import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  // SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically by the Supabase runtime.
  // Supabase CLI does not allow setting secrets starting with "SUPABASE_".
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

  if (!url || !anonKey || !serviceRoleKey) {
    return json(500, { error: "missing_env", message: "Missing Supabase env vars" });
  }

  let payload: { user_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }

  const targetUserId = String(payload?.user_id ?? "").trim();
  if (!targetUserId) {
    return json(400, { error: "missing_user_id" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json(401, { error: "unauthorized" });
  }

  const callerId = userData.user.id;
  if (callerId === targetUserId) {
    return json(400, { error: "cannot_delete_self" });
  }

  // Check caller is Admin (with user context)
  const { data: callerProfile, error: callerProfileErr } = await userClient
    .from("users_profile")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (callerProfileErr || !callerProfile || callerProfile.role !== "Admin") {
    return json(403, { error: "not_allowed" });
  }

  // Use service role for privileged reads + delete
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: targetProfile, error: targetProfileErr } = await adminClient
    .from("users_profile")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetProfileErr) {
    return json(500, { error: "target_lookup_failed", message: targetProfileErr.message });
  }

  if (targetProfile?.role === "Admin") {
    return json(400, { error: "cannot_delete_admin" });
  }

  const { error: delErr } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (delErr) {
    return json(500, { error: "delete_failed", message: delErr.message });
  }

  return json(200, { ok: true });
});
