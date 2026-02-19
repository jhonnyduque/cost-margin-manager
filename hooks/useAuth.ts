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
    };
}
