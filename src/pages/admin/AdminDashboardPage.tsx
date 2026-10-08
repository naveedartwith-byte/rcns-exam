import React from 'react';
import { useNavigate } from 'react-router-dom';
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
import { MOCK_ADMIN_STATS, MOCK_EXAMS } from '../../mock/mockData';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const stats = MOCK_ADMIN_STATS;

  // Department enrollment breakdown data
  const departmentBreakdown = [
    { name: 'Nursing & Allied Health Sciences', count: 185, percent: 53 },
    { name: 'Physical Therapy & Rehabilitation (DPT)', count: 72, percent: 21 },
    { name: 'Medical Laboratory Technology', count: 54, percent: 15 },
    { name: 'Radiology & Imaging Technology', count: 37, percent: 11 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #09090b 0%, #0f2744 60%, #0e5baa 100%)',
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
            <span>KMU Institutional Affiliation: KPK-RCNS-2026</span>
            <span>•</span>
            <span>Master Administration</span>
          </div>

          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Institutional Administration &amp; Examination Controller
          </h1>

          <p style={{ fontSize: '0.95rem', color: '#e2e8f0', marginTop: '0.4rem', lineHeight: 1.5 }}>
            Centralized monitoring for <strong>ROYAL COLLEGE OF NURSING SWAT</strong>. Real-time verification of 348 candidates and faculty across 5 departments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={() => navigate('/admin/students')}
            style={{ backgroundColor: '#ffffff', color: '#0f2744', fontWeight: 700 }}
          >
            Student Directory
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/admin/results')}
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.4)' }}
          >
            Master Results
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        <StatCard
          title="Total Candidates"
          value={stats.totalStudents}
          subtitle="Enrolled under KMU"
          variant="primary"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />

        <StatCard
          title="Faculty Members"
          value={stats.totalTeachers}
          subtitle="Examiners &amp; Lecturers"
          variant="teal"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
        />

        <StatCard
          title="Active Exams"
          value={stats.activeExams}
          subtitle="Live across campuses"
          variant="rose"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />

        <StatCard
          title="Overall Pass Rate"
          value={`${stats.overallPassRate}%`}
          subtitle="College Academic Benchmark"
          variant="gold"
          trend={{ value: 'Target 90% Met', isPositive: true }}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
        />
      </div>

      {/* Two Column Layout: Department Distribution + Recent Audit Log */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Department Enrollment Breakdown */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Department Enrollment Distribution</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Active candidate registration across disciplines
              </span>
            </div>
          </CardHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {departmentBreakdown.map((dept, idx) => {
              const colors = ['#0f2744', '#0d9488', '#d97706', '#6366f1'];
              const currentColor = colors[idx % colors.length];

              return (
                <div key={dept.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-slate-800)' }}>{dept.name}</span>
                    <span style={{ color: 'var(--color-slate-600)', fontWeight: 700 }}>
                      {dept.count} Students ({dept.percent}%)
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-slate-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${dept.percent}%`,
                        height: '100%',
                        backgroundColor: currentColor,
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent Platform Activity Audit Log */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>System Activity &amp; Audit Trail</CardTitle>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Real-time examination &amp; registration events
              </span>
            </div>
          </CardHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {stats.recentActivity.map((act) => (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-slate-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-slate-200)',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor:
                      act.type === 'registration'
                        ? 'var(--color-primary-50)'
                        : act.type === 'result'
                        ? '#ecfdf5'
                        : '#fef3c7',
                    color:
                      act.type === 'registration'
                        ? 'var(--color-primary-800)'
                        : act.type === 'result'
                        ? '#047857'
                        : '#b45309',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 14 14" />
                  </svg>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
                      {act.title}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>{act.time}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-slate-600)', marginTop: '0.2rem', margin: 0 }}>
                    {act.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* College Examination Overview Master List */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Active College-Wide Examinations</CardTitle>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
              Live and scheduled assessment monitoring
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate('/admin/exams')}>
            Manage All Registry
          </Button>
        </CardHeader>

        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam Title &amp; Subject</TableHead>
                <TableHead>Program &amp; Department</TableHead>
                <TableHead>Lead Faculty</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_EXAMS.slice(0, 4).map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell>
                    <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{exam.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>{exam.subject}</div>
                  </TableCell>
                  <TableCell>
                    <div style={{ fontWeight: 600 }}>{exam.program}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>{exam.semester}</div>
                  </TableCell>
                  <TableCell>{exam.teacherName}</TableCell>
                  <TableCell>{exam.duration} mins</TableCell>
                  <TableCell>
                    <Badge variant={exam.status === 'active' ? 'success' : 'warning'}>
                      {exam.status}
                    </Badge>
                  </TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    <Button variant="secondary" size="sm" onClick={() => navigate('/admin/exams')}>
                      Inspect
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

export default AdminDashboardPage;
