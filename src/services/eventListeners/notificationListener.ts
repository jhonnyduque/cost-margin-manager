import { supabase } from '../supabase';
import { EVENTS } from '../../core/events';
import { notificationService } from '../notificationService';

export const notificationListener = {
    /**
     * Inicializa la escucha del Event Bus para generar notificaciones.
     * En una app frontend, esto suele llamarse una vez al inicio.
     */
    start() {
        // Listener inicializado silenciosamente

        return supabase
            .channel('event_bus_notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'event_bus'
                },
                async (payload) => {
                    await this.handleEvent(payload.new);
                }
            )
            .subscribe();
    },

    /**
     * Procesa un evento del bus y decide si genera una notificación.
     */
    async handleEvent(event: any) {
        const { event_key, company_id, user_id, priority, payload } = event;

        // ── Filtrado por Preferencias ──
        // Si el evento tiene un destinatario específico, validamos sus preferencias.
        // Si es GLOBAL (sin user_id), permitimos que continúe para que se cree la notificación global.
        if (user_id) {
            const allowed = await notificationService.shouldNotify(user_id, event_key, 'in_app');
            if (!allowed) {
                console.log(`[NotificationListener] Evento ${event_key} filtrado por preferencias del usuario ${user_id}`);
                return;
            }
        }

        // Map Event Bus priority to Notification Level
        let notificationLevel: 'info' | 'warning' | 'error' = 'info';
        if (priority === 'critical' || priority === 'high') {
            notificationLevel = 'error';
        } else if (priority === 'medium') {
            switch (event_key) {
                // Some events are naturally warnings even on medium priority
                case EVENTS.INVENTORY_LOW_STOCK:
                case EVENTS.INVENTORY_COST_DEVIATION:
                case EVENTS.TEAM_SEAT_LIMIT_REACHED:
                case EVENTS.SYSTEM_MAINTENANCE:
                    notificationLevel = 'warning';
                    break;
                case EVENTS.BILLING_PAYMENT_FAILED:
                case EVENTS.SYSTEM_ERROR:
                    notificationLevel = 'error';
                    break;
                default:
                    notificationLevel = 'info';
            }
        } else if (priority === 'low') {
            notificationLevel = 'info';
        }

        switch (event_key) {
            // ── Inventario ──
            case EVENTS.INVENTORY_LOW_STOCK:
                await notificationService.createNotification({
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'company',
                    level: notificationLevel,
                    title: 'Stock Bajo Detectado',
                    message: `El producto ${payload.productName || 'desconocido'} ha caído por debajo del umbral mínimo.`,
                    actionUrl: '/inventory',
                    data: payload
                });
                break;

            case EVENTS.INVENTORY_COST_DEVIATION:
                await notificationService.createNotification({
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'company',
                    level: notificationLevel,
                    title: 'Desviación de Costo Detectada',
                    message: `El material ${payload.materialName || 'desconocido'} presenta una variación de costo de ${payload.deviation || 'N/A'}%.`,
                    actionUrl: '/materias-primas',
                    data: payload
                });
                break;

            // ── Billing ──
            case EVENTS.BILLING_PAYMENT_FAILED:
                await notificationService.createNotification({
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'company',
                    level: notificationLevel,
                    title: 'Error en Pago',
                    message: 'No pudimos procesar tu último pago. Revisa tu cuenta de facturación.',
                    actionUrl: '/settings/billing',
                    data: payload
                });
                break;

            case EVENTS.BILLING_SUBSCRIPTION_RENEWED:
                await notificationService.createNotification({
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'company',
                    level: notificationLevel,
                    title: 'Suscripción Renovada',
                    message: `Tu plan ${payload.planName || ''} ha sido renovado exitosamente.`,
                    data: payload
                });
                break;

            case EVENTS.BILLING_INVOICE_READY:
                await notificationService.createNotification({
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'company',
                    level: notificationLevel,
                    title: 'Factura Disponible',
                    message: `Tu factura de ${payload.period || 'este período'} está lista para descargar.`,
                    actionUrl: '/settings/billing',
                    data: payload
                });
                break;

            // ── Team ──
            case EVENTS.TEAM_USER_INVITED:
                await notificationService.createNotification({
                    userId: user_id,
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'user',
                    level: notificationLevel,
                    title: 'Invitación Enviada',
                    message: `Has invitado a ${payload.email} a la empresa.`,
                    actionUrl: '/equipo',
                    data: payload
                });
                break;

            case EVENTS.TEAM_USER_JOINED:
                await notificationService.createNotification({
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'company',
                    level: notificationLevel,
                    title: 'Nuevo Miembro',
                    message: `${payload.userName || payload.email || 'Un usuario'} se ha unido al equipo.`,
                    actionUrl: '/equipo',
                    data: payload
                });
                break;

            case EVENTS.TEAM_SEAT_LIMIT_REACHED:
                await notificationService.createNotification({
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'company',
                    level: notificationLevel,
                    title: 'Límite de Usuarios Alcanzado',
                    message: `Tu plan ha alcanzado el máximo de ${payload.seatLimit || 'N/A'} usuarios. Actualiza tu plan para agregar más.`,
                    actionUrl: '/settings/billing',
                    data: payload
                });
                break;

            // ── System ──
            case EVENTS.SYSTEM_ERROR:
                await notificationService.createNotification({
                    eventKey: event_key,
                    targetScope: 'global',
                    level: notificationLevel,
                    title: 'Error del Sistema',
                    message: payload.message || 'Se ha detectado un error en la plataforma. Nuestro equipo está trabajando en la solución.',
                    data: payload
                });
                break;

            case EVENTS.SYSTEM_MAINTENANCE:
                await notificationService.createNotification({
                    eventKey: event_key,
                    targetScope: 'global',
                    level: notificationLevel,
                    title: payload.title || 'Aviso BETO OS',
                    message: payload.message || 'El sistema entrará en mantenimiento pronto.',
                    data: payload
                });
                break;

            case EVENTS.SYSTEM_NEW_SIGNUP:
                await notificationService.createNotification({
                    eventKey: event_key,
                    targetScope: 'global',
                    level: notificationLevel,
                    title: 'Nuevo Registro',
                    message: `${payload.email || 'Un nuevo usuario'} se ha registrado en BETO OS.`,
                    data: payload
                });
                break;

            case EVENTS.SYSTEM_BROADCAST:
                await notificationService.createNotification({
                    eventKey: event_key,
                    targetScope: 'global',
                    level: notificationLevel,
                    title: payload.title || 'Aviso BETO OS',
                    message: payload.message || '',
                    actionUrl: payload.actionUrl,
                    data: payload
                });
                break;

            case EVENTS.SYSTEM_CRITICAL:
                await notificationService.createNotification({
                    eventKey: event_key,
                    targetScope: 'global',
                    level: 'error',
                    title: payload.title || '🚨 ALERTA CRÍTICA',
                    message: payload.message || '',
                    actionUrl: payload.actionUrl,
                    data: payload
                });
                break;

            default:
                break;
        }
    }
};
