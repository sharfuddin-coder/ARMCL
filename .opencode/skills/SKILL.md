# Custom Skills — AKIJ Mediplex CRM Toolkit

| Skill | File | Use Case |
|---|---|---|
| **crm** | [crm/SKILL.md](crm/SKILL.md) | End-to-end CRM: scaffold, secure, dashboard, CRUD, team mgmt, deploy |
| **deploy-render** | [deploy-render/SKILL.md](deploy-render/SKILL.md) | Deploy Node.js/Express app to Render free tier via GitHub |
| **secure-node-app** | [secure-node-app/SKILL.md](secure-node-app/SKILL.md) | Password hashing, sessions, rate limiting, headers, audit logging |
| **build-crm-dashboard** | [build-crm-dashboard/SKILL.md](build-crm-dashboard/SKILL.md) | KPI stat cards, SP performance tables, AI suggestions, back button |
| **add-crud-module** | [add-crud-module/SKILL.md](add-crud-module/SKILL.md) | Add any data type with full CRUD + frontend in minutes |
| **add-team-management** | [add-team-management/SKILL.md](add-team-management/SKILL.md) | Supervisor ↔ member assignment, team view, permission handling |

Trigger any skill with `@skill-name` (e.g., `@crm`, `@deploy-render`).

---

## Skill summaries

### crm
Master skill covering all 7 phases: Express server scaffold, JSON store, generic CRUD factory, password hashing, sessions, rate limiting, security headers, SPA frontend with role-based navigation, dashboard with clickable KPIs and AI suggestions, contact center call logging, team management with supervisor assignment, and Render deployment. Includes API endpoint and role reference tables.

### deploy-render
Project structure, render.yaml, GitHub push with curl+token, Render deployment via deploy URL. Covers cold starts, ephemeral filesystem, seeding on first run, env variables.

### secure-node-app
10-step security hardening: scrypt password hashing, 32-byte session tokens, authRequired/roleRequired middleware, rate-limited login, security headers (CSP, X-Frame-Options), input validation, data sanitization, audit logging, deployment checklist.

### build-crm-dashboard
Responsive KPI grid with color-coded borders, hover animations, click-to-navigate stat cards, SP performance table with target/achievement/percentage/AI columns, clickable rows with pre-filtered navigation, back button with nav history stack, targets data model joined with orders for achievement calculation.

### add-crud-module
10-step process: data wipe list, ID prefix, crudRoutes registration, nav item, renderPage case, view function with search/filter/table, modal create form, save/delete handlers, zero-data state, state wiring.

### add-team-management
10-step process: supervisor field on accounts, PUT permission for sales_head, nav+route, team view with member badges, checkbox assignment modal, save assignments (batch add/remove), dropdown member assign modal, customer count joins, permissions matrix, supervisor dropdown in customer forms.
