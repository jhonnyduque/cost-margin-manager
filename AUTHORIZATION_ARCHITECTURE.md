# AUTHORIZATION ARCHITECTURE AUDIT

**Date**: 2026-02-19  
**Status**: Current Implementation Documented (No Changes Applied)

---

## 1. Hierarchy Model

The system uses a Dual-Layer Authorization model:

### A. Platform Level (Global)
*   **Storage**: `public.users.is_super_admin` (Boolean).
*   **Source of Truth**: Database table `users`.
*   **Propagation**: Synced to `auth.users.app_metadata.is_super_admin` via triggers/edge logic.
*   **Privileges**: 
    - Full bypass of all RLS policies (via `public.is_super_admin()` helper).
    - Access to `/beto` (Platform Admin panel).
    - Ability to create new companies via `beto-create-company` Edge Function.

### B. Company Level (Tenant)
*   **Storage**: `public.company_members.role` (Text).
*   **Roles (Hierarchy)**: `viewer` < `operator` < `manager` < `admin` < `owner`.
*   **Helper**: `public.has_role_level(cid, min_role)` function in Postgres.

---

## 2. Actual Permission Flow

### I. Frontend Entry (Route Guards)
1.  `App.tsx` checks if a user is logged in.
2.  If `location === '/beto'`, it enforces `is_super_admin` check.
3.  If a user has no `currentCompanyId` and is not a super admin, they are redirected to `/not-provisioned`.
4.  Individual pages (`Dashboard`, `Products`, etc.) are wrapped in `Layout` but mostly lack internal granular guards.

### II. State Management (`AuthProvider.tsx`)
1.  Fetches `user` from `public.users`.
2.  Fetches `memberships` from `public.company_members`.
3.  Populates `userRole` into `AuthContext` based on the `currentCompanyId`.
4.  Exposes `userRole` to components via `useAuth()`.

### III. Server-Side Enforcement (Edge Functions)
*   `beto-manage-team`: 
    - Verifies JWT validity.
    - Manually checks `requester.app_metadata.is_super_admin`.
    - Fetches the requester's role in the specific `company_id` from the database.
    - Only proceeds with `update/delete` if requester is `manager` or higher.
    - **Does not trust payload**: Re-verifies role against DB on every call.

### IV. Database Enforcement (RLS)
*   **Domain Tables** (`products`, `materials`, `batches`):
    - `SELECT`: Restricted to company members.
    - `INSERT/UPDATE`: Restricted to `operator` or higher.
    - `DELETE`: Restricted to `manager` or higher.
*   **Core Tables**: 
    - `companies`: `owner` only for updates.
    - `users`: Self-update only.

---

## 3. Analysis of Reality

| Page | Visibility | Component-Level Guards | Backend Guard |
| :--- | :--- | :--- | :--- |
| **Dashboard** | Any Member | None | RLS (Select) |
| **Products** | Any Member | None (Buttons visible to all) | RLS (Ins/Upd/Del) |
| **Materials** | Any Member | None (Buttons visible to all) | RLS (Ins/Upd/Del) |
| **Team** | Any Member | `isManager` restricts names/roles | Edge Function + RLS |
| **Settings** | Any Member | None | RLS |

---

## 4. Risks & Weak Points

### 🚨 Critical Vulnerabilities
1.  **UI/UX Disconnect (Permissions)**:
    - A `viewer` can see "Delete Product" or "Add Material" buttons. Clicking them results in a silent failure or a "403 Forbidden" network error. This creates a confusing user experience.
2.  **Inconsistent Guard Implementation**:
    - `Team.tsx` has robust frontend guards (disabling inputs, hiding UI).
    - `Products.tsx` and `RawMaterials.tsx` have **zero** frontend guards.
3.  **Redundant Authorization Logic**:
    - Role hierarchy is defined in Postgres (`has_role_level`), repeated in `Team.tsx` (`isManager`), and partially in Edge Functions. There is no central "Authority" service in the frontend to determine capabilities (e.g., `can(USER, 'DELETE_PRODUCT')`).

### ⚠️ Security Risks
1.  **Over-reliance on `is_super_admin`**:
    - The `public.is_super_admin()` helper bypasses **all** RLS. If a super admin account is compromised, the entire database (all tenants) is exposed.
2.  **Service Role Context**:
    - Edge Functions use `SUPABASE_SERVICE_ROLE_KEY`. This bypasses RLS. While they perform manual checks, any bug in the function logic could lead to cross-tenant data leaks.

---

## 5. Redundant Logic
*   **Hierarchy Mapping**: The array `['viewer', 'operator', 'manager', 'admin', 'owner']` exists in multiple migration files and is implicitly assumed in React constants.
*   **Role Reconciliation**: `AuthProvider` and `useStore` both track "Company" and "Role", leading to potential desync if not handled carefully during company switches.

---

## 6. Missing Central Authority
*   There is no unified `PermissionsProvider` or `Ability` system.
*   Determining if a user can perform an action requires manual `role === '...'` checks in every component, which is error-prone as the role hierarchy evolves.
