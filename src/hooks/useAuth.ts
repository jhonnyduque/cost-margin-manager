import { useAuthContext } from './AuthProvider';

export function useAuth() {
    const context = useAuthContext();

    return {
        user: context.user,
        currentCompany: context.currentCompany,
        userCompanies: context.userCompanies,
        userRole: context.userRole,
        suspensionLevel: context.suspensionLevel,
        isLoading: context.isLoading,
        switchCompany: context.switchCompany,
        resetState: context.resetState,
        refreshAuth: context.refreshAuth,
        // Impersonation Support
        mode: context.mode,
        impersonatedCompanyId: context.impersonatedCompanyId,
        enterCompanyAsFounder: context.enterCompanyAsFounder,
        exitImpersonation: context.exitImpersonation,
        isSigningOut: context.isSigningOut,
        setIsSigningOut: context.setIsSigningOut,
    };
}
