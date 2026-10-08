import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  Card,
  Avatar,
  Badge,
  Button,
  Modal,
  Input,
  Alert,
} from '../../components/ui';

export const TeacherProfilePage: React.FC = () => {
  const { userProfile, teacherProfile } = useAuth();

  const [teacherData, setTeacherData] = useState({
    name: userProfile?.name || 'Dr. Tariq Shah, PhD',
    email: userProfile?.email || 'dr.tariq@royalcollege.edu.pk',
    department: teacherProfile?.department || 'Nursing & Allied Health Sciences',
    designation: 'Associate Professor & Head of Department',
    phone: '+92 300 9112233',
    office: 'Academic Block B, Room 204',
    specialization: 'Critical Care Nursing & Clinical Pharmacology',
    courses: [
      'Adult Health Nursing I (NUR-201)',
      'Clinical Pharmacology (PHM-302)',
      'Pathophysiology in Critical Care (NUR-401)',
    ],
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditModalOpen(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
          Faculty &amp; Examiner Profile
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
          Official academic appointments, authoring privileges, and department information.
        </p>
      </div>

      {saveSuccess && (
        <Alert type="success" onDismiss={() => setSaveSuccess(false)}>
          Faculty profile details updated successfully!
        </Alert>
      )}

      {/* Main Faculty Card */}
      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
            paddingBottom: '1.5rem',
            borderBottom: '1px solid var(--color-slate-100)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Avatar name={teacherData.name} size="xl" roleBadge="teacher" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                  {teacherData.name}
                </h2>
                <Badge variant="success">Verified Faculty</Badge>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-primary-700)', fontWeight: 600, marginTop: '0.2rem' }}>
                {teacherData.designation}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', marginTop: '0.15rem' }}>
                Department: {teacherData.department}
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
            Edit Faculty Info
          </Button>
        </div>

        {/* Details Grid */}
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '1.25rem' }}>
            Faculty &amp; Course Assignment
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Institution</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                ROYAL COLLEGE OF NURSING SWAT
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Academic Department</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {teacherData.department}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Official Email</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {teacherData.email}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Office / Chamber</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {teacherData.office}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)', gridColumn: 'span 2' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Assigned Teaching Courses (2025–2026)</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {teacherData.courses.map((c, i) => (
                  <Badge key={i} variant="primary" size="md">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Faculty Information"
        description="Update your contact details and office chamber location."
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveProfile} style={{ backgroundColor: '#0f2744' }}>
              Save Profile
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Full Name"
            value={teacherData.name}
            onChange={(e) => setTeacherData({ ...teacherData, name: e.target.value })}
            required
          />

          <Input
            label="Academic Designation"
            value={teacherData.designation}
            onChange={(e) => setTeacherData({ ...teacherData, designation: e.target.value })}
            required
          />

          <Input
            label="Contact Phone Number"
            value={teacherData.phone}
            onChange={(e) => setTeacherData({ ...teacherData, phone: e.target.value })}
          />

          <Input
            label="Office / Chamber Location"
            value={teacherData.office}
            onChange={(e) => setTeacherData({ ...teacherData, office: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
};

export default TeacherProfilePage;
