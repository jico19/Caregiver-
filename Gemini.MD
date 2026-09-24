# Project Development Context

## 1. Project Overview

This project is a unified healthcare/home-care agency web platform serving three U.S. states:

* Florida (FL)
* Indiana (IN)
* Georgia (GA)

The platform will provide:

1. A public-facing website for each state.
2. A Caregiver Portal.
3. A Client Portal.
4. An Administrator Dashboard.
5. Document management.
6. Training management.
7. Authorization management.
8. Notifications and automation.
9. Reports and analytics.
10. Secure access and audit logging.

The application must be designed as **one unified platform**, not three independent applications.

---

# 2. Primary Development Goal

Build a maintainable MVP within approximately **3 months** using an entry-level development approach.

The priority is:

1. Correct architecture
2. Working core workflows
3. Secure access control
4. State-specific functionality
5. Maintainable code
6. Testing
7. Deployment

Avoid unnecessary complexity.

Do not introduce microservices, Kubernetes, complex event-driven architecture, or other infrastructure that is not required by the current scope.

A well-structured monolithic backend is preferred.

---

# 3. Technology Stack

## Frontend

* React
* Vite
* React Router

## Backend

* FastAPI
* Python
* Pydantic

## Database / Backend Services

* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage

## Architecture

```text
React + Vite
      |
      | HTTP / REST API
      v
FastAPI
      |
      +----------------------+
      |                      |
      v                      v
PostgreSQL              Supabase Storage
      |
      v
Application Data
```

FastAPI should contain the primary application business logic.

React should primarily handle:

* UI
* Client-side routing
* Form interaction
* API communication
* Displaying application state

Supabase should provide:

* PostgreSQL database
* Authentication where appropriate
* Secure object/file storage

---

# 4. Critical Architectural Principle

## One Application, Three State Contexts

Do NOT create:

```text
Florida React App
Indiana React App
Georgia React App
```

Do NOT duplicate entire page/component structures for every state.

Instead, build:

```text
One React Application
        |
        +-- Florida
        +-- Indiana
        +-- Georgia
```

State-specific information must be represented as data.

For example:

```text
State
├── Florida
├── Indiana
└── Georgia
```

Services, forms, licensing information, website content, and other state-specific resources should reference a state.

---

# 5. State-Based Routing

The preferred public URL structure is:

```text
/florida
/indiana
/georgia
```

State-specific pages:

```text
/florida/services
/florida/careers
/florida/forms
/florida/licensing
/florida/contact

/indiana/services
/indiana/careers
/indiana/forms
/indiana/licensing
/indiana/contact

/georgia/services
/georgia/careers
/georgia/forms
/georgia/licensing
/georgia/contact
```

The application should use dynamic routing where appropriate:

```text
/:state
/:state/services
/:state/careers
/:state/forms
/:state/licensing
/:state/contact
```

Validate the state against the database or a controlled list.

Valid states:

```text
florida
indiana
georgia
```

Do not blindly accept arbitrary state values.

---

# 6. State Switching

The public website should have a state switcher.

Example:

```text
State: [ Florida ▼ ]
```

If the user is currently on:

```text
/florida/services
```

and switches to Indiana, the preferred behavior is:

```text
/indiana/services
```

rather than automatically returning to:

```text
/indiana
```

The state switcher should preserve the current page where a corresponding page exists.

---

# 7. State-Aware Data Model

State-specific resources should reference a state.

Examples:

```text
Service
    state_id

Form
    state_id

WebsiteContent
    state_id

LicensingInformation
    state_id

DocumentRequirement
    state_id

TrainingRequirement
    state_id
```

Do not create separate tables such as:

```text
florida_services
indiana_services
georgia_services
```

unless there is a documented technical reason.

Prefer:

```text
services
---------
id
state_id
name
description
active
```

---

# 8. Initial Database Model

The exact schema may evolve, but the initial domain model should include the following concepts.

## State

```text
states
---------
id
code
name
slug
active
created_at
updated_at
```

Example:

```text
FL | Florida | florida
IN | Indiana | indiana
GA | Georgia | georgia
```

---

## User

```text
users
---------
id
email
role_id
state_id
status
created_at
updated_at
```

Do not store authentication passwords manually if Supabase Auth is being used.

---

## Role

Initial roles:

```text
Public
Caregiver
Client
Administrator
```

The implementation may later support more granular administrative roles.

Possible future roles:

```text
Super Admin
State Admin
HR/Admin
Client Admin
Training Admin
Read Only
```

---

# 9. Caregiver Domain

Core entities:

```text
Caregiver
CaregiverApplication
Document
DocumentRequirement
TrainingCourse
TrainingEnrollment
TrainingCompletion
Certificate
```

Caregiver application workflow:

```text
Registration
    ↓
Application Draft
    ↓
Application Submitted
    ↓
Under Review
    ↓
Approved / Rejected
    ↓
Onboarding
```

---

# 10. Client Domain

Core entities:

```text
Client
ClientReferral
Intake
Document
Authorization
AuthorizationHistory
CarePlan
ServiceSchedule
```

Client workflow:

```text
Referral
    ↓
Intake
    ↓
Document Submission
    ↓
Electronic Signature
    ↓
Administrative Review
    ↓
Admission
    ↓
Authorization
    ↓
Service Start
```

---

# 11. Document Management

Documents are a major component of the system.

Caregiver documents may include:

* Driver's License
* CPR Certificate
* CNA/HHA Certificate
* TB Test
* Physical Exam
* Background Check
* Social Security Card
* Auto Insurance
* Driver's Insurance
* Direct Deposit Form
* Other onboarding documents

Client documents may include:

* Insurance Cards
* Medicaid Documents
* Physician Orders
* Plan of Care
* Identification
* Authorizations
* Other required documents

Documents should have concepts such as:

```text
Document
---------
id
owner_id
document_type_id
state_id
storage_path
status
expiration_date
uploaded_at
reviewed_at
reviewed_by
created_at
updated_at
```

Possible statuses:

```text
Pending Review
Approved
Rejected
Expired
```

---

# 12. Secure File Storage

Sensitive documents must not be publicly accessible.

Examples of sensitive documents:

* Social Security Cards
* Driver's Licenses
* Medical documents
* Insurance documents
* Background checks

Use private Supabase Storage buckets.

The application must verify authorization before allowing document access.

Never rely solely on a hidden frontend button for document security.

Incorrect:

```text
Frontend hides Download button
```

Correct:

```text
Frontend requests document
        ↓
FastAPI verifies authenticated user
        ↓
FastAPI verifies ownership/permission
        ↓
FastAPI provides authorized access
```

---

# 13. Caregiver Portal

Primary routes:

```text
/caregiver/login
/caregiver/dashboard
/caregiver/application
/caregiver/documents
/caregiver/training
/caregiver/profile
/caregiver/notifications
```

Dashboard should display:

* Onboarding progress
* Missing documents
* Expiring documents
* Expired documents
* Pending requirements
* Training progress
* Announcements
* Notifications

---

# 14. Client Portal

Primary routes:

```text
/client/login
/client/dashboard
/client/intake
/client/documents
/client/authorizations
/client/care-plan
/client/schedule
/client/forms
/client/messages
/client/notifications
/client/profile
```

Messaging is optional and should not block the core MVP.

---

# 15. Administrator Dashboard

Primary routes:

```text
/admin/dashboard
/admin/caregivers
/admin/caregivers/:id
/admin/clients
/admin/clients/:id
/admin/documents
/admin/training
/admin/authorizations
/admin/referrals
/admin/reports
/admin/communications
/admin/users
/admin/settings
/admin/audit-logs
```

Administrator capabilities include:

### Caregiver Management

* Review applications
* Approve/reject applicants
* Track onboarding
* Review documents
* Monitor compliance
* Monitor training
* Send reminders

### Client Management

* Review referrals
* Approve admissions
* Monitor authorization status
* Track missing documents
* Monitor service start dates

### Reports

* Caregiver compliance
* Expiring credentials
* In-service completion
* Client authorization
* Referral sources
* Website inquiries

---

# 16. Authentication

Authentication should support:

* Registration
* Login
* Logout
* Password reset
* Email verification
* Session management

Use Supabase Auth rather than implementing password storage manually.

Authentication is different from authorization.

Authentication answers:

> Who is this user?

Authorization answers:

> What is this user allowed to access?

Both are required.

---

# 17. Role-Based Access Control

Every protected API endpoint must verify authorization on the backend.

Example:

```text
Caregiver
    ↓
GET /api/v1/admin/clients
    ↓
403 Forbidden
```

Do not rely on frontend routing for security.

A user who manually calls an API endpoint must receive the same authorization restrictions as a user navigating through the UI.

---

# 18. State-Based Authorization

State must also be considered when accessing sensitive resources.

Example:

```text
Florida Caregiver
```

should not automatically be able to access:

```text
Indiana Caregiver
```

unless the user's role explicitly permits it.

For administrators, permissions may eventually be:

```text
Admin
├── Florida
├── Indiana
└── Georgia
```

A Super Admin may have access to all states.

Do not implement cross-state access without an explicit authorization rule.

---

# 19. Training System

Training entities:

```text
TrainingCourse
TrainingModule
TrainingEnrollment
TrainingProgress
TrainingCompletion
Certificate
```

Basic workflow:

```text
Course Assigned
      ↓
Not Started
      ↓
In Progress
      ↓
Completed
      ↓
Certificate
```

The initial MVP does not need a sophisticated LMS.

Keep the first version simple.

---

# 20. Authorization Management

Authorization entity should contain concepts such as:

```text
Authorization
----------------
id
client_id
state_id
authorization_number
start_date
end_date
status
document_id
created_at
updated_at
```

Statuses:

```text
Pending
Active
Expiring Soon
Expired
Rejected
```

Authorization history should be preserved where practical.

---

# 21. Notifications

The initial automation system should support:

```text
Application Submitted
Application Approved
Application Rejected

Document Uploaded
Document Approved
Document Rejected
Document Expiring
Document Expired

Authorization Approved
Authorization Expiring
Authorization Expired

Training Assigned
Training Reminder
Training Overdue

New Referral
```

Start with **email notifications**.

SMS should be treated as a later integration if schedule permits.

---

# 22. Background Jobs

Expiration and reminder logic should not depend on a user opening the website.

Example:

```text
Scheduled Job
      ↓
Check documents
      ↓
Find documents expiring soon
      ↓
Create notification
      ↓
Send email
      ↓
Create audit record
```

The same pattern can be used for:

* Credential expiration
* Authorization expiration
* Training reminders
* Overdue training

Use a simple scheduled/background job mechanism appropriate to the hosting environment.

Do not introduce a distributed event system unless the requirements actually demand it.

---

# 23. API Design

Use versioned APIs:

```text
/api/v1/
```

Example:

```text
GET    /api/v1/states
GET    /api/v1/states/{state}/services
GET    /api/v1/states/{state}/forms

POST   /api/v1/caregivers/applications
GET    /api/v1/caregivers/me
GET    /api/v1/caregivers/me/documents

POST   /api/v1/clients/intake
GET    /api/v1/clients/me
GET    /api/v1/clients/me/authorizations

GET    /api/v1/admin/caregivers
GET    /api/v1/admin/clients
GET    /api/v1/admin/reports
```

Keep API naming consistent.

---

# 24. Frontend Architecture

Recommended structure:

```text
src/
├── assets/
│
├── components/
│   ├── common/
│   ├── public/
│   ├── caregiver/
│   ├── client/
│   └── admin/
│
├── layouts/
│   ├── PublicLayout.jsx
│   ├── CaregiverLayout.jsx
│   ├── ClientLayout.jsx
│   └── AdminLayout.jsx
│
├── pages/
│   ├── public/
│   ├── caregiver/
│   ├── client/
│   └── admin/
│
├── routes/
│   └── AppRoutes.jsx
│
├── services/
│   └── api.js
│
├── contexts/
│   ├── AuthContext.jsx
│   └── StateContext.jsx
│
├── hooks/
│
└── App.jsx
```

Avoid putting all logic inside page components.

---

# 25. Backend Architecture

Recommended structure:

```text
app/
├── main.py
│
├── api/
│   └── routes/
│       ├── auth.py
│       ├── states.py
│       ├── services.py
│       ├── forms.py
│       ├── caregivers.py
│       ├── clients.py
│       ├── documents.py
│       ├── training.py
│       ├── authorizations.py
│       └── admin.py
│
├── models/
├── schemas/
├── services/
├── repositories/
├── middleware/
├── core/
└── utils/
```

Keep responsibilities separated.

For example:

```text
Route
 ↓
Validation
 ↓
Service / Business Logic
 ↓
Repository / Data Access
 ↓
Database
```

Do not place all business logic inside FastAPI route functions.

---

# 26. Three-Month Development Roadmap

## Month 1 — Foundation

### Week 1

* Requirements
* Repository
* React + Vite
* FastAPI
* Supabase
* Environment configuration
* Development workflow

### Week 2

* PostgreSQL schema
* State model
* User model
* Roles
* API foundation
* Database migrations

### Week 3

* Authentication
* Authorization
* Protected routes
* Role-based access
* State-aware access

### Week 4

* Public website
* Florida
* Indiana
* Georgia
* State switcher
* State-specific services/forms/licensing

### Month 1 Deliverable

A working unified public platform with authentication.

---

# 27. Month 2 — Core Portals

## Week 5

Caregiver application:

```text
Register
→ Application
→ Submit
→ Admin Review
```

## Week 6

Document management:

```text
Upload
→ Store
→ Review
→ Approve/Reject
→ Expiration
```

## Week 7

Caregiver dashboard:

```text
Profile
Documents
Onboarding
Training
Notifications
```

## Week 8

Client portal:

```text
Registration
→ Intake
→ Documents
→ Signature
→ Admin Review
```

### Month 2 Deliverable

Working caregiver and client workflows.

---

# 28. Month 3 — Operations

## Week 9

Training:

* Courses
* Enrollment
* Progress
* Completion
* Certificates

## Week 10

Authorization:

* Authorization records
* Upload
* Approval
* Expiration
* History

## Week 11

Administration:

* Admin dashboard
* Caregiver management
* Client management
* Notifications
* Basic reports

## Week 12

* Integration testing
* Security testing
* RBAC testing
* File-access testing
* Bug fixing
* Deployment
* User acceptance testing

### Month 3 Deliverable

A deployable MVP.

---

# 29. MVP Priorities

## Must Have

```text
✓ React/Vite frontend
✓ FastAPI backend
✓ Supabase/PostgreSQL
✓ Authentication
✓ RBAC
✓ State-aware architecture
✓ Florida website
✓ Indiana website
✓ Georgia website
✓ State switcher
✓ Caregiver application
✓ Client intake
✓ Document upload
✓ Document review
✓ Document expiration
✓ Caregiver dashboard
✓ Client dashboard
✓ Admin dashboard
✓ Basic training
✓ Authorization tracking
✓ Email notifications
✓ Audit logs
```

## Stretch Features

```text
△ SMS
△ Secure messaging
△ Advanced reporting
△ Advanced analytics
△ Advanced e-signature integration
△ Complex scheduling
△ Advanced CMS
```

Do not allow stretch features to delay the core MVP.

---

# 30. Development Rules for AI Coding Agents

AI coding agents must follow these rules.

## Rule 1 — Understand Before Editing

Before modifying code:

1. Inspect the relevant files.
2. Understand existing architecture.
3. Identify dependencies.
4. Determine whether the requested feature already exists partially.
5. Then make the smallest appropriate change.

Do not rewrite large sections of the project unnecessarily.

---

## Rule 2 — Do Not Invent Architecture

Do not introduce:

* New frameworks
* New databases
* New authentication systems
* Microservices
* Message brokers
* Complex state-management libraries

unless explicitly requested or technically justified.

Current stack:

```text
React + Vite
FastAPI
Supabase
PostgreSQL
```

---

## Rule 3 — Preserve Existing Functionality

Before changing an existing feature:

```text
Understand
    ↓
Modify
    ↓
Test
    ↓
Verify existing behavior
```

Do not fix one feature by breaking another.

---

## Rule 4 — Backend Security Is Mandatory

Never trust:

* Frontend route protection
* Hidden buttons
* Client-provided user IDs
* Client-provided roles
* Client-provided state IDs

The backend must verify permissions.

---

## Rule 5 — Never Expose Sensitive Documents

Sensitive files must use private storage and authorized access.

Never create public document URLs for sensitive client/caregiver documents.

---

## Rule 6 — Validate User Input

Validate:

* Forms
* Query parameters
* Path parameters
* File types
* File sizes
* Dates
* IDs
* State values

Never blindly trust client input.

---

## Rule 7 — Keep State Generic

Do not hard-code business logic like:

```python
if state == "florida":
    ...
elif state == "indiana":
    ...
elif state == "georgia":
    ...
```

when the behavior can be represented by database configuration.

Prefer:

```text
state
  ↓
requirements/configuration
  ↓
behavior
```

Hard-coded state-specific behavior should only exist when the states genuinely have different business rules that cannot reasonably be represented as configuration.

---

## Rule 8 — Don't Overengineer

Prefer:

```text
Simple
Readable
Testable
Maintainable
```

over:

```text
Complex
Abstract
Highly optimized
Prematurely distributed
```

This is an entry-level 3-month MVP.

---

# 31. AI Agent Workflow

For every development task, the AI agent should follow:

```text
1. Read context.md
       ↓
2. Inspect relevant code
       ↓
3. Identify affected components
       ↓
4. Explain planned changes
       ↓
5. Implement
       ↓
6. Run tests
       ↓
7. Check for regressions
       ↓
8. Summarize changes
```

For larger features:

```text
Requirements
    ↓
Design
    ↓
Database
    ↓
Backend
    ↓
Frontend
    ↓
Integration
    ↓
Testing
```

Do not jump directly from requirements to UI code.

---

# 32. Definition of Done

A feature is not considered complete simply because the UI exists.

A feature is complete when:

```text
UI
 ↓
API
 ↓
Validation
 ↓
Database
 ↓
Authorization
 ↓
Error Handling
 ↓
Testing
```

are all working.

Example:

A "Document Upload" feature is not complete if the upload button works visually but:

* The API is missing validation.
* The file is publicly accessible.
* The database doesn't track the document.
* Another user can access it.
* Expiration dates aren't stored.
* Errors aren't handled.

---

# 33. Current Project Principle

The application should ultimately behave as:

```text
                    UNIFIED PLATFORM
                           │
            ┌──────────────┼──────────────┐
            │              │              │
         Florida         Indiana        Georgia
            │              │              │
            └──────────────┼──────────────┘
                           │
                      React/Vite
                           │
                        FastAPI
                           │
                       Supabase
                ┌──────────┼──────────┐
                │          │          │
             Database     Auth      Storage
                │
        ┌───────┼──────────────┐
        │       │              │
    Caregiver  Client       Admin
```

The central architectural principle is:

> **One platform, shared codebase, shared backend, shared database, state-aware data and permissions.**

Florida, Indiana, and Georgia are **contexts within the platform**, not separate applications.

---

# 34. Current Development Status

At the beginning of development, assume:

```text
Project: Not Started
Frontend: React + Vite
Backend: FastAPI
Database: Supabase PostgreSQL
Authentication: Supabase Auth
Storage: Supabase Storage

States:
- Florida
- Indiana
- Georgia

Current Phase:
Phase 0 — Project Initialization
```

Before implementing major features, establish the database schema, state architecture, authentication strategy, and project structure.

These decisions affect nearly every subsequent feature.
