import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2022-11-15",
    httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

console.log("Stripe Webhook Handler initialized");

serve(async (req) => {
    try {
        const signature = req.headers.get("Stripe-Signature");
        const body = await req.text();
        const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

        if (!signature || !webhookSecret) {
            return new Response("Missing signature or secret", { status: 400 });
        }

        let event;
        try {
            event = await stripe.webhooks.constructEventAsync(
                body,
                signature,
                webhookSecret,
                undefined,
                cryptoProvider
            );
        } catch (err) {
            console.error(`⚠️  Webhook signature verification failed.`, err.message);
            return new Response(err.message, { status: 400 });
        }

        // 1. Idempotencia: Verificar si ya procesamos este evento
        const { data: existingEvent } = await supabaseAdmin
            .from("subscription_events")
            .select("status")
            .eq("stripe_event_id", event.id)
            .single();

        if (existingEvent && existingEvent.status === "processed") {
            console.log(`Event ${event.id} already processed.`);
            return new Response(JSON.stringify({ received: true }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // 2. Persistir evento en DB
        // Intentamos buscar company_id si viene en el objeto (customer id)
        // Nota: Esto es un best-effort, la lógica real de negocio busca por stripe_customer_id
        await supabaseAdmin.from("subscription_events").insert({
            stripe_event_id: event.id,
            event_type: event.type,
            payload: event,
            status: "pending",
        });

        // 3. Procesar lógica de negocio
        try {
            switch (event.type) {
                case "customer.subscription.updated":
                case "customer.subscription.created":
                    await handleSubscriptionChange(event.data.object);
                    break;
                case "customer.subscription.deleted":
                    await handleSubscriptionDeleted(event.data.object);
                    break;
                case "invoice.payment_succeeded":
                    await handlePaymentSucceeded(event.data.object);
                    break;
                case "invoice.payment_failed":
                    await handlePaymentFailed(event.data.object);
                    break;
                default:
                    console.log(`Unhandled event type ${event.type}`);
            }

            // Marcar como procesado
            await supabaseAdmin
                .from("subscription_events")
                .update({ status: "processed", processed_at: new Date().toISOString() })
                .eq("stripe_event_id", event.id);

        } catch (processError) {
            console.error("Processing error:", processError);
            await supabaseAdmin
                .from("subscription_events")
                .update({
                    status: "failed",
                    error_message: processError.message
                })
                .eq("stripe_event_id", event.id);

            // Retornar 200 para que Stripe no reintente infinitamente si es error lógico nuestro
            // O retornar 500 si queremos reintentos. Decisión: 200 y loguear error en DB.
            return new Response(JSON.stringify({ error: processError.message }), { status: 200 });
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error(err);
        return new Response(err.message, { status: 500 });
    }
});

// --- HELPERS ---

async function handleSubscriptionChange(subscription: any) {
    const customerId = subscription.customer;
    const status = subscription.status;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;

    // Mapear status de Stripe a nuestro enum
    // Stripe: active, past_due, unpaid, canceled, incomplete, incomplete_expired, trialing
    // CostManager: trialing, active, past_due, suspended, canceled

    let appStatus = status;
    if (status === 'unpaid') appStatus = 'past_due';
    if (status === 'incomplete') appStatus = 'past_due';
    if (status === 'incomplete_expired') appStatus = 'canceled';

    await updateCompanyByStripeId(customerId, {
        subscription_status: appStatus,
        stripe_subscription_id: subscription.id,
        current_period_ends_at: currentPeriodEnd.toISOString(),
        trial_ends_at: trialEnd?.toISOString(),
        cancel_at_period_end: cancelAtPeriodEnd
    });
}

async function handleSubscriptionDeleted(subscription: any) {
    await updateCompanyByStripeId(subscription.customer, {
        subscription_status: 'canceled',
        cancel_at_period_end: false,
        current_period_ends_at: new Date().toISOString() // Terminó ahora
    });
}

async function handlePaymentSucceeded(invoice: any) {
    if (invoice.billing_reason === 'subscription_create') return; // Ya manejado por subscription.created

    const customerId = invoice.customer;

    // Pago exitoso -> Active y limpiar gracia
    await updateCompanyByStripeId(customerId, {
        subscription_status: 'active',
        grace_period_ends_at: null
    });
}

async function handlePaymentFailed(invoice: any) {
    const customerId = invoice.customer;

    // Calcular Grace Period (ej: 7 días desde hoy)
    const gracePeriodDays = 7;
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);

    await updateCompanyByStripeId(customerId, {
        subscription_status: 'past_due',
        grace_period_ends_at: graceEnd.toISOString()
    });

    // Aquí podríamos enviar email de fallo de pago (Fase 4: Notificaciones)
}

async function updateCompanyByStripeId(stripeCustomerId: string, updates: any) {
    const { error } = await supabaseAdmin
        .from('companies')
        .update(updates)
        .eq('stripe_customer_id', stripeCustomerId);

    if (error) {
        console.error(`Error updating company ${stripeCustomerId}:`, error);
        throw error;
    }

    // Log billing action (Simplified)
    // En producción buscaríamos el ID de la company primero para loguear con company_id
}
