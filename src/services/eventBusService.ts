import { supabase } from './supabase';
import { EventKey, SourceModule, EVENTS } from '../core/events';

export interface EmitEventDto {
    companyId?: string | null;
    userId?: string | null;
    eventKey: EventKey;
    sourceModule: SourceModule;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    payload?: any;
}

export const eventBusService = {
    /**
     * Emite un evento al bus del sistema.
     * Este evento será persistido y podrá ser procesado por listeners.
     */
    async emitEvent(dto: EmitEventDto) {
        // Bloqueo de seguridad (Backend/Service): Evitar broadcast global por inquilinos
        if (dto.eventKey === EVENTS.SYSTEM_BROADCAST) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No session');

            // Consultar tabla users para veracidad del rol
            const { data: userData } = await supabase
                .from('users')
                .select('is_super_admin')
                .eq('id', user.id)
                .single();

            const isSuperAdmin = userData?.is_super_admin === true;
            
            if (!isSuperAdmin) {
                console.error('[EventBus] Access Denied: User is not super_admin. Broadcast blocked.');
                throw new Error('Requiere el rol super_admin para emitir un Broadcast Global.');
            }
        }

        const { error } = await supabase.from('event_bus').insert({
            company_id: dto.companyId,
            user_id: dto.userId,
            event_key: dto.eventKey,
            source_module: dto.sourceModule,
            priority: dto.priority || 'medium',
            payload: dto.payload || {}
        });

        if (error) {
            console.error('[EventBus] Error emitting event:', error);
            throw error;
        }

        return true;
    }
};
