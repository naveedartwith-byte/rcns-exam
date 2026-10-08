import React, { useState } from 'react';
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
import { MOCK_RESULTS } from '../../mock/mockData';

export const StudentResultsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedResult, setSelectedResult] = useState<typeof MOCK_RESULTS[0] | null>(null);

  // Filtered results
  const filteredResults = MOCK_RESULTS.filter((r) => {
    if (typeFilter !== 'all' && r.examType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSub = r.subject.toLowerCase().includes(q);
      const matchTitle = r.examTitle.toLowerCase().includes(q);
      if (!matchSub && !matchTitle) return false;
    }
    return true;
  });

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

      {/* KPI Performance Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <StatCard
          title="Cumulative GPA"
          value="3.78"
          subtitle="Scale: 4.0 (KMU Standard)"
          variant="gold"
          trend={{ value: 'Top 5% in Class', isPositive: true }}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
        />

        <StatCard
          title="Total Exams Graded"
          value={MOCK_RESULTS.length}
          subtitle="All published evaluations"
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
          title="Overall Average"
          value="84.8%"
          subtitle="Average score across courses"
          variant="teal"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          }
        />

        <StatCard
          title="Academic Standing"
          value="Passed (100%)"
          subtitle="Zero failed subjects"
          variant="slate"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
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
                      <Badge variant="outline">{r.examType.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--color-slate-900)' }}>{r.marks}</strong> / {r.totalMarks}
                    </TableCell>
                    <TableCell>
                      <span style={{ fontWeight: 600, color: 'var(--color-slate-800)' }}>{r.percentage}%</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.grade.startsWith('A') ? 'success' : 'primary'}>
                        {r.grade}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">PASSED</Badge>
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
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedResult.studentName}</div>
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
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
                  {selectedResult.grade}
                </div>
              </div>
            </div>

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
