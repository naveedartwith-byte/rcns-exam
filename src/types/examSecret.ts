export interface ExamSecret {
  examId: string;
  code: string; // Plaintext code visible only to authorized faculty and administrators
  codeHash: string; // Salted SHA-256 hash for secure verification
  salt: string; // Cryptographic salt
  createdBy: string; // Teacher or Admin UID
  createdAt?: any;
  updatedAt?: any;
}

export interface VerifyExamCodePayload {
  examId: string;
  code: string;
  studentId?: string;
}

export interface VerifyExamCodeResult {
  success: boolean;
  code?: string;
  message?: string;
  examId?: string;
  verifiedAt?: string;
  attemptId?: string;
}
