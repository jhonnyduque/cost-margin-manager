/**
 * BETO OS — WhatsApp Templates Service
 * Genera mensajes de texto enriquecidos (Markdown de WhatsApp) y Emojis.
 */

export const whatsappTemplates = {
    /**
     * Alerta de Inventario Crítica
     */
    getInventoryCritical(data: { productName: string, message: string, baseUrl?: string }) {
        const baseUrl = data.baseUrl || '';
        const text = `
📦 *BETO OS: Alerta de Inventario*
---------------------------------------
⚠️ *STOCK CRÍTICO:* El producto *${data.productName}* requiere atención inmediata.

📝 ${data.message}

🔗 Gestionar: ${baseUrl || 'https://app.beto-os.com'}/stock
        `.trim();
        
        return { text, priority: 'high' };
    },

    /**
     * Billing / Suscripción (Urgente)
     */
    getBillingAlert(data: { title: string, message: string, baseUrl?: string }) {
        const baseUrl = data.baseUrl || '';
        const text = `
💳 *BETO OS: Facturación*
---------------------------------------
🔔 *${data.title}*

${data.message}

⚙️ Revisar cuenta: ${baseUrl || 'https://app.beto-os.com'}/settings/billing
        `.trim();

        return { text, priority: 'critical' };
    },

    /**
     * Mensaje Crítico del Sistema
     */
    getSystemCritical(data: { title: string, message: string }) {
        const text = `
🚨 *BETO OS: SISTEMA*
---------------------------------------
🔥 *AVISO CRÍTICO:* ${data.title}

${data.message}

🛑 Este es un mensaje automático no silenciable.
        `.trim();

        return { text, priority: 'critical' };
    }
};
