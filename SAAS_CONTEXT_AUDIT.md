# SAAS CONTEXT AUDIT: Platform vs Company

**Date**: 2026-02-19  
**Subject**: Analysis of the "BETO" (Founder) Experience

---

## 1. Entry Point Identification
*   **Default Entry**: There is **no dedicated entry point** for the Platform Owner. 
*   **Login Flow**: All users, including Super Admins, use the same `/login` route.
*   **Destination**: After login, the system attempts to resolve a "Company Context" immediately. If successful, it redirects to `/dashboard`.

## 2. Platform Mode vs Company Mode
*   **Current State**: The concept of "Modes" **does not exist** in the frontend.
*   **Company Bias**: The application is architected to always expect a `currentCompanyId`. Even as a Super Admin, if you are a member of at least one company (likely "CALCPRO" or "Particulart"), the system "forces" you into that tenant's view.
*   **Platform Layer**: Exists as a "secret" standalone page (`/beto`) that does not share the main application's sidebar, style, or navigation flow.

## 3. Automatic Redirection Logic
The "Trap" occurs in two stages:

### A. Selection (`AuthProvider.tsx`)
In `loadUserData`, the system performs this logic:
```typescript
const targetCompany = 
    companies.find(c => c.id === userData.default_company_id) || 
    companies[0];
// ... sets currentCompany to targetCompany
```
If you (BETO) created the first company or were invited to one, `companies[0]` will be selected automatically.

### B. Navigation (`App.tsx`)
The routing logic prioritizes the Company Dashboard:
- If a user is logged in AND has a `currentCompanyId`, they are granted access to the main `Layout`.
- The root path `/` and any unknown paths default to `/dashboard`.

## 4. Platform Owner Accessibility
*   **Route**: `c:\Users\Beto\Documents\APP\cost-margin-manager\pages\PlatformAdmin.tsx` (Route: `/beto`).
*   **Visibility**: There is **no link** to this page in the Sidebar (`Layout.tsx`). You must type the URL manually.
*   **Context Disconnect**: When you are in `/beto`, you are "outside" the app (no sidebar). When you move to "Dashboard", you are "inside" a specific company (effectively a member, not an owner).

## 5. Global Capabilities (Audit)
Does the system support viewing all companies? **YES (Backend only).**

*   **Database**: RLS allows you to `SELECT * FROM companies` because you are a Super Admin.
*   **UI (`/beto`)**: Shows a list of all tenants, basic metrics, and the ability to provision new ones.
*   **Missing**: The ability to "Impersonate" or "Enter" a company context as a Platform Owner without being a permanent member of that company.

## 6. Conclusion: Multi-tenant vs SaaS
The system is currently a **Robust Multi-Tenant Application** with a **Disconnected Admin Utility**.

It is NOT yet a "SaaS Platform" because:
1.  **Founder is Tenant-Bound**: You cannot represent the Platform without belonging to a Company.
2.  **No Global Switcher**: You cannot jump between companies from the main UI.
3.  **Disconnected Experience**: The Administration of the platform (`/beto`) feels like a secondary internal tool rather than the primary seat for the Founder.

---

### File References for Analysis:
- **Redirection Logic**: [AuthProvider.tsx](file:///c:/Users/Beto/Documents/APP/cost-margin-manager/hooks/AuthProvider.tsx#L89-L113)
- **Routing Guards**: [App.tsx](file:///c:/Users/Beto/Documents/APP/cost-margin-manager/App.tsx#L101-L110)
- **Platform UI**: [PlatformAdmin.tsx](file:///c:/Users/Beto/Documents/APP/cost-margin-manager/pages/PlatformAdmin.tsx)
- **Navigation Hiding**: [Layout.tsx](file:///c:/Users/Beto/Documents/APP/cost-margin-manager/components/Layout.tsx#L34-L40)
