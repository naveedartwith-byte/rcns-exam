import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Logo, Input, Button, Alert, Checkbox } from '../../components/ui';

export const LoginPage: React.FC = () => {
  const { login, loginWithKmu } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activePortalTab, setActivePortalTab] = useState<'student' | 'staff'>('student');
  const [kmuRegNo, setKmuRegNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Determine redirect path
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (activePortalTab === 'student') {
      if (!kmuRegNo.trim() || !password) {
        setErrorMessage('Please enter both KMU Registration Number and password.');
        return;
      }
    } else {
      if (!email.trim() || !password) {
        setErrorMessage('Please enter both institutional email and password.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (activePortalTab === 'student') {
        await loginWithKmu(kmuRegNo.trim(), password);
        navigate(from || '/student', { replace: true });
      } else {
        const userRole = await login(email.trim(), password);
        const defaultRoute = userRole === 'teacher' ? '/teacher' : '/admin/dashboard';
        navigate(from || defaultRoute, { replace: true });
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-email'
      ) {
        setErrorMessage(
          activePortalTab === 'student'
            ? 'Invalid KMU Registration Number or password. Please verify your credentials.'
            : 'Invalid institutional credentials. Please verify your email and password.'
        );
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMessage('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMessage('Network error. Please check your internet connection.');
      } else {
        setErrorMessage(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (demoRole: 'student' | 'teacher' | 'admin') => {
    if (demoRole === 'student') {
      setActivePortalTab('student');
      setKmuRegNo('2026/KMU-RCNS/001');
      setPassword('Password123!');
    } else if (demoRole === 'teacher') {
      setActivePortalTab('staff');
      setEmail('dr.tariq@royalcollege.edu.pk');
      setPassword('Password123!');
    } else {
      setActivePortalTab('staff');
      setEmail('admin@royalcollege.edu.pk');
      setPassword('Admin@Royal2026!');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: '#0f2744',
      }}
    >
      {/* Left Showcase Banner (Desktop/Tablet) */}
      <div
        className="auth-showcase-panel"
        style={{
          flex: '1 1 50%',
          background: 'linear-gradient(145deg, #0f2744 0%, #0e498b 60%, #0d9488 100%)',
          padding: '3.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Academic watermark circles */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            right: '-80px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-120px',
            left: '-60px',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(13,148,136,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Top Branding */}
        <div>
          <Logo variant="light" size="lg" />
          <div
            style={{
              marginTop: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(4px)',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            Affiliated with Khyber Medical University (KMU) Peshawar
          </div>
        </div>

        {/* Middle Showcase Content */}
        <div style={{ margin: '2.5rem 0' }}>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              lineHeight: 1.2,
              color: '#ffffff',
              marginBottom: '1rem',
            }}
          >
            Examination, Quiz &amp; Result Management System
          </h1>
          <p
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.6,
              color: '#e2e8f0',
              maxWidth: '520px',
            }}
          >
            Official institutional testing portal for <strong>ROYAL COLLEGE OF NURSING SWAT</strong>. Secure digital assessment for Nursing, DPT, MLT, and Allied Health Sciences.
          </p>

          {/* Academic Highlights */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
              marginTop: '2rem',
              maxWidth: '480px',
            }}
          >
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fde68a' }}>KMU Verified</div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.2rem' }}>Registration Number based login</div>
            </div>
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#99f6e4' }}>Real-time Results</div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.2rem' }}>Automated grade transcripts</div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          &copy; {new Date().getFullYear()} ROYAL COLLEGE OF NURSING SWAT. All rights reserved.
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div
        style={{
          flex: '1 1 50%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2.5rem 2rem',
          backgroundColor: '#ffffff',
        }}
      >
        <div style={{ maxWidth: '440px', width: '100%' }}>
          {/* Header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
              Sign In to Your Account
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.35rem' }}>
              Access your institutional examination and academic records portal.
            </p>
          </div>

          {/* Portal Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--color-slate-100)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.75rem',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActivePortalTab('student');
                setErrorMessage(null);
              }}
              style={{
                flex: 1,
                padding: '0.6rem 0.5rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: activePortalTab === 'student' ? '#ffffff' : 'transparent',
                color: activePortalTab === 'student' ? '#0f2744' : 'var(--color-slate-600)',
                boxShadow: activePortalTab === 'student' ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              Student Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePortalTab('staff');
                setErrorMessage(null);
              }}
              style={{
                flex: 1,
                padding: '0.6rem 0.5rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: activePortalTab === 'staff' ? '#ffffff' : 'transparent',
                color: activePortalTab === 'staff' ? '#0f2744' : 'var(--color-slate-600)',
                boxShadow: activePortalTab === 'staff' ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              Faculty / Admin
            </button>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div style={{ marginBottom: '1.5rem' }}>
              <Alert type="danger" onDismiss={() => setErrorMessage(null)}>
                {errorMessage}
              </Alert>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {activePortalTab === 'student' ? (
              /* STUDENT LOGIN: KMU Registration Number + Password */
              <Input
                label="KMU Registration Number"
                placeholder="2026/KMU-RCNS/001"
                helperText="Enter your official KMU Registration Number (Not email)"
                value={kmuRegNo}
                onChange={(e) => setKmuRegNo(e.target.value)}
                required
                requiredIndicator
                leftIcon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
              />
            ) : (
              /* FACULTY / ADMIN LOGIN: Institutional Email + Password */
              <Input
                label="Institutional Email Address"
                type="email"
                placeholder="e.g. faculty@rcns.edu.pk"
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
            )}

            <Input
              label="Password"
              type="password"
              placeholder="Enter your secret password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              requiredIndicator
              leftIcon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
            />

            {/* Remember Me & Forgot Password */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <Checkbox
                label="Remember me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <Link
                to="/forgot-password"
                style={{
                  color: 'var(--color-primary-600)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              style={{
                backgroundColor: '#0f2744',
                borderColor: '#0f2744',
                marginTop: '0.5rem',
              }}
            >
              {activePortalTab === 'student' ? 'Sign In to Student Portal' : 'Sign In to Institutional Portal'}
            </Button>
          </form>

          {/* Registration Prompt */}
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--color-slate-200)',
              textAlign: 'center',
              fontSize: '0.875rem',
              color: 'var(--color-slate-600)',
            }}
          >
            New Student at ROYAL COLLEGE OF NURSING SWAT?{' '}
            <Link
              to="/register"
              style={{
                color: 'var(--color-primary-700)',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Register Here
            </Link>
          </div>

          {/* Demo Account Quick Switcher Helper */}
          <div
            style={{
              marginTop: '2rem',
              padding: '1rem',
              backgroundColor: 'var(--color-slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-slate-300)',
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Demo Quick-Fill Credentials:
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleQuickFill('student')}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-primary-200)',
                  backgroundColor: 'var(--color-primary-50)',
                  color: 'var(--color-primary-800)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Student Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('teacher')}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #99f6e4',
                  backgroundColor: '#ccfbf1',
                  color: '#0f766e',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Faculty Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #fecaca',
                  backgroundColor: '#fef2f2',
                  color: '#991b1b',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Admin Demo
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .auth-showcase-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;

