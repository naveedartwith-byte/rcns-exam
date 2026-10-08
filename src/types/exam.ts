import type { Timestamp } from 'firebase/firestore';

export type ExamType = 'quiz' | 'exam' | 'midterm';

export type ExamStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';

export interface Exam {
  id: string;
  title: string;
  description: string;
  type: ExamType;
  teacherId: string;
  semester: string;
  program: string;
  duration: number; // in minutes
  totalMarks: number;
  startAt: Timestamp | string;
  endAt: Timestamp | string;
  status: ExamStatus;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface AcademicProgram {
  id: string;
  name: string;
  code: string;
  department: string;
  totalSemesters: number;
}
