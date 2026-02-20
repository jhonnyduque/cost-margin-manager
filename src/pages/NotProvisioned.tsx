import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const NotProvisioned: React.FC = () => {
    const { resetState } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        resetState();
        navigate('/login');
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8fafc] p-6">
            {/* Background Decor */}
            <div className="top-[-10% ] absolute right-[-10%] size-2/5 rounded-full bg-red-50 opacity-60 blur-[120px]"></div>
            <div className="absolute bottom-[-10%] left-[-10%] size-2/5 rounded-full bg-orange-50 opacity-60 blur-[120px]"></div>

            <div className="relative z-10 w-full max-w-md">
                <div className="rounded-[2.5rem] border border-white bg-white p-10 text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] md:p-12">
                    <div className="mb-8 inline-flex items-center justify-center">
                        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 shadow-lg shadow-red-50">
                            <ShieldAlert size={32} />
                        </div>
                    </div>

                    <h1 className="mb-4 text-2xl font-black tracking-tight text-slate-900">
                        Cuenta no provisionada
                    </h1>

                    <p className="mb-8 font-medium leading-relaxed text-slate-500">
                        Tu usuario aún no ha sido asignado a ninguna empresa en la plataforma.
                        Por favor, contacta al administrador de <strong>BETO</strong> para completar tu acceso.
                    </p>

                    <div className="space-y-4">
                        <a
                            href="mailto:soporte@beto.com"
                            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 text-base font-black text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 active:scale-[0.98]"
                        >
                            Contactar Soporte <MessageSquare size={18} />
                        </a>

                        <button
                            onClick={handleLogout}
                            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-100 py-4 text-base font-black text-slate-600 transition-all hover:bg-slate-200 active:scale-[0.98]"
                        >
                            Cerrar Sesión <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotProvisioned;
