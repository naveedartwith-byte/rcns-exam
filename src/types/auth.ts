import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile, UserRole } from './user';
import type { StudentProfile } from './student';
import type { TeacherProfile } from './teacher';
import type { AdminProfile } from './admin';

export interface AuthState {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  studentProfile: StudentProfile | null;
  teacherProfile: TeacherProfile | null;
  adminProfile: AdminProfile | null;
  role: UserRole | null;
  loading: boolean;
}

export interface StudentRegistrationData {
  email: string;
  password: string;
  name: string;
  fatherName: string;
  kmuRegistrationNo: string;
  batch: string;
  semester: string;
  program: string;
  department: string;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<UserRole>;
  loginWithKmu: (kmuRegistrationNo: string, password: string) => Promise<UserRole>;
  logout: () => Promise<void>;
  registerStudent: (data: StudentRegistrationData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}


