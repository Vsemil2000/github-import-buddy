import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, gender } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const genderText = gender === "male" ? "мъж" : "жена";

    const maleCategories = `Къса мъжка прическа, Класическа прическа, Модерна прическа, Fade стил, Подредена бизнес визия, Небрежна визия, По-дълга мъжка прическа`;
    const femaleCategories = `Къса прическа, Средна дължина, Дълга прическа, Права коса, Къдрава коса, Официална прическа, Модерна прическа, Ежедневна прическа`;
    const categories = gender === "male" ? maleCategories : femaleCategories;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Ти си професионален AI-стилист на прически. Анализирай снимката на ${genderText} — формата на лицето, текстурата на косата, цвета и дължината. Предложи точно 3 подходящи прически. Категориите прически за ${genderText} включват: ${categories}.

За всяка прическа посочи: име, категория, описание на прическата, защо подхожда на лицето и стила на човека, съвети за поддръжка. Отговорът СТРОГО в JSON формат без markdown:
[
  {
    "name": "Име на прическата",
    "category": "Категория",
    "description": "Подробно описание на прическата — дължина, форма, стайлинг",
    "whySuitable": "Защо подхожда на формата на лицето и стила",
    "maintenanceTips": "Съвети за поддръжка"
  }
]`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Анализирай лицето и косата на този ${genderText} и предложи 3 подходящи прически.` },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Твърде много заявки, опитайте по-късно." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Недостатъчно средства за AI заявки." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const hairstyles = JSON.parse(content);

    return new Response(JSON.stringify({ hairstyles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-hairstyle error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
