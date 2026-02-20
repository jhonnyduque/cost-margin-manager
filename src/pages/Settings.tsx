
import React from 'react';
import { LimitIndicator } from '../components/LimitIndicator';
import { ShieldCheck, CreditCard } from 'lucide-react';

export default function Settings() {
    return (
        <div className="animate-in fade-in mx-auto max-w-4xl space-y-12 duration-700">
            {/* Header */}
            <header>
                <div className="mb-2 flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                        <ShieldCheck size={24} />
                    </div>
                    <span className="text-sm font-black uppercase tracking-widest text-indigo-600">Configuración</span>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900">Ajustes del Sistema</h1>
                <p className="mt-2 font-medium text-slate-500">Gestiona tu plan, suscripción y preferencias de la plataforma.</p>
            </header>

            <main className="space-y-12">
                {/* Plan Section */}
                <section className="relative overflow-hidden rounded-[2.5rem] border border-white bg-white p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] md:p-12">
                    <div className="absolute right-0 top-0 size-32 rounded-bl-full bg-indigo-50 opacity-50"></div>

                    <div className="mb-8 flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-slate-900">Plan y Uso</h2>
                            <p className="text-sm font-medium text-slate-500">Información sobre tu suscripción actual y límites de consumo.</p>
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
