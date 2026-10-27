import * as XLSX from 'xlsx';

/**
 * Sanitizes spreadsheet values to protect against formula injection attacks (CSV/Excel Injection).
 * If a cell string starts with =, +, -, @, tab, or carriage return, it prepends an apostrophe.
 */
export function sanitizeExcelValue(val: any): any {
  if (val === null || val === undefined) return 'N/A';
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'boolean') return val;
  const str = String(val).trim();
  if (str === '') return 'N/A';
  if (/^[=\+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export interface WrongMCQExportItem {
  order: number;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  marksAwarded: number;
}

export interface ExamResultExportItem {
  kmuRegistrationNo?: string;
  studentName?: string;
  fatherName?: string;
  batch?: string;
  semester?: string;
  examTitle?: string;
  examDate?: string;
  totalMCQs?: number;
  correctMCQs?: number;
  wrongMCQs?: number;
  unansweredMCQs?: number;
  marks: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
  status?: string;
  wrongMCQsList?: WrongMCQExportItem[];
}

export interface ExportExamOptions {
  examTitle: string;
  subject?: string;
  examinationDate?: string;
  results: ExamResultExportItem[];
  filename?: string;
}

/**
 * Exports class examination results and detailed incorrect MCQ breakdowns into a formatted .xlsx workbook.
 */
export function exportExamResultsToExcel(options: ExportExamOptions): void {
  const { examTitle, subject, examinationDate, results, filename } = options;

  const workbook = XLSX.utils.book_new();

  // --- SHEET 1: Class Results ---
  const classData: Record<string, any>[] = results.map((r, index) => {
    return {
      'S.No': index + 1,
      'KMU Registration #': sanitizeExcelValue(r.kmuRegistrationNo || 'N/A'),
      'Student Name': sanitizeExcelValue(r.studentName || 'N/A'),
      "Father's Name": sanitizeExcelValue(r.fatherName || 'N/A'),
      'Batch': sanitizeExcelValue(r.batch || 'N/A'),
      'Semester': sanitizeExcelValue(r.semester || 'N/A'),
      'Total MCQs': typeof r.totalMCQs === 'number' ? r.totalMCQs : 'N/A',
      'Correct MCQs': typeof r.correctMCQs === 'number' ? r.correctMCQs : 0,
      'Wrong MCQs': typeof r.wrongMCQs === 'number' ? r.wrongMCQs : 0,
      'Unanswered MCQs': typeof r.unansweredMCQs === 'number' ? r.unansweredMCQs : 0,
      'Obtained Marks': typeof r.marks === 'number' ? r.marks : 0,
      'Total Marks': typeof r.totalMarks === 'number' ? r.totalMarks : 0,
      'Percentage (%)': typeof r.percentage === 'number' ? Number(r.percentage.toFixed(1)) : 0,
      'KMU Grade': sanitizeExcelValue(r.grade || 'N/A'),
      'Result Status': sanitizeExcelValue(r.status ? r.status.toUpperCase() : 'GRADED'),
    };
  });

  const classWorksheet = XLSX.utils.json_to_sheet(classData.length > 0 ? classData : [
    { 'Notice': 'No examination result records available for export.' }
  ]);

  // Set column widths for readability
  classWorksheet['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 22 }, // KMU Reg #
    { wch: 24 }, // Student Name
    { wch: 22 }, // Father's Name
    { wch: 14 }, // Batch
    { wch: 14 }, // Semester
    { wch: 12 }, // Total MCQs
    { wch: 13 }, // Correct MCQs
    { wch: 12 }, // Wrong MCQs
    { wch: 16 }, // Unanswered MCQs
    { wch: 15 }, // Obtained Marks
    { wch: 12 }, // Total Marks
    { wch: 15 }, // Percentage
    { wch: 12 }, // Grade
    { wch: 14 }, // Status
  ];

  XLSX.utils.book_append_sheet(workbook, classWorksheet, 'Class Results');

  // --- SHEET 2: Incorrect MCQs Breakdown (Wrong MCQs) ---
  const wrongMCQsRows: Record<string, any>[] = [];
  results.forEach((r) => {
    if (Array.isArray(r.wrongMCQsList) && r.wrongMCQsList.length > 0) {
      r.wrongMCQsList.forEach((w) => {
        wrongMCQsRows.push({
          'KMU Registration #': sanitizeExcelValue(r.kmuRegistrationNo || 'N/A'),
          'Student Name': sanitizeExcelValue(r.studentName || 'N/A'),
          'Question #': w.order,
          'Question Text': sanitizeExcelValue(w.questionText),
          'Student Answer': sanitizeExcelValue(w.studentAnswer),
          'Official Correct Answer': sanitizeExcelValue(w.correctAnswer),
          'Marks Awarded': w.marksAwarded,
        });
      });
    }
  });

  if (wrongMCQsRows.length > 0) {
    const wrongWorksheet = XLSX.utils.json_to_sheet(wrongMCQsRows);
    wrongWorksheet['!cols'] = [
      { wch: 22 }, // KMU Reg
      { wch: 24 }, // Student Name
      { wch: 12 }, // Question #
      { wch: 45 }, // Question Text
      { wch: 22 }, // Student Answer
      { wch: 22 }, // Correct Answer
      { wch: 14 }, // Marks Awarded
    ];
    XLSX.utils.book_append_sheet(workbook, wrongWorksheet, 'Wrong MCQs Detail');
  }

  // --- SHEET 3: Examination Overview Metadata ---
  const overviewRows = [
    { 'Property': 'Institution', 'Value': 'ROYAL COLLEGE OF NURSING SWAT' },
    { 'Property': 'Affiliation', 'Value': 'Khyber Medical University (KMU) Peshawar' },
    { 'Property': 'Examination Title', 'Value': sanitizeExcelValue(examTitle) },
    { 'Property': 'Subject / Discipline', 'Value': sanitizeExcelValue(subject || 'Clinical Assessment') },
    { 'Property': 'Date of Examination', 'Value': sanitizeExcelValue(examinationDate || new Date().toLocaleDateString()) },
    { 'Property': 'Total Candidates Evaluated', 'Value': results.length },
    { 'Property': 'Generated At', 'Value': new Date().toISOString() },
  ];
  const overviewSheet = XLSX.utils.json_to_sheet(overviewRows);
  overviewSheet['!cols'] = [{ wch: 26 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Exam Info');

  // Trigger browser download
  const safeTitle = (examTitle || 'Exam_Results').replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalFilename = filename || `RCNS_${safeTitle}_Results.xlsx`;
  XLSX.writeFile(workbook, finalFilename);
}
