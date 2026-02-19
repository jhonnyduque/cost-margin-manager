# ACCESS MODEL DESIGN: Impersonation vs Membership

**Objective**: Determine the safest way for the Founder (BETO) to access tenant data.

---

## 1. Analysis of Models

| Feature | Membership-Based | **Platform Impersonation (Visitor Admin)** |
| :--- | :--- | :--- |
| **Logic** | Founder is added to `company_members` table for every tenant. | Founder remains "Universal" (Super Admin) and sets a target `company_id` in session. |
| **Audit Trails** | Looks like a regular member. Hard to distinguish Founder actions from staff actions. | Actions can be tagged as "SuperAdmin Override" in audit logs. |
| **Safe Exit** | Requires manual removal from company to "stop being a member". | Purely session-based. Closing the tab or switching mode resets the view. |
| **Permissions** | Limited by the assigned role (e.g. Viewer). | Inherits "Platform Rights" (Bypasses RLS). |
| **Data Pollution** | **HIGH**. The company team list shows the Founder's name/email. | **ZERO**. The Founder is never stored in the tenant's membership table. |

---

## 2. Proposed Design: The "Visitor Admin" Pattern

The safest approach is **Platform Impersonation**. We treat the Founder not as a "Member", but as a "Global Auditor".

### A. Non-Contamination Logic
*   **Database**: The `company_members` table **remains untouched**.
*   **Auth State**: The `AuthProvider` gains a `impersonatedCompanyId` state.
*   **Context**: If `impersonatedCompanyId` is set, the app behaves as if it's in that company, but `userRole` is hardcoded to `admin` or a special `super-admin` virtual role for UI purposes.

### B. Audit Traceability
Every database operation performed during an impersonation session should include a `metadata` flag:
1.  **Direct RLS Bypass**: Since `public.is_super_admin()` is already used in policies, the SQL layer knows this is not a regular member.
2.  **Audit Log Entry**: The `audit_logs` table (if used by Edge Functions) should explicitly record `actor_role: 'PLATFORM_ADMIN'` instead of just 'admin'.

### C. Permission Contamination Prevention
*   **Virtual Role**: In "Impersonation Mode", the Founder **cannot be invited** to the team or have their role changed by a tenant Admin (because they aren't in the membership table).
*   **Read-Only Safety**: The UI can implement a "ReadOnly Inspection" toggle. In this mode, the Founder can see everything but "Mutation" buttons are disabled to prevent accidental data changes during debugging.

---

## 3. Minimal Change: Implementing the "Visit" Action

1.  **Platform Home**: Founder clicks "Inspect Company" on a specific tenant.
2.  **App State**: 
    - `currentCompanyId` is set to the Target ID.
    - `isImpersonating` is set to `true`.
3.  **UI Feedback**: A persistent **Global Banner** (Top of screen) should appear:
    > "Viewing [Company Name] as Platform Admin. [Exit Session]"
4.  **Exit Safety**: Clicking "Exit Session" clears the context and returns to the Platform level.

---

## 4. Why this is the "Safest Path"
1.  **Privacy**: Tenants don't see the Founder in their "Team" page.
2.  **Architecture**: It respects the existing Multi-Tenant structure.
3.  **Security**: It utilizes the existing `is_super_admin` bit which is the most secure "Source of Truth" in the system.
4.  **No Contamination**: You never become a "Part" of the company; you are only a "Visitor" with keys.
