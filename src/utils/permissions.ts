import type { UserRole, UserProfile } from '../types/user';

/**
 * Checks if a user has the student role.
 */
export function isStudentRole(role: UserRole | null | undefined): boolean {
  return role === 'student';
}

/**
 * Checks if a user has the teacher role.
 */
export function isTeacherRole(role: UserRole | null | undefined): boolean {
  return role === 'teacher';
}

/**
 * Checks if a user has the admin role.
 */
export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

/**
 * Validates if the current user profile is authorized for an allowed list of roles.
 */
export function hasRequiredRole(
  userProfile: UserProfile | null | undefined,
  allowedRoles: UserRole[]
): boolean {
  if (!userProfile || !userProfile.role) return false;
  return allowedRoles.includes(userProfile.role);
}

/**
 * Determines default redirect route based on user role.
 */
export function getDefaultDashboardRoute(role: UserRole | null | undefined): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'teacher':
      return '/teacher/exams';
    case 'student':
      return '/student/exams';
    default:
      return '/login';
  }
}
