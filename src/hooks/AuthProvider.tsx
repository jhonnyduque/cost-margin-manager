import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useStore } from '../store';
import { User, Company, UserRole } from '@/types';
import { getSuspensionLevel, SuspensionLevel } from '../utils/subscription';

// 🔧 Logging helper - solo muestra logs informativos en desarrollo
// Errores y warnings SIEMPRE se muestran (en cualquier entorno)
const log = {
    debug: (...args: any[]) => import.meta.env.DEV && console.debug('[AuthProvider]', ...args),
    info: (...args: any[]) => import.meta.env.DEV && console.info('[AuthProvider]', ...args),
    warn: (...args: any[]) => console.warn('[AuthProvider]', ...args),
    error: (...args: any[]) => console.error('[AuthProvider]', ...args),
};

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
    // Logout Guard Support
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

    // Impersonation State
    const [mode, setMode] = useState<'platform' | 'company'>('company');
    const [impersonatedCompanyId, setImpersonatedCompanyId] = useState<string | null>(null);

    // Logout Lock
    const [isSigningOut, setIsSigningOut] = useState(false);

    // 🔧 FIX #1: Refs para valores que cambian pero NO deben regenerar funciones
    const isSigningOutRef = useRef(false);
    const userIdRef = useRef<string | null>(null);
    const isFetchingRef = useRef(false);
    const hasInitializedRef = useRef(false);

    // Aumentado a 3000ms para dar más margen en producción/multi-tab
    const lastLoadTimeRef = useRef<number>(0);
    const LOAD_DEBOUNCE_MS = 3000;

    // 🔧 FIX #2: Sincronizar refs con state (sin causar re-renders)
    useEffect(() => {
        isSigningOutRef.current = isSigningOut;
    }, [isSigningOut]);

    useEffect(() => {
        userIdRef.current = user?.id || null;
    }, [user?.id]);

    const setIsSigningOutSafe = useCallback((val: boolean) => {
        isSigningOutRef.current = val;
        setIsSigningOut(val);
    }, []);

    const setStoreCompany = useStore((state) => state.setCurrentCompany);

    const resetState = useCallback(() => {
        log.info('resetState called');
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

    // 🔧 FIX #3: loadUserData SIN user?.id en dependencias
    const loadUserData = useCallback(async (userId: string, force: boolean = false) => {
        const now = Date.now();

        // Guard: skip si ya está cargado el mismo usuario y no es force
        if (!force && userIdRef.current === userId) {
            log.info(`Already loaded user ${userId}, skipping unless forced`);
            return;
        }

        if (!force && (now - lastLoadTimeRef.current) < LOAD_DEBOUNCE_MS) {
            log.debug(`loadUserData - DEBOUNCED (${now - lastLoadTimeRef.current}ms)`);
            return;
        }

        if (isSigningOutRef.current || isFetchingRef.current) {
            log.debug(`loadUserData - SKIPPED (SigningOut: ${isSigningOutRef.current}, Fetching: ${isFetchingRef.current})`);
            return;
        }

        isFetchingRef.current = true;
        lastLoadTimeRef.current = now;
        log.debug('loadUserData - START for:', userId, 'current user:', userIdRef.current || 'none', 'force:', force);

        log.debug('Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? 'EXISTS' : 'MISSING');
        log.debug('Supabase Anon Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'EXISTS' : 'MISSING');

        try {
            setIsLoading(true);

            log.debug('Fetching user from Supabase...');

            let userRes = await supabase.from('users').select('*').eq('id', userId).single();

            log.debug('User query result:', {
                error: userRes.error,
                hasData: !!userRes.data
            });

            if (userRes.error && userRes.error.code === 'PGRST116') {
                log.warn('User record not found, retrying once...');
                await new Promise(r => setTimeout(r, 1000));
                userRes = await supabase.from('users').select('*').eq('id', userId).single();
            }

            if (userRes.error) {
                log.error('User Fetch Error:', userRes.error);
                log.error('Error details:', JSON.stringify(userRes.error, null, 2));
                resetState();
                return;
            }

            const membRes = await supabase.from('company_members')
                .select('company_id, role, companies(*)')
                .eq('user_id', userId)
                .eq('is_active', true);

            if (membRes.error) {
                log.error('Memberships Fetch Error:', membRes.error);
                setUser(userRes.data);
                setIsLoading(false);
                return;
            }

            const userData = userRes.data;
            const memberships = membRes.data || [];
            const companies: Company[] = memberships
                .map((m: any) => m.companies)
                .filter(Boolean);

            log.info(`Data loaded. User: ${userData.id}, Companies: ${companies.length}, SuperAdmin: ${userData.is_super_admin}`);

            setUserCompanies(companies);
            setUser(userData);

            if (userData.is_super_admin) {
                setMode('platform');
                setCurrentCompany(null);
                setUserRole(null);
                useStore.getState().setImpersonation(false, null);
            } else {
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
            log.error('loadUserData - CRITICAL:', error);
            log.error('Error stack:', error?.stack);
            resetState();
        } finally {
            log.debug('loadUserData - COMPLETED');
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [resetState]); // ← 🔧 ELIMINADO user?.id de las dependencias

    const refreshAuth = useCallback(async () => {
        log.info('refreshAuth called manually');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await loadUserData(session.user.id, true);
        } else {
            resetState();
        }
    }, [loadUserData, resetState]);

    // 🔧 FIX #4: useEffect de inicialización SIN user?.id en dependencias
    useEffect(() => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        log.info('Initializing...');

        const init = async () => {
            if (isSigningOutRef.current) {
                log.info('init() aborted: signing out');
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
            log.debug('Auth Event:', event, 'Session user ID:', session?.user?.id || 'none');

            if (isSigningOutRef.current && event !== 'SIGNED_OUT') {
                log.debug('Ignored event during signout:', event);
                return;
            }

            if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                log.debug(`Ignored ${event} (no data reload needed)`);
                return;
            }

            if (event === 'SIGNED_OUT') {
                log.info('SIGNED_OUT → resetState');
                resetState();
                return;
            }

            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
                const incomingUserId = session.user.id;

                // 🔧 FIX #5: Guard robusto usando ref (evita stale closure con isLoading)
                if (isFetchingRef.current || (userIdRef.current && userIdRef.current === incomingUserId)) {
                    log.info('SIGNED_IN/INITIAL_SESSION but user already loaded → SKIP reload');
                    return;
                }

                log.info('SIGNED_IN/INITIAL_SESSION → NEW or unknown user → loadUserData');
                await loadUserData(incomingUserId, true);
            }
        });

        return () => {
            log.debug('Unsubscribing from auth events');
            subscription.unsubscribe();
        };
    }, [loadUserData, resetState]); // ← 🔧 ELIMINADO user?.id de las dependencias

    // Efecto para redirección desde login (sin causar loops)
    useEffect(() => {
        if (!isLoading && user && window.location.pathname === '/login') {
            log.info('User detected on /login, triggering redirect');
        }
    }, [user, isLoading]);

    const enterCompanyAsFounder = async (companyId: string) => {
        if (!user?.is_super_admin) return;

        log.info('enterCompanyAsFounder:', companyId);
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
            log.error('Error entering company as founder:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const exitImpersonation = () => {
        log.info('exitImpersonation');
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
            log.error('Error switching company:', error);
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