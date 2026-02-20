import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useStore } from '../store';
import { User, Company, UserRole } from '../types';
import { getSuspensionLevel, SuspensionLevel } from '../utils/subscription';

interface AuthContextType {
    user: User | null;
    currentCompany: Company | null;
    userCompanies: Company[];
    userRole: UserRole | null;
    suspensionLevel: SuspensionLevel;
    isLoading: boolean;
    switchCompany: (companyId: string) => Promise<void>;
    resetState: () => void;
    refreshAuth: () => Promise<void>;
    // Impersonation Support
    mode: 'platform' | 'company';
    impersonatedCompanyId: string | null;
    enterCompanyAsFounder: (companyId: string) => Promise<void>;
    exitImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [userCompanies, setUserCompanies] = useState<Company[]>([]);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [suspensionLevel, setSuspensionLevel] = useState<SuspensionLevel>('none');
    const [isLoading, setIsLoading] = useState(true);

    // Impersonation State
    const [mode, setMode] = useState<'platform' | 'company'>('company');
    const [impersonatedCompanyId, setImpersonatedCompanyId] = useState<string | null>(null);

    const setStoreCompany = useStore((state) => state.setCurrentCompany);
    const isFetching = useRef(false);
    const hasInitialized = useRef(false);

    const resetState = useCallback(() => {
        console.log('[AuthProvider] resetState called');
        setUser(null);
        setCurrentCompany(null);
        setUserCompanies([]);
        setUserRole(null);
        setSuspensionLevel('none');
        setMode('company');
        setImpersonatedCompanyId(null);
        setIsLoading(false);
        useStore.getState().logout();
    }, []);

    const loadUserData = useCallback(async (userId: string) => {
        if (isFetching.current) {
            console.log('[AuthProvider] loadUserData - SKIPPED (Already fetching)');
            return;
        }
        isFetching.current = true;
        console.log('[AuthProvider] loadUserData - START for:', userId);

        try {
            setIsLoading(true);

            let userRes = await supabase.from('users').select('*').eq('id', userId).single();

            // Reintento rápido si no se encuentra el usuario (posible retraso en trigger)
            if (userRes.error && userRes.error.code === 'PGRST116') {
                console.warn('[AuthProvider] User record not found, retrying once...');
                await new Promise(r => setTimeout(r, 1000));
                userRes = await supabase.from('users').select('*').eq('id', userId).single();
            }

            if (userRes.error) {
                console.error('[AuthProvider] User Fetch Error:', userRes.error);
                resetState();
                return;
            }

            const membRes = await supabase.from('company_members').select('company_id, role, companies(*)').eq('user_id', userId).eq('is_active', true);

            if (membRes.error) {
                console.error('[AuthProvider] Memberships Fetch Error:', membRes.error);
                // No llamo a resetState aquí para permitir que el perfil de usuario se mantenga
                // incluso si no tiene compañías (onboarding incompleto)
                setUser(userRes.data);
                setIsLoading(false);
                return;
            }

            const userData = userRes.data;
            const memberships = membRes.data || [];
            const companies: Company[] = memberships
                .map((m: any) => m.companies)
                .filter(Boolean);

            console.log(`[AuthProvider] Data loaded. User: ${userData.id}, Companies: ${companies.length}, SuperAdmin: ${userData.is_super_admin}`);

            setUserCompanies(companies);
            setUser(userData);

            // LOGICA DE IMPERSONACIÓN / REDIRECCIÓN
            if (userData.is_super_admin) {
                // Si es Super Admin, por defecto entra en modo plataforma y no auto-selecciona empresa
                // a menos que estemos ya impersonando (re-load) o tenga una por defecto y NO queramos forzar plataforma.
                // Pero según el plan: "if is_super_admin: DO NOT auto-select company on login, route to Platform Home"
                setMode('platform');
                setCurrentCompany(null);
                setUserRole(null);
                useStore.getState().setImpersonation(false, null);
            } else {
                // Flujo estándar para usuarios normales
                const targetCompany =
                    companies.find(c => c.id === userData.default_company_id) ||
                    companies[0];

                const membership = memberships.find(
                    (m: any) => m.company_id === targetCompany?.id
                );

                if (targetCompany && membership) {
                    const role = membership.role as UserRole;
                    const level = getSuspensionLevel(
                        targetCompany.subscription_status,
                        targetCompany.grace_period_ends_at
                    );

                    setCurrentCompany(targetCompany);
                    setUserRole(role);
                    setSuspensionLevel(level);
                    setMode('company');
                    useStore.getState().setImpersonation(false, null); // Usuario normal no impersona
                    useStore.getState().setCurrentCompany(targetCompany.id, role);
                } else {
                    setCurrentCompany(null);
                    setUserRole(null);
                    setMode('company');
                    useStore.getState().setImpersonation(false, null);
                }
            }

        } catch (error) {
            console.error('[AuthProvider] loadUserData - CRITICAL:', error);
            resetState();
        } finally {
            console.log('[AuthProvider] loadUserData - COMPLETED');
            setIsLoading(false);
            isFetching.current = false;
        }
    }, [resetState]);

    const refreshAuth = useCallback(async () => {
        console.log('[AuthProvider] refreshAuth called manually');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await loadUserData(session.user.id);
        } else {
            resetState();
        }
    }, [loadUserData, resetState]);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        console.log('[AuthProvider] Initializing...');

        const init = async () => {
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
                console.log('[AuthProvider] Auth Event:', event, 'User:', session?.user?.id);

                if (event === 'SIGNED_IN' && session?.user) {
                    // Si ya estamos cargando este usuario, no interrumpir
                    if (user?.id === session.user.id && !isLoading) {
                        console.log('[AuthProvider] SIGNED_IN - Already have user, skipping load');
                        return;
                    }
                    await loadUserData(session.user.id);
                } else if (event === 'SIGNED_OUT') {
                    resetState();
                } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                    if (!user) await loadUserData(session.user.id);
                } else if (event === 'INITIAL_SESSION' && session?.user) {
                    if (!user) await loadUserData(session.user.id);
                }
            });

        return () => {
            subscription.unsubscribe();
        };
    }, [loadUserData, resetState]);

    const enterCompanyAsFounder = async (companyId: string) => {
        if (!user?.is_super_admin) return;

        console.log('[AuthProvider] enterCompanyAsFounder:', companyId);
        setIsLoading(true);
        try {
            const { data: company, error } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (error || !company) throw error || new Error('Company not found');

            setMode('company');
            setImpersonatedCompanyId(companyId);
            setCurrentCompany(company);
            setUserRole('admin'); // Rol virtual para el fundador

            const level = getSuspensionLevel(
                company.subscription_status,
                company.grace_period_ends_at
            );
            setSuspensionLevel(level);
            setStoreCompany(companyId, 'admin');

        } catch (error) {
            console.error('Error entering company as founder:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const exitImpersonation = () => {
        console.log('[AuthProvider] exitImpersonation');
        setMode('platform');
        setImpersonatedCompanyId(null);
        setCurrentCompany(null);
        setUserRole(null);
        setSuspensionLevel('none');
        useStore.getState().setImpersonation(false, null);
        // No llamamos a logout(), solo reseteamos el context a nivel plataforma
    };

    const switchCompany = async (companyId: string) => {
        if (!user) return;

        // Si estamos impersonando, switchCompany debería quizás resetear impersonación o simplemente cambiar de empresa impersonada
        // Para simplificar, si es super admin, dejamos que use enterCompanyAsFounder. 
        // Si es usuario normal, sigue su flujo.
        if (user.is_super_admin) {
            await enterCompanyAsFounder(companyId);
            return;
        }

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

        setMode('company');
        setImpersonatedCompanyId(null);
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

    return (
        <AuthContext.Provider value={{
            user,
            currentCompany,
            userCompanies,
            userRole,
            suspensionLevel,
            isLoading,
            switchCompany,
            resetState,
            refreshAuth,
            mode,
            impersonatedCompanyId,
            enterCompanyAsFounder,
            exitImpersonation
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
};
