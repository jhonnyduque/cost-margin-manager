import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Hexagon } from 'lucide-react';
import { MODULES } from '../../platform/modules.registry';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '../../platform/useSubscription';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
    const { user } = useAuth();
    const { enabledModules } = useSubscription();

    return (
        <aside
            className={`
                fixed left-0 top-0 z-40 h-screen bg-slate-900 text-slate-100 transition-all duration-300
                ${collapsed ? 'w-16' : 'w-64'}
            `}
        >
            {/* Header / Brand */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800">
                {!collapsed && (
                    <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
                        <Hexagon className="h-6 w-6 text-indigo-500 fill-indigo-500/20" />
                        <span>BETO OS</span>
                    </div>
                )}
                {collapsed && (
                    <div className="mx-auto">
                        <Hexagon className="h-6 w-6 text-indigo-500 fill-indigo-500/20" />
                    </div>
                )}
                <button
                    onClick={onToggle}
                    className="ml-auto rounded p-1 hover:bg-slate-800 text-slate-400"
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="p-2 space-y-1 mt-4">
                {Object.values(MODULES).map((module) => {
                    const visible = user?.is_super_admin || (
                        enabledModules.includes('*') || enabledModules.includes(module.id)
                    );

                    if (!visible && module.id !== 'control_center') return null;
                    if (module.id === 'control_center' && !user?.is_super_admin) return null;

                    const Icon = module.icon;

                    return (
                        <NavLink
                            key={module.id}
                            to={module.path}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-3 py-2 rounded-md transition-colors
                                ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                                ${collapsed ? 'justify-center' : ''}
                            `}
                            title={collapsed ? module.name : ''}
                        >
                            <Icon size={20} />
                            {!collapsed && <span className="text-sm font-medium">{module.name}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Footer / Version */}
            {!collapsed && (
                <div className="absolute bottom-4 left-0 w-full px-4 text-center">
                    <span className="text-xs text-slate-600 font-mono">v11.0.0</span>
                </div>
            )}
        </aside>
    );
};