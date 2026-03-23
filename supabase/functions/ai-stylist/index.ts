import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, occasion, gender } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let genderContext = "";
    if (gender === "male") {
      genderContext = `Потребителят е мъж. Давай препоръки подходящи за мъже — мъжко облекло, мъжки прически, мъжки аксесоари. Избягвай типично женски предложения (рокли, поли, кок и др.) освен ако потребителят изрично не поиска.`;
    } else if (gender === "female") {
      genderContext = `Потребителката е жена. Давай препоръки подходящи за жени — дамско облекло, дамски прически, дамски аксесоари.`;
    } else {
      genderContext = `Полът на потребителя не е уточнен. Преди да дадеш конкретни препоръки за облекло или прическа, помоли потребителя да уточни пола си.`;
    }

    const systemPrompt = `Ти си AI стилист — персонален AI асистент за облекло и прически.
Отговаряй на български език.
Давай конкретни, персонални препоръки за облекло, прически и цялостни визии.
Бъди кратък, професионален и елегантен в тона си.
Предлагай конкретни стилови решения, подходящи цветове, кройки и прически.
${genderContext}
${occasion ? `Потребителят търси визия за повод: ${occasion}.` : ""}
Ако потребителят не е дал достатъчно информация, задай уточняващи въпроси.
Предлагай follow-up действия като: "Искате ли да видите още варианти?", "Да комбинирам с прическа?" и др.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Твърде много заявки. Моля, опитайте отново след малко." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Кредитите са изчерпани." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-stylist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
