/**
 * BETO OS — Email Templates Service
 * Genera el HTML y Texto Plano para las comunicaciones externas.
 * Sigue los tokens visuales de global.css (adaptados para email).
 */

const TOKENS = {
    primary: '#0066FF',
    neutral900: '#0F172A',
    neutral700: '#334155',
    neutral400: '#94A3B8',
    neutral100: '#F1F5F9',
    neutral50: '#F8FAFC',
    white: '#FFFFFF',
    radiusLg: '12px',
    shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
};

/**
 * Layout base para todos los correos de BETO OS.
 */
function getWrappedLayout(title: string, contentHtml: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${TOKENS.neutral50}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${TOKENS.neutral900};">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${TOKENS.neutral50}; padding: 48px 0;">
        <tr>
            <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: ${TOKENS.white}; border: 1px solid #E2E8F0; border-radius: ${TOKENS.radiusLg}; box-shadow: ${TOKENS.shadow}; overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 24px 32px; border-bottom: 1px solid #F1F5F9;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 32px; height: 32px; background: ${TOKENS.primary}; border-radius: 8px;"></div>
                                <span style="font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: ${TOKENS.neutral900};">BETO OS</span>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px;">
                            ${contentHtml}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 32px; background-color: ${TOKENS.neutral100}; border-top: 1px solid #E2E8F0;">
                            <p style="margin: 0; font-size: 12px; color: ${TOKENS.neutral400}; line-height: 1.5;">
                                Has recibido este correo porque tienes activadas las notificaciones en tu perfil de <a href="#" style="color: ${TOKENS.primary}; text-decoration: none; font-weight: 600;">BETO OS</a>.
                            </p>
                            <p style="margin: 8px 0 0; font-size: 11px; color: ${TOKENS.neutral400}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">
                                &copy; 2026 Inteligencia de Operaciones
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

export const emailTemplates = {
    /**
     * Sistema (genérico no crítico)
     */
    getSystemNotice(data: { title: string; message: string; actionUrl?: string }) {
        const html = getWrappedLayout(data.title, `
            <p style="margin: 0 0 16px; font-size: 15px; color: ${TOKENS.neutral700}; line-height: 1.6;">
                ${data.message}
            </p>
            ${data.actionUrl ? `
            <a href="${data.actionUrl}" style="display: inline-block; background-color: ${TOKENS.primary}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
                Ver detalles &rarr;
            </a>` : ``}
        `);
        const text = `
${data.title}
------------------------------------------
${data.message}
${data.actionUrl ? `Detalles: ${data.actionUrl}` : ''}
        `.trim();
        return { html, text, subject: `[BETO OS] ${data.title}` };
    },

    /**
     * Alerta de Inventario (HTML y Texto)
     */
    getInventoryAlert(data: { productName: string, type: string, message: string, actionUrl: string }) {
        const title = data.type === 'LOW_STOCK' ? 'Aviso de Stock Bajo' : 'Alerta de Inventario';
        
        const html = getWrappedLayout(title, `
            <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 800; color: ${TOKENS.neutral900};">${title}</h2>
            <p style="margin: 0 0 24px; font-size: 15px; color: ${TOKENS.neutral700}; line-height: 1.6;">
                Hola, hemos detectado una actividad en el inventario que requiere tu atención:
            </p>
            <div style="background-color: ${TOKENS.neutral50}; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: ${TOKENS.neutral400}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Producto</p>
                <p style="margin: 4px 0 12px; font-size: 16px; color: ${TOKENS.neutral900}; font-weight: 700;">${data.productName}</p>
                
                <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.5; color: ${TOKENS.neutral700};">
                    ${data.message}
                </p>
            </div>
            <a href="${data.actionUrl}" style="display: inline-block; background-color: ${TOKENS.primary}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
                Gestionar Inventario &rarr;
            </a>
        `);

        const text = `
BETO OS — ${title}
------------------------------------------
Producto: ${data.productName}
Mensaje: ${data.message}

Gestionar Inventario: ${data.actionUrl}
        `.trim();

        return { html, text, subject: `[BETO OS] ${title}: ${data.productName}` };
    },

    /**
     * Alerta Crítica del Sistema
     */
    getSystemCritical(data: { title: string, message: string }) {
        const html = getWrappedLayout(data.title, `
            <div style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 8px; padding: 16px; border-left: 4px solid #EF4444; margin-bottom: 20px;">
                <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 800; color: #991B1B;">${data.title}</h2>
                <p style="margin: 0; font-size: 14px; color: #B91C1C;">Este es un mensaje crítico del sistema y no puede ser deshabilitado.</p>
            </div>
            <p style="margin: 0; font-size: 15px; color: ${TOKENS.neutral700}; line-height: 1.6;">
                ${data.message}
            </p>
        `);

        const text = `
[MENSAJE CRÍTICO] BETO OS
------------------------------------------
${data.title}
${data.message}
        `.trim();

        return { html, text, subject: `⚠️ [CRÍTICO] ${data.title}` };
    },

    /**
     * Avisos de Billing
     */
    getBillingNotice(data: { title: string; message: string; actionUrl?: string }) {
        const html = getWrappedLayout(data.title, `
            <p style="margin: 0 0 16px; font-size: 15px; color: ${TOKENS.neutral700}; line-height: 1.6;">
                ${data.message}
            </p>
            ${data.actionUrl ? `
            <a href="${data.actionUrl}" style="display: inline-block; background-color: ${TOKENS.primary}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
                Revisar facturación &rarr;
            </a>` : ``}
        `);
        const text = `
${data.title}
------------------------------------------
${data.message}
${data.actionUrl ? `Revisar: ${data.actionUrl}` : ''}
        `.trim();
        return { html, text, subject: `[BETO OS] ${data.title}` };
    },

    /**
     * Avisos de Equipo
     */
    getTeamNotice(data: { title: string; message: string; actionUrl?: string }) {
        const html = getWrappedLayout(data.title, `
            <p style="margin: 0 0 16px; font-size: 15px; color: ${TOKENS.neutral700}; line-height: 1.6;">
                ${data.message}
            </p>
            ${data.actionUrl ? `
            <a href="${data.actionUrl}" style="display: inline-block; background-color: ${TOKENS.primary}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
                Ver detalle &rarr;
            </a>` : ``}
        `);
        const text = `
${data.title}
------------------------------------------
${data.message}
${data.actionUrl ? `Detalle: ${data.actionUrl}` : ''}
        `.trim();
        return { html, text, subject: `[BETO OS] ${data.title}` };
    }
};
