export interface SanitizedStudentQuestion {
  id: string;
  examId: string;
  question: string;
  options: string[] | Array<{ id: string; text: string }>;
  marks: number;
  order: number;
}

export interface MasterQuestion {
  id: string;
  examId: string;
  question: string;
  options: any[];
  correctAnswer: string | number;
  marks: number;
  order: number;
  explanation?: string;
  createdBy?: string;
}

export interface ExamDocument {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  type?: string;
  teacherId?: string;
  batch?: string;
  semester?: string;
  program?: string;
  duration: number; // in minutes
  totalMarks?: number;
  passingMarks?: number;
  startAt: any;
  endAt: any;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
}

export interface StudentProfileDocument {
  uid: string;
  name?: string;
  kmuRegistrationNo?: string;
  program?: string;
  semester?: string;
  batch?: string;
  status?: string;
}

export interface GetStudentQuestionsRequest {
  examId: string;
}

export interface GetStudentQuestionsResponse {
  examId: string;
  examTitle: string;
  duration: number;
  totalMarks: number;
  questions: SanitizedStudentQuestion[];
}

export interface SubmitExamAttemptRequest {
  examId: string;
  answers: Record<string, string | number>;
}

export interface SubmitExamAttemptResponse {
  resultId: string;
  examId: string;
  studentId: string;
  studentName: string;
  kmuRegistrationNo: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  status: 'graded';
  submittedAt: string;
}
