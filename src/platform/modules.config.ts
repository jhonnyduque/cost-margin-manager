import {
    LayoutDashboard,
    Package,
    Layers,
    Users,
    Settings,
    Calculator
} from 'lucide-react';

export const modules = [
    {
        id: "cost-manager",
        name: "Cost Manager",
        route: "/dashboard",
        icon: "Calculator",
        enabled: true
    },
    {
        id: "products",
        name: "Products",
        route: "/productos",
        icon: "Package",
        enabled: true
    },
    {
        id: "inventory",
        name: "Raw Materials",
        route: "/materias-primas",
        icon: "Layers",
        enabled: true
    },
    {
        id: "team",
        name: "Team",
        route: "/equipo",
        icon: "Users",
        enabled: true
    },
    {
        id: "settings",
        name: "System Settings",
        route: "/settings",
        icon: "Settings",
        enabled: true
    }
];
