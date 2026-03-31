// Supabase Edge Function: wa-send (UltraMSG)
// Usage:
//   POST JSON { to: string, type?: 'text'|'image'|'audio', body?: string, mediaUrl?: string, caption?: string }
//   - text: requires body
//   - image: requires mediaUrl (caption optional)
//   - audio: requires mediaUrl
// Secrets required: ULTRAMSG_API_URL (e.g. https://api.ultramsg.com/instanceXXXX/), ULTRAMSG_TOKEN

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-client, x-supabase-client-info, x-supabase-client-name, x-supabase-client-version, x-supabase-client-platform",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  } as Record<string, string>;
}

function normalizeTo(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/@g\.us$/i.test(s)) return s;
  if (/@c\.us$/i.test(s)) return s.replace(/[^0-9]/g, "");
  return s.replace(/[^0-9]/g, "");
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

    const ULTRAMSG_API_URL = Deno.env.get("ULTRAMSG_API_URL") || "";
    const ULTRAMSG_TOKEN = Deno.env.get("ULTRAMSG_TOKEN") || "";
    if (!ULTRAMSG_API_URL || !ULTRAMSG_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "missing_ultramsg_config" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const input = await req.json().catch(() => ({}));
    const toRaw = input?.to as string | undefined;
    const typeRaw = (input?.type as string | undefined) ?? 'text';
    const body = (input?.body as string | undefined) ?? "";
    const mediaUrl = (input?.mediaUrl as string | undefined) ?? "";
    const caption = (input?.caption as string | undefined) ?? "";

    const to = normalizeTo(toRaw);
    if (!to) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_to" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const type = ["text","image","audio"].includes(typeRaw) ? typeRaw : 'text';

    let endpoint = "";
    let form = new URLSearchParams({ token: ULTRAMSG_TOKEN, to });
    if (type === 'text') {
      if (!body.trim()) {
        return new Response(JSON.stringify({ ok: false, error: "invalid_body" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      endpoint = "messages/chat";
      form.set('body', body);
    } else if (type === 'image') {
      if (!mediaUrl.trim()) {
        return new Response(JSON.stringify({ ok: false, error: "invalid_media_url" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      endpoint = "messages/image";
      form.set('image', mediaUrl);
      if (caption) form.set('caption', caption);
    } else if (type === 'audio') {
      if (!mediaUrl.trim()) {
        return new Response(JSON.stringify({ ok: false, error: "invalid_media_url" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      // UltraMSG voice note/audio endpoint
      // Some instances use messages/voice with 'audio' param; others may use messages/audio.
      // We'll try messages/voice by default.
      endpoint = "messages/voice";
      form.set('audio', mediaUrl);
    }

    const url = new URL(endpoint, ULTRAMSG_API_URL);
    const trace: Array<Record<string, unknown>> = [];
    let resp = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    try { const t = await resp.clone().text(); trace.push({ step: 'primary', endpoint, status: resp.status, ok: resp.ok, text: t.slice(0, 300) }); } catch {}

    // Fallback: some UltraMSG instances use messages/audio instead of messages/voice
    if (!resp.ok && type === 'audio' && endpoint === 'messages/voice') {
      const url2 = new URL('messages/audio', ULTRAMSG_API_URL);
      resp = await fetch(url2.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      try { const t2 = await resp.clone().text(); trace.push({ step: 'fallback_audio', endpoint: 'messages/audio', status: resp.status, ok: resp.ok, text: t2.slice(0, 300) }); } catch {}
    }
    // Second fallback: send as document (e.g., for .webm audio) so WhatsApp receives it as a file
    if (!resp.ok && type === 'audio') {
      const fileName = (() => {
        try {
          const u = new URL(mediaUrl);
          const last = u.pathname.split('/').filter(Boolean).pop() || 'audio.webm';
          return last;
        } catch {
          return 'audio.webm';
        }
      })();
      const formDoc = new URLSearchParams({ token: ULTRAMSG_TOKEN, to });
      formDoc.set('document', mediaUrl);
      formDoc.set('filename', fileName);
      const url3 = new URL('messages/document', ULTRAMSG_API_URL);
      resp = await fetch(url3.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formDoc.toString(),
      });
      try { const t3 = await resp.clone().text(); trace.push({ step: 'fallback_document', endpoint: 'messages/document', status: resp.status, ok: resp.ok, text: t3.slice(0, 300) }); } catch {}
    }

    const txt = await resp.text();
    let data: unknown;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
    const anyData = data as Record<string, unknown>;

    if (!resp.ok) {
      const errMsg = String(anyData?.error || anyData?.message || (typeof anyData?.raw === 'string' ? anyData?.raw : '') || `status_${resp.status}`);
      return new Response(JSON.stringify({ ok: false, status: resp.status, error: errMsg, data, trace }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // UltraMSG typically returns { sent: true, ... } or similar
    let sent = Boolean(anyData?.sent ?? anyData?.success ?? anyData?.status === "success");
    if (!sent && type === 'audio') {
      // If audio failed even with 2xx, try sending as document as a last resort (Chrome .webm)
      const fileName = (() => {
        try {
          const u = new URL(mediaUrl);
          const last = u.pathname.split('/').filter(Boolean).pop() || 'audio.webm';
          return last;
        } catch {
          return 'audio.webm';
        }
      })();
      const formDoc = new URLSearchParams({ token: ULTRAMSG_TOKEN, to });
      formDoc.set('document', mediaUrl);
      formDoc.set('filename', fileName);
      const url3 = new URL('messages/document', ULTRAMSG_API_URL);
      const respDoc = await fetch(url3.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formDoc.toString(),
      });
      try { const tDoc = await respDoc.clone().text(); trace.push({ step: 'fallback_document_after_2xx', endpoint: 'messages/document', status: respDoc.status, ok: respDoc.ok, text: tDoc.slice(0, 300) }); } catch {}
      const txtDoc = await respDoc.text();
      let dataDoc: unknown;
      try { dataDoc = JSON.parse(txtDoc); } catch { dataDoc = { raw: txtDoc }; }
      const anyDoc = dataDoc as Record<string, unknown>;
      sent = Boolean(anyDoc?.sent ?? anyDoc?.success ?? anyDoc?.status === 'success');
      if (!sent) {
        const errMsg = String(anyDoc?.error || anyDoc?.message || (typeof anyDoc?.raw === 'string' ? anyDoc?.raw : '') || `status_${respDoc.status}`);
        return new Response(JSON.stringify({ ok: false, error: errMsg, data: anyDoc, trace }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
    }

    if (!sent) {
      const errMsg = String(anyData?.error || anyData?.message || (typeof anyData?.raw === 'string' ? anyData?.raw : '') || 'ultramsg_not_sent');
      return new Response(JSON.stringify({ ok: false, error: errMsg, data: anyData, trace }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify({ ok: true, data, trace }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err || "unknown_error") }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(null) },
    });
  }
});
