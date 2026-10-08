import React, { useState } from 'react';
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
  Modal,
  ConfirmDialog,
  Alert,
  EmptyState,
} from '../../components/ui';
import { MOCK_EXAMS } from '../../mock/mockData';

export const AdminExamsPage: React.FC = () => {
  const [exams, setExams] = useState(MOCK_EXAMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedExam, setSelectedExam] = useState<typeof MOCK_EXAMS[0] | null>(null);
  const [deleteExamId, setDeleteExamId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const filteredExams = exams.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchSubject = e.subject.toLowerCase().includes(q);
      const matchTeacher = e.teacherName.toLowerCase().includes(q);
      if (!matchTitle && !matchSubject && !matchTeacher) return false;
    }
    return true;
  });

  const handleDeleteExam = () => {
    if (!deleteExamId) return;
    setExams((prev) => prev.filter((e) => e.id !== deleteExamId));
    setDeleteExamId(null);
    setNotification('Examination record deleted from system registry.');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleArchiveExam = (exam: typeof MOCK_EXAMS[0]) => {
    setExams((prev) =>
      prev.map((e) => (e.id === exam.id ? { ...e, status: 'archived' as const } : e))
    );
    setNotification(`Exam "${exam.title}" has been archived.`);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Centralized Examination Registry
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            College-wide oversight of mid-terms, quizzes, questions, and timing rules.
          </p>
        </div>
      </div>

      {notification && (
        <Alert type="success" onDismiss={() => setNotification(null)}>
          {notification}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search exam title, subject, examiner..."
          />

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '150px' }}>
              <Select
                options={[
                  { value: 'all', label: 'All Exam Types' },
                  { value: 'quiz', label: 'Quiz' },
                  { value: 'midterm', label: 'Mid-Term' },
                  { value: 'exam', label: 'Final Exam' },
                ]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>

            <div style={{ minWidth: '150px' }}>
              <Select
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'archived', label: 'Archived' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Exams Master Table */}
      {filteredExams.length === 0 ? (
        <EmptyState
          title="No Examination Papers Found"
          description="Try modifying search keywords or resetting filters."
          actionLabel="Reset Search"
          onAction={() => {
            setSearchQuery('');
            setTypeFilter('all');
            setStatusFilter('all');
          }}
        />
      ) : (
        <Card padding="none">
          <TableContainer style={{ border: 'none', borderRadius: 'var(--radius-lg)' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paper Title &amp; Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Program &amp; Semester</TableHead>
                  <TableHead>Lead Faculty</TableHead>
                  <TableHead>Duration / Marks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>Admin Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell>
                      <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{exam.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>{exam.subject}</div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{exam.type.toUpperCase()}</Badge>
                    </TableCell>

                    <TableCell>
                      <div style={{ fontWeight: 600 }}>{exam.program}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>{exam.semester}</div>
                    </TableCell>

                    <TableCell>{exam.teacherName}</TableCell>

                    <TableCell>
                      <div>
                        <strong>{exam.duration}</strong> mins • <strong>{exam.totalMarks}</strong> marks
                      </div>
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
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedExam(exam)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleArchiveExam(exam)}
                        >
                          Archive
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteExamId(exam.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* View Exam Details Modal */}
      {selectedExam && (
        <Modal
          isOpen={Boolean(selectedExam)}
          onClose={() => setSelectedExam(null)}
          title="Examination Paper Specifications"
          description="Institutional Controller Record"
          maxWidth="md"
          footer={
            <Button variant="primary" onClick={() => setSelectedExam(null)} style={{ backgroundColor: '#0f2744' }}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Paper Title</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedExam.title}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Subject &amp; Code</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedExam.subject}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Assigned Faculty</span>
                <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{selectedExam.teacherName}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Target Program</span>
                <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{selectedExam.program} ({selectedExam.semester})</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Duration &amp; Marks</span>
                <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{selectedExam.duration} mins • {selectedExam.totalMarks} Total Marks (Pass: {selectedExam.passingMarks})</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Status</span>
                <div><Badge variant="primary">{selectedExam.status}</Badge></div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>Paper Description:</span>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                {selectedExam.description}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Exam Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteExamId)}
        onClose={() => setDeleteExamId(null)}
        onConfirm={handleDeleteExam}
        title="Permanently Delete Examination Record"
        message="This action will delete the examination paper and its question configurations from the college registry."
        confirmText="Confirm Delete"
        variant="danger"
      />
    </div>
  );
};

export default AdminExamsPage;
