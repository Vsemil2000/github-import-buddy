import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseDataUrl(url: string): { mimeType: string; base64: string } | null {
  const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) return { mimeType: match[1], base64: match[2] };
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fittingImageUrl, styleDescription, styleName, items } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const itemsList = items.join(", ");

    // For flatlay, the fittingImageUrl may be a public URL, so we need to fetch and convert
    let imageParts: any[];
    const parsed = parseDataUrl(fittingImageUrl);
    if (parsed) {
      imageParts = [{ inlineData: { mimeType: parsed.mimeType, data: parsed.base64 } }];
    } else {
      // Fetch the image from URL and convert to base64
      const imgResponse = await fetch(fittingImageUrl);
      const imgBuffer = await imgResponse.arrayBuffer();
      const imgBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
      const contentType = imgResponse.headers.get("content-type") || "image/png";
      imageParts = [{ inlineData: { mimeType: contentType, data: imgBase64 } }];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Look at this image of a person wearing an outfit in style "${styleName}". Extract EXACTLY the clothing items shown on the person in this image and generate a flat lay photo on a clean white background. Show each clothing item from the image separately, neatly arranged as a fashion magazine flatlay. The items should be: ${itemsList}. Make sure the items match EXACTLY what the person is wearing in the photo - same colors, same styles, same fabrics. High quality, photorealistic.`
              },
              ...imageParts
            ]
          }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
        }),
      }
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Твърде много заявки, опитайте по-късно." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p: any) => p.inlineData);
    if (!imgPart) throw new Error("No image generated");

    const imageBytes = Uint8Array.from(atob(imgPart.inlineData.data), c => c.charCodeAt(0));
    const fileName = `${user.id}/${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(fileName, imageBytes, { contentType: "image/png" });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("generated-images")
      .getPublicUrl(fileName);

    const { error: dbError } = await supabase.from("generated_images").insert({
      user_id: user.id,
      image_url: publicUrlData.publicUrl,
      image_type: "flatlay",
      style_name: styleName,
    });

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ imageUrl: publicUrlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-flatlay error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
