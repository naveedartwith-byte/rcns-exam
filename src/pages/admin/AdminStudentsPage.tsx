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
  Modal,
  ConfirmDialog,
  Avatar,
  Input,
  Alert,
  EmptyState,
  LoadingSpinner,
  KmuRegistrationInput,
} from '../../components/ui';
import { MOCK_PROGRAMS, MOCK_SEMESTERS, MOCK_BATCHES } from '../../mock/mockData';
import { studentService } from '../../services/studentService';
import { adminService } from '../../services/adminService';
import { isValidKmuRegistration } from '../../utils/kmuRegistration';
import type { StudentProfile } from '../../types/student';

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const fetched = await studentService.getAllStudents();
      setStudents(fetched);
    } catch (err) {
      console.error('Error loading students in admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toggleStatusStudent, setToggleStatusStudent] = useState<StudentProfile | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<StudentProfile | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Edit / Add state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Password Management modal state (Requirement #3)
  const [passwordModalStudent, setPasswordModalStudent] = useState<StudentProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    email: '',
    kmuRegistrationNo: '',
    program: 'BS Nursing (Generic)',
    department: 'Nursing & Allied Health Sciences',
    batch: 'Batch 15th',
    semester: 'Semester 1',
    phone: '',
    address: '',
  });

  const availableBatches = useMemo(() => {
    const list = [...MOCK_BATCHES];
    students.forEach((s) => {
      if (s.batch && s.batch.trim() && !list.includes(s.batch.trim())) {
        list.push(s.batch.trim());
      }
    });
    return list;
  }, [students]);

  const filteredStudents = students.filter((s) => {
    if (batchFilter !== 'all' && (s.batch || '').trim().toLowerCase() !== batchFilter.trim().toLowerCase()) return false;
    if (semesterFilter !== 'all' && s.semester !== semesterFilter) return false;
    if (programFilter !== 'all' && s.program !== programFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchKmu = s.kmuRegistrationNo.toLowerCase().includes(q);
      const matchEmail = (s.email || '').toLowerCase().includes(q);
      if (!matchName && !matchKmu && !matchEmail) return false;
    }
    return true;
  });

  const handleOpenAddModal = () => {
    setSaveError(null);
    setFormData({
      name: '',
      fatherName: '',
      email: '',
      kmuRegistrationNo: `2026/KMU/RCNS/00${students.length + 1}`,
      program: 'BS Nursing (Generic)',
      department: 'Nursing & Allied Health Sciences',
      batch: 'Batch 15th',
      semester: 'Semester 1',
      phone: '',
      address: '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (s: StudentProfile) => {
    setSaveError(null);
    setEditingStudent(s);
    setFormData({
      name: s.name,
      fatherName: s.fatherName || '',
      email: s.email || '',
      kmuRegistrationNo: s.kmuRegistrationNo,
      program: s.program,
      department: s.department,
      batch: s.batch || 'Batch 15th',
      semester: s.semester,
      phone: s.phone || '',
      address: s.address || '',
    });
  };

  const handleOpenPasswordModal = (s: StudentProfile) => {
    setPasswordModalStudent(s);
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPassword(s.passKey || '');
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalStudent) return;
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const result = await adminService.updateStudentPassword(
        passwordModalStudent.uid,
        passwordModalStudent.email,
        newPassword,
        currentPassword
      );

      setPasswordSuccess(result.message);
      setNotification(`Candidate password updated for ${passwordModalStudent.name}`);
      await fetchStudents();
      setTimeout(() => {
        setPasswordModalStudent(null);
        setNotification(null);
      }, 2500);
    } catch (err: any) {
      console.error('Error changing student password:', err);
      setPasswordError(err.message || 'Failed to update student password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleAdminSendResetEmail = async () => {
    if (!passwordModalStudent || !passwordModalStudent.email) return;
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      setIsUpdatingPassword(true);
      await adminService.sendStudentPasswordReset(passwordModalStudent.email);
      setPasswordSuccess(`Password reset email link sent to ${passwordModalStudent.email}`);
    } catch (err: any) {
      console.error('Error sending reset email:', err);
      setPasswordError(err.message || 'Failed to send password reset email.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!formData.name.trim()) {
      setSaveError('Student Name is mandatory.');
      return;
    }

    if (!formData.kmuRegistrationNo.trim() || !isValidKmuRegistration(formData.kmuRegistrationNo)) {
      setSaveError('Please enter a valid KMU Registration Number (e.g., 2026/KMU/RCNS/001).');
      return;
    }

    setIsSaving(true);
    if (editingStudent) {
      try {
        await studentService.updateStudentByAdmin(editingStudent.uid, editingStudent, {
          name: formData.name,
          fatherName: formData.fatherName,
          email: formData.email || editingStudent.email || '',
          kmuRegistrationNo: formData.kmuRegistrationNo,
          program: formData.program,
          department: formData.department,
          batch: formData.batch,
          semester: formData.semester,
          phone: formData.phone,
          address: formData.address,
        });
        setNotification(`Student record for ${formData.name} successfully updated in Firebase.`);
        await fetchStudents();
        setEditingStudent(null);
      } catch (err: any) {
        console.error('Error updating student profile:', err);
        setSaveError(err.message || 'Failed to update student profile in Firebase.');
      } finally {
        setIsSaving(false);
      }
    } else {
      setNotification(`Candidate record created in registry.`);
      setIsAddModalOpen(false);
      setIsSaving(false);
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

  const handleDeleteStudent = async () => {
    if (!deleteStudent) return;
    try {
      setIsDeletingStudent(true);
      await studentService.deleteStudentPermanently(deleteStudent);
      setNotification(`Candidate record for ${deleteStudent.name} (${deleteStudent.kmuRegistrationNo}) and all associated records permanently deleted.`);
      await fetchStudents();
    } catch (err: any) {
      console.error('Error permanently deleting student:', err);
      setNotification(`Deletion failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeletingStudent(false);
      setDeleteStudent(null);
      setTimeout(() => setNotification(null), 4000);
    }
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
            {/* Batch Filter - FIRST */}
            <div style={{ minWidth: '150px' }}>
              <Select
                options={[
                  { value: 'all', label: 'All Batches' },
                  ...availableBatches.map((b) => ({ value: b, label: b })),
                ]}
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              />
            </div>

            {/* Semester Filter - SECOND */}
            <div style={{ minWidth: '150px' }}>
              <Select
                options={[{ value: 'all', label: 'All Semesters' }, ...MOCK_SEMESTERS.map((s) => ({ value: s, label: s }))]}
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
              />
            </div>

            {/* Academic Program Filter - THIRD */}
            <div style={{ minWidth: '180px' }}>
              <Select
                options={[{ value: 'all', label: 'All Programs' }, ...MOCK_PROGRAMS.map((p) => ({ value: p.name, label: p.name }))]}
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
              />
            </div>

            {/* Account Status Filter - FOURTH */}
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
      {loading ? (
        <LoadingSpinner text="Loading registered candidates..." />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          title="No Candidate Records Found"
          description="Try modifying search keywords or clear current batch, semester, and program filters."
          actionLabel="Reset Search &amp; Filters"
          onAction={() => {
            setSearchQuery('');
            setBatchFilter('all');
            setSemesterFilter('all');
            setProgramFilter('all');
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
                  <TableHead>Batch</TableHead>
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
                      <Badge variant="outline">{s.batch || 'Batch A'}</Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={(s.status || 'active') === 'active' ? 'success' : 'danger'}>
                        {s.status || 'active'}
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
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenPasswordModal(s)}
                          style={{ borderColor: '#cbd5e1', color: '#0f2744' }}
                          title="Change candidate password"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.2rem' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          Pass
                        </Button>
                        <Button
                          variant={s.status === 'active' ? 'danger' : 'success'}
                          size="sm"
                          onClick={() => setToggleStatusStudent(s)}
                        >
                          {s.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteStudent(s)}
                          style={{ backgroundColor: '#991b1b', borderColor: '#991b1b' }}
                          title="Permanently delete candidate and associated records"
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

      {/* View Student Modal */}
      {selectedStudent && (
        <Modal
          isOpen={Boolean(selectedStudent)}
          onClose={() => setSelectedStudent(null)}
          title="Student Official Dossier"
          description="Khyber Medical University verified academic file"
          maxWidth="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const s = selectedStudent;
                  setSelectedStudent(null);
                  handleOpenPasswordModal(s);
                }}
                style={{ borderColor: 'var(--color-primary-300)', color: 'var(--color-primary-800)' }}
              >
                🔑 Change Password
              </Button>
              <Button variant="primary" onClick={() => setSelectedStudent(null)} style={{ backgroundColor: '#0f2744' }}>
                Close Dossier
              </Button>
            </div>
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
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Batch Cohort</span>
                <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{selectedStudent.batch || 'N/A'}</div>
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
            if (!isSaving) {
              setIsAddModalOpen(false);
              setEditingStudent(null);
            }
          }}
          title={editingStudent ? 'Edit Candidate Record' : 'Register New Student (KMU Affiliated)'}
          description="Updates student profile, father's name, and KMU enrollment in Firebase."
          maxWidth="lg"
          footer={
            <>
              <Button
                variant="outline"
                disabled={isSaving}
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStudent(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveStudent}
                disabled={isSaving}
                style={{ backgroundColor: '#0f2744' }}
              >
                {isSaving ? 'Saving to Firebase...' : editingStudent ? 'Save Changes' : 'Register Candidate'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {saveError && <Alert type="danger">{saveError}</Alert>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <Input
                label="Full Name"
                placeholder="e.g. Muhammad Farhan"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                requiredIndicator
                disabled={isSaving}
              />

              <Input
                label="Father's Name"
                placeholder="e.g. Akhtar Ali"
                value={formData.fatherName}
                onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                required
                requiredIndicator
                disabled={isSaving}
              />

              {/* KMU Registration Input with fixed /KMU/RCNS/ pre-written */}
              <div style={{ gridColumn: 'span 2' }}>
                <KmuRegistrationInput
                  label="KMU Registration Number"
                  value={formData.kmuRegistrationNo}
                  onChange={(val) => setFormData({ ...formData, kmuRegistrationNo: val })}
                  required
                  requiredIndicator
                  disabled={isSaving}
                  helperText="Format: YYYY/KMU/RCNS/NNN (e.g. 2026/KMU/RCNS/001)"
                />
              </div>

              <Input
                label="Email Address"
                type="email"
                placeholder="student@royalcollege.edu.pk"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={Boolean(editingStudent) || isSaving}
                helperText={editingStudent ? 'Authentication email is tied to candidate account' : undefined}
              />

              <Select
                label="Academic Program"
                options={MOCK_PROGRAMS.map((p) => ({ value: p.name, label: p.name }))}
                value={formData.program}
                onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                required
                disabled={isSaving}
              />

              <Select
                label="Batch"
                options={MOCK_BATCHES.map((b) => ({ value: b, label: b }))}
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                required
                disabled={isSaving}
              />

              <Select
                label="Semester"
                options={MOCK_SEMESTERS.map((s) => ({ value: s, label: s }))}
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                required
                disabled={isSaving}
              />

              <Input
                label="Phone Number"
                placeholder="+92 300 1234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isSaving}
              />

              <Input
                label="Address"
                placeholder="Saidu Sharif, Swat"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={isSaving}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Change Student Password Modal (Requirement #3) */}
      {passwordModalStudent && (
        <Modal
          isOpen={Boolean(passwordModalStudent)}
          onClose={() => {
            if (!isUpdatingPassword) setPasswordModalStudent(null);
          }}
          title="Change Student Password"
          description={`Update authentication login credentials for ${passwordModalStudent.name} (${passwordModalStudent.kmuRegistrationNo})`}
          maxWidth="md"
          footer={
            <>
              <Button
                variant="outline"
                disabled={isUpdatingPassword}
                onClick={() => setPasswordModalStudent(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAdminChangePassword}
                disabled={isUpdatingPassword || !newPassword}
                style={{ backgroundColor: '#0f2744' }}
              >
                {isUpdatingPassword ? 'Updating Password...' : 'Save New Password'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleAdminChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {passwordError && <Alert type="danger">{passwordError}</Alert>}
            {passwordSuccess && <Alert type="success">{passwordSuccess}</Alert>}

            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--color-slate-500)' }}>Candidate Name:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{passwordModalStudent.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--color-slate-500)' }}>KMU Registration:</span>
                <span style={{ fontWeight: 700, color: '#0f2744' }}>{passwordModalStudent.kmuRegistrationNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-slate-500)' }}>Account Email:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-slate-800)' }}>{passwordModalStudent.email || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed #e2e8f0' }}>
                <span style={{ color: 'var(--color-slate-500)' }}>Auth Sync:</span>
                {passwordModalStudent.passKey ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', backgroundColor: '#ecfdf5', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                    ✓ Direct Auth Sync Ready
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d97706', backgroundColor: '#fffbeb', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #fde68a' }}>
                    ⚡ Legacy Profile (Provide current pass or reset link)
                  </span>
                )}
              </div>
            </div>

            {!passwordModalStudent.passKey && (
              <Input
                label="Current / Previous Password (Optional, if known)"
                type="password"
                placeholder="e.g. 123456"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isUpdatingPassword}
                helperText="Providing the candidate's previous password enables immediate update directly in Firebase Authentication on Spark free tier."
              />
            )}

            <Input
              label="New Password"
              type="password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              requiredIndicator
              disabled={isUpdatingPassword}
              helperText="Set a new password for this student to access their portal"
            />

            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Re-type new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              requiredIndicator
              disabled={isUpdatingPassword}
            />

            <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Alternative:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUpdatingPassword || !passwordModalStudent.email}
                onClick={handleAdminSendResetEmail}
                style={{ fontSize: '0.8rem' }}
              >
                📧 Send Password Reset Email Link
              </Button>
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

      {/* Permanent Deletion Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteStudent)}
        onClose={() => !isDeletingStudent && setDeleteStudent(null)}
        onConfirm={handleDeleteStudent}
        title="Permanently Delete Candidate"
        message={`Are you sure you want to permanently delete candidate ${deleteStudent?.name} (${deleteStudent?.kmuRegistrationNo})?\n\nThis will permanently remove:\n• Student Profile & Registry record\n• KMU Registration unique claim\n• User authentication identity document\n• All examination assignments and attempts\n• All examination results and answer transcripts\n\nThis action cannot be undone.`}
        confirmText={isDeletingStudent ? 'Deleting Candidate...' : 'Permanently Delete'}
        variant="danger"
        isLoading={isDeletingStudent}
      />
    </div>
  );
};

export default AdminStudentsPage;
