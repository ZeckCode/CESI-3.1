# CESI-3.1 — School Management System Flowchart

> Visual overview of the system architecture, authentication, role-based routing, and core business flows.

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend (React + Vite)"]
        direction TB
        UI["React SPA<br/>(BrowserRouter)"]
        AuthCtx["AuthProvider<br/>(Context)"]
        API["apiFetch<br/>(HTTP client)"]
        UI --> AuthCtx
        UI --> API
    end

    subgraph Server["Backend (Django + DRF)"]
        direction TB
        Router["URL Router<br/>(CESI/urls.py)"]
        Auth["JWT Authentication<br/>(CESI/authentication.py)"]
        Modules["REST Modules"]
        DB[("SQLite / DB<br/>db.sqlite3")]
        Router --> Auth
        Router --> Modules
        Modules --> DB
    end

    UI -->|"HTTP / JSON"| Router
    API -->|"Bearer Token"| Router

    subgraph Modules["REST Modules"]
        direction LR
        M1["accounts"]
        M2["enrollment"]
        M3["finance"]
        M4["grades"]
        M5["attendance"]
        M6["classmanagement"]
        M7["messaging"]
        M8["reminders"]
        M9["announcements"]
        M10["cmsmodule"]
    end
```

---

## 2. Authentication & Session Flow

```mermaid
flowchart TD
    Start([User opens app]) --> HasToken{Token in<br/>localStorage?}
    HasToken -- No --> LoginPage[Login Page]
    HasToken -- Yes --> Sync["GET /api/accounts/me/"]
    Sync --> SyncOK{Response OK?}
    SyncOK -- Yes --> SetUser["login(user)<br/>set context"]
    SyncOK -- No --> LoginPage

    LoginPage --> Submit[Submit credentials]
    Submit --> AuthAPI["POST /api/accounts/login/"]
    AuthAPI --> AuthOK{Valid?}
    AuthOK -- No --> Error[Show error]
    Error --> LoginPage
    AuthOK -- Yes --> StoreToken["Store JWT token"]
    StoreToken --> SetUser

    SetUser --> RoleCheck{Role?}
    RoleCheck -- ADMIN --> AdminDash["/admin"]
    RoleCheck -- TEACHER --> TeacherDash["/teacher"]
    RoleCheck -- PARENT_STUDENT --> StudentDash["/student"]

    Forgot[Forgot Password] --> ForgotAPI["POST /api/accounts/..."]
    ForgotAPI --> ResetLink[Email reset link]
    ResetLink --> ResetPage["/reset-password/:uid/:token"]
    ResetPage --> SetPass["/set-password/:uidb64/:token"]
```

---

## 3. Role-Based Routing (Frontend)

```mermaid
flowchart TD
    Root["/ (Home)"] --> Login["/login"]
    Login --> Protected{ProtectedRoute<br/>role check}

    Protected -->|"role=ADMIN"| Admin["AdminDashboard"]
    Protected -->|"role=TEACHER"| Teacher["TeacherDashboard"]
    Protected -->|"role=PARENT_STUDENT"| Student["StudentMain"]

    Admin --> A1["UserManagement"]
    Admin --> A2["EnrollmentManagement"]
    Admin --> A3["TuitionManagement"]
    Admin --> A4["GradesRecords"]
    Admin --> A5["ClassManagement"]
    Admin --> A6["AssignTeachers"]
    Admin --> A7["CMSModule"]
    Admin --> A8["Reports"]
    Admin --> A9["PaymentReminders"]
    Admin --> A10["AdminProofOfPayment"]
    Admin --> A11["IdGenerator"]
    Admin --> A12["Messages"]

    Teacher --> T1["TeacherDashboard"]
    Teacher --> T2["AttendanceMonitoring"]
    Teacher --> T3["Grade"]
    Teacher --> T4["Students"]
    Teacher --> T5["TeacherClassSchedule"]
    Teacher --> T6["SPerformance"]
    Teacher --> T7["Messages"]
    Teacher --> T8["TeacherReminders"]

    Student --> S1["Dashboard"]
    Student --> S2["StudentEnrollment / Reenrollment"]
    Student --> S3["Grades"]
    Student --> S4["Attendance"]
    Student --> S5["Schedule"]
    Student --> S6["Ledgers"]
    Student --> S7["ProofOfPayment"]
    Student --> S8["AcademicHistory"]
    Student --> S9["Message"]
    Student --> S10["StudentReminders"]
    Student --> S11["Profile"]

    Protected -->|"No access"| Unauthorized["/unauthorized"]
```

---

## 4. Enrollment Flow

```mermaid
flowchart TD
    Start([Student/Parent]) --> Apply["Submit enrollment<br/>(StudentEnrollment)"]
    Apply --> API["POST /api/enrollment/"]
    API --> Validate{Valid data?}
    Validate -- No --> Fix[Show validation errors]
    Fix --> Apply
    Validate -- Yes --> Save["Save enrollment record"]
    Save --> Status["Status = NEW"]
    Status --> AdminReview["Admin reviews<br/>(EnrollmentManagement)"]
    AdminReview --> Decision{Approve?}
    Decision -- Approve --> Active["Status = ACTIVE"]
    Decision -- Reject --> Rejected["Status = REJECTED"]
    Active --> Notify["Notify student/parent"]
    Rejected --> Notify
    Active --> Reenroll["Reenrollment available<br/>next term"]
```

---

## 5. Finance / Payment Flow

```mermaid
flowchart TD
    Start([Student/Parent]) --> ViewLedger["View Ledgers<br/>(finance)"]
    ViewLedger --> Pay["Submit payment /<br/>Proof of Payment"]
    Pay --> API["POST /api/finance/"]
    API --> Upload["Upload proof<br/>(ProofOfPayment)"]
    Upload --> Pending["Status = PENDING"]
    Pending --> AdminVerify["Admin verifies<br/>(AdminProofOfPayment)"]
    AdminVerify --> Verify{Verified?}
    Verify -- Approve --> Paid["Status = PAID<br/>update ledger"]
    Verify -- Reject --> Rejected["Status = REJECTED"]
    Paid --> Receipt["Generate receipt /<br/>update transaction history"]
    Rejected --> Resubmit["Student resubmits"]
    Resubmit --> Upload
```

---

## 6. Grades Flow

```mermaid
flowchart TD
    Teacher["Teacher"] --> Input["Enter grades<br/>(Grade.jsx)"]
    Input --> API["POST /api/grades/"]
    API --> Save["Save grade records"]
    Save --> DB[("Grades DB")]
    DB --> StudentView["Student views<br/>(Grades.jsx)"]
    DB --> AdminView["Admin views<br/>(GradesRecords.jsx)"]
    StudentView --> History["AcademicHistory"]
```

---

## 7. Attendance Flow

```mermaid
flowchart TD
    Teacher["Teacher"] --> Monitor["AttendanceMonitoring.jsx"]
    Monitor --> Mark["Mark attendance<br/>(present/absent)"]
    Mark --> API["POST /api/attendance/"]
    API --> Save["Save attendance record"]
    Save --> DB[("Attendance DB")]
    DB --> StudentView["Student views<br/>(Attendance.jsx)"]
    DB --> Reports["Admin reports"]
```

---

## 8. Messaging & Reminders Flow

```mermaid
flowchart TD
    Sender["Admin / Teacher / Student"] --> Compose["Compose message<br/>(messaging)"]
    Compose --> API["POST /api/messaging/"]
    API --> Save["Save message"]
    Save --> Inbox["Recipient inbox<br/>(Messages.jsx)"]

    Reminder["Admin creates reminder"] --> RemAPI["POST /api/reminders/"]
    RemAPI --> RemSave["Save reminder"]
    RemSave --> RemInbox["Recipient reminder inbox<br/>(*Reminders.jsx)"]
    RemInbox --> MarkRead["Mark as read<br/>/api/reminders/mark-read/<id>/"]
```

---

## 9. CMS / Announcements Flow

```mermaid
flowchart TD
    Admin["Admin"] --> CMS["CMSModule / PageEditor"]
    CMS --> Publish["Publish content"]
    Publish --> API["POST /api/cms/"]
    API --> Save["Save page/content"]
    Save --> Public["Public website<br/>(IndexWebsite)"]

    Admin2["Admin"] --> Announce["Create announcement"]
    Announce --> AnnAPI["POST /api/announcements/"]
    AnnAPI --> AnnSave["Save announcement"]
    AnnSave --> Broadcast["Broadcast to users"]
```

---

## 10. End-to-End Request Lifecycle

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant F as React Frontend
    participant B as Django Backend
    participant D as Database

    Note over U,D: REQUEST (forward)
    U->>F: 1. Interact with UI
    F->>F: 2. AuthProvider checks token
    F->>B: 3. apiFetch (Bearer JWT)
    B->>B: 4. Authenticate (JWT)
    B->>B: 5. Route to module view
    B->>D: 6. Query/Write (ORM)

    Note over U,D: RESPONSE (backward)
    D-->>B: 7. Return data
    B-->>F: 8. JSON response
    F-->>U: 9. Render updated UI
```

---

## Summary of Modules

| Module | Purpose | Key Frontend Components |
|--------|---------|-------------------------|
| `accounts` | Users, roles, auth | `Login`, `SetPassword`, `ForgotPassword`, `ResetPassword` |
| `enrollment` | Student enrollment | `StudentEnrollment`, `EnrollmentManagement` |
| `finance` | Tuition, payments, ledgers | `Ledgers`, `ProofOfPayment`, `TuitionManagement`, `TransactionHistory` |
| `grades` | Grade records | `Grade`, `Grades`, `GradesRecords`, `AcademicHistory` |
| `attendance` | Attendance tracking | `AttendanceMonitoring`, `Attendance` |
| `classmanagement` | Classes, subjects, teachers | `ClassManagement`, `AssignTeachers`, `Subjects` |
| `messaging` | Internal messaging | `Messages`, `FloatingMessages` |
| `reminders` | Notifications/reminders | `PaymentReminders`, `TeacherReminders`, `StudentReminders` |
| `announcements` | Public announcements | `Home` (IndexWebsite) |
| `cmsmodule` | Content management | `CMSModule`, `PageEditor` |