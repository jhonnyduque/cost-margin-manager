import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useStore } from '../store';
import { User, Company, UserRole } from '../types';
import { getSuspensionLevel, SuspensionLevel } from '../utils/subscription';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [userCompanies, setUserCompanies] = useState<Company[]>([]);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [suspensionLevel, setSuspensionLevel] = useState<SuspensionLevel>('none');
    const [isLoading, setIsLoading] = useState(true);

    const setStoreCompany = useStore((state) => state.setCurrentCompany);

    const isMounted = useRef(true);
    const isFetching = useRef(false);
    const hasInitialized = useRef(false);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const resetState = useCallback(() => {
        console.log('[useAuth] resetState called');
        setUser(null);
        setCurrentCompany(null);
        setUserCompanies([]);
        setUserRole(null);
        setSuspensionLevel('none');
        setIsLoading(false);
        // Limpiamos el store global para evitar fugas de contexto entre sesiones
        useStore.getState().logout();
    }, []);

    const loadUserData = useCallback(async (userId: string) => {
        if (isFetching.current) {
            console.log('[useAuth] loadUserData - SKIPPED (Already fetching)');
            return;
        }
        isFetching.current = true;
        console.log('[useAuth] loadUserData - START for:', userId);

        try {
            setIsLoading(true);

            // 🔹 Step 1: User & Memberships in parallel to speed up and avoid partial states
            console.log('[useAuth] Fetching user + memberships...');
            const [userRes, membRes] = await Promise.all([
                supabase.from('users').select('*').eq('id', userId).single(),
                supabase.from('company_members').select('company_id, role, companies(*)').eq('user_id', userId).eq('is_active', true)
            ]);

            if (userRes.error) {
                console.error('[useAuth] User Fetch Error:', userRes.error);
                resetState();
                return;
            }

            if (membRes.error) {
                console.error('[useAuth] Memberships Fetch Error:', membRes.error);
                resetState();
                return;
            }

            const userData = userRes.data;
            const memberships = membRes.data || [];
            const companies: Company[] = memberships
                .map((m: any) => m.companies)
                .filter(Boolean);

            console.log(`[useAuth] Data loaded. User: ${userData.id}, Companies: ${companies.length}`);

            const targetCompany =
                companies.find(c => c.id === userData.default_company_id) ||
                companies[0];

            const membership = memberships.find(
                (m: any) => m.company_id === targetCompany?.id
            );

            // 🔹 ATOMIC STATE UPDATE (avoiding multiple renders if possible)
            // React 18 batches these, but order matters for guards
            setUserCompanies(companies);

            if (targetCompany && membership) {
                const role = membership.role as UserRole;
                const level = getSuspensionLevel(
                    targetCompany.subscription_status,
                    targetCompany.grace_period_ends_at
                );

                setCurrentCompany(targetCompany);
                setUserRole(role);
                setSuspensionLevel(level);
                useStore.getState().setCurrentCompany(targetCompany.id, role);
            } else {
                setCurrentCompany(null);
                setUserRole(null);
            }

            // Set user LAST to ensure guards see the company state already populated
            setUser(userData);

        } catch (error) {
            console.error('[useAuth] loadUserData - CRITICAL:', error);
            resetState();
        } finally {
            console.log('[useAuth] loadUserData - COMPLETED. isAuthLoading -> false');
            setIsLoading(false);
            isFetching.current = false;
        }
    }, [resetState]);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        console.log('[useAuth] Effect Mounted');

        const init = async () => {
            console.log('[useAuth] Init - getSession');

            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                await loadUserData(session.user.id);
            } else {
                resetState();
            }
        };

        init();

        const { data: { subscription } } =
            supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('[useAuth] Auth Event:', event);

                if (event === 'SIGNED_IN' && session?.user) {
                    await loadUserData(session.user.id);
                }

                if (event === 'SIGNED_OUT') {
                    resetState();
                }
            });

        return () => {
            subscription.unsubscribe();
        };

    }, [loadUserData, resetState]);

    const switchCompany = async (companyId: string) => {
        if (!user) return;

        const target = userCompanies.find(c => c.id === companyId);
        if (!target) return;

        setIsLoading(true);

        const { data: membership, error } = await supabase
            .from('company_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('company_id', companyId)
            .single();

        if (error || !membership) {
            console.error('Error switching company:', error);
            setIsLoading(false);
            return;
        }

        const role = membership.role as UserRole;
        const level = getSuspensionLevel(
            target.subscription_status,
            target.grace_period_ends_at
        );

        setCurrentCompany(target);
        setUserRole(role);
        setSuspensionLevel(level);
        setStoreCompany(target.id, role);

        await supabase
            .from('users')
            .update({ default_company_id: companyId })
            .eq('id', user.id);

        setIsLoading(false);
    };

    useEffect(() => {
        if (!currentCompany) return;

        const interval = setInterval(() => {
            const level = getSuspensionLevel(
                currentCompany.subscription_status,
                currentCompany.grace_period_ends_at
            );
            setSuspensionLevel(level);
        }, 60000);

        return () => clearInterval(interval);
    }, [currentCompany]);

    return {
        user,
        currentCompany,
        userCompanies,
        userRole,
        suspensionLevel,
        isLoading,
        switchCompany,
        resetState,
    };
}
