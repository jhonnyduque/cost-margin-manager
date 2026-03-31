import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as EmailRequest;

    if (!body?.to || !body?.subject || !body?.html) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields (to, subject, html)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const apiKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
    const senderName = Deno.env.get("BREVO_SENDER_NAME");

    if (!apiKey || !senderEmail || !senderName) {
      const missing = [
        !apiKey ? "BREVO_API_KEY" : null,
        !senderEmail ? "BREVO_SENDER_EMAIL" : null,
        !senderName ? "BREVO_SENDER_NAME" : null,
      ].filter(Boolean).join(", ");
      return new Response(JSON.stringify({ success: false, error: `Missing required secrets: ${missing}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: body.to }],
        subject: body.subject,
        htmlContent: body.html,
        textContent: body.text || "",
      }),
    });

    const providerResponse = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: providerResponse?.message || "Brevo error",
          providerResponse,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: providerResponse?.messageId || providerResponse?.message_id || null,
        providerResponse,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("[send-email] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
