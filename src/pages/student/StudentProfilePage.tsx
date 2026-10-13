import React, { useState, useEffect } from 'react';
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

export const StudentProfilePage: React.FC = () => {
  const { userProfile, studentProfile } = useAuth();

  const [studentData, setStudentData] = useState({
    name: userProfile?.name || 'Student Candidate',
    fatherName: studentProfile?.fatherName || '',
    email: userProfile?.email || '',
    kmuRegistrationNo: studentProfile?.kmuRegistrationNo || '',
    program: studentProfile?.program || 'BS Nursing (Generic)',
    department: studentProfile?.department || 'Nursing & Allied Health Sciences',
    batch: studentProfile?.batch || 'Batch 15th',
    semester: studentProfile?.semester || 'Semester 4',
    phone: studentProfile?.phone || '+92 300 1234567',
    address: studentProfile?.address || 'Saidu Sharif, Swat, Khyber Pakhtunkhwa',
    bloodGroup: 'B+',
    status: 'active',
  });

  useEffect(() => {
    if (userProfile || studentProfile) {
      setStudentData((prev) => ({
        ...prev,
        name: userProfile?.name || prev.name,
        email: userProfile?.email || prev.email,
        fatherName: studentProfile?.fatherName || prev.fatherName,
        kmuRegistrationNo: studentProfile?.kmuRegistrationNo || prev.kmuRegistrationNo,
        program: studentProfile?.program || prev.program,
        department: studentProfile?.department || prev.department,
        batch: studentProfile?.batch || prev.batch,
        semester: studentProfile?.semester || prev.semester,
        phone: studentProfile?.phone || prev.phone,
        address: studentProfile?.address || prev.address,
      }));
    }
  }, [userProfile, studentProfile]);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
          Student Academic Profile
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
          Official candidate records registered at ROYAL COLLEGE OF NURSING SWAT (Affiliated with KMU Peshawar).
        </p>
      </div>

      {saveSuccess && (
        <Alert type="success" onDismiss={() => setSaveSuccess(false)}>
          Password updated successfully!
        </Alert>
      )}

      {/* Official Registry Lock Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.85rem 1.25rem',
          backgroundColor: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #cbd5e1',
          fontSize: '0.85rem',
          color: '#334155',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>🔒</span>
        <div style={{ flex: 1, lineHeight: 1.45 }}>
          <strong>Institutional Registration Dossier:</strong> Official identity, KMU Registration ID, enrolled program, batch, and semester details are permanently locked to ensure examination record integrity. Contact College Administration for any authorized profile amendments.
        </div>
      </div>

      {/* Main Student Identity Card */}
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
            <Avatar name={studentData.name} size="xl" roleBadge="student" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                  {studentData.name}
                </h2>
                <Badge variant="success">Active Student</Badge>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-primary-50)',
                    color: 'var(--color-primary-800)',
                    border: '1px solid var(--color-primary-200)',
                  }}
                >
                  Student Login ID
                </span>
                <span style={{ fontSize: '0.92rem', color: 'var(--color-primary-900)', fontWeight: 800 }}>
                  {studentData.kmuRegistrationNo}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
                {studentData.program} • {studentData.batch} • {studentData.semester}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--color-slate-500)',
                backgroundColor: 'var(--color-slate-100)',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-slate-200)',
              }}
            >
              🔒 Profile Locked
            </span>
            <Button variant="secondary" size="sm" onClick={() => setIsPasswordModalOpen(true)}>
              Change Password
            </Button>
          </div>
        </div>

        {/* Academic Profile Details Grid */}
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '1.25rem' }}>
            Official Enrollment &amp; Academic Record
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Full Name</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {studentData.name}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Father's Name</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {studentData.fatherName}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-primary-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary-100)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-primary-800)', textTransform: 'uppercase', fontWeight: 700 }}>
                KMU Registration (Login ID)
              </span>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-primary-900)', marginTop: '0.2rem' }}>
                {studentData.kmuRegistrationNo}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Institution</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                ROYAL COLLEGE OF NURSING SWAT
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Academic Program</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {studentData.program}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Department</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {studentData.department}
              </div>
            </div>

            {/* Separate Batch Field */}
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Enrolled Batch</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {studentData.batch}
              </div>
            </div>

            {/* Separate Semester Field */}
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Current Semester</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {studentData.semester}
              </div>
            </div>

            {/* Formal Profile Email */}
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Formal Contact Email</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {studentData.email}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)' }}>
                Profile info only (Not student login ID)
              </span>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Contact Phone</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {studentData.phone}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)', gridColumn: 'span 2' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Permanent / Residential Address</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                {studentData.address}
              </div>
            </div>
          </div>
        </div>
      </Card>



      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Security Password"
        description="Ensure your password contains at least 6 characters."
        maxWidth="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsPasswordModalOpen(false);
                setSaveSuccess(true);
              }}
              style={{ backgroundColor: '#0f2744' }}
            >
              Update Password
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input label="Current Password" type="password" placeholder="Enter current password" />
          <Input label="New Password" type="password" placeholder="Enter new password" />
          <Input label="Confirm New Password" type="password" placeholder="Re-type new password" />
        </div>
      </Modal>
    </div>
  );
};

export default StudentProfilePage;

