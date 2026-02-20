export const capabilities = {
    // Cost Management
    view_costs: true,
    edit_costs: true,
    delete_costs: true,

    // Product Management
    view_products: true,
    edit_products: true,
    delete_products: true,

    // Raw Materials
    view_raw_materials: true,
    edit_raw_materials: true,

    // Team Management
    view_team: true,
    manage_team: true,

    // System
    configure_system: true,
    manage_tenants: true
} as const;

export type Capability = keyof typeof capabilities;
