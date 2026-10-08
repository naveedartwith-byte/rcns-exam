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
  ConfirmDialog,
  Avatar,
  Input,
  Alert,
  EmptyState,
  Checkbox,
  LoadingSpinner,
} from '../../components/ui';
import { MOCK_DEPARTMENTS } from '../../mock/mockData';
import { teacherService } from '../../services/teacherService';
import { adminService } from '../../services/adminService';
import type { TeacherProfile } from '../../types/teacher';

export const AdminTeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const fetched = await teacherService.getAllTeachers();
      setTeachers(fetched);
    } catch (err) {
      console.error('Error fetching teachers in admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // Modals
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [permissionsTeacher, setPermissionsTeacher] = useState<TeacherProfile | null>(null);
  const [toggleStatusTeacher, setToggleStatusTeacher] = useState<TeacherProfile | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: 'Nursing & Allied Health Sciences',
    designation: 'Assistant Professor',
    phone: '',
    courses: 'Adult Health Nursing I, Pharmacology',
  });

  const filteredTeachers = teachers.filter((t) => {
    if (departmentFilter !== 'all' && t.department !== departmentFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.name.toLowerCase().includes(q);
      const matchEmail = t.email.toLowerCase().includes(q);
      const matchDept = t.department.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchDept) return false;
    }
    return true;
  });

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      email: '',
      department: 'Nursing & Allied Health Sciences',
      designation: 'Assistant Professor',
      phone: '',
      courses: 'Fundamentals of Nursing',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (t: TeacherProfile) => {
    setEditingTeacher(t);
    setFormData({
      name: t.name,
      email: t.email,
      department: t.department,
      designation: t.designation || 'Assistant Professor',
      phone: t.phone || '',
      courses: (t.courses || []).join(', '),
    });
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const courseList = formData.courses.split(',').map((c) => c.trim()).filter(Boolean);

    if (editingTeacher) {
      try {
        await teacherService.updateTeacherProfile(editingTeacher.uid, {
          name: formData.name,
          designation: formData.designation,
          phone: formData.phone,
          courses: courseList,
        });
        setNotification(`Faculty details for ${formData.name} updated.`);
        fetchTeachers();
      } catch (err) {
        console.error('Error updating teacher:', err);
      }
      setEditingTeacher(null);
    } else {
      try {
        await adminService.provisionTeacher({
          name: formData.name,
          email: formData.email,
          department: formData.department,
          designation: formData.designation,
          phone: formData.phone,
          courses: courseList,
        });
        setNotification(`Faculty member ${formData.name} profile provisioned.`);
        fetchTeachers();
      } catch (err) {
        console.error('Error provisioning teacher:', err);
      }
      setIsAddModalOpen(false);
    }
    setTimeout(() => setNotification(null), 3500);
  };

  const handleToggleStatus = () => {
    if (!toggleStatusTeacher) return;
    const newStatus = toggleStatusTeacher.status === 'active' ? 'inactive' : 'active';
    setTeachers((prev) =>
      prev.map((t) => (t.uid === toggleStatusTeacher.uid ? { ...t, status: newStatus } : t))
    );
    setNotification(`Faculty status for ${toggleStatusTeacher.name} set to ${newStatus}.`);
    setToggleStatusTeacher(null);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Faculty &amp; Examiner Directory
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            Manage professors, examiners, paper creation authorizations, and academic departments.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenAddModal} style={{ backgroundColor: '#0f2744' }}>
          + Add Faculty Member
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
            placeholder="Search faculty name, email, designation..."
          />

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '220px' }}>
              <Select
                options={[{ value: 'all', label: 'All Departments' }, ...MOCK_DEPARTMENTS.map((d) => ({ value: d, label: d }))]}
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              />
            </div>

            <div style={{ minWidth: '130px' }}>
              <Select
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Faculty Table */}
      {loading ? (
        <LoadingSpinner text="Loading faculty roster..." />
      ) : filteredTeachers.length === 0 ? (
        <EmptyState
          title="No Faculty Members Found"
          description="Try modifying search keywords or clear current department filter."
          actionLabel="Reset Search"
          onAction={() => {
            setSearchQuery('');
            setDepartmentFilter('all');
            setStatusFilter('all');
          }}
        />
      ) : (
        <Card padding="none">
          <TableContainer style={{ border: 'none', borderRadius: 'var(--radius-lg)' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faculty Name &amp; Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Papers Authored</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>Faculty Management</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((t) => (
                  <TableRow key={t.uid}>
                    <TableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={t.name} size="sm" roleBadge="teacher" />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{t.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-700)', fontWeight: 600 }}>
                            {t.designation}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>{t.department}</TableCell>

                    <TableCell>{t.email}</TableCell>

                    <TableCell>
                      <Badge variant="outline">{t.totalExams} Exams</Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={t.status === 'active' ? 'success' : 'default'}>
                        {t.status}
                      </Badge>
                    </TableCell>

                    <TableCell style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedTeacher(t)}
                        >
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(t)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPermissionsTeacher(t)}
                        >
                          Permissions
                        </Button>
                        <Button
                          variant={t.status === 'active' ? 'danger' : 'success'}
                          size="sm"
                          onClick={() => setToggleStatusTeacher(t)}
                        >
                          {t.status === 'active' ? 'Deactivate' : 'Activate'}
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

      {/* View Teacher Details Modal */}
      {selectedTeacher && (
        <Modal
          isOpen={Boolean(selectedTeacher)}
          onClose={() => setSelectedTeacher(null)}
          title="Faculty Academic Profile"
          description="ROYAL COLLEGE OF NURSING SWAT"
          maxWidth="md"
          footer={
            <Button variant="primary" onClick={() => setSelectedTeacher(null)} style={{ backgroundColor: '#0f2744' }}>
              Close
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-slate-100)' }}>
              <Avatar name={selectedTeacher.name} size="lg" roleBadge="teacher" />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{selectedTeacher.name}</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-primary-700)', fontWeight: 600 }}>
                  {selectedTeacher.designation} • {selectedTeacher.department}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Official Email</span>
                <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{selectedTeacher.email}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Contact Phone</span>
                <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>{selectedTeacher.phone}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Assigned Courses</span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                  {(selectedTeacher.courses || []).map((c: string, i: number) => (
                    <Badge key={i} variant="primary">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Faculty Modal */}
      {(isAddModalOpen || editingTeacher) && (
        <Modal
          isOpen={isAddModalOpen || Boolean(editingTeacher)}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingTeacher(null);
          }}
          title={editingTeacher ? 'Edit Faculty Record' : 'Add New Faculty Member'}
          description="Provide appointment and department details."
          maxWidth="md"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingTeacher(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveTeacher} style={{ backgroundColor: '#0f2744' }}>
                {editingTeacher ? 'Save Changes' : 'Induct Faculty Member'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveTeacher} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              label="Full Name & Title"
              placeholder="e.g. Dr. Tariq Shah, PhD"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Official Institutional Email"
              type="email"
              placeholder="dr.tariq@royalcollege.edu.pk"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Select
              label="Department"
              options={MOCK_DEPARTMENTS.map((d) => ({ value: d, label: d }))}
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              required
            />

            <Input
              label="Academic Designation"
              placeholder="Associate Professor / Senior Lecturer"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              required
            />

            <Input
              label="Contact Phone Number"
              placeholder="+92 300 9112233"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              label="Assigned Courses (Comma separated)"
              placeholder="Adult Health Nursing I, Pharmacology"
              value={formData.courses}
              onChange={(e) => setFormData({ ...formData, courses: e.target.value })}
            />
          </form>
        </Modal>
      )}

      {/* Permissions Modal */}
      {permissionsTeacher && (
        <Modal
          isOpen={Boolean(permissionsTeacher)}
          onClose={() => setPermissionsTeacher(null)}
          title={`Examiner Authorizations: ${permissionsTeacher.name}`}
          description="Grant or revoke specific academic and testing privileges."
          maxWidth="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setPermissionsTeacher(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setPermissionsTeacher(null);
                  setNotification('Examiner authorizations updated.');
                  setTimeout(() => setNotification(null), 3000);
                }}
                style={{ backgroundColor: '#0f2744' }}
              >
                Save Permissions
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Checkbox
              label="Create & Edit Examination Papers"
              description="Allow authoring mid-term, quiz, and final papers"
              defaultChecked
            />
            <Checkbox
              label="Publish Official Results"
              description="Permit release of grades to candidate portal"
              defaultChecked
            />
            <Checkbox
              label="View Student Complete Dossiers"
              description="Access KMU registration records and GPAs"
              defaultChecked
            />
            <Checkbox
              label="Manage Question Banks"
              description="Author and archive departmental question repositories"
              defaultChecked
            />
          </div>
        </Modal>
      )}

      {/* Status Toggle Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(toggleStatusTeacher)}
        onClose={() => setToggleStatusTeacher(null)}
        onConfirm={handleToggleStatus}
        title={toggleStatusTeacher?.status === 'active' ? 'Deactivate Faculty Account' : 'Reactivate Faculty Account'}
        message={`Are you sure you want to ${
          toggleStatusTeacher?.status === 'active' ? 'deactivate' : 'reactivate'
        } faculty access for ${toggleStatusTeacher?.name}?`}
        confirmText={toggleStatusTeacher?.status === 'active' ? 'Deactivate' : 'Reactivate'}
        variant={toggleStatusTeacher?.status === 'active' ? 'danger' : 'primary'}
      />
    </div>
  );
};

export default AdminTeachersPage;
