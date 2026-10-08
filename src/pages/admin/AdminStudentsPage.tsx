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
  Avatar,
  Input,
  Alert,
  EmptyState,
} from '../../components/ui';
import { MOCK_STUDENTS, MOCK_PROGRAMS, MOCK_SEMESTERS } from '../../mock/mockData';

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState<typeof MOCK_STUDENTS[0] | null>(null);
  const [editingStudent, setEditingStudent] = useState<typeof MOCK_STUDENTS[0] | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toggleStatusStudent, setToggleStatusStudent] = useState<typeof MOCK_STUDENTS[0] | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    email: '',
    kmuRegistrationNo: '',
    program: 'BS Nursing (Generic)',
    department: 'Nursing & Allied Health Sciences',
    semester: 'Semester 1',
    phone: '',
    address: '',
  });

  const filteredStudents = students.filter((s) => {
    if (programFilter !== 'all' && s.program !== programFilter) return false;
    if (semesterFilter !== 'all' && s.semester !== semesterFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchKmu = s.kmuRegistrationNo.toLowerCase().includes(q);
      const matchEmail = s.email.toLowerCase().includes(q);
      if (!matchName && !matchKmu && !matchEmail) return false;
    }
    return true;
  });

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      fatherName: '',
      email: '',
      kmuRegistrationNo: `2026/KMU-RCNS/00${students.length + 1}`,
      program: 'BS Nursing (Generic)',
      department: 'Nursing & Allied Health Sciences',
      semester: 'Semester 1',
      phone: '',
      address: '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (s: typeof MOCK_STUDENTS[0]) => {
    setEditingStudent(s);
    setFormData({
      name: s.name,
      fatherName: s.fatherName,
      email: s.email,
      kmuRegistrationNo: s.kmuRegistrationNo,
      program: s.program,
      department: s.department,
      semester: s.semester,
      phone: s.phone,
      address: s.address,
    });
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      setStudents((prev) =>
        prev.map((item) =>
          item.uid === editingStudent.uid
            ? {
                ...item,
                ...formData,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
      setNotification(`Student record for ${formData.name} updated successfully.`);
      setEditingStudent(null);
    } else {
      const newStudent: typeof MOCK_STUDENTS[0] = {
        uid: `student-${Date.now()}`,
        role: 'student',
        ...formData,
        status: 'active',
        gpa: 3.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setStudents((prev) => [newStudent, ...prev]);
      setNotification(`Candidate ${formData.name} registered under KMU registration.`);
      setIsAddModalOpen(false);
    }
    setTimeout(() => setNotification(null), 3500);
  };

  const handleToggleStatus = () => {
    if (!toggleStatusStudent) return;
    const newStatus = toggleStatusStudent.status === 'active' ? 'suspended' : 'active';
    setStudents((prev) =>
      prev.map((s) => (s.uid === toggleStatusStudent.uid ? { ...s, status: newStatus } : s))
    );
    setNotification(`Status for ${toggleStatusStudent.name} changed to ${newStatus}.`);
    setToggleStatusStudent(null);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Student &amp; Candidate Registry
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            Comprehensive KMU enrollment registry, academic verification, and status control.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenAddModal} style={{ backgroundColor: '#0f2744' }}>
          + Register New Candidate
        </Button>
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
            placeholder="Search candidate name, KMU ID, email..."
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

            <div style={{ minWidth: '130px' }}>
              <Select
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Student Registry Table */}
      {filteredStudents.length === 0 ? (
        <EmptyState
          title="No Candidate Records Found"
          description="Try modifying search keywords or clear current program and semester filters."
          actionLabel="Reset Search &amp; Filters"
          onAction={() => {
            setSearchQuery('');
            setProgramFilter('all');
            setSemesterFilter('all');
            setStatusFilter('all');
          }}
        />
      ) : (
        <Card padding="none">
          <TableContainer style={{ border: 'none', borderRadius: 'var(--radius-lg)' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate &amp; KMU Registration</TableHead>
                  <TableHead>Father's Name</TableHead>
                  <TableHead>Program &amp; Department</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Current GPA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>Management Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s) => (
                  <TableRow key={s.uid}>
                    <TableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={s.name} size="sm" roleBadge="student" />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{s.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-700)', fontWeight: 600 }}>
                            {s.kmuRegistrationNo}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>{s.fatherName}</TableCell>

                    <TableCell>
                      <div style={{ fontWeight: 600 }}>{s.program}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>{s.department}</div>
                    </TableCell>

                    <TableCell>{s.semester}</TableCell>

                    <TableCell>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--color-slate-900)' }}>{s.gpa.toFixed(2)}</strong> / 4.00
                    </TableCell>

                    <TableCell>
                      <Badge variant={s.status === 'active' ? 'success' : 'danger'}>
                        {s.status}
                      </Badge>
                    </TableCell>

                    <TableCell style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedStudent(s)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(s)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={s.status === 'active' ? 'danger' : 'success'}
                          size="sm"
                          onClick={() => setToggleStatusStudent(s)}
                        >
                          {s.status === 'active' ? 'Suspend' : 'Activate'}
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

      {/* View Student Modal */}
      {selectedStudent && (
        <Modal
          isOpen={Boolean(selectedStudent)}
          onClose={() => setSelectedStudent(null)}
          title="Student Official Dossier"
          description="Khyber Medical University verified academic file"
          maxWidth="md"
          footer={
            <Button variant="primary" onClick={() => setSelectedStudent(null)} style={{ backgroundColor: '#0f2744' }}>
              Close Dossier
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-slate-100)' }}>
              <Avatar name={selectedStudent.name} size="lg" roleBadge="student" />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{selectedStudent.name}</h3>
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
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Official Email</span>
                <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{selectedStudent.email}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Program</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedStudent.program}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Semester</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedStudent.semester}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Phone</span>
                <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{selectedStudent.phone}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>GPA Standing</span>
                <div style={{ fontWeight: 700, color: '#059669' }}>{selectedStudent.gpa.toFixed(2)} / 4.00</div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Student Modal */}
      {(isAddModalOpen || editingStudent) && (
        <Modal
          isOpen={isAddModalOpen || Boolean(editingStudent)}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingStudent(null);
          }}
          title={editingStudent ? 'Edit Candidate Record' : 'Register New Student (KMU Affiliated)'}
          description="Ensure KMU registration number matches university issuance."
          maxWidth="lg"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStudent(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveStudent} style={{ backgroundColor: '#0f2744' }}>
                {editingStudent ? 'Save Changes' : 'Register Candidate'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <Input
                label="Full Name"
                placeholder="e.g. Muhammad Farhan"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <Input
                label="Father's Name"
                placeholder="e.g. Akhtar Ali"
                value={formData.fatherName}
                onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                required
              />

              <Input
                label="KMU Registration Number"
                placeholder="2026/KMU-RCNS/001"
                value={formData.kmuRegistrationNo}
                onChange={(e) => setFormData({ ...formData, kmuRegistrationNo: e.target.value })}
                required
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="student@royalcollege.edu.pk"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />

              <Select
                label="Academic Program"
                options={MOCK_PROGRAMS.map((p) => ({ value: p.name, label: p.name }))}
                value={formData.program}
                onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                required
              />

              <Select
                label="Semester"
                options={MOCK_SEMESTERS.map((s) => ({ value: s, label: s }))}
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                required
              />

              <Input
                label="Phone Number"
                placeholder="+92 300 1234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />

              <Input
                label="Address"
                placeholder="Saidu Sharif, Swat"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Suspend / Activate Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(toggleStatusStudent)}
        onClose={() => setToggleStatusStudent(null)}
        onConfirm={handleToggleStatus}
        title={toggleStatusStudent?.status === 'active' ? 'Suspend Student Account' : 'Reactivate Student Account'}
        message={`Are you sure you want to ${
          toggleStatusStudent?.status === 'active' ? 'suspend' : 'reactivate'
        } ${toggleStatusStudent?.name} (KMU ID: ${toggleStatusStudent?.kmuRegistrationNo})?`}
        confirmText={toggleStatusStudent?.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
        variant={toggleStatusStudent?.status === 'active' ? 'danger' : 'primary'}
      />
    </div>
  );
};

export default AdminStudentsPage;
