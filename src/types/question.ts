export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  examId: string;
  question: string;
  options: string[] | QuestionOption[];
  correctAnswer: string | number; // 'A' | 'B' | 'C' | 'D' or 0 | 1 | 2 | 3 or option text
  marks: number;
  order: number;
  explanation?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ParsedMCQ {
  id: string;
  order: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D' | '';
  explanation?: string;
  marks?: number;
  errors: string[];
  warnings?: string[];
  isValid: boolean;
  isDuplicate?: boolean;
}

export interface BulkImportSummary {
  totalDetected: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  parsedQuestions: ParsedMCQ[];
}
