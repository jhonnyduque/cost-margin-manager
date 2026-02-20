import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, XCircle } from 'lucide-react';

const ImpersonationBanner: React.FC = () => {
    const { mode, currentCompany, user, exitImpersonation } = useAuth();

    const isSuperAdmin = (user as any)?.is_super_admin;
    const isImpersonating = mode === 'company' && isSuperAdmin && currentCompany;

    if (!isImpersonating) return null;

    return (
        <div className="animate-in slide-in-from-top sticky top-0 z-[60] flex items-center justify-between bg-blue-600 px-4 py-2 text-white shadow-lg duration-300 md:px-8">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/20 p-1.5">
                    <ShieldAlert size={18} className="text-white" />
                </div>
                <div>
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest md:text-sm">
                        Modo Fundador Activo
                        <span className="font-medium opacity-60">|</span>
                        <span className="text-blue-100">Inspeccionando: {currentCompany.name}</span>
                    </p>
                </div>
            </div>

            <button
                onClick={exitImpersonation}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/20 active:scale-95 md:text-xs"
            >
                <XCircle size={14} />
                Salir y Volver a Plataforma
            </button>
        </div>
    );
};

export default ImpersonationBanner;
