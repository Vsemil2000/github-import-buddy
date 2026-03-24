import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LegacyProfileRow = {
  user_id: string;
  email: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await adminClient.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function migrateLegacyData(
  adminClient: ReturnType<typeof createClient>,
  oldUserId: string,
  newUserId: string,
  email: string
) {
  const updates = [
    adminClient.from("profiles").update({ user_id: newUserId, email }).eq("user_id", oldUserId),
    adminClient.from("style_profiles").update({ user_id: newUserId }).eq("user_id", oldUserId),
    adminClient.from("generated_images").update({ user_id: newUserId }).eq("user_id", oldUserId),
    adminClient.from("payments").update({ user_id: newUserId }).eq("user_id", oldUserId),
  ];

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw failed.error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return jsonResponse({ error: "Email and password are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(supabaseUrl, anonKey);

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingAuthUser = await findAuthUserByEmail(adminClient, normalizedEmail);
    if (existingAuthUser) {
      return jsonResponse({
        recovered: false,
        error: "Този акаунт вече съществува. Проверете паролата си.",
      }, 409);
    }

    const { data: legacyProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("user_id, email")
      .eq("email", normalizedEmail)
      .maybeSingle<LegacyProfileRow>();

    if (profileError) {
      return jsonResponse({ recovered: false, error: profileError.message }, 500);
    }

    if (!legacyProfile?.user_id) {
      return jsonResponse({ recovered: false, error: "Стар профил не беше намерен" }, 404);
    }

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: String(password),
      email_confirm: true,
    });

    if (createError || !createdUser.user) {
      return jsonResponse({ recovered: false, error: createError?.message || "Неуспешно създаване на акаунт" }, 500);
    }

    await migrateLegacyData(adminClient, legacyProfile.user_id, createdUser.user.id, normalizedEmail);

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: normalizedEmail,
      password: String(password),
    });

    if (signInError || !signInData.session) {
      return jsonResponse({ recovered: false, error: signInError?.message || "Неуспешен вход след възстановяване" }, 500);
    }

    return jsonResponse({
      recovered: true,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    });
  } catch (error) {
    return jsonResponse(
      {
        recovered: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      500
    );
  }
});