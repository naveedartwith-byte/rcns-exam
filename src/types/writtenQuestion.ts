export type WrittenQuestionType = 'short' | 'long';

export interface WrittenQuestion {
  id: string;
  examId: string;
  type: WrittenQuestionType;       // 'short' | 'long'
  question: string;               // Prompt text entered by teacher
  maxMarks: number;               // Configurable maximum marks (e.g. 5, 10, 15)
  order: number;                  // 1, 2, 3...
  guidelines?: string;            // Confidential teacher marking rubric / model answer
  minWords?: number;              // Optional guidance for candidate
  maxWords?: number;              // Optional guidance for candidate
  createdBy?: string;             // Teacher UID
  createdAt?: any;
  updatedAt?: any;
}

export type StudentWrittenQuestion = Omit<WrittenQuestion, 'guidelines' | 'createdBy'>;

export interface StudentWrittenAnswer {
  questionId: string;
  type: WrittenQuestionType;
  questionText: string;
  answerText: string;
  wordCount?: number;
  submittedAt?: string;
}

export interface WrittenQuestionEvaluation {
  questionId: string;
  type: WrittenQuestionType;
  questionText?: string;
  maxMarks: number;
  awardedMarks: number;
  teacherComment?: string;
}
