/**
 * Comunicación BETO OS — Config centralizada de canales (Fase 2-C base)
 *
 * Usa variables Vite (import.meta.env) con defaults seguros orientados a mock.
 * No activa proveedores productivos; deja flags claros y concentrados.
 */

const env = import.meta.env;

const toBool = (val: any, fallback = false) => {
    if (val === undefined || val === null) return fallback;
    if (typeof val === 'boolean') return val;
    const s = String(val).toLowerCase().trim();
    return s === '1' || s === 'true' || s === 'yes';
};

export const communicationConfig = {
    baseUrl: env.VITE_COMM_BASE_URL || 'https://app.beto-os.com',

    email: {
        enabled: toBool(env.VITE_COMM_EMAIL_ENABLED, true),
        // Fase real controlada: testMode por defecto en false. Usa testTo solo si se activa expresamente.
        testMode: toBool(env.VITE_COMM_EMAIL_TEST_MODE, false),
        testTo: env.VITE_COMM_EMAIL_TEST_TO || '',
        senderEmail: env.VITE_BREVO_SENDER_EMAIL || 'notificaciones@beto-os.com',
        senderName: env.VITE_BREVO_SENDER_NAME || 'BETO OS',
        timeoutMs: Number(env.VITE_COMM_EMAIL_TIMEOUT_MS) || 7000
    },

    whatsapp: {
        enabled: toBool(env.VITE_COMM_WHATSAPP_ENABLED, true),
        // Fase real controlada: provider ON, testMode OFF, manualOnly OFF por defecto.
        testMode: toBool(env.VITE_COMM_WHATSAPP_TEST_MODE, false),
        manualOnly: toBool(env.VITE_COMM_WHATSAPP_MANUAL_ONLY, false),
        providerEnabled: toBool(env.VITE_COMM_WHATSAPP_PROVIDER_ENABLED, true),
        testPhone: env.VITE_COMM_WHATSAPP_TEST_PHONE || env.VITE_WHATSAPP_TEST_NUMBER || '',
        apiKey: env.VITE_WHATSAPP_API_KEY || '',
        phoneNumberId: env.VITE_WHATSAPP_PHONE_NUMBER_ID || '',
        businessAccountId: env.VITE_WHATSAPP_BUSINESS_ACCOUNT_ID || '',
        dailyCapPerUser: Number(env.VITE_COMM_WHATSAPP_DAILY_CAP_PER_USER) || 3,
        cooldownCriticalMinutes: Number(env.VITE_COMM_WHATSAPP_COOLDOWN_CRITICAL_MIN) || 120,
        whitelistEvents: (env.VITE_COMM_WHATSAPP_WHITELIST_EVENTS || 'SYSTEM_CRITICAL,BILLING_PAYMENT_FAILED').split(',').map(e => e.trim()).filter(Boolean)
    }
};
