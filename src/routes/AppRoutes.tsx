import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import { getDefaultDashboardRoute } from '../utils/permissions';
import { LoadingSpinner } from '../components/ui';

// Layouts
import { StudentLayout } from '../layouts/StudentLayout';
import { TeacherLayout } from '../layouts/TeacherLayout';
import { AdminLayout } from '../layouts/AdminLayout';

// Auth Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterStudentPage } from '../pages/auth/RegisterStudentPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';

// Student Pages
import { StudentDashboardPage } from '../pages/student/StudentDashboardPage';
import { StudentExamsPage } from '../pages/student/StudentExamsPage';
import { StudentProfilePage } from '../pages/student/StudentProfilePage';
import { StudentResultsPage } from '../pages/student/StudentResultsPage';

// Teacher Pages
import { TeacherDashboardPage } from '../pages/teacher/TeacherDashboardPage';
import { TeacherExamsPage } from '../pages/teacher/TeacherExamsPage';
import { TeacherStudentsPage } from '../pages/teacher/TeacherStudentsPage';
import { TeacherProfilePage } from '../pages/teacher/TeacherProfilePage';

// Admin Pages
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminStudentsPage } from '../pages/admin/AdminStudentsPage';
import { AdminTeachersPage } from '../pages/admin/AdminTeachersPage';
import { AdminExamsPage } from '../pages/admin/AdminExamsPage';
import { AdminResultsPage } from '../pages/admin/AdminResultsPage';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage';

// Common Error Pages
import { UnauthorizedPage } from '../pages/UnauthorizedPage';
import { NotFoundPage } from '../pages/NotFoundPage';

// Root redirect handler
const RootRedirect: React.FC = () => {
  const { currentUser, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <LoadingSpinner size="lg" text="Loading Royal College of Nursing Swat Examination System..." />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultDashboardRoute(role)} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterStudentPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected Student Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboardPage />} />
        <Route path="dashboard" element={<StudentDashboardPage />} />
        <Route path="exams" element={<StudentExamsPage />} />
        <Route path="profile" element={<StudentProfilePage />} />
        <Route path="results" element={<StudentResultsPage />} />
      </Route>

      {/* Protected Teacher Routes */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TeacherLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeacherDashboardPage />} />
        <Route path="dashboard" element={<TeacherDashboardPage />} />
        <Route path="exams" element={<TeacherExamsPage />} />
        <Route path="students" element={<TeacherStudentsPage />} />
        <Route path="profile" element={<TeacherProfilePage />} />
      </Route>

      {/* Protected Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="teachers" element={<AdminTeachersPage />} />
        <Route path="exams" element={<AdminExamsPage />} />
        <Route path="results" element={<AdminResultsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;
