
import React from 'react';
import { LimitIndicator } from '../components/LimitIndicator';
import { ShieldCheck, CreditCard } from 'lucide-react';

export default function Settings() {
    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
            {/* Header */}
            <header>
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <ShieldCheck size={24} />
                    </div>
                    <span className="font-black text-indigo-600 tracking-widest text-sm uppercase">Configuración</span>
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Ajustes del Sistema</h1>
                <p className="text-slate-500 font-medium mt-2">Gestiona tu plan, suscripción y preferencias de la plataforma.</p>
            </header>

            <main className="space-y-12">
                {/* Plan Section */}
                <section className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50"></div>

                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Plan y Uso</h2>
                            <p className="text-slate-500 text-sm font-medium">Información sobre tu suscripción actual y límites de consumo.</p>
                        </div>
                    </div>

                    <div className="max-w-md">
                        <LimitIndicator />
                    </div>
                </section>
            </main>
        </div>
    );
}
