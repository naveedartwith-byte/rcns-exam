import type { Timestamp } from 'firebase/firestore';
import type { StudentQuestion } from './question';

export type ExamType = 'quiz' | 'exam' | 'midterm';

export type ExamStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';

export interface Exam {
  id: string;
  title: string;
  description: string;
  subject?: string;
  type: ExamType;
  teacherId: string;
  teacherName?: string;
  batch?: string;
  semester: string;
  program: string;
  duration: number; // in minutes
  totalMarks: number;
  passingMarks?: number;
  questionCount?: number;
  instructions?: string;
  sanitizedQuestions?: StudentQuestion[];
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
