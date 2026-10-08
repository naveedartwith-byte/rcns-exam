import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Logo, Input, Button, Alert } from '../../components/ui';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      setIsSubmitted(true);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/user-not-found') {
        // For security reasons, can still show sent or friendly message
        setErrorMessage('No account found with this email address.');
      } else {
        setErrorMessage(error.message || 'Failed to send password reset email. Please try again.');
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
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ maxWidth: '440px', width: '100%' }}>
        {/* Header Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Logo variant="dark" size="lg" />
        </div>

        {/* Card Container */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-slate-200)',
            boxShadow: 'var(--shadow-md)',
            padding: '2rem',
          }}
        >
          {isSubmitted ? (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success-bg)',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>

              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                Password Reset Email Sent
              </h2>

              <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)', marginTop: '0.75rem', lineHeight: 1.5 }}>
                We have dispatched password reset instructions to <strong>{email}</strong>. Please check your inbox and spam folder.
              </p>

              <div style={{ marginTop: '1.75rem' }}>
                <Link to="/login" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" fullWidth style={{ backgroundColor: '#0f2744' }}>
                    Return to Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                Reset Your Password
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)', marginTop: '0.35rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Enter the email address registered with your ROYAL COLLEGE OF NURSING SWAT academic profile. We will email you a secure reset link.
              </p>

              {errorMessage && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <Alert type="danger" onDismiss={() => setErrorMessage(null)}>
                    {errorMessage}
                  </Alert>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <Input
                  label="Registered Email Address"
                  type="email"
                  placeholder="e.g. farhan.student@royalcollege.edu.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  requiredIndicator
                  leftIcon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  }
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isLoading}
                  style={{ backgroundColor: '#0f2744', borderColor: '#0f2744' }}
                >
                  Send Reset Link
                </Button>
              </form>

              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
                <Link to="/login" style={{ color: 'var(--color-slate-600)', textDecoration: 'none', fontWeight: 600 }}>
                  ← Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
