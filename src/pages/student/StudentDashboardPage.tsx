import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { StatCard, Button, Badge, Card, CardHeader, CardTitle, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableContainer, Modal } from '../../components/ui';
import { MOCK_EXAMS, MOCK_RESULTS } from '../../mock/mockData';

export const StudentDashboardPage: React.FC = () => {
  const { userProfile, studentProfile } = useAuth();
  const navigate = useNavigate();

  const studentName = userProfile?.name || 'Muhammad Farhan';
  const kmuReg = studentProfile?.kmuRegistrationNo || '2026/KMU-RCNS/001';
  const program = studentProfile?.program || 'BS Nursing (Generic)';
  const semester = studentProfile?.semester || 'Semester 4';

  const [selectedResult, setSelectedResult] = useState<typeof MOCK_RESULTS[0] | null>(null);

  // Student specific mock data
  const activeExams = MOCK_EXAMS.filter((e) => e.status === 'active');
  const upcomingExams = MOCK_EXAMS.filter((e) => e.status === 'scheduled');
  const completedResults = MOCK_RESULTS.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Welcome Banner */}
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
              gap: '0.4rem',
              padding: '0.2rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              fontSize: '0.78rem',
              fontWeight: 600,
              marginBottom: '0.75rem',
            }}
          >
            <span>KMU ID: {kmuReg}</span>
            <span>•</span>
            <span>{semester}</span>
          </div>

          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Welcome back, {studentName}
          </h1>

          <p style={{ fontSize: '0.95rem', color: '#e2e8f0', marginTop: '0.4rem', lineHeight: 1.5 }}>
            Enrolled in <strong>{program}</strong> at ROYAL COLLEGE OF NURSING SWAT. You have{' '}
            <strong style={{ color: '#fde68a' }}>{activeExams.length} active exam</strong> available for submission.
          </p>
        </div>

        <div style={{ zIndex: 1, display: 'flex', gap: '0.75rem' }}>
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

      {/* Statistics Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <StatCard
          title="Total Assigned Exams"
          value={MOCK_EXAMS.length}
          subtitle="All academic evaluations"
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
          title="Active Exams"
          value={activeExams.length}
          subtitle="Available for submission now"
          variant="teal"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />

        <StatCard
          title="Completed Exams"
          value="2"
          subtitle="Submitted & graded"
          variant="slate"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />

        <StatCard
          title="Cumulative GPA"
          value="3.78"
          subtitle="Academic Standing: Excellent"
          variant="gold"
          trend={{ value: 'Top 5% in Batch', isPositive: true }}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
        />
      </div>

      {/* Active Exam Action Alert if available */}
      {activeExams.length > 0 && (
        <Card style={{ borderLeft: '4px solid var(--color-primary-600)', backgroundColor: '#f0f7ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-100)',
                  color: 'var(--color-primary-800)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant="primary">Active Now</Badge>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                    Duration: {activeExams[0].duration} Mins • Total Marks: {activeExams[0].totalMarks}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                  {activeExams[0].title}
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)' }}>
                  Subject: {activeExams[0].subject} • Instructor: {activeExams[0].teacherName}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/student/exams')}
              style={{ backgroundColor: '#0f2744' }}
            >
              Enter Exam Room
            </Button>
          </div>
        </Card>
      )}

      {/* Two Column Layout: Upcoming Exams & Recent Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Upcoming Exams Card */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Upcoming Examination Schedule</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Scheduled mid-terms &amp; quizzes
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/student/exams')}>
              View All
            </Button>
          </CardHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {upcomingExams.map((exam) => (
              <div
                key={exam.id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-slate-200)',
                  backgroundColor: 'var(--color-slate-50)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Badge variant={exam.type === 'midterm' ? 'warning' : 'info'}>
                      {exam.type.toUpperCase()}
                    </Badge>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>
                      {exam.duration} Minutes
                    </span>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.25rem' }}>
                    {exam.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-600)', marginTop: '0.15rem' }}>
                    {exam.subject}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>
                    Oct 10, 2026
                  </div>
                  <Badge variant="outline" size="sm" style={{ marginTop: '0.25rem' }}>
                    Scheduled
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Results Card */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent Examination Results</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Published official transcripts
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/student/results')}>
              All Results
            </Button>
          </CardHeader>

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
                      <Badge variant={res.grade.startsWith('A') ? 'success' : 'primary'}>
                        {res.grade}
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
        </Card>
      </div>

      {/* Result Card Modal */}
      {selectedResult && (
        <Modal
          isOpen={Boolean(selectedResult)}
          onClose={() => setSelectedResult(null)}
          title="Official Examination Result Card"
          description={`ROYAL COLLEGE OF NURSING SWAT • Session 2025-2026`}
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
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Student Name</span>
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
