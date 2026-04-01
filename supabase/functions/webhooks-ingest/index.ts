import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Channel = "whatsapp" | "email";
type NormalizedStatus = "sent" | "delivered" | "read" | "error";

interface NormalizedEvent {
  channel: Channel;
  status: NormalizedStatus;
  messageId?: string;
  eventType?: string;
  destination?: string | null;
  reason?: string | null;
  raw: any;
}

function normalize(body: any): NormalizedEvent | null {
  const provider = (body?.provider || body?.channel || body?.source || "").toLowerCase();
  const channel: Channel | null = provider.includes("whatsapp") ? "whatsapp" : provider.includes("email") ? "email" : null;

  // Allow explicit query override (e.g., ?provider=whatsapp)
  const hintedChannel = (body?.queryChannel as string | undefined)?.toLowerCase();
  const finalChannel = (hintedChannel === "whatsapp" || hintedChannel === "email") ? hintedChannel : channel;
  if (!finalChannel) return null;

  // Meta webhook (WhatsApp)
  if (finalChannel === "whatsapp") {
    const entry = body?.entry?.[0]?.changes?.[0]?.value || body;
    const statusObj = Array.isArray(entry?.statuses) ? entry.statuses[0]
      : Array.isArray(body?.statuses) ? body.statuses[0]
      : null;

    const statusRaw = (statusObj?.status || entry?.status || body?.status || "").toLowerCase();
    const status: NormalizedStatus = statusRaw === "read" ? "read" : statusRaw === "delivered" ? "delivered" : statusRaw === "failed" ? "error" : "sent";

    const messageId = statusObj?.id
      || entry?.message_id
      || body?.message_id
      || body?.id;

    const destination = statusObj?.recipient_id
      || entry?.to
      || body?.to;

    const reason = statusObj?.errors?.[0]?.title
      || statusObj?.errors?.[0]?.code
      || body?.error
      || body?.reason
      || null;

    return { channel: finalChannel, status, messageId: messageId || undefined, destination: destination || null, reason, raw: body };
  }

  // Brevo email webhook
  if (finalChannel === "email") {
    const event = (body?.event || body?.type || "").toLowerCase();
    let status: NormalizedStatus = "sent";
    if (["delivered"].includes(event)) status = "delivered";
    else if (["opened", "open", "read"].includes(event)) status = "read";
    else if (["soft_bounce", "hard_bounce", "bounce", "spam", "blocked", "invalid_email", "error"].includes(event)) status = "error";
    const reason = body?.reason || body?.message || body?.tag || null;
    const messageId = body?.message_id || body?.messageId || body?.id;
    const destination = body?.email || body?.to;
    return { channel: finalChannel, status, messageId: messageId || undefined, destination: destination || null, reason, raw: body };
  }

  return null;
}

serve(async (req) => {
  // --- GET: Meta webhook verification ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";

    if (mode === "subscribe" && token && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};

    // Allow provider hint via query param
    const url = new URL(req.url);
    if (url.searchParams.get("provider")) body.queryChannel = url.searchParams.get("provider");

    const evt = normalize(body);
    if (!evt) {
      return new Response(JSON.stringify({ error: "Unsupported or unrecognized webhook payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Idempotencia por messageId+channel cuando exista
    if (evt.messageId) {
      const { data: existing, error: findError } = await supabase
        .from("delivery_logs")
        .select("id")
        .eq("channel", evt.channel)
        .eq("provider_response->>message_id", evt.messageId)
        .maybeSingle();

      if (!findError && existing?.id) {
        const { error: updError } = await supabase
          .from("delivery_logs")
          .update({
            status: evt.status,
            error_message: evt.status === "error" ? evt.reason : null,
            metadata: {
              _meta: {
                reason: evt.reason || null,
              },
              message_id: evt.messageId,
            },
            provider_response: evt.raw,
          })
          .eq("id", existing.id);

        if (updError) throw updError;

        return new Response(JSON.stringify({ success: true, id: existing.id, updated: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const { error: insertError, data: inserted } = await supabase.from("delivery_logs").insert({
      user_id: null,
      company_id: null,
      channel: evt.channel,
      event_type: body?.event_type || "webhook_status",
      status: evt.status,
      destination: evt.destination || null,
      error_message: evt.status === "error" ? evt.reason : null,
      metadata: {
        _meta: {
          reason: evt.reason || null,
        },
        message_id: evt.messageId
          || body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.id
          || body?.message_id
          || null,
      },
      provider_response: evt.raw,
    }).select("id").maybeSingle();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, id: inserted?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[webhooks-ingest] Error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
