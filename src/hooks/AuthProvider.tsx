import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useStore } from '../store';
import { User, Company, UserRole } from '@/types';
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
    mode: 'platform' | 'company';
    impersonatedCompanyId: string | null;
    enterCompanyAsFounder: (companyId: string) => Promise<void>;
    exitImpersonation: () => void;
    isSigningOut: boolean;
    setIsSigningOut: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [userCompanies, setUserCompanies] = useState<Company[]>([]);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [suspensionLevel, setSuspensionLevel] = useState<SuspensionLevel>('none');
    const [isLoading, setIsLoading] = useState(true);

    const [mode, setMode] = useState<'platform' | 'company'>('company');
    const [impersonatedCompanyId, setImpersonatedCompanyId] = useState<string | null>(null);

    const [isSigningOut, setIsSigningOut] = useState(false);

    const isSigningOutRef = useRef(false);
    const isFetching = useRef(false);
    const lastLoadTimeRef = useRef<number>(0);
    const LOAD_DEBOUNCE_MS = 4000; // 4 segundos para evitar ráfagas en multi-tab

    // Refs para leer estado actual en callbacks asíncronos y listeners
    const userRef = useRef<User | null>(null);
    const userCompaniesRef = useRef<Company[]>([]);

    const setIsSigningOutSafe = useCallback((val: boolean) => {
        isSigningOutRef.current = val;
        setIsSigningOut(val);
    }, []);

    const setStoreCompany = useStore((state) => state.setCurrentCompany);
    const hasInitialized = useRef(false);

    // Sincronizar refs con estados
    useEffect(() => {
        userRef.current = user;
        userCompaniesRef.current = userCompanies;
    }, [user, userCompanies]);

    // Cleanup de refs al desmontar (opcional pero buena práctica)
    useEffect(() => {
        return () => {
            userRef.current = null;
            userCompaniesRef.current = [];
        };
    }, []);

    const resetState = useCallback(() => {
        console.log('[AuthProvider] resetState called');
        setUser(null);
        setCurrentCompany(null);
        setUserCompanies([]);
        setUserRole(null);
        setSuspensionLevel('none');
        setMode('company');
        setImpersonatedCompanyId(null);
        isSigningOutRef.current = false;
        lastLoadTimeRef.current = 0;
        useStore.getState().logout();
        setIsLoading(false);
        setIsSigningOut(false);
    }, []);

    const loadUserData = useCallback(async (userId: string, force: boolean = false) => {
        const now = Date.now();

        // Mutex: si ya hay fetch en curso → skip incluso force
        if (isFetching.current) {
            console.log(`[loadUserData] Fetch ya en curso → SKIP (userId: ${userId}, force: ${force})`);
            return;
        }

        // Debounce global (aplica siempre, incluso force)
        if ((now - lastLoadTimeRef.current) < LOAD_DEBOUNCE_MS) {
            console.log(`[loadUserData] DEBOUNCED (${now - lastLoadTimeRef.current}ms) - force: ${force}`);
            return;
        }

        // Guard completo usando refs (valor actual real)
        const fullyLoaded = userRef.current?.id === userId &&
            userCompaniesRef.current.length > 0 &&
            (currentCompany !== undefined || userRef.current?.is_super_admin);

        if (!force && fullyLoaded) {
            console.log(`[loadUserData] Datos completos ya cargados → SKIP completo`);
            return;
        }

        isFetching.current = true;
        lastLoadTimeRef.current = now;

        console.log('[loadUserData] START', {
            userId,
            currentUser: userRef.current?.id || 'none',
            force,
            fullyLoaded,
            companiesLoaded: userCompaniesRef.current.length
        });

        console.log('[AuthProvider] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
        console.log('[AuthProvider] Supabase Anon Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'EXISTS' : 'MISSING');

        try {
            setIsLoading(true);

            let userRes = await supabase.from('users').select('*').eq('id', userId).single();

            if (userRes.error && userRes.error.code === 'PGRST116') {
                console.warn('[AuthProvider] User not found, retrying once...');
                await new Promise(r => setTimeout(r, 1000));
                userRes = await supabase.from('users').select('*').eq('id', userId).single();
            }

            if (userRes.error) {
                console.error('[AuthProvider] User Fetch Error:', userRes.error);
                resetState();
                return;
            }

            const membRes = await supabase.from('company_members')
                .select('company_id, role, companies(*)')
                .eq('user_id', userId)
                .eq('is_active', true);

            if (membRes.error) {
                console.error('[AuthProvider] Memberships Fetch Error:', membRes.error);
                setUser(userRes.data);
                setIsLoading(false);
                return;
            }

            const userData = userRes.data;
            const memberships = membRes.data || [];
            const companies: Company[] = memberships.map((m: any) => m.companies).filter(Boolean);

            console.log(`[AuthProvider] Data loaded. User: ${userData.id}, Companies: ${companies.length}, SuperAdmin: ${userData.is_super_admin}`);

            setUserCompanies(companies);
            setUser(userData);

            if (userData.is_super_admin) {
                setMode('platform');
                setCurrentCompany(null);
                setUserRole(null);
                useStore.getState().setImpersonation(false, null);
            } else {
                const targetCompany = companies.find(c => c.id === userData.default_company_id) || companies[0];
                const membership = memberships.find((m: any) => m.company_id === targetCompany?.id);

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
                    useStore.getState().setImpersonation(false, null);
                    useStore.getState().setCurrentCompany(targetCompany.id, role);
                } else {
                    setCurrentCompany(null);
                    setUserRole(null);
                    setMode('company');
                    useStore.getState().setImpersonation(false, null);
                }
            }

        } catch (error: any) {
            console.error('[AuthProvider] loadUserData - CRITICAL:', error);
            resetState();
        } finally {
            console.log('[AuthProvider] loadUserData - COMPLETED');
            setIsLoading(false);
            isFetching.current = false;
        }
    }, [resetState, currentCompany]); // Dependencias mínimas y correctas

    const refreshAuth = useCallback(async () => {
        console.log('[AuthProvider] refreshAuth called manually');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await loadUserData(session.user.id, true);
        } else {
            resetState();
        }
    }, [loadUserData, resetState]);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        console.log('[AuthProvider] Initializing...');

        const init = async () => {
            if (isSigningOutRef.current) {
                console.log('[AuthProvider] init() aborted: signing out');
                resetState();
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await loadUserData(session.user.id, true);
            } else {
                resetState();
            }
        };

        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AuthProvider] Auth Event:', event, 'Session user ID:', session?.user?.id || 'none');

            if (isSigningOutRef.current && event !== 'SIGNED_OUT') {
                console.log('[AuthProvider] Ignored during signout:', event);
                return;
            }

            if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                console.log(`[AuthProvider] Ignored ${event}`);
                return;
            }

            if (event === 'SIGNED_OUT') {
                console.log('[AuthProvider] SIGNED_OUT → resetState');
                resetState();
                return;
            }

            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
                // Delay para agrupar eventos rápidos en multi-tab
                await new Promise(r => setTimeout(r, 200));

                const incomingUserId = session.user.id;

                // Guard usando refs (valor real actual)
                const fullyLoaded = userRef.current?.id === incomingUserId &&
                    userCompaniesRef.current.length > 0;

                if (fullyLoaded) {
                    console.log('[AuthProvider] User fully loaded after delay → SKIP');
                    return;
                }

                console.log('[AuthProvider] Loading data for new/unknown user');
                await loadUserData(incomingUserId, true);
            }
        });

        return () => {
            console.log('[AuthProvider] Unsubscribing from auth events');
            subscription.unsubscribe();
        };
    }, [loadUserData, resetState]); // Dependencias mínimas y seguras

    useEffect(() => {
        if (!isLoading && user && window.location.pathname === '/login') {
            console.log('[AuthProvider] User detected on /login, triggering redirect');
        }
    }, [user, isLoading]);

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
            setUserRole('admin');

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
    };

    const switchCompany = async (companyId: string) => {
        if (!user) return;

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
            exitImpersonation,
            isSigningOut,
            setIsSigningOut: setIsSigningOutSafe,
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