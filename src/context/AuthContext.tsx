import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
        const rawRole = (uProfile.role || '').toLowerCase();
        const normalizedRole: UserRole =
          rawRole === 'faculty' ? 'teacher' : (rawRole as UserRole);

        setUserProfile({ ...uProfile, role: normalizedRole });
        setRole(normalizedRole);
        setCurrentUser(firebaseUser);

        if (normalizedRole === 'student') {
          const studentSnap = await getDoc(doc(db, 'students', uid));
          if (studentSnap.exists()) {
            setStudentProfile(studentSnap.data() as StudentProfile);
          }
        } else if (normalizedRole === 'teacher') {
          const teacherSnap = await getDoc(doc(db, 'teachers', uid));
          if (teacherSnap.exists()) {
            setTeacherProfile(teacherSnap.data() as TeacherProfile);
          } else {
            const facultyProfile: TeacherProfile = {
              uid,
              role: 'teacher',
              name: uProfile.name || 'Faculty Member',
              email: (firebaseUser.email || '').trim().toLowerCase(),
              department: 'Nursing & Allied Health Sciences',
              designation: 'Assistant Professor',
              phone: '+92 300 9112233',
              courses: ['Adult Health Nursing I', 'Pathophysiology'],
              totalExams: 0,
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setTeacherProfile(facultyProfile);
            try {
              await setDoc(
                doc(db, 'teachers', uid),
                {
                  ...facultyProfile,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            } catch (syncErr) {
              console.warn('Teacher document auto-provision note:', syncErr);
            }
          }
        } else if (normalizedRole === 'admin') {
          const adminSnap = await getDoc(doc(db, 'admins', uid));
          const email = (firebaseUser.email || '').trim().toLowerCase();
          const defaultAdminName =
            email === 'naveedartwith@gmail.com' ? 'Super Administrator' : 'System Administrator';

          if (adminSnap.exists()) {
            const rawAdminData = adminSnap.data() as Record<string, any>;
            const adminName =
              rawAdminData.name ||
              rawAdminData['name '] ||
              (uProfile.name && uProfile.name.trim() ? uProfile.name : defaultAdminName);
            const adminRole = rawAdminData.role || rawAdminData['role  '] || 'admin';

            const adminProfileData: AdminProfile = {
              uid,
              role: adminRole,
              name: adminName,
              email: rawAdminData.email || firebaseUser.email || '',
              department: rawAdminData.department || 'Examination & Institutional Administration',
              status: rawAdminData.status || 'active',
              createdAt: rawAdminData.createdAt || new Date().toISOString(),
              updatedAt: rawAdminData.updatedAt || new Date().toISOString(),
            };
            setAdminProfile(adminProfileData);

            if (!uProfile.name || !uProfile.name.trim()) {
              setUserProfile({
                ...uProfile,
                name: adminName,
                role: 'admin',
              });
            }
          } else {
            const adminName =
              uProfile.name && uProfile.name.trim() ? uProfile.name : defaultAdminName;
            const adminProfileData: AdminProfile = {
              uid,
              role: 'admin',
              name: adminName,
              email: firebaseUser.email || '',
              department: 'Examination & Institutional Administration',
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setAdminProfile(adminProfileData);
            if (!uProfile.name || !uProfile.name.trim()) {
              setUserProfile({
                ...uProfile,
                name: adminName,
                role: 'admin',
              });
            }
          }
        }
        return normalizedRole;
      } else {
        // Fallback 1: Check if admin profile exists in admins/{uid} (Admin precedence)
        const adminSnap = await getDoc(doc(db, 'admins', uid));
        if (adminSnap.exists()) {
          const email = (firebaseUser.email || '').trim().toLowerCase();
          const defaultAdminName =
            email === 'naveedartwith@gmail.com' ? 'Super Administrator' : 'System Administrator';
          const rawAdminData = adminSnap.data() as Record<string, any>;
          const adminName =
            rawAdminData.name ||
            rawAdminData['name '] ||
            defaultAdminName;
          const adminRole = rawAdminData.role || rawAdminData['role  '] || 'admin';
          const aData: AdminProfile = {
            uid,
            role: adminRole,
            name: adminName,
            email: rawAdminData.email || firebaseUser.email || '',
            department: rawAdminData.department || 'Examination & Institutional Administration',
            status: rawAdminData.status || 'active',
            createdAt: rawAdminData.createdAt || new Date().toISOString(),
            updatedAt: rawAdminData.updatedAt || new Date().toISOString(),
          };
          setAdminProfile(aData);
          setRole('admin');
          setUserProfile({
            uid,
            role: 'admin',
            name: adminName,
            email: aData.email,
            createdAt: aData.createdAt,
            updatedAt: aData.updatedAt,
          });
          setCurrentUser(firebaseUser);
          return 'admin';
        }

        // Fallback 2: Check if teacher profile exists directly in teachers/{uid}
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

        // Fallback 3: Check if student profile exists in students/{uid}
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

        // Fallback for Admin accounts: Initialize missing profile documents
        const email = (firebaseUser.email || '').trim().toLowerCase();
        const isAdminEmail =
          email === 'naveedartwith@gmail.com' ||
          email === 'admin@royalcollege.edu.pk';

        if (isAdminEmail) {
          const adminName =
            (email === 'naveedartwith@gmail.com' ? 'Super Administrator' : null) ||
            firebaseUser.displayName ||
            'Super Administrator';
          try {
            await setDoc(
              doc(db, 'users', uid),
              {
                uid,
                role: 'admin',
                name: adminName,
                email: firebaseUser.email || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );

            await setDoc(
              doc(db, 'admins', uid),
              {
                uid,
                role: 'admin',
                name: adminName,
                email: firebaseUser.email || '',
                department: 'Examination & Institutional Administration',
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (initErr) {
            console.warn('Admin profile auto-provisioning note:', initErr);
          }

          const adminProfileData: AdminProfile = {
            uid,
            role: 'admin',
            name: adminName,
            email: firebaseUser.email || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          setAdminProfile(adminProfileData);
          setRole('admin');
          setUserProfile({
            uid,
            role: 'admin',
            name: adminName,
            email: firebaseUser.email || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setCurrentUser(firebaseUser);
          return 'admin';
        }

        // Fallback for recognized institutional faculty: Initialize missing profile documents
        const isFaculty =
          email.endsWith('@royalcollege.edu.pk') ||
          email.endsWith('@rcns.edu.pk') ||
          email === 'dr.tariq@royalcollege.edu.pk' ||
          email === 'maryam.saeed@royalcollege.edu.pk' ||
          email === 'dr.usman@royalcollege.edu.pk' ||
          email === 'dr.sanaullah@royalcollege.edu.pk' ||
          email.startsWith('dr.') ||
          email.startsWith('prof.') ||
          email.includes('teacher') ||
          email.includes('faculty');

        if (isFaculty) {
          const facultyName =
            email === 'dr.tariq@royalcollege.edu.pk'
              ? 'Dr. Tariq Shah, PhD'
              : firebaseUser.displayName || 'Faculty Member';

          const facultyDept = 'Nursing & Allied Health Sciences';
          const facultyDesignation =
            email === 'dr.tariq@royalcollege.edu.pk' ? 'Associate Professor & HOD' : 'Assistant Professor';

          try {
            await setDoc(
              doc(db, 'users', uid),
              {
                uid,
                role: 'teacher',
                name: facultyName,
                email: firebaseUser.email || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );

            await setDoc(
              doc(db, 'teachers', uid),
              {
                uid,
                role: 'teacher',
                name: facultyName,
                email: firebaseUser.email || '',
                department: facultyDept,
                designation: facultyDesignation,
                phone: '+92 300 9112233',
                courses: ['Adult Health Nursing I', 'Pathophysiology'],
                totalExams: 0,
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (initErr) {
            console.warn('Faculty profile auto-provisioning note:', initErr);
          }

          const facultyProfile: TeacherProfile = {
            uid,
            role: 'teacher',
            name: facultyName,
            email: firebaseUser.email || '',
            department: facultyDept,
            designation: facultyDesignation,
            phone: '+92 300 9112233',
            courses: ['Adult Health Nursing I', 'Pathophysiology'],
            totalExams: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          setTeacherProfile(facultyProfile);
          setRole('teacher');
          setUserProfile({
            uid,
            role: 'teacher',
            name: facultyName,
            email: firebaseUser.email || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setCurrentUser(firebaseUser);
          return 'teacher';
        }

        // Fallback for student account
        const studentName = firebaseUser.displayName || 'Student Candidate';
        const studentProfileData: StudentProfile = {
          uid,
          role: 'student',
          name: studentName,
          fatherName: 'Candidate Father',
          email: firebaseUser.email || '',
          batch: 'Batch 13th',
          semester: 'Semester 1',
          program: 'BS Nursing (Generic)',
          department: 'Nursing & Allied Health Sciences',
          kmuRegistrationNo: '2026/KMU/RCNS/01',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setStudentProfile(studentProfileData);
        setRole('student');
        setUserProfile({
          uid,
          role: 'student',
          name: studentName,
          email: firebaseUser.email || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setCurrentUser(firebaseUser);
        return 'student';
      }
    } catch (error) {
      console.error('Error fetching user profile in AuthContext:', error);
      // Safe fallback role based on institutional email
      const email = (firebaseUser.email || '').trim().toLowerCase();
      const fallbackRole: UserRole =
        email === 'naveedartwith@gmail.com' || email.includes('admin')
          ? 'admin'
          : email.endsWith('@royalcollege.edu.pk') || email.includes('faculty') || email.includes('teacher')
          ? 'teacher'
          : 'student';
      setRole(fallbackRole);
      setCurrentUser(firebaseUser);
      const fallbackName =
        fallbackRole === 'admin'
          ? (email === 'naveedartwith@gmail.com' ? 'Super Administrator' : 'System Administrator')
          : (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Candidate');

      setUserProfile((prev) => prev || {
        uid: firebaseUser.uid,
        role: fallbackRole,
        name: fallbackName,
        email: firebaseUser.email || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (fallbackRole === 'admin') {
        setAdminProfile((prev) => prev || {
          uid: firebaseUser.uid,
          role: 'admin',
          name: fallbackName,
          email: firebaseUser.email || '',
          department: 'Examination & Institutional Administration',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (fallbackRole === 'student') {
        setStudentProfile((prev) => prev || {
          uid: firebaseUser.uid,
          role: 'student',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Student Candidate',
          fatherName: 'Candidate Father',
          email: firebaseUser.email || '',
          batch: 'Batch 13th',
          semester: 'Semester 1',
          program: 'BS Nursing (Generic)',
          department: 'Nursing & Allied Health Sciences',
          kmuRegistrationNo: '2026/KMU/RCNS/01',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return fallbackRole;
    }
  };

  // Fetch role-specific profile when auth state changes
  useEffect(() => {
    // Check if session is new from a closed browser tab (Security requirement #5)
    const sessionActive = sessionStorage.getItem('rcns_browser_session_active');
    if (!sessionActive) {
      // Reopening after browser/tab close -> start from login page for examination security
      authService.logout().catch(() => {});
      sessionStorage.setItem('rcns_browser_session_active', '1');
      setCurrentUser(null);
      setUserProfile(null);
      setStudentProfile(null);
      setTeacherProfile(null);
      setAdminProfile(null);
      setRole(null);
      setLoading(false);
      return;
    }

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

      sessionStorage.setItem('rcns_browser_session_active', '1');
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
      const normalizedEmail = (email || '').trim().toLowerCase();
      const isKnownAdmin =
        normalizedEmail === 'naveedartwith@gmail.com' ||
        normalizedEmail.includes('admin');
      if (isKnownAdmin) {
        return 'admin';
      }
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
