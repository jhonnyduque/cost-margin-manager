import { supabase } from './supabase';
import { EventKey, SourceModule } from '../core/events';

export interface EmitEventDto {
    companyId?: string | null;
    userId?: string | null;
    eventKey: EventKey;
    sourceModule: SourceModule;
    payload?: any;
}

export const eventBusService = {
    /**
     * Emite un evento al bus del sistema.
     * Este evento será persistido y podrá ser procesado por listeners.
     */
    async emitEvent(dto: EmitEventDto) {
        const { error } = await supabase.from('event_bus').insert({
            company_id: dto.companyId,
            user_id: dto.userId,
            event_key: dto.eventKey,
            source_module: dto.sourceModule,
            payload: dto.payload || {}
        });

        if (error) {
            console.error('[EventBus] Error emitting event:', error);
            throw error;
        }

        return true;
    }
};
