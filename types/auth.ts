import { User, Company, UserRole } from '../types';
import { SuspensionLevel } from '../utils/subscription';

export interface AuthContextType {
    user: User | null;
    currentCompany: Company | null;
    userCompanies: Company[];
    userRole: UserRole | null;
    suspensionLevel: SuspensionLevel;
    isLoading: boolean;
    switchCompany: (companyId: string) => Promise<void>;
}

export interface TenantGuardProps {
    minRole?: UserRole;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}
