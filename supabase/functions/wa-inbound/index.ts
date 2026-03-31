// Supabase Edge Function: wa-inbound (UltraMSG webhook)
// Receives incoming WhatsApp messages (text, image, voice/audio) and logs them to DB.
// Security: require a shared token via ?token=... (set ULTRAMSG_WEBHOOK_TOKEN in function env)
// Mapping order: match by agent_phone or customer_phone equal to sender number, prefer most recently updated.
// Env vars: use PROJECT_URL and SERVICE_ROLE_KEY (avoid reserved SUPABASE_* prefix)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  } as Record<string, string>;
}

function cleanPhone(v: unknown) {
  return String(v ?? "").replace(/[^0-9]/g, "");
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { return await req.json() as Record<string, unknown>; } catch { return {}; }
  }
  const txt = await req.text();
  try { return JSON.parse(txt); } catch {}
  const params = new URLSearchParams(txt);
  const obj: Record<string, unknown> = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const url = new URL(req.url);
    const token = url.searchParams.get("token") || req.headers.get("x-ultramsg-token") || "";
    const expected = Deno.env.get("ULTRAMSG_WEBHOOK_TOKEN") || "";
    if (!expected || token !== expected) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const SUPABASE_URL = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_config" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await parseBody(req);

    // Extract fields
    const fromRaw = body["from"] ?? body["sender"] ?? body["author"] ?? body["waId"] ?? body["chatId"] ?? "";
    const from = cleanPhone(fromRaw);
    const typeRaw = String(body["type"] ?? body["messageType"] ?? body["mediaType"] ?? "text");
    const text = String(body["body"] ?? body["message"] ?? "");
    const caption = String(body["caption"] ?? "");
    const mediaUrl = String(body["mediaUrl"] ?? body["image"] ?? body["audio"] ?? body["url"] ?? "");
    const durationSec = Number(body["duration"] ?? body["seconds"] ?? 0) || null;

    if (!from) {
      return new Response(JSON.stringify({ ok: false, error: "missing_from" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Determine message type
    let mType: 'text'|'image'|'audio' = 'text';
    const typeLower = typeRaw.toLowerCase();
    const hasMedia = Boolean(String(mediaUrl || '').trim());
    const hasCaption = Boolean(String(caption || '').trim());
    const isAudioHint = typeLower.includes('voice') || typeLower.includes('audio');
    const isImageHint = typeLower.includes('image') || Boolean(body["image"]) || Boolean(body["mediaUrl"]);

    if (isAudioHint) mType = 'audio';
    else if (isImageHint && hasMedia) mType = 'image';
    else if (hasMedia && hasCaption) mType = 'image';

    // Find matching order (prefer latest update)
    let orderId: number | null = null;
    let fromRole: 'agent'|'customer' = 'agent';

    // First: try exact match on stored value (when DB stores normalized digits)
    {
      const { data: rows } = await sb
        .from('orders')
        .select('id, agent_phone, customer_phone, page_phone, page_whatsapp, updated_at')
        .eq('agent_phone', from)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (rows && rows[0]) {
        orderId = rows[0].id as number;
        fromRole = 'agent';
      }
    }

    if (!orderId) {
      const { data: rows } = await sb
        .from('orders')
        .select('id, agent_phone, customer_phone, page_phone, page_whatsapp, updated_at')
        .eq('customer_phone', from)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (rows && rows[0]) {
        orderId = rows[0].id as number;
        fromRole = 'customer';
      }
    }

    if (!orderId) {
      const { data: rows } = await sb
        .from('orders')
        .select('id, agent_phone, customer_phone, page_phone, page_whatsapp, updated_at')
        .eq('page_phone', from)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (rows && rows[0]) {
        orderId = rows[0].id as number;
        fromRole = 'page' as any;
      }
    }

    if (!orderId) {
      const { data: rows } = await sb
        .from('orders')
        .select('id, agent_phone, customer_phone, page_phone, page_whatsapp, updated_at')
        .eq('page_whatsapp', from)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (rows && rows[0]) {
        orderId = rows[0].id as number;
        fromRole = 'page' as any;
      }
    }

    // Fallback: fetch recent orders and match by sanitized digits (handles +216 / leading zero / formatting)
    if (!orderId) {
      const lastDigits = from.slice(-9); // tolerate local storage formats
      const recentLimit = 200;
      const { data: recents } = await sb
        .from('orders')
        .select('id, agent_phone, customer_phone, page_phone, page_whatsapp, updated_at')
        .order('updated_at', { ascending: false })
        .limit(recentLimit);

      if (Array.isArray(recents)) {
        for (const r of recents) {
          const ap = cleanPhone((r as any).agent_phone);
          const cp = cleanPhone((r as any).customer_phone);
          const pp = cleanPhone((r as any).page_phone);
          const pw = cleanPhone((r as any).page_whatsapp);
          // exact or endsWith/startsWith checks on digits
          const agentMatch = ap && (ap === from || ap.endsWith(lastDigits) || from.endsWith(ap));
          const customerMatch = cp && (cp === from || cp.endsWith(lastDigits) || from.endsWith(cp));
          const pageMatch = (pp && (pp === from || pp.endsWith(lastDigits) || from.endsWith(pp)))
                         || (pw && (pw === from || pw.endsWith(lastDigits) || from.endsWith(pw)));
          if (agentMatch || customerMatch || pageMatch) {
            orderId = (r as any).id as number;
            fromRole = agentMatch ? 'agent' : (customerMatch ? 'customer' : ('page' as any));
            break;
          }
        }
      }
    }

    if (!orderId) {
      return new Response(JSON.stringify({ ok: false, error: "order_not_found_for_sender", sender: from }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Prepare message row
    const row: Record<string, unknown> = {
      order_id: orderId,
      type: mType,
      from_role: fromRole,
      created_at: new Date().toISOString(),
    };
    if (mType === 'text') row["text"] = text || caption || '';
    if (mType === 'image') {
      row["media_url"] = mediaUrl;
      const cap = caption || text || '';
      if (cap) row["text"] = cap;
    }
    if (mType === 'audio') {
      row["media_url"] = mediaUrl;
      if (durationSec) row["audio_duration_sec"] = durationSec;
    }

    const { error: insErr } = await sb.from('messages').insert([row]);
    if (insErr) {
      return new Response(JSON.stringify({ ok: false, error: insErr.message || String(insErr) }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (err) {
    const msg = (err as any)?.message || String(err) || 'unknown_error';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(null) },
    });
  }
});
