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

  // Helper to fetch and apply user profile
  const fetchAndApplyUserProfile = async (firebaseUser: FirebaseUser): Promise<UserRole | null> => {
    try {
      const uid = firebaseUser.uid;
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const uProfile = userDocSnap.data() as UserProfile;
        setUserProfile(uProfile);
        setRole(uProfile.role);
        setCurrentUser(firebaseUser);

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
        return uProfile.role;
      } else {
        // Fallback: Check if teacher profile exists directly in teachers/{uid}
        const teacherSnap = await getDoc(doc(db, 'teachers', uid));
        if (teacherSnap.exists()) {
          const tData = teacherSnap.data() as TeacherProfile;
          setTeacherProfile(tData);
          setRole('teacher');
          setUserProfile({
            uid,
            role: 'teacher',
            name: tData.name,
            email: tData.email,
            createdAt: tData.createdAt,
            updatedAt: tData.updatedAt,
          });
          setCurrentUser(firebaseUser);
          return 'teacher';
        }

        // Fallback: Check if student profile exists in students/{uid}
        const studentSnap = await getDoc(doc(db, 'students', uid));
        if (studentSnap.exists()) {
          const sData = studentSnap.data() as StudentProfile;
          setStudentProfile(sData);
          setRole('student');
          setUserProfile({
            uid,
            role: 'student',
            name: sData.name,
            email: sData.email,
            createdAt: sData.createdAt,
            updatedAt: sData.updatedAt,
          });
          setCurrentUser(firebaseUser);
          return 'student';
        }

        // Fallback: Check if admin profile exists in admins/{uid}
        const adminSnap = await getDoc(doc(db, 'admins', uid));
        if (adminSnap.exists()) {
          const aData = adminSnap.data() as AdminProfile;
          setAdminProfile(aData);
          setRole('admin');
          setUserProfile({
            uid,
            role: 'admin',
            name: aData.name,
            email: aData.email,
            createdAt: aData.createdAt,
            updatedAt: aData.updatedAt,
          });
          setCurrentUser(firebaseUser);
          return 'admin';
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile in AuthContext:', error);
      return null;
    }
  };

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

      await fetchAndApplyUserProfile(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<UserRole> => {
    setLoading(true);
    try {
      const firebaseUser = await authService.login(email, password);
      const userRole = await fetchAndApplyUserProfile(firebaseUser);
      return userRole || 'teacher';
    } finally {
      setLoading(false);
    }
  };

  const loginWithKmu = async (kmuRegistrationNo: string, password: string): Promise<UserRole> => {
    setLoading(true);
    try {
      const firebaseUser = await authService.loginWithKmu(kmuRegistrationNo, password);
      const userRole = await fetchAndApplyUserProfile(firebaseUser);
      return userRole || 'student';
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

  const registerStudent = async (data: StudentRegistrationData): Promise<string> => {
    setLoading(true);
    try {
      return await authService.registerStudent(data);
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
    loginWithKmu,
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
