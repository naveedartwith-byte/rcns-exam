import type { UserRole } from '../types/user';
import { isValidKmuRegistration } from './kmuRegistration';

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates standard email address format.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates password strength (minimum 6 characters as required by Firebase Auth, recommended 8+).
 */
export function isValidPassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required.'] };
  }

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates if a required field is non-empty.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates semester input (e.g., '1st', '2nd', 'Semester 1', 'Spring 2026', etc.).
 */
export function isValidSemester(semester: string): boolean {
  return isNonEmptyString(semester) && semester.trim().length <= 50;
}

/**
 * Validates whether the role is one of the strictly allowed UserRole values.
 */
export function isValidRole(role: unknown): role is UserRole {
  return role === 'student' || role === 'teacher' || role === 'admin';
}

/**
 * Validates all required student registration input fields.
 */
export function validateStudentRegistrationInput(data: {
  email: string;
  password: string;
  name: string;
  fatherName: string;
  kmuRegistrationNo: string;
  semester: string;
  program: string;
  department: string;
}): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!isValidEmail(data.email)) {
    errors.email = 'Please provide a valid email address.';
  }

  const pwdCheck = isValidPassword(data.password);
  if (!pwdCheck.isValid) {
    errors.password = pwdCheck.errors.join(' ');
  }

  if (!isNonEmptyString(data.name)) {
    errors.name = 'Full name is required.';
  }

  if (!isNonEmptyString(data.fatherName)) {
    errors.fatherName = "Father's name is required.";
  }

  if (!isValidKmuRegistration(data.kmuRegistrationNo)) {
    errors.kmuRegistrationNo = 'Invalid KMU Registration format (expected e.g., 2026/KMU-RCNS/001).';
  }

  if (!isValidSemester(data.semester)) {
    errors.semester = 'Semester is required.';
  }

  if (!isNonEmptyString(data.program)) {
    errors.program = 'Program is required (e.g. BS Nursing, Post-RN, etc.).';
  }

  if (!isNonEmptyString(data.department)) {
    errors.department = 'Department is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Reusable utility to safely calculate percentage with rounding.
 */
export function calculatePercentage(marks: number, totalMarks: number, decimals: number = 2): number {
  if (totalMarks <= 0 || isNaN(marks) || isNaN(totalMarks)) {
    return 0;
  }
  const ratio = (marks / totalMarks) * 100;
  const factor = Math.pow(10, decimals);
  return Math.round(ratio * factor) / factor;
}
