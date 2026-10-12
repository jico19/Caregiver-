# Caregiver Platform — Heads-Up Technical Documentation

Welcome to the centralized technical documentation for the **Caregiver Platform**.
These documents provide clear, modular, and actionable architecture guides for engineers, administrators, and technical stakeholders.

---

## Document Catalog

Documentation is divided into six (6) distinct areas of concern:

| Index | Document | Scope & Contents |
|---|---|---|
| **01** | [**Codebase Architecture**](./01_codebase.md) | Technology stack, frontend and backend repository layout, routing, state-as-a-boundary pattern, and dev/build commands. |
| **02** | [**Database Schema**](./02_database_schema.md) | Comprehensive catalog of PostgreSQL tables, foreign key relationships, soft-deletion pattern, legal hold flags, and atomic stored procedures. |
| **03** | [**API Endpoints**](./03_endpoints.md) | Full reference of all 77+ FastAPI endpoints: HTTP methods, URL paths, required roles, state scope rules, and request/response specifications. |
| **04** | [**Database Migrations**](./04_migrations.md) | Chronological log of 19 SQL migrations from Sept 2026 to Oct 2026, forward-only guidelines, and indexing performance standards. |
| **05** | [**Authorization & Security Rules**](./05_authorization_rules.md) | Detailed explanation of multi-tenancy, RBAC roles (`super_admin`, `administrator`, `caregiver`, `client`), `AdminScope` enforcement, fail-closed principles, and token validation. |
| **06** | [**Implemented Workflows**](./06_implemented_workflows.md) | Visual sequence and architecture diagrams for seven (7) core workflows: Caregiver Onboarding, Client Intake, Prior Authorizations & Burndown, Staffing Gates, Care Plans, Training, and Legal Retention. |

---

## Key Development Guidelines

1. **Multi-Tenant State Scoping**:
   - The platform serves Florida, Indiana, and Georgia within a single shared database.
   - Never trust client-supplied `state_id`. Always enforce the `require_admin_scoped` dependency on backend routes.
2. **Database Modifications**:
   - Never modify existing migrations. Always generate a new forward-only migration.
   - Never execute production database pushes without prior dry-run review and explicit user approval.
3. **Data Integrity & HIPAA Compliance**:
   - Do not perform hard `DELETE` operations on operational tables; use soft deletion.
   - Evidentiary tables like `audit_logs` and `client_agreements` are strictly immutable.
