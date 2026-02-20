import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';

export interface PlanLimits {
    currentUsers: number;
    maxUsers: number;
    remainingUsers: number;
    percentageUsed: number;
    isNearLimit: boolean;
    isAtLimit: boolean;
    upgradeRecommended: boolean;
    isLoading: boolean;
}

export function usePlanLimits() {
    const { currentCompany } = useAuth();
    const [limits, setLimits] = useState<PlanLimits>({
        currentUsers: 0,
        maxUsers: 0,
        remainingUsers: 0,
        percentageUsed: 0,
        isNearLimit: false,
        isAtLimit: false,
        upgradeRecommended: false,
        isLoading: true
    });

    useEffect(() => {
        if (!currentCompany) return;

        const fetchLimits = async () => {
            try {
                // 1. Fetch Plan Definition
                const { data: planData, error: planError } = await supabase
                    .from('subscription_plans')
                    .select('max_users')
                    .eq('slug', currentCompany.subscription_tier)
                    .single();

                if (planError) throw planError;

                const maxUsers = planData.max_users;

                // 2. Fetch Current Usage
                // IMPORTANTE: company_members count for Atomic check is logic source
                const { count, error: countError } = await supabase
                    .from('company_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('company_id', currentCompany.id)
                    .eq('is_active', true);

                if (countError) throw countError;

                const currentUsers = count || 0;
                const remainingUsers = Math.max(0, maxUsers - currentUsers);
                const percentageUsed = Math.min(100, (currentUsers / maxUsers) * 100);

                const isNearLimit = percentageUsed >= 80;
                const isAtLimit = remainingUsers <= 0;

                setLimits({
                    currentUsers,
                    maxUsers,
                    remainingUsers,
                    percentageUsed,
                    isNearLimit,
                    isAtLimit,
                    upgradeRecommended: isNearLimit || isAtLimit,
                    isLoading: false
                });

            } catch (err) {
                console.error('Error fetching plan limits:', err);
                setLimits(prev => ({ ...prev, isLoading: false }));
            }
        };

        fetchLimits();

        // Opcional: Suscribirse a cambios en company_members para actualizar en tiempo real
        const channel = supabase
            .channel('limits-monitor')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'company_members',
                filter: `company_id=eq.${currentCompany.id}`
            }, () => {
                fetchLimits();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [currentCompany?.id, currentCompany?.subscription_tier]);

    return limits;
}
