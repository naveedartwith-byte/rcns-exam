import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { authService } from '../services/authService';
import type {
  AuthContextType,
  StudentRegistrationData,
} from '../types/auth';
import type { UserProfile, UserRole } from '../types/user';
import type { StudentProfile } from '../types/student';
import type { TeacherProfile } from '../types/teacher';
import type { AdminProfile } from '../types/admin';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch role-specific profile when auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      setCurrentUser(firebaseUser);

      if (!firebaseUser) {
        setUserProfile(null);
        setStudentProfile(null);
        setTeacherProfile(null);
        setAdminProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const uid = firebaseUser.uid;
        // Fetch common user profile
        const userDocRef = doc(db, 'users', uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const uProfile = userDocSnap.data() as UserProfile;
          setUserProfile(uProfile);
          setRole(uProfile.role);

          // Fetch specific profile based on role
          if (uProfile.role === 'student') {
            const studentSnap = await getDoc(doc(db, 'students', uid));
            if (studentSnap.exists()) {
              setStudentProfile(studentSnap.data() as StudentProfile);
            }
          } else if (uProfile.role === 'teacher') {
            const teacherSnap = await getDoc(doc(db, 'teachers', uid));
            if (teacherSnap.exists()) {
              setTeacherProfile(teacherSnap.data() as TeacherProfile);
            }
          } else if (uProfile.role === 'admin') {
            const adminSnap = await getDoc(doc(db, 'admins', uid));
            if (adminSnap.exists()) {
              setAdminProfile(adminSnap.data() as AdminProfile);
            }
          }
        } else {
          // Check if user is an admin registered directly in admins collection
          const adminSnap = await getDoc(doc(db, 'admins', uid));
          if (adminSnap.exists()) {
            const aProfile = adminSnap.data() as AdminProfile;
            setAdminProfile(aProfile);
            setRole('admin');
            setUserProfile({
              uid,
              role: 'admin',
              name: aProfile.name,
              email: aProfile.email,
              createdAt: aProfile.createdAt,
              updatedAt: aProfile.updatedAt,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      await authService.login(email, password);
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await authService.logout();
      setCurrentUser(null);
      setUserProfile(null);
      setStudentProfile(null);
      setTeacherProfile(null);
      setAdminProfile(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const registerStudent = async (data: StudentRegistrationData): Promise<void> => {
    setLoading(true);
    try {
      await authService.registerStudent(data);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    await authService.resetPassword(email);
  };

  const value: AuthContextType = {
    currentUser,
    userProfile,
    studentProfile,
    teacherProfile,
    adminProfile,
    role,
    loading,
    login,
    logout,
    registerStudent,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
