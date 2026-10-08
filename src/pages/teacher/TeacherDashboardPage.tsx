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
} from '../../components/ui';
import { examService } from '../../services/examService';
import { studentService } from '../../services/studentService';
import type { Exam } from '../../types/exam';

export const TeacherDashboardPage: React.FC = () => {
  const { currentUser, userProfile, teacherProfile } = useAuth();
  const navigate = useNavigate();

  const teacherName = userProfile?.name || 'Faculty Examiner';
  const department = teacherProfile?.department || 'Nursing & Allied Health Sciences';

  const [teacherExams, setTeacherExams] = useState<Exam[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchTeacherData = async () => {
      try {
        if (currentUser) {
          const [exams, students] = await Promise.all([
            examService.getExamsByTeacher(currentUser.uid),
            studentService.getAllStudents(),
          ]);
          if (isMounted) {
            setTeacherExams(exams);
            setTotalStudents(students.length);
          }
        }
      } catch (err) {
        console.error('Error loading teacher dashboard data:', err);
      }
    };
    fetchTeacherData();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const activeExams = teacherExams.filter((e) => e.status === 'active');
  const draftExams = teacherExams.filter((e) => e.status === 'draft');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f2744 0%, #16365c 60%, #0d9488 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem 2.25rem',
          color: '#ffffff',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
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
            <span>Department: {department}</span>
            <span>•</span>
            <span>Faculty &amp; Examiner Portal</span>
          </div>

          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Welcome, {teacherName}
          </h1>

          <p style={{ fontSize: '0.95rem', color: '#e2e8f0', marginTop: '0.4rem', lineHeight: 1.5 }}>
            You have <strong style={{ color: '#fde68a' }}>{activeExams.length} active examination</strong> currently live for candidate submissions across Nursing &amp; Health Sciences.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={() => navigate('/teacher/exams')}
            style={{ backgroundColor: '#ffffff', color: '#0f2744', fontWeight: 700 }}
          >
            + Create New Exam
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/teacher/students')}
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.4)' }}
          >
            Enrolled Students
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        <StatCard
          title="Total Exams"
          value={teacherExams.length}
          subtitle="All academic papers"
          variant="primary"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          }
        />

        <StatCard
          title="Active Exams"
          value={activeExams.length}
          subtitle="Open for candidate testing"
          variant="teal"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />

        <StatCard
          title="Draft Papers"
          value={draftExams.length}
          subtitle="Pending question setup"
          variant="gold"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          }
        />

        <StatCard
          title="Enrolled Candidates"
          value={totalStudents}
          subtitle="Department students"
          variant="slate"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
      </div>

      {/* Quick Action Tiles */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '0.85rem' }}>
          Faculty Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <Card
            hoverable
            onClick={() => navigate('/teacher/exams')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>Create New Exam</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>Setup title, duration, passing score</div>
            </div>
          </Card>

          <Card
            hoverable
            onClick={() => navigate('/teacher/exams')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', backgroundColor: '#ccfbf1', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>Manage Question Bank</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>Add MCQs &amp; True/False items</div>
            </div>
          </Card>

          <Card
            hoverable
            onClick={() => navigate('/teacher/students')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', backgroundColor: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>Candidate Directory</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>View KMU reg records &amp; GPAs</div>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Examinations Master Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent Department Examinations</CardTitle>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
              Manage paper status, questions, and timing
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate('/teacher/exams')}>
            View All Examinations
          </Button>
        </CardHeader>

        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam Title &amp; Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Semester / Program</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacherExams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell>
                    <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{exam.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>{exam.subject || 'Clinical Assessment'}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{exam.type.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    <div style={{ fontWeight: 600 }}>{exam.semester}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>{exam.program}</div>
                  </TableCell>
                  <TableCell>{exam.duration} mins</TableCell>
                  <TableCell>
                    <strong>{exam.totalMarks}</strong> (Pass: {exam.passingMarks || Math.round(exam.totalMarks * 0.5)})
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        exam.status === 'active'
                          ? 'success'
                          : exam.status === 'scheduled'
                          ? 'warning'
                          : exam.status === 'completed'
                          ? 'default'
                          : 'outline'
                      }
                    >
                      {exam.status}
                    </Badge>
                  </TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate('/teacher/exams')}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </div>
  );
};

export default TeacherDashboardPage;
