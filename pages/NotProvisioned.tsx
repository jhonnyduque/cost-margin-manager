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
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-[-10% ] right-[-10%] w-[40%] h-[40%] bg-red-50 rounded-full blur-[120px] opacity-60"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-50 rounded-full blur-[120px] opacity-60"></div>

            <div className="max-w-md w-full relative z-10">
                <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-white p-10 md:p-12 text-center">
                    <div className="mb-8 inline-flex items-center justify-center">
                        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shadow-lg shadow-red-50">
                            <ShieldAlert size={32} />
                        </div>
                    </div>

                    <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-4">
                        Cuenta no provisionada
                    </h1>

                    <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                        Tu usuario aún no ha sido asignado a ninguna empresa en la plataforma.
                        Por favor, contacta al administrador de <strong>BETO</strong> para completar tu acceso.
                    </p>

                    <div className="space-y-4">
                        <a
                            href="mailto:soporte@beto.com"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-base shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            Contactar Soporte <MessageSquare size={18} />
                        </a>

                        <button
                            onClick={handleLogout}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
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
