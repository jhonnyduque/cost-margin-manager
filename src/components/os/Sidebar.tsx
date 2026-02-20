import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Hexagon } from 'lucide-react';
import { MODULES } from '../../platform/modules.registry';
import { useCapabilities } from '../../platform/useCapabilities';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '../../platform/useSubscription';

export const Sidebar: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const { can } = useCapabilities();
    const { user } = useAuth();
    const { enabledModules } = useSubscription();

    // Helper to check visibility
    const isModuleVisible = (moduleKey: keyof typeof MODULES) => {
        const module = MODULES[moduleKey];

        // Super Admin sees everything (or check capability)
        if (user?.is_super_admin) return true;

        // Check if module is enabled in subscription (for company mode)
        // Note: 'enabledModules' from useSubscription tells us which IDs are allowed.
        // We match MODULES[key].id against enabledModules
        if (enabledModules.includes('*')) return true;

        // Some core modules might not be in subscription config explicit list but base?
        // Let's assume subscription config maps to these IDs.
        // If not found in enabledModules, hide.
        if (!enabledModules.includes(module.id)) return false;

        // Check Capability
        if (module.requiredCapability) {
            // This check might be redundant if enabledModules is authoritative, but good for safety
            // return can(module.requiredCapability);
        }

        return true;
    };

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
                    onClick={() => setCollapsed(!collapsed)}
                    className="ml-auto rounded p-1 hover:bg-slate-800 text-slate-400"
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="p-2 space-y-1 mt-4">
                {Object.values(MODULES).map((module) => {
                    // Primitive visibility check: if super admin OR enabled
                    const visible = user?.is_super_admin || (
                        enabledModules.includes('*') || enabledModules.includes(module.id)
                    );

                    // If not visible, don't render
                    if (!visible && module.id !== 'control_center') return null;
                    // Control Center usually restricted to Super Admin via capability, verify:
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

            {/* Footer / Version if expanded */}
            {!collapsed && (
                <div className="absolute bottom-4 left-0 w-full px-4 text-center">
                    <span className="text-xs text-slate-600 font-mono">v11.0.0</span>
                </div>
            )}
        </aside>
    );
};
