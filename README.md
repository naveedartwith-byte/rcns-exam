<<<<<<< HEAD
# ROYAL COLLEGE OF NURSING SWAT
## Online Quiz, Examination, Mid-Term Examination and Result Management System

---

### Phase 2 — Verified & Updated

This repository contains the examination and academic result management system for **ROYAL COLLEGE OF NURSING SWAT**.

---

## 1. Technology Stack

* **Frontend Engine:** React 19, TypeScript 5.7, Vite 6.2
* **Routing & Navigation:** React Router 7
* **Backend Infrastructure:** Firebase (Modular Web SDK v11)
  * **Firebase Authentication:** Email/Password Provider
  * **Cloud Firestore:** Document Database (`asia-south1` / Asia Mumbai)
* **Hosting Configuration:** Firebase Hosting SPA Configuration

---

## 2. Directory Structure

```text
EXAM/
├── .env.example
├── .gitignore
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── README.md
└── src/
    ├── assets/
    ├── components/
    ├── context/
    │   └── AuthContext.tsx
    ├── firebase/
    │   ├── config.ts
    │   ├── auth.ts
    │   └── firestore.ts
    ├── hooks/
    │   ├── useAuth.ts
    │   └── useRole.ts
    ├── layouts/
    │   ├── StudentLayout/
    │   │   └── index.tsx
    │   ├── TeacherLayout/
    │   │   └── index.tsx
    │   └── AdminLayout/
    │       └── index.tsx
    ├── pages/
    │   ├── auth/
    │   │   ├── LoginPage.tsx
    │   │   ├── RegisterStudentPage.tsx
    │   │   └── ForgotPasswordPage.tsx
    │   ├── student/
    │   │   ├── StudentExamsPage.tsx
    │   │   ├── StudentProfilePage.tsx
    │   │   └── StudentResultsPage.tsx
    │   ├── teacher/
    │   │   ├── TeacherExamsPage.tsx
    │   │   ├── TeacherStudentsPage.tsx
    │   │   └── TeacherProfilePage.tsx
    │   ├── admin/
    │   │   ├── AdminDashboardPage.tsx
    │   │   ├── AdminStudentsPage.tsx
    │   │   ├── AdminTeachersPage.tsx
    │   │   ├── AdminExamsPage.tsx
    │   │   ├── AdminResultsPage.tsx
    │   │   └── AdminSettingsPage.tsx
    │   ├── UnauthorizedPage.tsx
    │   └── NotFoundPage.tsx
    ├── routes/
    │   ├── ProtectedRoute.tsx
    │   └── AppRoutes.tsx
    ├── services/
    │   ├── authService.ts
    │   ├── userService.ts
    │   ├── studentService.ts
    │   ├── teacherService.ts
    │   ├── adminService.ts
    │   ├── examService.ts
    │   ├── questionService.ts
    │   ├── assignmentService.ts
    │   └── resultService.ts
    ├── types/
    │   ├── admin.ts
    │   ├── assignment.ts
    │   ├── auth.ts
    │   ├── exam.ts
    │   ├── index.ts
    │   ├── question.ts
    │   ├── result.ts
    │   ├── student.ts
    │   ├── teacher.ts
    │   └── user.ts
    ├── utils/
    │   ├── kmuRegistration.ts
    │   ├── permissions.ts
    │   └── validation.ts
    ├── App.tsx
    ├── main.tsx
    └── vite-env.d.ts
```

---

## 3. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate `.env` with your Firebase Web App credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   ```
> **IMPORTANT:** Never commit `.env` or service account credentials into version control. `.gitignore` is preconfigured to protect secrets.

---

## 4. Development & Build Commands

```bash
# Install dependencies
npm install

# Start local Vite development server (port 3000)
npm run dev

# Run TypeScript type check
npm run typecheck

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 5. User Roles & Security Architecture

The system enforces three distinct user roles:

1. **`student`**:
   * Can view and update own profile.
   * Can view assigned/scheduled exams.
   * Can view own results.
   * Cannot access administrative settings, other students' records, or faculty panels.
2. **`teacher`**:
   * Can view and update own faculty profile.
   * Can create, update, and manage their assigned exams and question banks.
   * Can assign exams to students and review submissions.
   * Cannot access system configuration or manage other teachers.
3. **`admin`**:
   * Full administrative authority across students, faculty, exams, results, and system settings.
   * Can provision teacher accounts and assign institutional parameters.

### Cloud Firestore Security Rules
Security rules in `firestore.rules` enforce:
* Role-based validation using Firestore collections (`admins`, `teachers`, `students`).
* Client self-elevation prevention (role cannot be modified on client update).
* Strict ownership checks for private records (student results and profile data).
* Prevention of password storage in Firestore (Firebase Authentication handles credentials).

---

## 6. KMU Registration Number Architecture

* **Standard Format:** `YYYY/KMU-RCNS/NNN` (e.g. `2026/KMU-RCNS/001`, `2026/KMU-RCNS/1050`).
* **Uniqueness Registry:** Handled via `kmuRegistrations/{normalizedKmuReg}` Firestore collection.
* **Atomic Registration:** When a student registers, an atomic transaction checks `kmuRegistrations` to guarantee uniqueness before claiming the number.

---

## 7. Provisioning Initial Administrator

To establish the first system administrator securely:
1. Create a user account in the **Firebase Console > Authentication > Users** tab (Email/Password).
2. Note the generated User UID (e.g., `ADMIN_UID_123`).
3. In **Firestore Database**, create a document:
   * Collection: `admins`
   * Document ID: `ADMIN_UID_123`
   * Fields:
     ```json
     {
       "uid": "ADMIN_UID_123",
       "role": "admin",
       "name": "Super Administrator",
       "email": "admin@royalcollege.edu.pk",
       "createdAt": "SERVER_TIMESTAMP",
       "updatedAt": "SERVER_TIMESTAMP"
     }
     ```
4. Also create a corresponding identity document in `users`:
   * Collection: `users`
   * Document ID: `ADMIN_UID_123`
   * Fields:
     ```json
     {
       "uid": "ADMIN_UID_123",
       "role": "admin",
       "name": "Super Administrator",
       "email": "admin@royalcollege.edu.pk",
       "createdAt": "SERVER_TIMESTAMP",
       "updatedAt": "SERVER_TIMESTAMP"
     }
     ```
5. The admin can now sign in at `/login` and access `/admin/dashboard`.

---

## 8. Multi-Phase Development Roadmap

* **Phase 1 (Current):** Technical Foundation & Architecture (Routing, Types, Services, AuthContext, Security Rules, KMU uniqueness, Build verification).
* **Phase 2 (Next):** Complete Frontend/UI (Responsive design, UI components, exam taking interface, student/teacher/admin dashboards).
* **Phase 3:** Complete Backend & Business Logic (Exam engine, auto-marking, question bank management, grading algorithms, results publishing).
* **Phase 4:** Testing, Security Audit, Bug Fixing & Production Deployment.
=======
# rcns-exam
>>>>>>> a1677dd0ef72964a69c04707376cf51643ab0faf
