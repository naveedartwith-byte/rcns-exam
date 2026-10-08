import { useAuth } from './useAuth';
import type { UserRole } from '../types/user';

export interface UseRoleReturn {
  role: UserRole | null;
  isStudent: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
  hasRole: (allowedRoles: UserRole[]) => boolean;
}

export function useRole(): UseRoleReturn {
  const { role } = useAuth();

  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!role) return false;
    return allowedRoles.includes(role);
  };

  return {
    role,
    isStudent,
    isTeacher,
    isAdmin,
    hasRole,
  };
}

export default useRole;
