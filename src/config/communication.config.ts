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
        enabled: toBool(env.VITE_COMM_EMAIL_ENABLED, false),
        testMode: toBool(env.VITE_COMM_EMAIL_TEST_MODE, true),
        testTo: env.VITE_COMM_EMAIL_TEST_TO || 'jhonnydp78@gmail.com',
        senderEmail: env.VITE_BREVO_SENDER_EMAIL || 'notificaciones@beto-os.com',
        senderName: env.VITE_BREVO_SENDER_NAME || 'BETO OS',
        timeoutMs: Number(env.VITE_COMM_EMAIL_TIMEOUT_MS) || 7000
    },

    whatsapp: {
        enabled: toBool(env.VITE_COMM_WHATSAPP_ENABLED, false),
        testMode: toBool(env.VITE_COMM_WHATSAPP_TEST_MODE, true),
        manualOnly: toBool(env.VITE_COMM_WHATSAPP_MANUAL_ONLY, true),
        providerEnabled: toBool(env.VITE_COMM_WHATSAPP_PROVIDER_ENABLED, false),
        testPhone: env.VITE_COMM_WHATSAPP_TEST_PHONE || env.VITE_WHATSAPP_TEST_NUMBER || '+34604405615',
        apiKey: env.VITE_WHATSAPP_API_KEY || '',
        phoneNumberId: env.VITE_WHATSAPP_PHONE_NUMBER_ID || '',
        businessAccountId: env.VITE_WHATSAPP_BUSINESS_ACCOUNT_ID || '',
        dailyCapPerUser: Number(env.VITE_COMM_WHATSAPP_DAILY_CAP_PER_USER) || 3,
        cooldownCriticalMinutes: Number(env.VITE_COMM_WHATSAPP_COOLDOWN_CRITICAL_MIN) || 120,
        whitelistEvents: (env.VITE_COMM_WHATSAPP_WHITELIST_EVENTS || 'SYSTEM_CRITICAL,BILLING_PAYMENT_FAILED').split(',').map(e => e.trim()).filter(Boolean)
    }
};
