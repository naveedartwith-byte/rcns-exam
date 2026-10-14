import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  StatCard,
  Button,
  Badge,
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
  LoadingSpinner,
  Alert,
} from '../../components/ui';
import { assignmentService } from '../../services/assignmentService';
import { resultService } from '../../services/resultService';
import {
  formatPakistanDateTime,
  formatPakistanTime,
  getEffectiveExamStatus,
} from '../../utils/dateTime';
import type { Exam } from '../../types/exam';
import type { Result } from '../../types/result';

export const StudentDashboardPage: React.FC = () => {
  const { currentUser, userProfile, studentProfile } = useAuth();
  const navigate = useNavigate();

  const studentName = userProfile?.name || 'Student Candidate';
  const kmuReg = studentProfile?.kmuRegistrationNo || 'KMU Registration';
  const program = studentProfile?.program || 'BS Nursing (Generic)';
  const batch = studentProfile?.batch || 'Batch 15th';
  const semester = studentProfile?.semester || 'Semester 4';

  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [, setClockTick] = useState<number>(Date.now());

  // Function to load dashboard data
  const loadDashboardData = async () => {
    if (!currentUser) return;
    try {
      setErrorMessage(null);
      const [fetchedExams, fetchedResults] = await Promise.all([
        assignmentService.getAuthorizedExamsForStudent(
          currentUser.uid,
          studentProfile?.program || program,
          studentProfile?.semester || semester,
          studentProfile?.batch || batch
        ),
        resultService.getResultsByStudentId(currentUser.uid),
      ]);

      setExams(fetchedExams);
      setResults(fetchedResults);
    } catch (err: any) {
      console.error('Error fetching student dashboard data:', err);
      setErrorMessage('Could not load examination schedule. Please verify your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser, studentProfile]);

  // Periodic clock tick (every 15 seconds) to automatically transition Upcoming -> Active
  // when scheduled start time arrives without requiring teacher intervention or manual refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick(Date.now());
      // Re-evaluate exam statuses in state
      setExams((prev) =>
        prev.map((exam) => ({
          ...exam,
          status: getEffectiveExamStatus(exam),
        }))
      );
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  // Filter quizzes and exams by dynamic effective status (excluding already-submitted attempts)
  const isSubmittedExam = (e: Exam) =>
    e.assignmentStatus === 'submitted' || e.assignmentStatus === 'graded';
  const activeExams = exams.filter((e) => getEffectiveExamStatus(e) === 'active' && !isSubmittedExam(e));
  const upcomingExams = exams.filter((e) => getEffectiveExamStatus(e) === 'scheduled' && !isSubmittedExam(e));
  const completedResults = results.slice(0, 5);
  const totalAssigned = exams.length;
  const avgPercentage =
    results.length > 0
      ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / results.length)
      : 85;

  if (loading) {
    return <LoadingSpinner text="Loading candidate examination portal..." fullScreen />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Welcome Banner with Full Academic Enrollment Info */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f2744 0%, #0e498b 60%, #0d9488 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem 2.25rem',
          color: '#ffffff',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ zIndex: 1, maxWidth: '640px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.4rem',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '0.75rem',
            }}
          >
            <span>KMU ID: {kmuReg}</span>
            <span>•</span>
            <span style={{ color: '#fef08a' }}>{batch}</span>
            <span>•</span>
            <span>{semester}</span>
          </div>

          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Welcome back, {studentName}
          </h1>

          <p style={{ fontSize: '0.95rem', color: '#e2e8f0', marginTop: '0.4rem', lineHeight: 1.5 }}>
            Enrolled in <strong>{program}</strong> at ROYAL COLLEGE OF NURSING SWAT.
            {activeExams.length > 0 ? (
              <span> You have <strong style={{ color: '#fde68a' }}>{activeExams.length} active quiz/exam</strong> ready to attempt.</span>
            ) : (
              <span> You have <strong style={{ color: '#fde68a' }}>{upcomingExams.length} upcoming scheduled quiz(zes)</strong>.</span>
            )}
          </p>
        </div>

        <div style={{ zIndex: 1, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={() => navigate('/student/exams')}
            style={{ backgroundColor: '#ffffff', color: '#0f2744', fontWeight: 700 }}
          >
            View All Exams
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/student/results')}
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.4)' }}
          >
            Check Results
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Alert type="danger" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Statistics Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <StatCard
          title="Assigned Quizzes & Exams"
          value={totalAssigned}
          subtitle={`Enrolled in ${batch} • ${semester}`}
          variant="primary"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          }
        />

        <StatCard
          title="Active Now"
          value={activeExams.length}
          subtitle="Open for immediate submission"
          variant="teal"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />

        <StatCard
          title="Upcoming Quizzes"
          value={upcomingExams.length}
          subtitle="Scheduled by Faculty"
          variant="slate"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />

        <StatCard
          title="Academic Performance"
          value={`${avgPercentage}%`}
          subtitle="Average Exam Score"
          variant="gold"
          trend={{ value: 'KMU Standard Passing', isPositive: true }}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
        />
      </div>

      {/* SECTION 1: Active Quizzes & Examinations */}
      {activeExams.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.25)',
              }}
            />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
              Active Quizzes &amp; Live Examinations ({activeExams.length})
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeExams.map((exam) => (
              <Card
                key={exam.id}
                style={{
                  borderLeft: '5px solid #10b981',
                  backgroundColor: '#f0fdf4',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '2px solid #86efac',
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Badge variant="success">Active Now</Badge>
                        <Badge variant="outline">{exam.type.toUpperCase()}</Badge>
                        <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                          Closes: {formatPakistanDateTime(exam.endAt)}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.25rem' }}>
                        {exam.title}
                      </h3>

                      <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)', marginTop: '0.2rem' }}>
                        <span>Subject: <strong>{exam.subject || 'Clinical Assessment'}</strong></span>
                        <span style={{ margin: '0 0.5rem' }}>•</span>
                        <span>Duration: <strong>{exam.duration} Mins</strong></span>
                        <span style={{ margin: '0 0.5rem' }}>•</span>
                        <span>Total Marks: <strong>{exam.totalMarks}</strong></span>
                        {exam.teacherName && (
                          <>
                            <span style={{ margin: '0 0.5rem' }}>•</span>
                            <span>Examiner: <strong>{exam.teacherName}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/student/exams')}
                    style={{
                      backgroundColor: '#0f2744',
                      borderColor: '#0f2744',
                      fontWeight: 700,
                      padding: '0.75rem 1.75rem',
                    }}
                  >
                    Enter Exam Room →
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout: Upcoming Quizzes & Recent Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* SECTION 2: Upcoming Quizzes & Scheduled Papers */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Upcoming Quizzes &amp; Scheduled Schedule</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Targeted for {batch} • {semester}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/student/exams')}>
              View All
            </Button>
          </CardHeader>

          {upcomingExams.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                color: 'var(--color-slate-500)',
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-slate-200)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
              <div style={{ fontWeight: 700, color: 'var(--color-slate-800)', fontSize: '0.95rem' }}>
                No Upcoming Quizzes Scheduled
              </div>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', maxWidth: '320px', margin: '0.25rem auto 0' }}>
                All scheduled quizzes for your cohort have been completed or none are currently scheduled by faculty.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {upcomingExams.map((exam) => (
                <div
                  key={exam.id}
                  style={{
                    padding: '1.1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-slate-200)',
                    backgroundColor: 'var(--color-slate-50)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Badge variant="warning">UPCOMING</Badge>
                      <Badge variant="outline">{exam.type.toUpperCase()}</Badge>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>
                        {exam.duration} Minutes • {exam.totalMarks} Marks
                      </span>
                    </div>

                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.35rem' }}>
                      {exam.title}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-600)', marginTop: '0.15rem' }}>
                      {exam.subject || 'Course Assessment'} {exam.teacherName ? `• ${exam.teacherName}` : ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f2744' }}>
                      {formatPakistanDateTime(exam.startAt)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginTop: '0.15rem' }}>
                      Opens at {formatPakistanTime(exam.startAt)}
                    </div>
                    <Badge variant="outline" size="sm" style={{ marginTop: '0.35rem' }}>
                      Locked Until Start Time
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* SECTION 3: Recent Results & Completed Quizzes */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent Examination Results</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Published official transcripts &amp; GPA records
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/student/results')}>
              All Results
            </Button>
          </CardHeader>

          {completedResults.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                color: 'var(--color-slate-500)',
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-slate-200)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝</div>
              <div style={{ fontWeight: 700, color: 'var(--color-slate-800)', fontSize: '0.95rem' }}>
                No Results Recorded Yet
              </div>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', maxWidth: '320px', margin: '0.25rem auto 0' }}>
                Completed quizzes and examinations will display their official grades here after submission.
              </p>
            </div>
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam / Subject</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead style={{ textAlign: 'right' }}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedResults.map((res) => (
                    <TableRow key={res.id}>
                      <TableCell>
                        <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{res.subject}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>{res.examTitle}</div>
                      </TableCell>
                      <TableCell>
                        <strong>{res.marks}</strong> / {res.totalMarks} ({res.percentage}%)
                      </TableCell>
                      <TableCell>
                        <Badge variant={(res.grade || 'A').startsWith('A') ? 'success' : 'primary'}>
                          {res.grade || 'Passed'}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ textAlign: 'right' }}>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedResult(res)}>
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
      </div>

      {/* Result Card Modal */}
      {selectedResult && (
        <Modal
          isOpen={Boolean(selectedResult)}
          onClose={() => setSelectedResult(null)}
          title="Official Examination Result Card"
          description="ROYAL COLLEGE OF NURSING SWAT • KMU Affiliated Evaluation Transcript"
          maxWidth="md"
          footer={
            <Button variant="primary" onClick={() => setSelectedResult(null)} style={{ backgroundColor: '#0f2744' }}>
              Close Result
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-200)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Candidate Name</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedResult.studentName}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>KMU Registration #</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedResult.kmuRegistrationNo}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Subject</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedResult.subject}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Exam Title</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedResult.examTitle}</div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-50)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-primary-800)', fontWeight: 600 }}>Obtained Score</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary-900)' }}>
                  {selectedResult.marks} / {selectedResult.totalMarks}
                </div>
              </div>
              <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: '#ecfdf5' }}>
                <span style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>Percentage</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#065f46' }}>
                  {selectedResult.percentage}%
                </div>
              </div>
              <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: '#fef3c7' }}>
                <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>Letter Grade</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#92400e' }}>
                  {selectedResult.grade} (Passed)
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--color-slate-500)', fontStyle: 'italic', borderTop: '1px solid var(--color-slate-100)', paddingTop: '0.75rem' }}>
              Note: This is an official digital result transcript issued under the authority of Khyber Medical University examination protocols.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentDashboardPage;
