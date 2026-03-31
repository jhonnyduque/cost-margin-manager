import { supabase } from './supabase';
import { EventKey, EVENTS } from '../core/events';
import { communicationConfig } from '@/config/communication.config';
import { emailTemplates } from './emailTemplates';
import { whatsappTemplates } from './whatsappTemplates';

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

async function getCurrentContext(preferredCompanyId?: string | null): Promise<{ userId: string; companyId: string | null }> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('[NotificationService] No active session');

    const metaCompany = (user.user_metadata as any)?.company_id || (user.app_metadata as any)?.company_id || null;
    const companyId = preferredCompanyId ?? metaCompany ?? null;

    return { userId: user.id, companyId };
}

export const notificationService = {
    _prefsCache: new Map<string, { data: any[], timestamp: number }>(),
    _alertCooldown: new Map<string, number>(),

    invalidatePrefsCache(userId: string) {
        this._prefsCache.delete(userId);
        console.info('[NotificationService] Prefs cache invalidated for', userId);
    },

    alertCooldownHit(key: string, ttlMs = 15 * 60 * 1000) {
        const now = Date.now();
        const last = this._alertCooldown.get(key);
        if (last && now - last < ttlMs) return true;
        this._alertCooldown.set(key, now);
        return false;
    },

    buildEmailContent(eventKey: string, payload: any, baseUrl: string) {
        switch (eventKey) {
            case EVENTS.INVENTORY_LOW_STOCK:
            case EVENTS.INVENTORY_COST_DEVIATION:
                return emailTemplates.getInventoryAlert({
                    productName: payload.productName || payload.materialName || 'Recurso',
                    type: eventKey,
                    message: payload.message || payload.deviation || 'Revisa el inventario',
                    actionUrl: payload.actionUrl || payload.link || `${baseUrl}/stock`
                });
            case EVENTS.BILLING_PAYMENT_FAILED:
                return emailTemplates.getBillingNotice({
                    title: payload.title || 'Error de pago',
                    message: payload.message || 'No pudimos procesar tu último pago.',
                    actionUrl: payload.actionUrl || `${baseUrl}/settings/billing`
                });
            case EVENTS.BILLING_INVOICE_READY:
                return emailTemplates.getBillingNotice({
                    title: payload.title || 'Factura disponible',
                    message: payload.message || 'Tu factura está lista para descargar.',
                    actionUrl: payload.actionUrl || `${baseUrl}/settings/billing`
                });
            case EVENTS.BILLING_SUBSCRIPTION_RENEWED:
                return emailTemplates.getBillingNotice({
                    title: payload.title || 'Suscripción renovada',
                    message: payload.message || 'Tu plan ha sido renovado.',
                    actionUrl: payload.actionUrl || `${baseUrl}/settings/billing`
                });
            case EVENTS.SYSTEM_CRITICAL:
                return emailTemplates.getSystemCritical({
                    title: payload.title || '🚨 ALERTA CRÍTICA',
                    message: payload.message || 'Aviso crítico del sistema.'
                });
            case EVENTS.SYSTEM_MAINTENANCE:
            case EVENTS.SYSTEM_BROADCAST:
            case EVENTS.SYSTEM_ERROR:
            case EVENTS.SYSTEM_NEW_SIGNUP:
                return emailTemplates.getSystemNotice({
                    title: payload.title || 'Aviso BETO OS',
                    message: payload.message || 'Tienes un aviso del sistema.',
                    actionUrl: payload.actionUrl
                });
            case EVENTS.TEAM_USER_INVITED:
                return emailTemplates.getTeamNotice({
                    title: payload.title || 'Invitación enviada',
                    message: payload.message || `Has invitado a ${payload.email || 'un usuario'}.`,
                    actionUrl: payload.actionUrl
                });
            case EVENTS.TEAM_USER_JOINED:
                return emailTemplates.getTeamNotice({
                    title: payload.title || 'Nuevo miembro en tu equipo',
                    message: payload.message || `${payload.userName || 'Un usuario'} se ha unido.`,
                    actionUrl: payload.actionUrl
                });
            case EVENTS.TEAM_SEAT_LIMIT_REACHED:
                return emailTemplates.getTeamNotice({
                    title: payload.title || 'Límite de usuarios alcanzado',
                    message: payload.message || `Has alcanzado el máximo de seats (${payload.seatLimit || 'N/A'}).`,
                    actionUrl: payload.actionUrl || `${baseUrl}/settings/billing`
                });
            default:
                return emailTemplates.getSystemNotice({
                    title: payload.title || 'Aviso BETO OS',
                    message: payload.message || 'Tienes una notificación pendiente.',
                    actionUrl: payload.actionUrl
                });
        }
    },

    buildWhatsappText(eventKey: string, payload: any, baseUrl: string) {
        switch (eventKey) {
            case EVENTS.INVENTORY_LOW_STOCK:
            case EVENTS.INVENTORY_COST_DEVIATION:
                return whatsappTemplates.getInventoryCritical({
                    productName: payload.productName || payload.materialName || 'Recurso',
                    message: payload.message || 'Revisa el inventario crítico.',
                    baseUrl
                }).text;
            case EVENTS.BILLING_PAYMENT_FAILED:
            case EVENTS.BILLING_INVOICE_READY:
            case EVENTS.BILLING_SUBSCRIPTION_RENEWED:
                return whatsappTemplates.getBillingAlert({
                    title: payload.title || 'Facturación',
                    message: payload.message || 'Revisa tu cuenta de facturación.',
                    baseUrl
                }).text;
            case EVENTS.SYSTEM_CRITICAL:
            case EVENTS.SYSTEM_ERROR:
                return whatsappTemplates.getSystemCritical({
                    title: payload.title || 'Alerta crítica',
                    message: payload.message || 'Revisa el sistema.'
                }).text;
            default:
                return `BETO OS: ${payload.title || 'Aviso'} - ${payload.message || ''}`.trim();
        }
    },

    async getWhatsappOptIn(userId: string, phone: string | null): Promise<{ ok: boolean; reason?: string }> {
        if (!phone) return { ok: false, reason: 'no_phone' };
        const phoneTrimmed = phone.trim();
        const e164 = phoneTrimmed.startsWith('+') ? phoneTrimmed : `+${phoneTrimmed}`;
        const valid = /^\+[1-9]\d{7,14}$/.test(e164);
        if (!valid) return { ok: false, reason: 'invalid_phone' };

        const { data, error } = await supabase
            .from('whatsapp_optin')
            .select('consent_at, revoked_at')
            .eq('user_id', userId)
            .eq('phone_e164', e164)
            .limit(1);

        if (error) return { ok: false, reason: 'optin_lookup_error' };
        const row = data && data[0];
        if (!row || !row.consent_at || row.revoked_at) return { ok: false, reason: 'no_opt_in' };

        return { ok: true };
    },

    async checkWhatsappCaps(userId: string, eventKey: string) {
        const now = new Date();
        const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('delivery_logs')
            .select('id, created_at, event_type')
            .eq('channel', 'whatsapp')
            .eq('is_mock', false)
            .in('status', ['success', 'error'])
            .eq('user_id', userId)
            .gte('created_at', since);

        if (error || !data) return { allowed: false, reason: 'caps_lookup_error' };

        const dailyCap = communicationConfig.whatsapp.dailyCapPerUser || 3;
        if (data.length >= dailyCap) return { allowed: false, reason: 'cap_exceeded' };

        const cooldownMin = communicationConfig.whatsapp.cooldownCriticalMinutes || 120;
        if (eventKey === EVENTS.SYSTEM_CRITICAL) {
            const cutoff = new Date(now.getTime() - cooldownMin * 60 * 1000).toISOString();
            const recentCritical = data.find(d => d.event_type === EVENTS.SYSTEM_CRITICAL && d.created_at >= cutoff);
            if (recentCritical) return { allowed: false, reason: 'cooldown_active' };
        }

        return { allowed: true };
    },

    async ensureDefaultPreferences(userId: string) {
        const { data, error } = await supabase.from('notification_preferences').select('event_key').eq('user_id', userId);
        if (error) {
            console.warn('[NotificationService] ensureDefaultPreferences skip due error', error.message);
            return;
        }
        if (data && data.length > 0) return;

        const eventKeys = Object.values(EVENTS);
        const rows = eventKeys.map(key => ({
            user_id: userId,
            event_key: key,
            in_app_enabled: true,
            email_enabled: false
        }));
        await supabase.from('notification_preferences').insert(rows);
        this.invalidatePrefsCache(userId);
        console.info('[NotificationService] Default preferences seeded for', userId);
    },

    /**
     * Crea una notificación en el sistema.
     * Esta función suele ser llamada por el NotificationListener.
     */
    async createNotification(dto: CreateNotificationDto) {
        console.info('[NotificationService] Creating notification', dto.eventKey, dto.targetScope);
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

        console.info('[NotificationService] Notification created', dto.eventKey, dto.targetScope);

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
    async getNotifications(options?: { limit?: number; unreadOnly?: boolean; companyId?: string | null }) {
        const { userId, companyId } = await getCurrentContext(options?.companyId);
        const limitStr = options?.limit || 20;

        const filters = [
            `user_id.eq.${userId}`,
            `target_scope.eq.global`
        ];
        if (companyId) filters.push(`and(target_scope.eq.company,company_id.eq.${companyId})`);

        const { data, error } = await supabase
            .from('notifications')
            .select(`
                *,
                notification_reads!left(read_at)
            `)
            .or(filters.join(','))
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
    async getUnreadCount(companyId?: string | null) {
        const { userId, companyId: resolvedCompanyId } = await getCurrentContext(companyId);

        const filters = [
            `user_id.eq.${userId}`,
            `target_scope.eq.global`
        ];
        if (resolvedCompanyId) filters.push(`and(target_scope.eq.company,company_id.eq.${resolvedCompanyId})`);

        const { data: notes, error: fetchError } = await supabase
            .from('notifications')
            .select(`
                id,
                user_id,
                target_scope,
                company_id,
                read_at,
                notification_reads!left(read_at)
            `)
            .or(filters.join(','));

        if (fetchError) throw fetchError;

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
    async markAllAsRead(companyId?: string | null) {
        const { userId, companyId: resolvedCompanyId } = await getCurrentContext(companyId);

        // 1. Marcar personales
        await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('read_at', null);

        // 2. Marcar compartidas (global + company del usuario)
        const sharedFilters = [`target_scope.eq.global`];
        if (resolvedCompanyId) sharedFilters.push(`and(target_scope.eq.company,company_id.eq.${resolvedCompanyId})`);

        const { data: sharedNotes } = await supabase
            .from('notifications')
            .select(`
                id,
                target_scope,
                company_id,
                notification_reads!left(id)
            `)
            .or(sharedFilters.join(','));

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
    subscribeToNotifications(userId: string, companyId: string | null | undefined, callback: (payload: any) => void) {
        const channel = supabase.channel(`notifications_realtime_${userId}`);

        // Personales
        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
            (payload) => callback(payload.new)
        );

        // Company scoped (solo la empresa actual)
        if (companyId) {
            channel.on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `company_id=eq.${companyId}` },
                (payload) => {
                    const newNote = payload.new;
                    if (newNote.target_scope === 'company') callback(newNote);
                }
            );
        }

        // Global
        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `target_scope=eq.global` },
            (payload) => callback(payload.new)
        );

        return channel.subscribe();
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
        this.invalidatePrefsCache(userId);
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

    /**
     * Determina si se debe emitir una notificación según las preferencias del usuario.
     */
    async shouldNotify(userId: string, eventKey: string, channel: 'in_app' | 'email' | 'whatsapp', opts?: { scope?: 'user' | 'company' | 'global' }): Promise<boolean> {
        const scope = opts?.scope || 'user';

        // 1. Bypass explícito para Mensajes Críticos
        const criticalEvents = new Set([
            'SYSTEM_CRITICAL',
            'SYSTEM_ERROR',
            'BILLING_PAYMENT_FAILED',
            'SYSTEM_MAINTENANCE'
        ]);
        if (criticalEvents.has(eventKey)) {
            console.info('[NotificationService][shouldNotify] bypass critical', { eventKey, channel, scope });
            return true;
        }

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
        let decision: boolean;
        if (!pref) {
            decision = channel === 'in_app'; // Default seguro
        } else if (channel === 'in_app') {
            decision = pref.in_app_enabled;
        } else if (channel === 'email') {
            decision = pref.email_enabled;
        } else {
            decision = false;
        }

        console.info('[NotificationService][shouldNotify] decision', { userId, eventKey, channel, scope, decision });
        return decision;
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
        providerResponse?: any,
        error_type?: 'transient' | 'permanent' | null,
        is_mock?: boolean | null
    }) {
        try {
            const mergedMetadata = {
                ...(options.metadata || {}),
                _meta: {
                    error_type: options.error_type || null,
                    is_mock: options.is_mock ?? null,
                    reason: options.metadata?._meta?.reason || options.metadata?._meta?.cause || null
                }
            };
            const { error } = await supabase.from('delivery_logs').insert({
                user_id: options.userId,
                company_id: options.companyId,
                channel: options.channel,
                event_type: options.eventType,
                status: options.status,
                destination: options.destination,
                error_message: options.errorMessage,
                metadata: mergedMetadata,
                provider_response: options.providerResponse
            });

            if (error) {
                console.error('[NotificationService] 🔴 Supabase insert error:', error.message, error.details);
            } else {
                console.log('[NotificationService] 🟢 Log de auditoría persistido correctamente.');
                if (options.status === 'error') {
                    this.evaluateAlerts(options.channel, options.eventType, options.error_type, options.errorMessage, options.providerResponse);
                }
            }
        } catch (err) {
            console.error('[NotificationService] 🔴 Exception logging delivery:', err);
        }
    },

    async evaluateAlerts(channel: 'email' | 'whatsapp', eventType: string, errorType?: string | null, errorMessage?: string | null, providerResponse?: any) {
        const now = Date.now();

        // 1) Error rate en 1h
        const keyRate = `errRate-${channel}`;
        if (!this.alertCooldownHit(keyRate)) {
            const since = new Date(now - 60 * 60 * 1000).toISOString();
            const { data: cntData } = await supabase
                .from('delivery_logs')
                .select('id', { count: 'exact', head: true })
                .eq('channel', channel)
                .eq('status', 'error')
                .gte('created_at', since);
            const errCount = (cntData as any)?.length ?? 0;
            if (errCount >= 5) {
                await this.createSystemAlert(`ERROR_RATE_${channel.toUpperCase()}`, `WhatsApp/Email con alta tasa de errores (última hora)`, {
                    alert_type: 'error_rate',
                    channel,
                    window: '1h',
                    error_count: errCount,
                    runbook_hint: channel === 'whatsapp' ? 'check_whatsapp_config' : 'check_email_config'
                });
            }
        }

        // 2) Config/token inválido (pattern simple)
        const keyCfg = `cfg-${channel}`;
        const msg = (errorMessage || '').toLowerCase();
        const providerStr = JSON.stringify(providerResponse || {}).toLowerCase();
        if (!this.alertCooldownHit(keyCfg) && (msg.includes('token') || providerStr.includes('token') || providerStr.includes('unauthorized') || providerStr.includes('invalid'))) {
            await this.createSystemAlert(`CONFIG_${channel.toUpperCase()}`, `Config/token potencialmente inválido en canal ${channel}`, {
                alert_type: 'config',
                channel,
                reason_detected: 'token_invalid',
                runbook_hint: channel === 'whatsapp' ? 'check_whatsapp_config' : 'check_email_config'
            });
        }

        // 3) Fallos consecutivos (últimos 3)
        const keyConsec = `consec-${channel}`;
        if (!this.alertCooldownHit(keyConsec)) {
            const { data: lastLogs } = await supabase
                .from('delivery_logs')
                .select('status')
                .eq('channel', channel)
                .order('created_at', { ascending: false })
                .limit(3);
            if (lastLogs && lastLogs.length === 3 && lastLogs.every(l => l.status === 'error')) {
                await this.createSystemAlert(`CONSEC_${channel.toUpperCase()}`, `Errores consecutivos en canal ${channel}`, {
                    alert_type: 'consecutive',
                    channel,
                    error_count: 3,
                    runbook_hint: channel === 'whatsapp' ? 'check_whatsapp_config' : 'check_email_config'
                });
            }
        }
    },

    async createSystemAlert(code: string, message: string, meta?: Record<string, any>) {
        if (this.alertCooldownHit(`notify-${code}`, 15 * 60 * 1000)) return;
        try {
            await supabase.from('notifications').insert({
                user_id: null,
                company_id: null,
                event_key: EVENTS.SYSTEM_ERROR,
                target_scope: 'global',
                level: 'warning',
                title: message,
                message,
                data: meta || {}
            });
        } catch (err) {
            console.error('[NotificationService] no pudo registrar alerta', code, err);
        }
    },

    /**
     * Despacha una notificación a los canales externos habilitados.
     */
    async dispatchToExternalChannels(userId: string, eventKey: string, payload: any) {
        // Ejecución asíncrona (fire & forget para no bloquear la UI)
        Promise.resolve().then(async () => {
            const baseUrl = communicationConfig.baseUrl;

            // 1. Validar Email
            const shouldSendEmail = communicationConfig.email.enabled && await this.shouldNotify(userId, eventKey, 'email');

            const resolveEmailRecipient = async (): Promise<{ target: string | null; reason?: string }> => {
                const explicit = payload?.data?.email || payload?.email || payload?.data?.userEmail;
                if (explicit) return { target: explicit };
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.email) return { target: user.email };
                return { target: null, reason: 'No se pudo resolver email (sin payload ni user.email)' };
            };

            if (shouldSendEmail) {
                const { emailService } = await import('./emailService');
                const { target, reason } = await resolveEmailRecipient();
                const compiledEmail = this.buildEmailContent(eventKey, payload, baseUrl);

                if (!compiledEmail?.subject || !compiledEmail?.html) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'email',
                        eventType: eventKey,
                        status: 'error',
                        destination: 'unresolved',
                        errorMessage: 'Plantilla email incompleta (subject/html requerido)',
                        metadata: { ...payload, compiledEmail },
                        error_type: 'permanent',
                        is_mock: communicationConfig.email.testMode
                    });
                    return;
                }

                if (!target) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'email',
                        eventType: eventKey,
                        status: 'error',
                        destination: 'unresolved',
                        errorMessage: reason || 'Email destinatario no resuelto',
                        metadata: { ...payload, compiledEmail },
                        error_type: 'permanent',
                        is_mock: communicationConfig.email.testMode
                    });
                    return;
                }

                try {
                    const emailResult: any = await emailService.sendEmail({
                        to: target,
                        template: 'INVENTORY', // template se ignora si compiled está presente
                        data: payload,
                        compiled: compiledEmail,
                        useProvider: !communicationConfig.email.testMode
                    });

                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'email',
                        eventType: eventKey,
                        status: emailResult.success ? 'success' : 'error',
                        destination: communicationConfig.email.testMode ? communicationConfig.email.testTo : target,
                        errorMessage: emailResult.success ? null : (emailResult.error || 'Unknown email error'),
                        metadata: { ...payload, compiledEmail },
                        providerResponse: emailResult,
                        error_type: null,
                        is_mock: communicationConfig.email.testMode
                    });
                } catch (err: any) {
                    const errorType = err?.error_type
                        || (err?.status && err.status >= 500 ? 'transient' : 'permanent');
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'email',
                        eventType: eventKey,
                        status: 'error',
                        destination: communicationConfig.email.testMode ? communicationConfig.email.testTo : target,
                        errorMessage: err?.error || err?.message || 'Email dispatch error',
                        metadata: { ...payload, compiledEmail },
                        providerResponse: err?.providerResponse || err,
                        error_type: errorType,
                        is_mock: communicationConfig.email.testMode
                    });
                }
            } else {
                await this.logDelivery({
                    userId,
                    companyId: payload.companyId,
                    channel: 'email',
                    eventType: eventKey,
                    status: 'omitted',
                    destination: communicationConfig.email.testMode
                        ? (communicationConfig.email.testTo || 'unresolved')
                        : 'unresolved',
                    errorMessage: communicationConfig.email.enabled
                        ? 'Canal desactivado por preferencias de usuario'
                        : 'Canal email deshabilitado por configuración',
                    metadata: payload,
                    error_type: null,
                    is_mock: communicationConfig.email.testMode
                });
            }

            // 2. Validar WhatsApp (Canal Restringido - Fase 2-B)
            const shouldSendWA = communicationConfig.whatsapp.enabled && await this.shouldNotify(userId, eventKey, 'whatsapp');
            if (shouldSendWA) {
                const categories = this.getNotificationCategories();
                const cat = categories.find(c => c.key === eventKey);

                // Elegibilidad por whitelist estricta
                const whitelist = new Set(communicationConfig.whatsapp.whitelistEvents || []);
                if (!whitelist.has(eventKey)) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: 'omitted',
                        destination: communicationConfig.whatsapp.testMode
                            ? (communicationConfig.whatsapp.testPhone || 'unresolved')
                            : 'unresolved',
                        errorMessage: 'Evento no whitelisteado para WhatsApp',
                        metadata: { ...payload, _meta: { reason: 'event_not_whitelisted' } },
                        is_mock: true
                    });
                    return;
                }

                // Flags de activación
                if (!communicationConfig.whatsapp.providerEnabled) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: 'omitted',
                        destination: 'unresolved',
                        errorMessage: 'Provider WhatsApp desactivado',
                        metadata: { ...payload, _meta: { reason: 'provider_disabled' } },
                        is_mock: true
                    });
                    return;
                }

                if (communicationConfig.whatsapp.testMode) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: 'omitted',
                        destination: communicationConfig.whatsapp.testPhone || 'unresolved',
                        errorMessage: 'Modo test activo',
                        metadata: { ...payload, _meta: { reason: 'test_mode' } },
                        is_mock: true
                    });
                    return;
                }

                if (communicationConfig.whatsapp.manualOnly) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: 'omitted',
                        destination: communicationConfig.whatsapp.testPhone || 'unresolved',
                        errorMessage: 'Modo manual-only',
                        metadata: { ...payload, _meta: { reason: 'manual_only' } },
                        is_mock: true
                    });
                    return;
                }

                // Permisos básicos: requerir usuario actual super-admin (metadata?) o servicio interno
                const { data: currentUser } = await supabase.auth.getUser();
                const isSuperAdmin = currentUser.user?.app_metadata?.is_super_admin === true;
                if (!isSuperAdmin) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: 'omitted',
                        destination: 'unresolved',
                        errorMessage: 'Permiso denegado para WA productivo',
                        metadata: { ...payload, _meta: { reason: 'permission_denied' } },
                        is_mock: true
                    });
                    return;
                }

                // Resolver destinatario
                const resolveWaRecipient = (): { target: string | null; reason?: string } => {
                    const explicit = payload?.data?.phone || payload?.phone || payload?.data?.userPhone;
                    if (explicit) return { target: explicit };
                    if (communicationConfig.whatsapp.testPhone) return { target: communicationConfig.whatsapp.testPhone };
                    return { target: null, reason: 'No se pudo resolver destinatario WhatsApp (sin payload.phone)' };
                };
                const { target: waTarget, reason: waReason } = resolveWaRecipient();
                if (!waTarget) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: 'omitted',
                        destination: 'unresolved',
                        errorMessage: waReason || 'Destinatario WhatsApp no resuelto',
                        metadata: { ...payload, _meta: { reason: 'no_phone' } },
                        is_mock: true
                    });
                    return;
                }

                // Opt-in
                const opt = await this.getWhatsappOptIn(userId, waTarget);
                if (!opt.ok) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: 'omitted',
                        destination: waTarget,
                        errorMessage: opt.reason || 'Sin opt-in WhatsApp',
                        metadata: { ...payload, _meta: { reason: opt.reason || 'no_opt_in' } },
                        is_mock: true
                    });
                    return;
                }

                // Caps
                const caps = await this.checkWhatsappCaps(userId, eventKey);
                if (!caps.allowed) {
                    await this.logDelivery({
                        userId,
                        companyId: payload.companyId,
                        channel: 'whatsapp',
                        eventType: eventKey,
                        status: 'omitted',
                        destination: waTarget,
                        errorMessage: caps.reason || 'Cap/cooldown activo',
                        metadata: { ...payload, _meta: { reason: caps.reason || 'cap_exceeded' } },
                        is_mock: true
                    });
                    return;
                }

                // Template mapping (productivo)
                let template: 'INVENTORY' | 'BILLING' | 'CRITICAL' = 'INVENTORY';
                if (eventKey === EVENTS.SYSTEM_CRITICAL) template = 'CRITICAL';
                if (eventKey === EVENTS.BILLING_PAYMENT_FAILED) template = 'BILLING';

                const { whatsappService } = await import('./whatsappService');
                const waResult: any = await whatsappService.sendWhatsApp({
                    to: waTarget,
                    template,
                    data: {
                        productName: payload.productName || 'Sistema',
                        message: payload.message || '',
                        title: payload.title || 'Aviso BETO OS',
                        baseUrl
                    }
                });

                const isMock = !!waResult.mock || !!waResult.omitted;
                const status: 'success' | 'error' | 'omitted' = waResult.omitted
                    ? 'omitted'
                    : (waResult.success ? 'success' : 'error');

                const errorType = waResult.error_type || (waResult.success ? null :
                    (waResult.status && waResult.status >= 500 ? 'transient' : 'permanent'));

                await this.logDelivery({
                    userId,
                    companyId: payload.companyId,
                    channel: 'whatsapp',
                    eventType: eventKey,
                    status,
                    destination: waTarget,
                    errorMessage: waResult.success ? null : (waResult.reason || waResult.providerResponse?.error || 'WhatsApp dispatch error'),
                    metadata: {
                        ...payload,
                        _meta: {
                            ...(payload?._meta || {}),
                            is_mock: isMock,
                            reason: waResult.reason || null,
                            waText: this.buildWhatsappText(eventKey, payload, baseUrl)
                        }
                    },
                    providerResponse: waResult.providerResponse || waResult,
                    error_type: errorType,
                    is_mock: isMock
                });
            } else if (shouldSendWA === false || !communicationConfig.whatsapp.enabled) {
                await this.logDelivery({
                    userId,
                    companyId: payload.companyId,
                    channel: 'whatsapp',
                    eventType: eventKey,
                    status: 'omitted',
                    destination: communicationConfig.whatsapp.testMode
                        ? (communicationConfig.whatsapp.testPhone || 'unresolved')
                        : 'unresolved',
                    errorMessage: communicationConfig.whatsapp.enabled
                        ? 'Canal desactivado por preferencias de usuario'
                        : 'Canal WhatsApp deshabilitado por configuración',
                    metadata: payload
                });
            }
        }).catch(err => console.error('[NotificationService] Error en despacho externo:', err));
    },

};
