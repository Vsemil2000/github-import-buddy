import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) return { mimeType: match[1], base64: match[2] };
  return { mimeType: "image/jpeg", base64: dataUrl };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, hairstyleDescription, hairstyleName, gender } = await req.json();
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

    const genderText = gender === "male" ? "мъж" : "жена";
    const { mimeType, base64 } = parseDataUrl(imageBase64);

    console.log("[generate-hairstyle] Request received, user:", user.id, "hairstyle:", hairstyleName);
    console.log("[generate-hairstyle] Image base64 length:", base64.length, "mimeType:", mimeType);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `ABSOLUTE PRIORITY: You MUST preserve the person's face with 100% accuracy — same exact eyes, nose, mouth, jawline, eyebrows, skin texture, skin tone, facial proportions, and all unique facial features. Do NOT alter, beautify, age, or modify the face in ANY way. The face must be identical to the reference photo.\n\nGenerate EXACTLY ONE person in the image — the same person from the reference photo. Do NOT add any other people.\n\nKeep their exact body type, skin tone, and proportions. Only change their hairstyle to "${hairstyleName}": ${hairstyleDescription}. The hairstyle must look natural and realistic on this person. Use the same pose and a clean neutral background. The person is ${genderText}. Output only one single photorealistic image with one single person.`
              },
              { inlineData: { mimeType, data: base64 } }
            ]
          }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
        }),
      }
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("[generate-hairstyle] Gemini API error:", response.status, t.slice(0, 1000));
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Твърде много заявки, опитайте по-късно." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Gemini API error ${response.status}: ${t.slice(0, 200)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("[generate-hairstyle] Gemini response candidates:", data.candidates?.length, "finishReason:", data.candidates?.[0]?.finishReason);
    const parts = data.candidates?.[0]?.content?.parts || [];
    console.log("[generate-hairstyle] Parts count:", parts.length, "types:", parts.map((p: any) => p.inlineData ? "image" : "text").join(","));
    const imagePart = parts.find((p: any) => p.inlineData);
    if (!imagePart) {
      const textPart = parts.find((p: any) => p.text);
      console.error("[generate-hairstyle] No image in response. Text:", textPart?.text?.slice(0, 500));
      return new Response(JSON.stringify({ error: "Gemini не генерира изображение. " + (textPart?.text?.slice(0, 100) || "") }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageBytes = Uint8Array.from(atob(imagePart.inlineData.data), c => c.charCodeAt(0));
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
      image_type: "hairstyle",
      style_name: hairstyleName,
    });

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ imageUrl: publicUrlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-hairstyle error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
