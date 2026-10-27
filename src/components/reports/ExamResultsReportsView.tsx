import React, { useState, useEffect, useMemo } from 'react';
import {
  SearchBar,
  Select,
  Badge,
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableContainer,
  EmptyState,
  LoadingSpinner,
  Alert,
} from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { examService } from '../../services/examService';
import { resultService } from '../../services/resultService';
import { assignmentService } from '../../services/assignmentService';
import { questionService } from '../../services/questionService';
import { studentService } from '../../services/studentService';
import { formatPakistanDateTime } from '../../utils/dateTime';
import { exportExamResultsToExcel, type WrongMCQExportItem } from '../../utils/excelExport';
import { checkAnswerMatch } from '../../utils/secureGrading';
import type { Exam } from '../../types/exam';
import type { Result } from '../../types/result';
import type { Assignment } from '../../types/assignment';
import type { MasterQuestion } from '../../types/question';
import type { StudentProfile } from '../../types/student';

interface ExamResultsReportsViewProps {
  userRole: 'teacher' | 'admin';
}

export const ExamResultsReportsView: React.FC<ExamResultsReportsViewProps> = ({ userRole }) => {
  const { currentUser } = useAuth();

  // Data states
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [results, setResults] = useState<Result[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [masterQuestions, setMasterQuestions] = useState<MasterQuestion[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, StudentProfile>>({});
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // View modes
  const [reportTab, setReportTab] = useState<'class_sheet' | 'individual' | 'wrong_mcqs' | 'audit_log'>('class_sheet');
  const [selectedStudentResult, setSelectedStudentResult] = useState<Result | null>(null);
  const [includeWrongMCQsInIndividual, setIncludeWrongMCQsInIndividual] = useState(true);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // 1. Initial Load: Load authorized exams based on role
  useEffect(() => {
    let isMounted = true;
    const loadExamsAndStudents = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        // Fetch students to enrich fatherName and cohort info
        const studentsList = await studentService.getAllStudents().catch(() => []);
        const sMap: Record<string, StudentProfile> = {};
        studentsList.forEach((s) => {
          sMap[s.uid] = s;
        });
        if (isMounted) setStudentsMap(sMap);

        // Fetch authorized exams
        let fetchedExams: Exam[] = [];
        if (userRole === 'admin') {
          fetchedExams = await examService.getAllExams();
        } else if (currentUser) {
          fetchedExams = await examService.getExamsByTeacher(currentUser.uid, currentUser.email || undefined);
        }

        if (isMounted) {
          setExams(fetchedExams);
          if (fetchedExams.length > 0) {
            setSelectedExamId(fetchedExams[0].id);
          }
        }
      } catch (err: any) {
        console.error('Error loading reports metadata:', err);
        if (isMounted) setErrorMessage(err?.message || 'Failed to load authorized exams.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadExamsAndStudents();
    return () => {
      isMounted = false;
    };
  }, [userRole, currentUser]);

  // Selected Exam Object
  const selectedExam = useMemo(() => {
    return exams.find((e) => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // 2. Load Results, Assignments, and Master Questions whenever selectedExamId changes
  useEffect(() => {
    if (!selectedExamId) {
      setResults([]);
      setAssignments([]);
      setMasterQuestions([]);
      return;
    }

    let isMounted = true;
    const fetchExamData = async () => {
      try {
        setResultsLoading(true);
        const [resList, assignList, fetchedQs] = await Promise.all([
          resultService.getResultsByExamId(selectedExamId),
          assignmentService.getExamCandidateRoster(selectedExamId),
          questionService.getQuestionsByExamId(selectedExamId).catch(() => []),
        ]);

        const masterQs: MasterQuestion[] = (fetchedQs && fetchedQs.length > 0)
          ? fetchedQs
          : (((selectedExam as any)?.questions as any[]) || []);

        if (isMounted) {
          setResults(resList);
          setAssignments(assignList);
          setMasterQuestions(masterQs);
          if (resList.length > 0) {
            setSelectedStudentResult(resList[0]);
          } else {
            setSelectedStudentResult(null);
          }
        }
      } catch (err: any) {
        console.error('Error loading exam result details:', err);
        if (isMounted) setErrorMessage('Failed to load examination results.');
      } finally {
        if (isMounted) setResultsLoading(false);
      }
    };

    fetchExamData();
    return () => {
      isMounted = false;
    };
  }, [selectedExamId, selectedExam]);

  // Helper to extract father's name safely from student map or result
  const getFatherName = (r: Result): string => {
    if ((r as any).fatherName) return (r as any).fatherName;
    const profile = studentsMap[r.studentId];
    return profile?.fatherName || 'N/A';
  };

  // Helper to calculate Wrong MCQs list for a result
  const computeStudentWrongMCQs = (r: Result): WrongMCQExportItem[] => {
    if (!masterQuestions || masterQuestions.length === 0) return [];
    const answers = r.answers || {};
    const wrongList: WrongMCQExportItem[] = [];

    masterQuestions.forEach((q, idx) => {
      const submitted = answers[idx] !== undefined ? answers[idx] : answers[q.id];
      const isAnswered =
        submitted !== undefined &&
        submitted !== null &&
        String(submitted).trim() !== '' &&
        submitted !== -1 &&
        submitted !== '-1';

      if (isAnswered) {
        const isMatch = checkAnswerMatch(submitted, q.correctAnswer, q.options);
        if (!isMatch) {
          // Resolve student answer text
          let subText = String(submitted);
          const numIdx = Number(submitted);
          if (!isNaN(numIdx) && Array.isArray(q.options) && q.options[numIdx] !== undefined) {
            const opt = q.options[numIdx];
            subText = typeof opt === 'string' ? opt : opt.text || opt.label || subText;
          }

          // Resolve correct answer text
          let corText = String(q.correctAnswer);
          const corNum = Number(q.correctAnswer);
          if (!isNaN(corNum) && Array.isArray(q.options) && q.options[corNum] !== undefined) {
            const opt = q.options[corNum];
            corText = typeof opt === 'string' ? opt : opt.text || opt.label || corText;
          } else if (typeof q.correctAnswer === 'string' && /^[A-D]$/i.test(q.correctAnswer.trim())) {
            const letterIdx = { A: 0, B: 1, C: 2, D: 3 }[q.correctAnswer.trim().toUpperCase()];
            if (letterIdx !== undefined && Array.isArray(q.options) && q.options[letterIdx] !== undefined) {
              const opt = q.options[letterIdx];
              const optText = typeof opt === 'string' ? opt : opt.text || opt.label || '';
              corText = `Option ${q.correctAnswer.toUpperCase()}: ${optText}`;
            }
          }

          wrongList.push({
            order: q.order || idx + 1,
            questionText: q.question,
            studentAnswer: subText,
            correctAnswer: corText,
            marksAwarded: 0,
          });
        }
      }
    });

    return wrongList;
  };

  // Filtered Results
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      // Semester filter
      if (semesterFilter !== 'all' && (r.semester || selectedExam?.semester || '') !== semesterFilter) {
        return false;
      }
      // Batch filter
      if (batchFilter !== 'all' && (r.batch || selectedExam?.batch || '') !== batchFilter) {
        return false;
      }
      // Search query (Student Name, KMU ID, Subject)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.studentName || '').toLowerCase().includes(q);
        const matchKmu = (r.kmuRegistrationNo || '').toLowerCase().includes(q);
        const matchFather = getFatherName(r).toLowerCase().includes(q);
        if (!matchName && !matchKmu && !matchFather) return false;
      }
      return true;
    });
  }, [results, semesterFilter, batchFilter, searchQuery, selectedExam, studentsMap]);

  // KPI Metrics
  const totalStudentsAssigned = assignments.length > 0 ? assignments.length : results.length;
  const totalSubmissions = assignments.filter((a) => a.status === 'submitted' || a.status === 'graded').length || results.length;
  const availableResultsCount = results.length;
  const classAvgPercentage = results.length > 0
    ? (results.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0) / results.length).toFixed(1)
    : '0';
  const passedCount = results.filter((r) => r.passed || r.percentage >= 50).length;
  const passRate = results.length > 0 ? ((passedCount / results.length) * 100).toFixed(1) : '0';

  // Handle Excel Export
  const handleExportExcel = () => {
    if (!selectedExam) {
      setErrorMessage('Please select an examination first.');
      return;
    }

    try {
      const exportItems = filteredResults.map((r) => {
        const wrongList = computeStudentWrongMCQs(r);
        const totalMCQs = typeof r.totalMCQs === 'number' ? r.totalMCQs : masterQuestions.length || 'N/A';
        const correctMCQs = typeof r.correctMCQs === 'number' ? r.correctMCQs : (r.correctCount ?? 'N/A');
        const wrongMCQs = typeof r.incorrectMCQs === 'number' ? r.incorrectMCQs : wrongList.length;
        const unansweredMCQs = typeof r.unansweredMCQs === 'number'
          ? r.unansweredMCQs
          : (typeof totalMCQs === 'number' && typeof correctMCQs === 'number' && typeof wrongMCQs === 'number'
            ? Math.max(0, totalMCQs - (correctMCQs + wrongMCQs))
            : 0);

        return {
          kmuRegistrationNo: r.kmuRegistrationNo || 'N/A',
          studentName: r.studentName || 'Student Candidate',
          fatherName: getFatherName(r),
          batch: r.batch || selectedExam.batch || 'N/A',
          semester: r.semester || selectedExam.semester || 'N/A',
          examTitle: selectedExam.title,
          examDate: formatPakistanDateTime(selectedExam.startAt),
          totalMCQs: typeof totalMCQs === 'number' ? totalMCQs : undefined,
          correctMCQs: typeof correctMCQs === 'number' ? correctMCQs : undefined,
          wrongMCQs: typeof wrongMCQs === 'number' ? wrongMCQs : undefined,
          unansweredMCQs: typeof unansweredMCQs === 'number' ? unansweredMCQs : undefined,
          marks: r.marks ?? 0,
          totalMarks: r.totalMarks ?? selectedExam.totalMarks ?? 100,
          percentage: r.percentage ?? 0,
          grade: r.grade || 'N/A',
          status: r.status || (r.passed ? 'PASSED' : 'FAILED'),
          wrongMCQsList: wrongList,
        };
      });

      exportExamResultsToExcel({
        examTitle: selectedExam.title,
        subject: selectedExam.subject,
        examinationDate: formatPakistanDateTime(selectedExam.startAt),
        results: exportItems,
      });

      setNoticeMessage('Official examination report exported successfully (.xlsx).');
      setTimeout(() => setNoticeMessage(null), 4000);
    } catch (exportErr: any) {
      console.error('Excel export error:', exportErr);
      setErrorMessage(exportErr?.message || 'Failed to export results to Excel.');
    }
  };

  // Handle Browser A4 Print
  const handlePrintA4 = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem 0', display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner text="Loading authorized examination reports registry..." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner - Screen Only */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <Badge variant="primary">
              {userRole === 'admin' ? 'Institution Administration' : 'Faculty Examiner'}
            </Badge>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>
              KMU Peshawar Affiliation Standard
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Exam Results &amp; Reports
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            Official examination grade sheets, professional A4 student transcripts, incorrect MCQ diagnostics, and Excel exports.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Paper:</span>
            <button
              type="button"
              onClick={() => setPrintOrientation('portrait')}
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: printOrientation === 'portrait' ? '#0f2744' : 'transparent',
                color: printOrientation === 'portrait' ? '#ffffff' : '#64748b',
              }}
              title="Auto-fit to standard A4 Portrait paper"
            >
              📄 Portrait (Auto-fit)
            </button>
            <button
              type="button"
              onClick={() => setPrintOrientation('landscape')}
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: printOrientation === 'landscape' ? '#0f2744' : 'transparent',
                color: printOrientation === 'landscape' ? '#ffffff' : '#64748b',
              }}
              title="Wide layout for multi-column printing"
            >
              📑 Landscape
            </button>
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={handlePrintA4}
            disabled={!selectedExam || results.length === 0}
            style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', borderColor: '#0f2744', color: '#0f2744', fontWeight: 700 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect width="12" height="8" x="6" y="14" />
            </svg>
            Print A4 Result
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleExportExcel}
            disabled={!selectedExam || results.length === 0}
            style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', backgroundColor: '#059669', color: '#ffffff', fontWeight: 700 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Export to Excel (.xlsx)
          </Button>
        </div>
      </div>

      {noticeMessage && (
        <Alert type="success" onDismiss={() => setNoticeMessage(null)}>
          {noticeMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert type="danger" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Selection & Filter Bar - Screen Only */}
      <Card className="no-print">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
            {/* Exam Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-slate-700)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Select Authorized Examination
              </label>
              <Select
                options={
                  exams.length === 0
                    ? [{ value: '', label: 'No exams permitted for account' }]
                    : exams.map((e) => ({
                        value: e.id,
                        label: `${e.title} • ${e.semester} (${e.batch || 'Batch'})`,
                      }))
                }
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                disabled={exams.length === 0}
              />
            </div>

            {/* Batch Filter (First) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-slate-700)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Batch Filter
              </label>
              <Select
                options={[
                  { value: 'all', label: 'All Batches' },
                  { value: 'Batch 13th', label: 'Batch 13th' },
                  { value: 'Batch 14th', label: 'Batch 14th' },
                  { value: 'Batch 15th', label: 'Batch 15th' },
                  { value: 'Batch 16th', label: 'Batch 16th' },
                  { value: 'Batch 17th', label: 'Batch 17th' },
                  { value: 'Batch 18th', label: 'Batch 18th' },
                  { value: 'Batch 19th', label: 'Batch 19th' },
                  { value: 'Batch 20th', label: 'Batch 20th' },
                ]}
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              />
            </div>

            {/* Semester Filter (Second) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-slate-700)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Semester Filter
              </label>
              <Select
                options={[
                  { value: 'all', label: 'All Semesters' },
                  { value: 'Semester 1', label: 'Semester 1' },
                  { value: 'Semester 2', label: 'Semester 2' },
                  { value: 'Semester 3', label: 'Semester 3' },
                  { value: 'Semester 4', label: 'Semester 4' },
                  { value: 'Semester 5', label: 'Semester 5' },
                  { value: 'Semester 6', label: 'Semester 6' },
                  { value: 'Semester 7', label: 'Semester 7' },
                  { value: 'Semester 8', label: 'Semester 8' },
                ]}
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
              />
            </div>

            {/* Search Bar */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-slate-700)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Search Student
              </label>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Candidate name, father, KMU ID..."
              />
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Stats Grid - Screen Only */}
      {selectedExam && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem 1.25rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', borderLeft: '4px solid #0f2744' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Total Enrolled</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f2744', marginTop: '0.2rem' }}>
              {totalStudentsAssigned}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)' }}>Assigned Candidates</span>
          </div>

          <div style={{ padding: '1rem 1.25rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', borderLeft: '4px solid #2563eb' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Attempts Submitted</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
              {totalSubmissions}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)' }}>Papers Handed In</span>
          </div>

          <div style={{ padding: '1rem 1.25rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', borderLeft: '4px solid #059669' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Results Available</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', marginTop: '0.2rem' }}>
              {availableResultsCount}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)' }}>Graded &amp; Certified</span>
          </div>

          <div style={{ padding: '1rem 1.25rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', borderLeft: '4px solid #d97706' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Class Average</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
              {classAvgPercentage}%
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)' }}>Overall Mean Score</span>
          </div>

          <div style={{ padding: '1rem 1.25rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', borderLeft: '4px solid #7c3aed' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Pass Rate</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.2rem' }}>
              {passRate}%
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)' }}>Benchmark ≥ 50%</span>
          </div>
        </div>
      )}

      {/* View Mode Tabs - Screen Only */}
      <div className="no-print" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-slate-200)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setReportTab('class_sheet')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            backgroundColor: reportTab === 'class_sheet' ? '#0f2744' : 'transparent',
            color: reportTab === 'class_sheet' ? '#ffffff' : 'var(--color-slate-600)',
          }}
        >
          📄 Full Class Result Sheet
        </button>

        <button
          type="button"
          onClick={() => setReportTab('individual')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            backgroundColor: reportTab === 'individual' ? '#0f2744' : 'transparent',
            color: reportTab === 'individual' ? '#ffffff' : 'var(--color-slate-600)',
          }}
        >
          🎓 Individual Student A4 Report
        </button>

        <button
          type="button"
          onClick={() => setReportTab('wrong_mcqs')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            backgroundColor: reportTab === 'wrong_mcqs' ? '#0f2744' : 'transparent',
            color: reportTab === 'wrong_mcqs' ? '#ffffff' : 'var(--color-slate-600)',
          }}
        >
          🔍 Wrong MCQs Detail Breakdown
        </button>
      </div>

      {/* Main Content Area */}
      {resultsLoading ? (
        <div style={{ padding: '3rem 0', display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner text="Retrieving verified exam results and transcripts..." />
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          title="No Permitted Examinations Found"
          description={
            userRole === 'teacher'
              ? 'You currently do not have any authored or assigned examination papers in your department.'
              : 'No examination papers have been scheduled or created yet.'
          }
        />
      ) : filteredResults.length === 0 ? (
        <EmptyState
          title="No Result Records Found"
          description="No students match the current filters or no submissions have been recorded for this examination yet."
          actionLabel="Reset Filters"
          onAction={() => {
            setSemesterFilter('all');
            setBatchFilter('all');
            setSearchQuery('');
          }}
        />
      ) : (
        <>
          {/* =====================================================================
              TAB 1: FULL CLASS RESULT SHEET (PRINTABLE A4 LANDSCAPE / PORTRAIT)
              ===================================================================== */}
          {reportTab === 'class_sheet' && (
            <div className={`a4-print-sheet ${printOrientation === 'landscape' ? 'a4-landscape-page' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Official College Header for Print & Screen */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.25rem',
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid #0f2744',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <img
                    src="/rcns-logo.png"
                    alt="Royal College of Nursing Swat"
                    style={{ width: '64px', height: '64px', objectFit: 'contain' }}
                    onError={(e) => {
                      // Fallback icon if logo image fails
                      (e.target as any).style.display = 'none';
                    }}
                  />
                  <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f2744', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      ROYAL COLLEGE OF NURSING SWAT
                    </h2>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#059669', marginTop: '2px' }}>
                      Affiliated with Khyber Medical University (KMU) Peshawar
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-600)', marginTop: '2px' }}>
                      Official Comprehensive Class Examination Result Master Sheet
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#0f2744' }}>
                  <div><strong>Paper:</strong> {selectedExam?.title}</div>
                  <div><strong>Discipline:</strong> {selectedExam?.subject || 'Clinical Assessment'}</div>
                  <div><strong>Cohort:</strong> {selectedExam?.batch || 'Batch'} • {selectedExam?.semester}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
                    Date: {formatPakistanDateTime(selectedExam?.startAt)}
                  </div>
                </div>
              </div>

              {/* Class Results Table */}
              <Card padding="none">
                <TableContainer className="print-table-container" style={{ border: 'none', borderRadius: 'var(--radius-lg)' }}>
                  <Table className="class-results-table">
                    <TableHeader>
                      <TableRow style={{ backgroundColor: '#0f2744', color: '#ffffff' }}>
                        <TableHead style={{ color: '#ffffff', width: '50px' }}>#</TableHead>
                        <TableHead style={{ color: '#ffffff' }}>KMU Registration #</TableHead>
                        <TableHead style={{ color: '#ffffff' }}>Candidate Name</TableHead>
                        <TableHead style={{ color: '#ffffff' }}>Father's Name</TableHead>
                        <TableHead style={{ color: '#ffffff', textAlign: 'center' }}>Total MCQs</TableHead>
                        <TableHead style={{ color: '#ffffff', textAlign: 'center' }}>Correct</TableHead>
                        <TableHead style={{ color: '#ffffff', textAlign: 'center' }}>Wrong</TableHead>
                        <TableHead style={{ color: '#ffffff', textAlign: 'center' }}>Unanswered</TableHead>
                        <TableHead style={{ color: '#ffffff', textAlign: 'center' }}>Marks</TableHead>
                        <TableHead style={{ color: '#ffffff', textAlign: 'center' }}>%</TableHead>
                        <TableHead style={{ color: '#ffffff', textAlign: 'center' }}>Grade</TableHead>
                        <TableHead style={{ color: '#ffffff', textAlign: 'center' }}>Status</TableHead>
                        <TableHead className="no-print" style={{ color: '#ffffff', textAlign: 'right' }}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((r, index) => {
                        const totalMCQs = typeof r.totalMCQs === 'number' ? r.totalMCQs : masterQuestions.length || 'N/A';
                        const correctMCQs = typeof r.correctMCQs === 'number' ? r.correctMCQs : (r.correctCount ?? 'N/A');
                        const wrongMCQs = typeof r.incorrectMCQs === 'number'
                          ? r.incorrectMCQs
                          : (typeof totalMCQs === 'number' && typeof correctMCQs === 'number' ? Math.max(0, (r.answersCount || 0) - correctMCQs) : 'N/A');
                        const unansweredMCQs = typeof r.unansweredMCQs === 'number'
                          ? r.unansweredMCQs
                          : (typeof totalMCQs === 'number' && typeof correctMCQs === 'number' && typeof wrongMCQs === 'number'
                            ? Math.max(0, totalMCQs - (correctMCQs + wrongMCQs))
                            : 'N/A');

                        return (
                          <TableRow key={r.id} style={{ borderBottom: '1px solid var(--color-slate-200)' }}>
                            <TableCell style={{ fontWeight: 600 }}>{index + 1}</TableCell>
                            <TableCell>
                              <strong style={{ color: '#0f2744', fontFamily: 'monospace' }}>
                                {r.kmuRegistrationNo || 'N/A'}
                              </strong>
                            </TableCell>
                            <TableCell>
                              <strong style={{ color: 'var(--color-slate-900)' }}>{r.studentName}</strong>
                            </TableCell>
                            <TableCell>{getFatherName(r)}</TableCell>
                            <TableCell style={{ textAlign: 'center' }}>{totalMCQs}</TableCell>
                            <TableCell style={{ textAlign: 'center', color: '#059669', fontWeight: 700 }}>
                              {correctMCQs}
                            </TableCell>
                            <TableCell style={{ textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>
                              {wrongMCQs}
                            </TableCell>
                            <TableCell style={{ textAlign: 'center', color: 'var(--color-slate-500)' }}>
                              {unansweredMCQs}
                            </TableCell>
                            <TableCell style={{ textAlign: 'center', fontWeight: 700 }}>
                              {r.marks} <span style={{ color: 'var(--color-slate-400)', fontWeight: 400 }}>/ {r.totalMarks}</span>
                            </TableCell>
                            <TableCell style={{ textAlign: 'center', fontWeight: 700 }}>
                              {r.percentage}%
                            </TableCell>
                            <TableCell style={{ textAlign: 'center' }}>
                              <Badge variant={(r.grade || 'Pass').startsWith('A') ? 'success' : 'primary'}>
                                {r.grade || 'Pass'}
                              </Badge>
                            </TableCell>
                            <TableCell style={{ textAlign: 'center' }}>
                              {r.passed || r.percentage >= 50 ? (
                                <Badge variant="success">PASSED</Badge>
                              ) : (
                                <Badge variant="danger">FAILED</Badge>
                              )}
                            </TableCell>
                            <TableCell className="no-print" style={{ textAlign: 'right' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedStudentResult(r);
                                  setReportTab('individual');
                                }}
                              >
                                View Report
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>

              {/* Official Signatures Bar (Print Footer) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '2rem',
                  marginTop: '1.5rem',
                  paddingTop: '2rem',
                  borderTop: '1px solid var(--color-slate-300)',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ height: '40px', borderBottom: '1px dashed var(--color-slate-400)', width: '80%', margin: '0 auto' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '0.4rem' }}>
                    Course Instructor / Examiner
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Royal College of Nursing Swat</div>
                </div>

                <div>
                  <div style={{ height: '40px', borderBottom: '1px dashed var(--color-slate-400)', width: '80%', margin: '0 auto' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '0.4rem' }}>
                    Department Head / Invigilator
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Faculty of Nursing &amp; Allied Health</div>
                </div>

                <div>
                  <div style={{ height: '40px', borderBottom: '1px dashed var(--color-slate-400)', width: '80%', margin: '0 auto' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '0.4rem' }}>
                    Controller of Examinations
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>Khyber Medical University Standard</div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 2: INDIVIDUAL STUDENT A4 RESULT REPORT / TRANSCRIPT
              ===================================================================== */}
          {reportTab === 'individual' && selectedStudentResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Student Selector Bar - Screen Only */}
              <Card className="no-print">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-700)', textTransform: 'uppercase' }}>
                      Select Candidate:
                    </span>
                    <Select
                      options={filteredResults.map((r) => ({
                        value: r.id,
                        label: `${r.studentName} • ${r.kmuRegistrationNo || 'No KMU'} (${r.marks}/${r.totalMarks} - ${r.percentage}%)`,
                      }))}
                      value={selectedStudentResult.id}
                      onChange={(e) => {
                        const found = results.find((r) => r.id === e.target.value);
                        if (found) setSelectedStudentResult(found);
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-slate-700)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={includeWrongMCQsInIndividual}
                        onChange={(e) => setIncludeWrongMCQsInIndividual(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      Include Detailed Incorrect MCQs in Printed Report
                    </label>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handlePrintA4}
                      style={{ backgroundColor: '#0f2744', display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}
                    >
                      🖨️ Print Individual A4 Report
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Printable Official A4 Document Card */}
              <div
                className="a4-print-sheet"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-lg)',
                  border: '1.5px solid var(--color-slate-300)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '2rem',
                  maxWidth: '850px',
                  margin: '0 auto',
                  width: '100%',
                }}
              >
                {/* Official College Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '2.5px solid #0f2744',
                    paddingBottom: '1.25rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <img
                      src="/rcns-logo.png"
                      alt="Royal College of Nursing Swat"
                      style={{ width: '75px', height: '75px', objectFit: 'contain' }}
                      onError={(e) => {
                        (e.target as any).style.display = 'none';
                      }}
                    />
                    <div>
                      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f2744', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        ROYAL COLLEGE OF NURSING SWAT
                      </h1>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                        Affiliated with Khyber Medical University (KMU) Peshawar
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-600)', marginTop: '2px' }}>
                        Official Examination Grade Transcript &amp; Result Report
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-slate-500)', letterSpacing: '0.05em' }}>
                      Transcript ID
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f2744' }}>
                      TR-{selectedStudentResult.id.slice(0, 14).toUpperCase()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)', marginTop: '0.2rem' }}>
                      Issued: {new Date().toLocaleDateString('en-GB')}
                    </div>
                  </div>
                </div>

                {/* Candidate & Examination Metadata Grid */}
                <div
                  style={{
                    backgroundColor: 'var(--color-slate-50)',
                    border: '1px solid var(--color-slate-200)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.1rem 1.25rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Candidate Name
                    </span>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-slate-900)', textTransform: 'uppercase' }}>
                      {selectedStudentResult.studentName}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Father's Name
                    </span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-800)', textTransform: 'uppercase' }}>
                      {getFatherName(selectedStudentResult)}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                      KMU Registration #
                    </span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f2744', fontFamily: 'monospace' }}>
                      {selectedStudentResult.kmuRegistrationNo || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Examination Paper
                    </span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
                      {selectedExam?.title || selectedStudentResult.examTitle}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Academic Program &amp; Cohort
                    </span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                      {selectedStudentResult.program || selectedExam?.program || 'Nursing & Allied Sciences'} • {selectedStudentResult.semester || selectedExam?.semester} ({selectedStudentResult.batch || selectedExam?.batch})
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Examination Date
                    </span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                      {formatPakistanDateTime(selectedExam?.startAt || selectedStudentResult.submittedAt)}
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Cards */}
                {(() => {
                  const wrongList = computeStudentWrongMCQs(selectedStudentResult);
                  const totalMCQs = typeof selectedStudentResult.totalMCQs === 'number'
                    ? selectedStudentResult.totalMCQs
                    : masterQuestions.length || 'N/A';
                  const correctMCQs = typeof selectedStudentResult.correctMCQs === 'number'
                    ? selectedStudentResult.correctMCQs
                    : (selectedStudentResult.correctCount ?? 'N/A');
                  const wrongMCQs = typeof selectedStudentResult.incorrectMCQs === 'number'
                    ? selectedStudentResult.incorrectMCQs
                    : wrongList.length;
                  const unansweredMCQs = typeof selectedStudentResult.unansweredMCQs === 'number'
                    ? selectedStudentResult.unansweredMCQs
                    : (typeof totalMCQs === 'number' && typeof correctMCQs === 'number' && typeof wrongMCQs === 'number'
                      ? Math.max(0, totalMCQs - (correctMCQs + wrongMCQs))
                      : 'N/A');

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                      {/* Metric Stat Boxes */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', textAlign: 'center' }}>
                        <div style={{ padding: '0.85rem', backgroundColor: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-primary-800)', fontWeight: 600, textTransform: 'uppercase' }}>Total MCQs</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary-950)' }}>
                            {totalMCQs}
                          </div>
                        </div>

                        <div style={{ padding: '0.85rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>Correct MCQs</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46' }}>
                            {correctMCQs}
                          </div>
                        </div>

                        <div style={{ padding: '0.85rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600, textTransform: 'uppercase' }}>Wrong MCQs</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991b1b' }}>
                            {wrongMCQs}
                          </div>
                        </div>

                        <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>Unanswered</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-slate-700)' }}>
                            {unansweredMCQs}
                          </div>
                        </div>

                        <div style={{ padding: '0.85rem', backgroundColor: 'var(--color-primary-100)', border: '1px solid var(--color-primary-300)', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.72rem', color: '#0e498b', fontWeight: 700, textTransform: 'uppercase' }}>Obtained Score</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f2744' }}>
                            {selectedStudentResult.marks} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-slate-500)' }}>/ {selectedStudentResult.totalMarks}</span>
                          </div>
                        </div>

                        <div style={{ padding: '0.85rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 700, textTransform: 'uppercase' }}>Percentage</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857' }}>
                            {selectedStudentResult.percentage}%
                          </div>
                        </div>

                        <div style={{ padding: '0.85rem', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>KMU Grade</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#92400e' }}>
                            {selectedStudentResult.grade || 'Pass'}
                          </div>
                        </div>
                      </div>

                      {/* Optional Detailed Incorrect Answer Breakdown */}
                      {includeWrongMCQsInIndividual && (
                        <div style={{ marginTop: '1rem', borderTop: '1.5px solid var(--color-slate-200)', paddingTop: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f2744', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                              Detailed Incorrect MCQs Breakdown ({wrongList.length} Wrong Answers)
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontStyle: 'italic' }}>
                              Authorized Faculty Diagnostics
                            </span>
                          </div>

                          {wrongList.length === 0 ? (
                            <div style={{ padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: 'var(--radius-sm)', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.85rem' }}>
                              ✓ Outstanding Assessment: The student answered zero questions incorrectly!
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {wrongList.map((w, wIdx) => (
                                <div
                                  key={wIdx}
                                  className="wrong-mcq-box"
                                  style={{
                                    padding: '0.85rem 1rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid #fecaca',
                                    backgroundColor: '#fffafa',
                                    fontSize: '0.85rem',
                                  }}
                                >
                                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                                    Q{w.order}. {w.questionText}
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', fontSize: '0.8rem' }}>
                                    <div style={{ padding: '0.4rem 0.6rem', backgroundColor: '#fee2e2', borderRadius: 'var(--radius-xs)', color: '#991b1b', border: '1px solid #fca5a5' }}>
                                      <strong>Candidate Selected: </strong> {w.studentAnswer || '(No answer provided)'}
                                    </div>
                                    <div style={{ padding: '0.4rem 0.6rem', backgroundColor: '#dcfce7', borderRadius: 'var(--radius-xs)', color: '#14532d', border: '1px solid #86efac' }}>
                                      <strong>Official Correct Answer: </strong> {w.correctAnswer}
                                    </div>
                                    <div style={{ padding: '0.4rem 0.6rem', backgroundColor: '#f1f5f9', borderRadius: 'var(--radius-xs)', color: 'var(--color-slate-700)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                      <strong>Marks Awarded: </strong> {w.marksAwarded} Marks
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Signatures & Certification Block */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '2rem',
                    marginTop: '2rem',
                    paddingTop: '2rem',
                    borderTop: '1.5px solid var(--color-slate-300)',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ height: '40px', borderBottom: '1px dashed var(--color-slate-400)', width: '80%', margin: '0 auto' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '0.4rem' }}>
                      Examiner Signature
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)' }}>Royal College of Nursing Swat</div>
                  </div>

                  <div>
                    <div style={{ height: '40px', borderBottom: '1px dashed var(--color-slate-400)', width: '80%', margin: '0 auto' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '0.4rem' }}>
                      Head of Department
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)' }}>Faculty of Nursing &amp; Allied Health</div>
                  </div>

                  <div>
                    <div style={{ height: '40px', borderBottom: '1px dashed var(--color-slate-400)', width: '80%', margin: '0 auto' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '0.4rem' }}>
                      Controller of Examinations
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)' }}>KMU Affiliation Secretariat</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontStyle: 'italic', textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--color-slate-100)', paddingTop: '0.75rem' }}>
                  Note: This is an official institutional examination transcript. Any tampering, unverified erasure, or alteration renders this document completely void.
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 3: WRONG MCQS ANALYSIS ACROSS WHOLE EXAM
              ===================================================================== */}
          {reportTab === 'wrong_mcqs' && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f2744', margin: 0 }}>
                    Class-Wide Question Error Analysis
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', marginTop: '0.2rem' }}>
                    Identifies which multiple choice questions were most frequently missed across the student cohort.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}
                >
                  📊 Export Wrong MCQs Sheet (.xlsx)
                </Button>
              </div>

              {masterQuestions.length === 0 ? (
                <EmptyState
                  title="No Master Questions Accessible"
                  description="Master question definitions with answer keys are required to perform detailed question error analysis."
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ width: '60px' }}>Q #</TableHead>
                        <TableHead>Question Text</TableHead>
                        <TableHead>Correct Answer</TableHead>
                        <TableHead style={{ textAlign: 'center' }}>Total Answered</TableHead>
                        <TableHead style={{ textAlign: 'center' }}>Class Error Count</TableHead>
                        <TableHead style={{ textAlign: 'center' }}>Error Rate (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {masterQuestions.map((q, idx) => {
                        let wrongCount = 0;
                        let answeredTotal = 0;

                        results.forEach((r) => {
                          const answers = r.answers || {};
                          const sub = answers[idx] !== undefined ? answers[idx] : answers[q.id];
                          const hasAns = sub !== undefined && sub !== null && String(sub).trim() !== '' && sub !== -1 && sub !== '-1';
                          if (hasAns) {
                            answeredTotal++;
                            const isCorrect = checkAnswerMatch(sub, q.correctAnswer, q.options);
                            if (!isCorrect) wrongCount++;
                          }
                        });

                        const errorRate = answeredTotal > 0 ? ((wrongCount / answeredTotal) * 100).toFixed(1) : '0';

                        return (
                          <TableRow key={q.id || idx}>
                            <TableCell style={{ fontWeight: 700 }}>{q.order || idx + 1}</TableCell>
                            <TableCell>
                              <div style={{ fontWeight: 600, color: 'var(--color-slate-900)', maxWidth: '420px', lineHeight: 1.4 }}>
                                {q.question}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span style={{ color: '#047857', fontWeight: 700 }}>
                                {String(q.correctAnswer)}
                              </span>
                            </TableCell>
                            <TableCell style={{ textAlign: 'center' }}>{answeredTotal}</TableCell>
                            <TableCell style={{ textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>
                              {wrongCount}
                            </TableCell>
                            <TableCell style={{ textAlign: 'center' }}>
                              <Badge variant={Number(errorRate) > 50 ? 'danger' : Number(errorRate) > 25 ? 'warning' : 'success'}>
                                {errorRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ExamResultsReportsView;
