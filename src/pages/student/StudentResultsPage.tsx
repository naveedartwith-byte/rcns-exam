import React, { useState, useEffect } from 'react';
import {
  StatCard,
  SearchBar,
  Select,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableContainer,
  Modal,
  EmptyState,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { resultService } from '../../services/resultService';
import type { Result } from '../../types/result';

export const StudentResultsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchResults = async () => {
      try {
        if (currentUser) {
          const res = await resultService.getResultsByStudentId(currentUser.uid);
          if (isMounted) setResults(res);
        }
      } catch (err) {
        console.error('Error loading student results:', err);
      }
    };
    fetchResults();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Helper to parse dates/timestamps safely for sorting
  const parseTime = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val?.toMillis === 'function') return val.toMillis();
    if (typeof val?.toDate === 'function') return val.toDate().getTime();
    const d = new Date(val).getTime();
    return isNaN(d) ? 0 : d;
  };

  // Filtered results, sorted newest submitted first (Requirement #9)
  const filteredResults = results
    .filter((r) => {
      if (typeFilter !== 'all' && r.examType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSub = (r.subject || '').toLowerCase().includes(q);
        const matchTitle = (r.examTitle || '').toLowerCase().includes(q);
        if (!matchSub && !matchTitle) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = parseTime(a.submittedAt || a.evaluatedAt || (a as any).createdAt);
      const timeB = parseTime(b.submittedAt || b.evaluatedAt || (b as any).createdAt);
      return timeB - timeA;
    });

  // All evaluated quizzes & exams counted in Total Exam Graded (Requirement #7)
  const gradedResults = results.filter((r) => r.status === 'graded' || (r.percentage !== undefined && r.percentage !== null));
  const totalEvaluated = gradedResults.length;

  // Accurate percentage calculated across all student quizzes (Requirement #8)
  const totalMarksObtained = gradedResults.reduce((acc, r) => acc + (Number(r.marks) || 0), 0);
  const totalMaxMarks = gradedResults.reduce((acc, r) => acc + (Number(r.totalMarks) || 0), 0);
  const accuratePercentage = totalMaxMarks > 0
    ? ((totalMarksObtained / totalMaxMarks) * 100).toFixed(1)
    : gradedResults.length > 0
    ? (gradedResults.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0) / gradedResults.length).toFixed(1)
    : '0.0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
          Academic Results &amp; Transcripts
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
          Official assessment records certified under Khyber Medical University standards.
        </p>
      </div>

      {/* KPI Performance Summary: Cumulative GPA & Academic Standing removed per Requirement #6 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        <StatCard
          title="Total Exams Graded"
          value={totalEvaluated}
          subtitle="All evaluated quizzes & examinations"
          variant="primary"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          }
        />

        <StatCard
          title="Percentage"
          value={`${accuratePercentage}%`}
          subtitle="Accurate evaluated score across all quizzes"
          variant="teal"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          }
        />
      </div>

      {/* Search & Filter Bar */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Official Grade Book</CardTitle>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
              Verified semester examination records
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by subject or exam..."
            />

            <div style={{ width: '150px' }}>
              <Select
                options={[
                  { value: 'all', label: 'All Exam Types' },
                  { value: 'quiz', label: 'Quizzes' },
                  { value: 'midterm', label: 'Mid-Terms' },
                  { value: 'exam', label: 'Final Exams' },
                ]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        {filteredResults.length === 0 ? (
          <EmptyState
            title="No Results Match Criteria"
            description="Try changing your search keywords or filter options."
            actionLabel="Reset Filters"
            onAction={() => {
              setSearchQuery('');
              setTypeFilter('all');
            }}
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject &amp; Course</TableHead>
                  <TableHead>Evaluation Type</TableHead>
                  <TableHead>Marks Obtained</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Letter Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{r.subject}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>{r.examTitle}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{(r.examType || 'exam').toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.status === 'pending' ? (
                        <span style={{ fontSize: '0.825rem', color: 'var(--color-slate-500)', fontStyle: 'italic' }}>
                          Under Review
                        </span>
                      ) : (
                        <>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--color-slate-900)' }}>{r.marks}</strong> / {r.totalMarks}
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.status === 'pending' ? (
                        <span style={{ fontSize: '0.825rem', color: 'var(--color-slate-500)' }}>Pending</span>
                      ) : (
                        <span style={{ fontWeight: 600, color: 'var(--color-slate-800)' }}>{r.percentage}%</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.status === 'pending' ? (
                        <Badge variant="outline">Pending</Badge>
                      ) : (
                        <Badge variant={(r.grade || 'A').startsWith('A') ? 'success' : 'primary'}>
                          {r.grade || 'Pass'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.status === 'pending' ? (
                        <Badge variant="warning">PENDING</Badge>
                      ) : r.passed || r.percentage >= 50 ? (
                        <Badge variant="success">PASSED</Badge>
                      ) : (
                        <Badge variant="danger">FAILED</Badge>
                      )}
                    </TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedResult(r)}
                      >
                        View Card
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Result Card Modal */}
      {selectedResult && (
        <Modal
          isOpen={Boolean(selectedResult)}
          onClose={() => setSelectedResult(null)}
          title="Official Grade Transcript & Result Sheet"
          description="ROYAL COLLEGE OF NURSING SWAT • Affiliated with KMU Peshawar"
          maxWidth="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <Button variant="outline" onClick={() => window.print()} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect width="12" height="8" x="6" y="14" />
                </svg>
                Print Transcript
              </Button>
              <Button variant="primary" onClick={() => setSelectedResult(null)} style={{ backgroundColor: '#0f2744' }}>
                Close Result
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Institution Badge Top */}
            <div
              style={{
                backgroundColor: '#0f2744',
                color: '#ffffff',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>
                  Khyber Medical University Examination System
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                  ROYAL COLLEGE OF NURSING SWAT
                </h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Transcript ID</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  TR-{selectedResult.id.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Student & Course Details */}
            <div
              style={{
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-200)',
                padding: '1rem 1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Candidate Name</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)', textTransform: 'uppercase' }}>
                  {selectedResult.studentName?.toUpperCase()}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>KMU Registration #</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedResult.kmuRegistrationNo}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Subject / Course</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedResult.subject}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Evaluation</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedResult.examTitle}</div>
              </div>
            </div>

            {/* Score Grid */}
            {selectedResult.status === 'pending' ? (
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: '#fffbeb',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#92400e', marginBottom: '0.25rem' }}>
                    ⏳ Assessment Submission Under Faculty Evaluation
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#b45309', margin: 0, lineHeight: 1.5 }}>
                    Your examination responses have been securely recorded. Short &amp; Long written questions require faculty evaluation before final KMU grade certification.
                  </p>
                </div>

                {/* Objective marks & statistics breakdown if available */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #fde68a',
                    padding: '0.85rem 1rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Objective Marks</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                      {selectedResult.mcqMarks ?? selectedResult.marks ?? 0}
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-slate-400)' }}> / {selectedResult.mcqTotalMarks ?? '—'}</span>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>MCQs Answered</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857' }}>
                      {selectedResult.answeredMCQs ?? selectedResult.answersCount ?? 0}
                      {selectedResult.totalMCQs ? <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-slate-400)' }}> / {selectedResult.totalMCQs}</span> : ''}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Written Answered</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb' }}>
                      {selectedResult.writtenAnsweredCount ?? 0}
                      {selectedResult.totalWrittenQuestions ? <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-slate-400)' }}> / {selectedResult.totalWrittenQuestions}</span> : ''}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Written Evaluation</span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>
                      PENDING REVIEW
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-50)', border: '1px solid var(--color-primary-100)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-primary-800)', fontWeight: 600 }}>Obtained Marks</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary-900)' }}>
                    {selectedResult.marks} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--color-slate-500)' }}>/ {selectedResult.totalMarks}</span>
                  </div>
                </div>
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                  <span style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>Percentage</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#065f46' }}>
                    {selectedResult.percentage}%
                  </div>
                </div>
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', backgroundColor: '#fef3c7', border: '1px solid #fde68a' }}>
                  <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>Final Grade</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#92400e' }}>
                    {selectedResult.grade || 'Pass'}
                  </div>
                </div>
              </div>
            )}

            {/* Component Marks Breakdown (MCQs, Short Questions, Long Questions) */}
            {selectedResult.status !== 'pending' && (selectedResult.writtenMarks !== undefined || selectedResult.shortQuestionsMarks !== undefined || selectedResult.longQuestionsMarks !== undefined) && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-slate-200)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--color-slate-50)',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--color-slate-200)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: 'var(--color-slate-700)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>KMU Examination Score Breakdown</span>
                  <Badge variant="outline">Official Transcript</Badge>
                </div>
                <div style={{ padding: '0.5rem 1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--color-slate-100)' }}>
                        <td style={{ padding: '0.6rem 0', color: 'var(--color-slate-600)' }}>
                          <strong>Section A:</strong> Multiple Choice Questions (MCQs)
                        </td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                          {selectedResult.mcqMarks ?? 0} <span style={{ color: 'var(--color-slate-400)', fontWeight: 400 }}>/ {selectedResult.mcqTotalMarks ?? '—'}</span>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-slate-100)' }}>
                        <td style={{ padding: '0.6rem 0', color: 'var(--color-slate-600)' }}>
                          <strong>Section B:</strong> Short Questions (SAQs)
                        </td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                          {selectedResult.shortQuestionsMarks ?? 0} <span style={{ color: 'var(--color-slate-400)', fontWeight: 400 }}>/ {selectedResult.shortQuestionsTotalMarks ?? '—'}</span>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--color-slate-100)' }}>
                        <td style={{ padding: '0.6rem 0', color: 'var(--color-slate-600)' }}>
                          <strong>Section C:</strong> Long Questions (LAQs)
                        </td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                          {selectedResult.longQuestionsMarks ?? 0} <span style={{ color: 'var(--color-slate-400)', fontWeight: 400 }}>/ {selectedResult.longQuestionsTotalMarks ?? '—'}</span>
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: 'var(--color-primary-50)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: 'var(--color-primary-900)' }}>
                          Total Aggregate Score
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 800, color: 'var(--color-primary-900)', fontSize: '1rem' }}>
                          {selectedResult.marks} <span style={{ color: 'var(--color-slate-500)', fontWeight: 500 }}>/ {selectedResult.totalMarks}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)', fontStyle: 'italic', borderTop: '1px solid var(--color-slate-100)', paddingTop: '0.75rem' }}>
              Note: This is an electronic transcript. Any alteration, forgery, or tampering renders this result document null and void.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentResultsPage;
