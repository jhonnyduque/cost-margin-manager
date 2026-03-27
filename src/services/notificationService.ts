import { supabase } from './supabase';
import { EventKey } from '../core/events';

export type NotificationLevel = 'info' | 'warning' | 'error';
export type NotificationScope = 'user' | 'company' | 'global';

export interface CreateNotificationDto {
    userId?: string | null;
    companyId?: string | null;
    eventKey: EventKey;
    targetScope: NotificationScope;
    level: NotificationLevel;
    title: string;
    message: string;
    actionUrl?: string | null;
    data?: any;
}

/**
 * Helper interno — obtiene el user_id del usuario autenticado actualmente.
 * Lanza error si no hay sesión activa, lo que previene queries sin filtro
 * que expondrían notificaciones de otros usuarios.
 */
async function getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('[NotificationService] No active session');
    return user.id;
}

export const notificationService = {
    /**
     * Crea una notificación en el sistema.
     * Esta función suele ser llamada por el NotificationListener.
     */
    async createNotification(dto: CreateNotificationDto) {
        const { error } = await supabase.from('notifications').insert({
            user_id: dto.userId,
            company_id: dto.companyId,
            event_key: dto.eventKey,
            target_scope: dto.targetScope,
            level: dto.level,
            title: dto.title,
            message: dto.message,
            action_url: dto.actionUrl,
            data: dto.data || {}
        });

        if (error) {
            console.error('[NotificationService] Error creating notification:', error);
            throw error;
        }

        // 🟢 NUEVO: Despachar a canales externos (Email/WhatsApp)
        // Para notificaciones globales (userId null), despachamos usando el contexto del emisor para la prueba
        const dispatchUserId = dto.userId || (await supabase.auth.getUser()).data.user?.id;
        if (dispatchUserId) {
            this.dispatchToExternalChannels(dispatchUserId, dto.eventKey, dto);
        }

        return true;
    },

    /**
     * Obtiene las notificaciones del usuario actual.
     *
     * 🔴 FIX: Añadido filtro por user_id — antes traía todas las notificaciones
     * de la tabla sin filtrar, exponiendo datos de otros usuarios y causando
     * que el estado de lectura se mezclara entre sesiones.
     */
    async getNotifications(options?: { limit?: number; unreadOnly?: boolean }) {
        const userId = await getCurrentUserId();
        const limitStr = options?.limit || 20;

        const { data, error } = await supabase
            .from('notifications')
            .select(`
                *,
                notification_reads!left(read_at)
            `)
            .or(`user_id.eq.${userId},target_scope.in.(global,company)`)
            .order('created_at', { ascending: false })
            .limit(limitStr);

        if (error) throw error;

        let mapped = data.map(n => ({
            ...n,
            read_at: n.user_id ? n.read_at : (n.notification_reads?.[0]?.read_at || null)
        }));

        if (options?.unreadOnly) {
            mapped = mapped.filter(n => !n.read_at);
        }

        return mapped;
    },

    /**
     * Obtiene el conteo de no leídas del usuario actual para el badge.
     *
     * 🔴 FIX: Añadido filtro por user_id — antes contaba todas las
     * read_at IS NULL globales, lo que causaba que al refrescar el badge
     * mostrara un número incorrecto (suma de todos los usuarios).
     */
    async getUnreadCount() {
        const userId = await getCurrentUserId();

        const { data: notes, error: fetchError } = await supabase
            .from('notifications')
            .select(`
                id,
                user_id,
                read_at,
                notification_reads!left(read_at)
            `)
            .or(`user_id.eq.${userId},target_scope.in.(global,company)`);

        if (fetchError) throw fetchError;

        // Contar las que no tienen read_at personal ni en la relación
        const unread = notes.filter(n => {
            if (n.user_id) return !n.read_at;
            return !n.notification_reads || n.notification_reads.length === 0;
        });

        return unread.length;
    },

    /**
     * Marca una notificación como leída.
     *
     * 🔴 FIX: Añadido filtro por user_id — previene que un usuario
     * pueda marcar como leída una notificación de otro usuario.
     */
    async markAsRead(id: string) {
        const userId = await getCurrentUserId();

        // Primero verificamos si es una notificación personal
        const { data: note } = await supabase
            .from('notifications')
            .select('user_id')
            .eq('id', id)
            .single();

        if (note?.user_id) {
            // Si es personal, actualizamos directamente (como antes, pero seguro)
            const { error } = await supabase
                .from('notifications')
                .update({ read_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_id', userId);
            if (error) throw error;
        } else {
            // Si es global/empresa, registramos la lectura individual en la nueva tabla
            const { error } = await supabase
                .from('notification_reads')
                .upsert({
                    notification_id: id,
                    user_id: userId,
                    read_at: new Date().toISOString()
                }, { onConflict: 'notification_id,user_id' });
            if (error) throw error;
        }

        return true;
    },

    /**
     * Marca todas las notificaciones del usuario actual como leídas.
     *
     * 🔴 FIX: Añadido filtro por user_id — antes actualizaba TODAS
     * las notificaciones sin leer de toda la tabla.
     */
    async markAllAsRead() {
        const userId = await getCurrentUserId();

        // 1. Marcar personales
        await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('read_at', null);

        // 2. Marcar compartidas (global/company)
        // Buscamos todas las compartidas que el usuario no ha leído aún
        const { data: sharedNotes } = await supabase
            .from('notifications')
            .select(`
                id,
                notification_reads!left(id)
            `)
            .is('user_id', null)
            .or('target_scope.eq.global,target_scope.eq.company');

        if (sharedNotes) {
            const unreadShared = sharedNotes.filter(n => !n.notification_reads || n.notification_reads.length === 0);

            if (unreadShared.length > 0) {
                const reads = unreadShared.map(n => ({
                    notification_id: n.id,
                    user_id: userId,
                    read_at: new Date().toISOString()
                }));

                await supabase.from('notification_reads').upsert(reads, { onConflict: 'notification_id,user_id' });
            }
        }

        return true;
    },

    /**
     * Suscripción en tiempo real a nuevas notificaciones del usuario actual.
     *
     * 🔴 FIX: Añadido filtro user_id en el canal de realtime — antes
     * el callback se disparaba con INSERT de cualquier usuario,
     * incrementando el badge incorrectamente para todos.
     *
     * Nota: el canal se nombra con userId para que cada sesión tenga
     * su propio canal independiente y no haya colisiones entre usuarios.
     */
    subscribeToNotifications(userId: string, callback: (payload: any) => void) {
        return supabase
            .channel(`notifications_realtime_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                },
                (payload) => {
                    const newNote = payload.new;
                    // Filtrar en cliente: si es para el usuario OR global OR de su empresa
                    const isForMe = newNote.user_id === userId ||
                        newNote.target_scope === 'global' ||
                        (newNote.target_scope === 'company' && newNote.company_id); // El company_id se valida en RLS usualmente

                    if (isForMe) callback(newNote);
                }
            )
            .subscribe();
    },

    async getUserPreferences() {
        const userId = await getCurrentUserId();
        const { data, error } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', userId);
        
        if (error) throw error;
        return data;
    },

    async updateUserPreferences(eventKey: string, inApp: boolean, email: boolean) {
        const userId = await getCurrentUserId();
        const { error } = await supabase
            .from('notification_preferences')
            .upsert({
                user_id: userId,
                event_key: eventKey,
                in_app_enabled: inApp,
                email_enabled: email
            }, { onConflict: 'user_id,event_key' });
        
        if (error) throw error;
        return true;
    },

    /**
     * Catálogo centralizado de categorías de notificación.
     * Fuente de verdad para la UI y el motor de eventos.
     */
    getNotificationCategories() {
        return [
            { key: 'SYSTEM_CRITICAL', label: 'Mensajes Críticos', description: 'Alertas de seguridad, fallos de sistema y facturación vital.', isCritical: true },
            { key: 'SYSTEM_NOTICE', label: 'Avisos del Sistema', description: 'Mantenimiento, actualizaciones y noticias globales.' },
            { key: 'INVENTORY_ALERT', label: 'Alertas de Inventario', description: 'Stock bajo, discrepancias y recepciones.' },
            { key: 'COST_ALERT', label: 'Alertas de Costos', description: 'Desviaciones significativas en costos de produción.' },
            { key: 'SUBSCRIPTION_UPDATE', label: 'Facturación y Suscripción', description: 'Facturas listas, renovaciones y límites.' }
        ];
    },

    /**
     * Valida la disponibilidad técnica de un canal para el usuario.
     */
    async getChannelAvailability() {
        const { data: { user } } = await supabase.auth.getUser();
        
        return {
            email: {
                available: !!user?.email_confirmed_at,
                message: user?.email_confirmed_at ? 'Disponible' : 'Requiere verificar email'
            },
            whatsapp: {
                available: false,
                message: 'Próximamente: Integración WhatsApp Enterprise'
            },
            in_app: {
                available: true,
                message: 'Siempre disponible'
            }
        };
    },

    // Caché de preferencias para evitar consultas excesivas (TTL: 1 min)
    _prefsCache: new Map<string, { data: any[], timestamp: number }>(),

    /**
     * Determina si se debe emitir una notificación según las preferencias del usuario.
     */
    async shouldNotify(userId: string, eventKey: string, channel: 'in_app' | 'email' | 'whatsapp'): Promise<boolean> {
        // 1. Bypass explícito para Mensajes Críticos
        const categories = this.getNotificationCategories();
        const category = categories.find(c => c.key === eventKey);
        if (category?.isCritical) return true;

        // 2. Consultar Caché
        const now = Date.now();
        const cached = this._prefsCache.get(userId);
        let prefs = [];

        if (cached && (now - cached.timestamp < 60000)) {
            prefs = cached.data;
        } else {
            const { data, error } = await supabase.from('notification_preferences').select('*').eq('user_id', userId);
            if (error) return true; // Fail-safe: notificar si hay error de DB
            prefs = data || [];
            this._prefsCache.set(userId, { data: prefs, timestamp: now });
        }

        // 3. Evaluar Preferencia
        const pref = prefs.find(p => p.event_key === eventKey);
        if (!pref) return channel === 'in_app'; // Default: solo in-app si no hay registro

        if (channel === 'in_app') return pref.in_app_enabled;
        if (channel === 'email') return pref.email_enabled;
        return false; // WhatsApp siempre false por ahora
    },

    /**
     * Registra un intento de envío en la tabla de auditoría.
     */
    async logDelivery(options: {
        userId?: string | null,
        companyId?: string | null,
        channel: 'email' | 'whatsapp',
        eventType: string, // renombrado
        status: 'success' | 'error' | 'omitted', // añadido omitted
        destination?: string, // renombrado
        errorMessage?: string | null, // nuevo
        metadata?: any, // renombrado
        providerResponse?: any
    }) {
        try {
            const { error } = await supabase.from('delivery_logs').insert({
                user_id: options.userId,
                company_id: options.companyId,
                channel: options.channel,
                event_type: options.eventType,
                status: options.status,
                destination: options.destination,
                error_message: options.errorMessage,
                metadata: options.metadata,
                provider_response: options.providerResponse
            });

            if (error) {
                console.error('[NotificationService] 🔴 Supabase insert error:', error.message, error.details);
            } else {
                console.log('[NotificationService] 🟢 Log de auditoría persistido correctamente.');
            }
        } catch (err) {
            console.error('[NotificationService] 🔴 Exception logging delivery:', err);
        }
    },

    /**
     * Despacha una notificación a los canales externos habilitados.
     */
    async dispatchToExternalChannels(userId: string, eventKey: string, payload: any) {
        // Ejecución asíncrona (fire & forget para no bloquear la UI)
        Promise.resolve().then(async () => {
            // 1. Validar Email
            const shouldSendEmail = await this.shouldNotify(userId, eventKey, 'email');

            if (shouldSendEmail) {
                const { emailService } = await import('./emailService');
                
                // Determinar plantilla según evento
                let template: 'INVENTORY' | 'CRITICAL' = 'INVENTORY';
                const categories = this.getNotificationCategories();
                const cat = categories.find(c => c.key === eventKey);
                if (cat?.isCritical) template = 'CRITICAL';

                const emailResult: any = await emailService.sendEmail({
                    to: 'user_email_from_auth@placeholder.com', // En Fase 2-A el servicio redirige a Beto
                    template,
                    data: {
                        productName: payload.productName || 'Sistema',
                        type: eventKey,
                        message: payload.message || '',
                        actionUrl: payload.actionUrl || window.location.origin,
                        title: payload.title || 'Aviso BETO OS'
                    }
                });

                // 🟢 PERSISTIR AUDITORÍA (Fase 2-C Refinada)
                await this.logDelivery({
                    userId,
                    companyId: payload.companyId,
                    channel: 'email',
                    eventType: eventKey,
                    status: emailResult.success ? 'success' : 'error',
                    destination: 'user_email_from_auth@placeholder.com',
                    errorMessage: emailResult.success ? null : (emailResult.error || 'Unknown email error'),
                    metadata: payload,
                    providerResponse: emailResult
                });
            } else {
                // Registrar envío omitido por preferencia
                await this.logDelivery({
                    userId,
                    companyId: payload.companyId,
                    channel: 'email',
                    eventType: eventKey,
                    status: 'omitted',
                    destination: 'user_email_from_auth@placeholder.com',
                    errorMessage: 'Canal desactivado por preferencias de usuario',
                    metadata: payload
                });
            }

            // 2. Validar WhatsApp (Canal Restringido - Fase 2-B)
            const shouldSendWA = await this.shouldNotify(userId, eventKey, 'whatsapp');
            if (shouldSendWA) {
                const categories = this.getNotificationCategories();
                const cat = categories.find(c => c.key === eventKey);
                
                // CRITERIO DE ELEGIBILIDAD: Solo críticos o billing para WA en esta fase
                const isEligible = cat?.isCritical || 
                                   eventKey === 'BILLING_PAYMENT_FAILED' || 
                                   eventKey === 'SUBSCRIPTION_UPDATE';

                if (isEligible) {
                    const { whatsappService } = await import('./whatsappService');
                    
                    let template: 'INVENTORY' | 'BILLING' | 'CRITICAL' = 'INVENTORY';
                    if (cat?.isCritical) template = 'CRITICAL';
                    if (eventKey.includes('BILLING') || eventKey.includes('SUBSCRIPTION')) template = 'BILLING';

                    const waResult: any = await whatsappService.sendWhatsApp({
                        to: '+34000000000', // Redirected by service in test mode
                        template,
                        data: {
                            productName: payload.productName || 'Sistema',
                            message: payload.message || '',
                            title: payload.title || 'Aviso BETO OS'
                        }
                    });

                    // 🟢 PERSISTIR AUDITORÍA (Fase 2-C Refinada)
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: waResult.success ? 'success' : 'error',
                        destination: '+34000000000',
                        errorMessage: waResult.success ? null : (waResult.error || 'Unknown WhatsApp error'),
                        metadata: payload,
                        providerResponse: waResult
                    });
                } else {
                    // Omitido por falta de elegibilidad técnica/fase
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: 'omitted',
                        destination: '+34000000000',
                        errorMessage: 'Evento no elegible para WhatsApp en esta fase',
                        metadata: payload
                    });
                }
            } else if (shouldSendWA === false) {
                 // Registrar envío omitido por preferencia
                 await this.logDelivery({
                    userId,
                    companyId: payload.companyId,
                    channel: 'whatsapp',
                    eventType: eventKey,
                    status: 'omitted',
                    destination: '+34000000000',
                    errorMessage: 'Canal desactivado por preferencias de usuario',
                    metadata: payload
                });
            }
        }).catch(err => console.error('[NotificationService] Error en despacho externo:', err));
    }
};