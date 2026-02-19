import React from 'react';
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
    resetState: () => void;
    refreshAuth: () => Promise<void>;
    // Impersonation Support
    mode: 'platform' | 'company';
    impersonatedCompanyId: string | null;
    enterCompanyAsFounder: (companyId: string) => Promise<void>;
    exitImpersonation: () => void;
}

export interface TenantGuardProps {
    minRole?: UserRole;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}
