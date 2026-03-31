import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Leer y validar el body con valores por defecto
    const body = await req.json();
    const company_id = body.company_id || null;
    const recipient = body.recipient || body.to;
    const channel = body.channel || 'email';
    const data = body.data || { 
      subject: body.subject || "Notificación de BETO OS", 
      message: body.message || "" 
    };

    if (!recipient) throw new Error("Falta el destinatario (recipient o to)");

    // 1. Obtener configuración de Brevo
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL');
    const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME');
    if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL || !BREVO_SENDER_NAME) {
      const missing = [
        !BREVO_API_KEY ? 'BREVO_API_KEY' : null,
        !BREVO_SENDER_EMAIL ? 'BREVO_SENDER_EMAIL' : null,
        !BREVO_SENDER_NAME ? 'BREVO_SENDER_NAME' : null
      ].filter(Boolean).join(', ');
      throw new Error(`Faltan secretos requeridos: ${missing}`);
    }

    let result;

    if (channel === 'email') {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
          to: [{ email: recipient }],
          subject: data.subject,
          htmlContent: data.htmlContent || `<h3>Hola</h3><p>${data.message}</p>`,
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error en Brevo: ${JSON.stringify(errorData)}`);
      }
      
      result = await response.json();
    } else if (channel === 'whatsapp') {
      result = { message: "WhatsApp channel integration coming soon" };
    }

    // 2. Loggear en la base de datos (Solo si hay company_id)
    if (company_id) {
      await supabaseClient.from('communication_logs').insert({
        company_id,
        recipient_email: channel === 'email' ? recipient : null,
        recipient_phone: channel === 'whatsapp' ? recipient : null,
        channel,
        status: 'sent',
        content_preview: data.subject || data.message
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error en function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
