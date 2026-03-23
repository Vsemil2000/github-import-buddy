import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { imageBase64, gender } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const genderText = gender === "male" ? "мъж" : "жена";
    const { mimeType, base64 } = parseDataUrl(imageBase64);

    const systemPrompt = `Ти си професионален AI-стилист. Анализирай снимката на ${genderText} и предложи точно 3 варианта на стилове на облекло. За всеки стил посочи: име на стила, подробно описание какви дрехи да облече (горна част, долна част, обувки, аксесоари), какви цветове подхождат. Отговорът СТРОГО в JSON формат без markdown:
[
  {
    "name": "Име на стила",
    "description": "Описание: какви дрехи да облече, цветове, детайли",
    "items": ["дреха 1", "дреха 2", "дреха 3", "дреха 4"],
    "colors": ["цвят 1", "цвят 2", "цвят 3"]
  }
]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            parts: [
              { text: `Анализирай външността на този човек (${genderText}) и предложи 3 стила на облекло.` },
              { inlineData: { mimeType, data: base64 } }
            ]
          }],
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
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const styles = JSON.parse(content);

    return new Response(JSON.stringify({ styles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-style error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
