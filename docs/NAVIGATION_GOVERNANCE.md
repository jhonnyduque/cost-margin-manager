# BETO OS Navigation Governance

## Purpose
Define a stable navigation model for BETO OS across desktop, tablet, and mobile.

This governance follows these principles:
- primary operation belongs in primary navigation
- administration, analysis, support, and legal belong in `Mas`
- mobile bottom navigation must stay compact and icon-only
- links should not be duplicated between mobile bottom navigation and `Mas` without a strong reason

## Primary Rule

### Desktop
- Use the sidebar for daily operational modules.
- Use `Mas` for secondary, legal, support, and system destinations.

### Tablet
- Follow the same information architecture as desktop.
- Render through sidebar or drawer depending on breakpoint.

### Mobile
- Bottom navigation is reserved for core daily actions only.
- Everything secondary or administrative lives inside `Mas`.

## Official Navigation Matrix

| Link | Desktop sidebar | Tablet sidebar/drawer | Mobile bottom nav | Mobile Mas |
|---|---|---|---|---|
| Home / Dashboard | Yes | Yes | Yes | No |
| Productos | Yes | Yes | Yes | No |
| Produccion | Yes | Yes | Yes | No |
| Materias Primas | Yes | Yes | Yes | No |
| Mas | Yes | Yes | Yes | No |
| Stock | Yes | Yes | No | Yes |
| Compras | Yes | Yes | No | Yes |
| Proveedores | Yes | Yes | No | Yes |
| Clientes | Yes | Yes | No | Yes |
| Despachos | Yes | Yes | No | Yes |
| Equipo | Yes | Yes | No | Yes |
| Facturacion / Billing | Yes | Yes | No | Yes |
| Settings | No | No | No | Yes |
| Analytics | No | No | No | Yes |
| Reportes | No | No | No | Yes |
| AI Consultants | Yes | Yes | No | Yes |
| Derechos de Datos | No | No | No | Yes |
| Asuntos Legales | No | No | No | Yes |
| Cumplimiento | No | No | No | Yes |
| Ayuda | No | No | No | Yes |
| Estado del sistema | No | No | No | Yes |

## Official Mobile Bottom Navigation
- Home
- Productos
- Produccion
- Materias Primas
- Mas

## Official Mobile `Mas`

### Cuenta y acceso
- Equipo
- Facturacion
- Settings

### Operacion extendida
- Stock
- Compras
- Proveedores
- Clientes
- Despachos
- AI Consultants

### Herramientas
- Reportes
- Analytics

### Legal y cumplimiento
- Derechos de Datos
- Asuntos Legales
- Cumplimiento

### Soporte y sistema
- Ayuda
- Estado del sistema

## Governance Notes
- `Settings` must not appear in the tenant desktop sidebar if it already lives in `Mas`.
- `Analytics` must live under `Herramientas` inside `Mas`, below `Reportes`.
- Mobile bottom navigation must show icons only.
- `Equipo` and `Facturacion` remain accessible on mobile, but through `Mas`, not through the bottom navigation.
- If a module is `coming soon`, it may remain visible when product strategy requires roadmap signaling, but it should not displace active core modules from primary mobile navigation.

## Change Control
Any future navigation change should be validated against these questions:
1. Is this module part of the user's daily operational flow?
2. Does it deserve primary placement on mobile?
3. Will it create duplication with `Mas`?
4. Does it preserve a compact five-slot mobile bottom navigation?
5. Is the result consistent across desktop, tablet, and mobile?
