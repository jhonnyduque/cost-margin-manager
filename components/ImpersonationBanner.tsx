import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, XCircle } from 'lucide-react';

const ImpersonationBanner: React.FC = () => {
    const { mode, currentCompany, user, exitImpersonation } = useAuth();

    const isSuperAdmin = (user as any)?.is_super_admin;
    const isImpersonating = mode === 'company' && isSuperAdmin && currentCompany;

    if (!isImpersonating) return null;

    return (
        <div className="bg-blue-600 text-white py-2 px-4 md:px-8 flex items-center justify-between sticky top-0 z-[60] shadow-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-1.5 rounded-lg">
                    <ShieldAlert size={18} className="text-white" />
                </div>
                <div>
                    <p className="text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        Modo Fundador Activo
                        <span className="opacity-60 font-medium">|</span>
                        <span className="text-blue-100">Inspeccionando: {currentCompany.name}</span>
                    </p>
                </div>
            </div>

            <button
                onClick={exitImpersonation}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border border-white/20 active:scale-95"
            >
                <XCircle size={14} />
                Salir y Volver a Plataforma
            </button>
        </div>
    );
};

export default ImpersonationBanner;
