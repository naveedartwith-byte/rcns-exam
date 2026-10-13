import React, { useState, useEffect } from 'react';
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
  Avatar,
  EmptyState,
  LoadingSpinner,
} from '../../components/ui';
import { MOCK_PROGRAMS, MOCK_SEMESTERS } from '../../mock/mockData';
import { studentService } from '../../services/studentService';
import { resultService } from '../../services/resultService';
import type { StudentProfile } from '../../types/student';
import type { Result } from '../../types/result';

export const TeacherStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');

  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [viewingResultsStudent, setViewingResultsStudent] = useState<StudentProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStudentsAndResults = async () => {
      try {
        setLoading(true);
        const [fetchedStudents, fetchedResults] = await Promise.all([
          studentService.getAllStudents(),
          resultService.getAllResults(),
        ]);
        if (isMounted) {
          setStudents(fetchedStudents);
          setResults(fetchedResults);
        }
      } catch (err) {
        console.error('Error fetching teacher student roster:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchStudentsAndResults();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredStudents = students.filter((s) => {
    if (programFilter !== 'all' && s.program !== programFilter) return false;
    if (semesterFilter !== 'all' && s.semester !== semesterFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchKmu = s.kmuRegistrationNo.toLowerCase().includes(q);
      if (!matchName && !matchKmu) return false;
    }
    return true;
  });

  const studentResults = viewingResultsStudent
    ? results.filter((r) => r.studentId === viewingResultsStudent.uid || r.kmuRegistrationNo === viewingResultsStudent.kmuRegistrationNo)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
          Enrolled Candidates &amp; Student Roster
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
          Department candidate verification, KMU enrollment records, and academic progress monitoring.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search candidate name or KMU ID..."
          />

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '180px' }}>
              <Select
                options={[{ value: 'all', label: 'All Programs' }, ...MOCK_PROGRAMS.map((p) => ({ value: p.name, label: p.name }))]}
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
              />
            </div>

            <div style={{ minWidth: '150px' }}>
              <Select
                options={[{ value: 'all', label: 'All Semesters' }, ...MOCK_SEMESTERS.map((s) => ({ value: s, label: s }))]}
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Student Table */}
      {loading ? (
        <LoadingSpinner text="Loading candidate roster..." />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          title="No Students Found"
          description="Try broadening your search term or reset program/semester filters."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearchQuery('');
            setProgramFilter('all');
            setSemesterFilter('all');
          }}
        />
      ) : (
        <Card padding="none">
          <TableContainer style={{ border: 'none', borderRadius: 'var(--radius-lg)' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate &amp; KMU Registration</TableHead>
                  <TableHead>Academic Program</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Cumulative GPA</TableHead>
                  <TableHead>Enrollment Status</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.uid}>
                    <TableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={student.name} size="sm" roleBadge="student" />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{student.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-700)', fontWeight: 600 }}>
                            {student.kmuRegistrationNo}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div style={{ fontWeight: 600 }}>{student.program}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>{student.department}</div>
                    </TableCell>

                    <TableCell>{student.semester}</TableCell>

                    <TableCell>
                      <strong style={{ color: 'var(--color-slate-900)', fontSize: '0.95rem' }}>{(student.gpa ?? 3.5).toFixed(2)}</strong> / 4.00
                    </TableCell>

                    <TableCell>
                      <Badge variant={(student.status || 'active') === 'active' ? 'success' : 'danger'}>
                        {student.status || 'active'}
                      </Badge>
                    </TableCell>

                    <TableCell style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedStudent(student)}
                        >
                          Profile
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingResultsStudent(student)}
                        >
                          Results
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

      {/* Candidate Profile Details Modal */}
      {selectedStudent && (
        <Modal
          isOpen={Boolean(selectedStudent)}
          onClose={() => setSelectedStudent(null)}
          title="Candidate Academic Profile"
          description="Khyber Medical University verified student record"
          maxWidth="md"
          footer={
            <Button variant="primary" onClick={() => setSelectedStudent(null)} style={{ backgroundColor: '#0f2744' }}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-slate-100)' }}>
              <Avatar name={selectedStudent.name} size="lg" roleBadge="student" />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--color-slate-900)' }}>
                  {selectedStudent.name}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-primary-700)', fontWeight: 600 }}>
                  KMU ID: {selectedStudent.kmuRegistrationNo}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Father's Name</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedStudent.fatherName}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Email</span>
                <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{selectedStudent.email}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Program</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedStudent.program}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Current Semester</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedStudent.semester}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Contact Phone</span>
                <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{selectedStudent.phone}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Academic Standing</span>
                <div style={{ fontWeight: 700, color: '#059669' }}>GPA: {(selectedStudent.gpa ?? 3.5).toFixed(2)} (Good Standing)</div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Candidate Results Modal */}
      {viewingResultsStudent && (
        <Modal
          isOpen={Boolean(viewingResultsStudent)}
          onClose={() => setViewingResultsStudent(null)}
          title={`Academic Transcript: ${viewingResultsStudent.name}`}
          description={`KMU ID: ${viewingResultsStudent.kmuRegistrationNo} • ${viewingResultsStudent.program}`}
          maxWidth="lg"
          footer={
            <Button variant="primary" onClick={() => setViewingResultsStudent(null)} style={{ backgroundColor: '#0f2744' }}>
              Close Record
            </Button>
          }
        >
          {studentResults.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-slate-500)' }}>
              No examination records found for this candidate yet.
            </div>
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentResults.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div style={{ fontWeight: 600 }}>{r.subject || 'Nursing Assessment'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{(r.examType || 'exam').toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <strong>{r.marks}</strong> / {r.totalMarks}
                      </TableCell>
                      <TableCell>{r.percentage}%</TableCell>
                      <TableCell>
                        <Badge variant="primary">{r.grade || 'Pass'}</Badge>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Modal>
      )}
    </div>
  );
};

export default TeacherStudentsPage;
