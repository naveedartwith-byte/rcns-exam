import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Logo, Input, Select, Button, Alert, Checkbox } from '../../components/ui';
import { MOCK_PROGRAMS, MOCK_BATCHES, MOCK_SEMESTERS } from '../../mock/mockData';

export const RegisterStudentPage: React.FC = () => {
  const { registerStudent } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    email: '',
    password: '',
    confirmPassword: '',
    kmuRegistrationNo: '',
    program: 'BS Nursing (Generic)',
    department: 'Nursing & Allied Health Sciences',
    batch: '',
    semester: '',
    agreedToTerms: false,
  });

  const [allocatedKmuNo, setAllocatedKmuNo] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  const handleProgramChange = (progName: string) => {
    const selected = MOCK_PROGRAMS.find((p) => p.name === progName);
    setFormData((prev) => ({
      ...prev,
      program: progName,
      department: selected ? selected.department : prev.department,
    }));
  };

  const handleBatchChange = (batchVal: string) => {
    setFormData((prev) => ({
      ...prev,
      batch: batchVal,
      // Reset semester if batch is cleared
      semester: batchVal ? prev.semester : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Frontend Validations
    if (!formData.name.trim() || !formData.fatherName.trim() || !formData.email.trim() || !formData.password) {
      setErrorMessage('Please fill in all required academic registration fields.');
      return;
    }

    if (!formData.batch) {
      setErrorMessage('Please select your Batch (e.g., Batch 15th). Batch is required.');
      return;
    }

    if (!formData.semester) {
      setErrorMessage('Please select your Semester. Semester depends on your Batch.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Password and Confirm Password do not match.');
      return;
    }

    if (!formData.agreedToTerms) {
      setErrorMessage('You must verify and agree to Royal College of Nursing Swat examination rules.');
      return;
    }

    setIsLoading(true);
    try {
      const allocatedNumber = await registerStudent({
        email: formData.email.trim(),
        password: formData.password,
        name: formData.name.trim(),
        fatherName: formData.fatherName.trim(),
        program: formData.program,
        department: formData.department,
        batch: formData.batch,
        semester: formData.semester,
      });

      setAllocatedKmuNo(allocatedNumber);
      setIsRegistered(true);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('This email address is already registered. Please sign in or use another email.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('Please provide a valid institutional email address format.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('Password must be at least 6 characters long.');
      } else {
        setErrorMessage(error.message || 'Registration failed. Please verify your details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2.5rem 1rem',
      }}
    >
      <div style={{ maxWidth: '680px', width: '100%' }}>
        {/* Header Logo & Institution Name */}
        <div style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Logo variant="dark" size="lg" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '1.25rem', color: 'var(--color-slate-900)' }}>
            Student Registration Portal
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            KMU Affiliated Academic Examination &amp; Evaluation System
          </p>
        </div>

        {/* Success View: Displayed after registration instead of auto-login */}
        {isRegistered ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-slate-200)',
              boxShadow: 'var(--shadow-lg)',
              padding: '2.5rem 2rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                border: '2px solid #a7f3d0',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
              Registration Completed Successfully
            </h3>

            <p style={{ fontSize: '0.95rem', color: 'var(--color-slate-600)', marginTop: '0.5rem', lineHeight: 1.6 }}>
              Your student profile has been created for <strong>ROYAL COLLEGE OF NURSING SWAT</strong>.
              <br />
              Please sign in to your student portal using your <strong>KMU Registration Number</strong> and password.
            </p>

            {/* Credential Summary Box */}
            <div
              style={{
                margin: '1.75rem 0',
                padding: '1.25rem',
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-200)',
                textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Candidate Name
                </span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
                  {formData.name}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-700)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Student Login ID (KMU Registration Number)
                </span>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-primary-800)' }}>
                  {allocatedKmuNo || 'Generated'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Batch
                </span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
                  {formData.batch}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Semester
                </span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
                  {formData.semester}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Formal / Profile Email
                </span>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-slate-700)' }}>
                  {formData.email} <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>(Recorded for profile information only)</span>
                </div>
              </div>
            </div>

            {/* Navigation Button to Login */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate('/login')}
                style={{
                  backgroundColor: '#0f2744',
                  borderColor: '#0f2744',
                }}
              >
                Go to Login Page
              </Button>
            </div>
          </div>
        ) : (
          /* Form Container Card */
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-slate-200)',
              boxShadow: 'var(--shadow-md)',
              padding: '2rem',
            }}
          >
            {errorMessage && (
              <div style={{ marginBottom: '1.5rem' }}>
                <Alert type="danger" onDismiss={() => setErrorMessage(null)}>
                  {errorMessage}
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Section 1: Personal Information */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-800)', borderBottom: '1px solid var(--color-slate-100)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  1. Personal Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  <Input
                    label="Full Name (As per Matric/FSc)"
                    placeholder="e.g. Muhammad Farhan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    requiredIndicator
                  />

                  <Input
                    label="Father's Name"
                    placeholder="e.g. Akhtar Ali"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    required
                    requiredIndicator
                  />
                </div>
              </div>

              {/* Section 2: Academic & KMU Enrollment */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-800)', borderBottom: '1px solid var(--color-slate-100)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  2. Academic Enrollment
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  {/* Auto-Assigned Institutional KMU Registration Number */}
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      backgroundColor: 'var(--color-primary-50)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-primary-200)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-primary-900)', textTransform: 'uppercase' }}>
                        KMU Registration Number
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: '#0f2744',
                          color: '#ffffff',
                        }}
                      >
                        Auto-Allocated
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-primary-950)', letterSpacing: '0.04em' }}>
                      {new Date().getFullYear()}/KMU/RCNS/XX
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-primary-700)' }}>
                      Assigned automatically upon registration (e.g. {new Date().getFullYear()}/KMU/RCNS/01).
                    </span>
                  </div>

                  <Select
                    label="Academic Program / Department"
                    options={MOCK_PROGRAMS.map((p) => ({ value: p.name, label: p.name }))}
                    value={formData.program}
                    onChange={(e) => handleProgramChange(e.target.value)}
                    required
                    requiredIndicator
                  />

                  {/* Batch Selection - MUST come before Semester */}
                  <Select
                    label="Batch"
                    options={[
                      { value: '', label: '-- Select Batch --' },
                      ...MOCK_BATCHES.map((b) => ({ value: b, label: b })),
                    ]}
                    value={formData.batch}
                    onChange={(e) => handleBatchChange(e.target.value)}
                    required
                    requiredIndicator
                    helperText="Select your enrolled batch first"
                  />

                  {/* Semester Selection - Depends on Batch */}
                  <Select
                    label="Current Semester"
                    options={[
                      {
                        value: '',
                        label: formData.batch ? '-- Select Semester --' : '-- Please select Batch first --',
                      },
                      ...MOCK_SEMESTERS.map((s) => ({ value: s, label: s })),
                    ]}
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    disabled={!formData.batch}
                    required
                    requiredIndicator
                    helperText={formData.batch ? 'Choose current academic semester' : 'Select Batch above to enable semester'}
                  />

                  <div style={{ gridColumn: 'span 2' }}>
                    <Input
                      label="Assigned Department"
                      value={formData.department}
                      disabled
                      helperText="Auto-assigned based on selected academic program"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Account Credentials & Formal Email */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-800)', borderBottom: '1px solid var(--color-slate-100)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  3. Contact Information &amp; Password
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Input
                    label="Formal / Profile Email Address"
                    type="email"
                    placeholder="e.g. farhan.student@royalcollege.edu.pk"
                    helperText="Collected for academic profile records only (Not used for student login)"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    requiredIndicator
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                    <Input
                      label="Create Password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      requiredIndicator
                    />

                    <Input
                      label="Confirm Password"
                      type="password"
                      placeholder="Repeat password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      requiredIndicator
                    />
                  </div>
                </div>
              </div>

              {/* Terms Agreement */}
              <div style={{ marginTop: '0.5rem' }}>
                <Checkbox
                  label="I confirm that the provided KMU Registration Number and academic credentials are true and accurate."
                  description="Any false representation may lead to cancellation of exam enrollment under Royal College of Nursing Swat conduct regulations."
                  checked={formData.agreedToTerms}
                  onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                style={{
                  backgroundColor: '#0f2744',
                  borderColor: '#0f2744',
                  marginTop: '0.75rem',
                }}
              >
                Complete Student Registration
              </Button>
            </form>

            {/* Back to Login Link */}
            <div
              style={{
                marginTop: '1.5rem',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: 'var(--color-slate-600)',
              }}
            >
              Already registered?{' '}
              <Link to="/login" style={{ color: 'var(--color-primary-700)', fontWeight: 700 }}>
                Sign In to Your Account
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterStudentPage;

