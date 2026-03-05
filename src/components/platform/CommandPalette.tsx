import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
    Search, Layers, Users, CreditCard,
    Zap, Activity, LayoutDashboard, Settings
} from 'lucide-react';
import { typography } from '@/design/typography';

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    // Toggle the menu when ⌘K is pressed
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100 transition-all group"
            >
                <Search size={14} className="group-hover:text-slate-600" />
                <span className={`${typography.caption} font-medium group-hover:text-slate-600`}>Buscar o ejecutar...</span>
                <kbd className={`${typography.caption} font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200`}>⌘K</kbd>
            </button>

            <Command.Dialog
                open={open}
                onOpenChange={setOpen}
                label="Global Command Palette"
                className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            >
                <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center border-b border-slate-50 px-4">
                        <Search size={18} className="text-slate-500" />
                        <Command.Input
                            placeholder="¿Qué necesitas hacer hoy?"
                            className="w-full h-14 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-500 px-3"
                        />
                    </div>

                    <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-hide">
                        <Command.Empty className="py-6 text-center text-sm text-slate-500">
                            No se encontraron resultados.
                        </Command.Empty>

                        <Command.Group heading="Navegación" className={`px-2 py-1 ${typography.uiLabel} text-slate-500 uppercase tracking-wider`}>
                            <Item
                                icon={<LayoutDashboard size={16} />}
                                onSelect={() => runCommand(() => navigate('/dashboard'))}
                            >
                                Ir al Dashboard de Usuario
                            </Item>
                            <Item
                                icon={<Layers size={16} />}
                                onSelect={() => runCommand(() => navigate('/platform/environments'))}
                            >
                                Gestionar Entornos
                            </Item>
                            <Item
                                icon={<Users size={16} />}
                                onSelect={() => runCommand(() => navigate('/platform/users'))}
                            >
                                Gestionar Equipo
                            </Item>
                            <Item
                                icon={<CreditCard size={16} />}
                                onSelect={() => runCommand(() => navigate('/platform/billing'))}
                            >
                                Ver Facturación de Plataforma
                            </Item>
                        </Command.Group>

                        <Command.Group heading="Operaciones" className={`px-2 py-1 ${typography.uiLabel} text-slate-500 uppercase tracking-wider mt-4`}>
                            <Item
                                icon={<Zap size={16} />}
                                onSelect={() => runCommand(() => { })}
                            >
                                Verificar System Health
                            </Item>
                            <Item
                                icon={<Activity size={16} />}
                                onSelect={() => runCommand(() => { })}
                            >
                                Ver Logs de Actividad
                            </Item>
                            <Item
                                icon={<Settings size={16} />}
                                onSelect={() => runCommand(() => navigate('/settings'))}
                            >
                                Configuración de Perfil
                            </Item>
                        </Command.Group>
                    </Command.List>

                    <div className="border-t border-slate-50 p-3 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-1.5 ${typography.caption} text-slate-500 font-medium`}>
                                <kbd className="bg-white px-1 py-0.5 rounded border border-slate-200">ENTER</kbd> Seleccionar
                            </div>
                            <div className={`flex items-center gap-1.5 ${typography.caption} text-slate-500 font-medium`}>
                                <kbd className="bg-white px-1 py-0.5 rounded border border-slate-200">ESC</kbd> Cerrar
                            </div>
                        </div>
                        <span className={`${typography.caption} font-bold text-slate-300`}>BETO OS CMD v1.0</span>
                    </div>
                </div>
            </Command.Dialog>
        </>
    );
}

function Item({ children, icon, onSelect }: { children: React.ReactNode, icon: React.ReactNode, onSelect: () => void }) {
    return (
        <Command.Item
            onSelect={onSelect}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 aria-selected:bg-indigo-50 aria-selected:text-indigo-600 cursor-pointer transition-colors"
        >
            {icon}
            {children}
        </Command.Item>
    );
}
