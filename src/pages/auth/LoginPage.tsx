import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Logo, Input, Button, Alert, Checkbox, KmuRegistrationInput } from '../../components/ui';
import { isValidKmuRegistration } from '../../utils/kmuRegistration';
import { getDefaultDashboardRoute } from '../../utils/permissions';

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
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // Parse security alerts from tab switching or session timeout
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('security_violation') === 'tab_switched') {
      setSecurityNotice(
        '🔒 Examination Security Alert: You switched browser tabs or minimized the examination window during an active assessment. Under KMU institutional rules, your exam session was locked and you were signed out for academic integrity.'
      );
    } else if (params.get('reason') === 'session_closed') {
      setSecurityNotice('Your previous examination session has ended. Please log in to continue.');
    }
  }, [location.search]);

  // Determine redirect path safely without 403 loops
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (activePortalTab === 'student') {
      if (!kmuRegNo.trim() || !isValidKmuRegistration(kmuRegNo)) {
        setErrorMessage('Please enter your complete KMU Registration Number (Year & Roll Number).');
        return;
      }
      if (!password) {
        setErrorMessage('Please enter your student password.');
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
        const studentRole = await loginWithKmu(kmuRegNo.trim(), password);
        const resolvedRole = studentRole || 'student';
        const defaultRoute = getDefaultDashboardRoute(resolvedRole);
        const targetRoute = (from && !from.includes('unauthorized') && !from.includes('login') && from.startsWith('/student'))
          ? from
          : defaultRoute;
        navigate(targetRoute, { replace: true });
      } else {
        const userRole = await login(email.trim(), password);
        const defaultRoute = getDefaultDashboardRoute(userRole);
        const targetRoute = (from && !from.includes('unauthorized') && !from.includes('login') && (
          (userRole === 'teacher' && from.startsWith('/teacher')) ||
          (userRole === 'admin' && from.startsWith('/admin'))
        )) ? from : defaultRoute;
        navigate(targetRoute, { replace: true });
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

  return (
    <div
      className="auth-page-root"
      style={{
        height: '100vh',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 10% 15%, rgba(13, 148, 136, 0.25) 0%, transparent 45%), radial-gradient(circle at 90% 85%, rgba(14, 73, 139, 0.35) 0%, transparent 45%), linear-gradient(135deg, #091a2f 0%, #0e498b 55%, #0d9488 100%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '1.5rem',
        boxSizing: 'border-box',
      }}
    >
      {/* Academic background ambient circles */}
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          left: '-80px',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-100px',
          right: '-80px',
          width: '460px',
          height: '460px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Unified Layout Container */}
      <div
        className="auth-layout-container"
        style={{
          width: '100%',
          maxWidth: '1060px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2.5rem',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Left Showcase Banner */}
        <div
          className="auth-showcase-panel"
          style={{
            flex: '1 1 500px',
            maxWidth: '520px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            color: '#ffffff',
          }}
        >
          {/* Top Branding & Affiliation */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Logo variant="light" size="lg" subtitle={false} />
            <div
              style={{
                marginTop: '1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(6px)',
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              Affiliated with Khyber Medical University (KMU) Peshawar
            </div>
          </div>

          {/* Title Aligned in One Line & Second Line Centered With Reference to It */}
          <div style={{ margin: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                lineHeight: 1.25,
                color: '#ffffff',
                margin: '0 0 0.75rem 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>Examination, Quiz &amp; Result</span>
              <span style={{ color: '#99f6e4', marginTop: '0.2rem', textAlign: 'center' }}>
                Management System
              </span>
            </h1>
            <p
              style={{
                fontSize: '0.95rem',
                lineHeight: 1.5,
                color: '#e2e8f0',
                maxWidth: '460px',
                margin: 0,
                textAlign: 'center',
              }}
            >
              Official institutional testing portal for <strong>ROYAL COLLEGE OF NURSING SWAT</strong>.
            </p>

            {/* Academic Highlights */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.85rem',
                marginTop: '1.5rem',
                maxWidth: '440px',
                width: '100%',
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fde68a' }}>KMU Verified</div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                  Registration Number based login
                </div>
              </div>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#99f6e4' }}>Real-time Results</div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                  Automated grade transcripts
                </div>
              </div>
            </div>
          </div>

          {/* Footer info */}
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            &copy; {new Date().getFullYear()} ROYAL COLLEGE OF NURSING SWAT. All rights reserved.
          </div>
        </div>

        {/* Right Floating Login Box Card */}
        <div
          className="auth-card-panel"
          style={{
            flex: '0 0 490px',
            maxWidth: '490px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '1.25rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.15)',
            padding: '2.25rem 2.25rem',
            boxSizing: 'border-box',
          }}
        >
          {/* Mobile-Only Header Branding (iOS & Android) */}
          <div className="auth-mobile-header" style={{ display: 'none', marginBottom: '1.25rem', textAlign: 'center' }}>
            <Logo variant="dark" size="sm" subtitle={false} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', marginTop: '0.35rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Examination, Quiz &amp; Result System
            </div>
          </div>

          {/* Header */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
              Sign In to Your Account
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
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
              marginBottom: '1.25rem',
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
                padding: '0.55rem 0.5rem',
                fontSize: '0.85rem',
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
                padding: '0.55rem 0.5rem',
                fontSize: '0.85rem',
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

          {/* Security Alert from Tab Switching or Inactivity */}
          {securityNotice && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert type="warning" onDismiss={() => setSecurityNotice(null)}>
                {securityNotice}
              </Alert>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert type="danger" onDismiss={() => setErrorMessage(null)}>
                {errorMessage}
              </Alert>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activePortalTab === 'student' ? (
              /* STUDENT LOGIN: KMU Registration Number + Password */
              <KmuRegistrationInput
                label="KMU Registration Number"
                value={kmuRegNo}
                onChange={(val) => setKmuRegNo(val)}
                helperText="Permanent KMU identifier (e.g. 2026/KMU/RCNS/001)"
                required
                requiredIndicator
              />
            ) : (
              /* FACULTY / ADMIN LOGIN: Institutional Email + Password */
              <Input
                label="Institutional Email Address"
                type="email"
                placeholder="faculty@rcns.edu.pk"
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.825rem' }}>
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
                  fontSize: '0.825rem',
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
                marginTop: '0.25rem',
                fontWeight: 700,
              }}
            >
              {activePortalTab === 'student' ? 'Sign In to Student Portal' : 'Sign In to Institutional Portal'}
            </Button>
          </form>

          {/* Registration Prompt */}
          <div
            className="auth-register-prompt"
            style={{
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--color-slate-200)',
              textAlign: 'center',
              fontSize: '0.825rem',
              color: 'var(--color-slate-600)',
              whiteSpace: 'nowrap',
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
        </div>
      </div>

      <style>{`
        /* Responsive adaptations for Tablets, iOS, and Android */
        @media (max-width: 900px) {
          .auth-page-root {
            height: auto !important;
            min-height: 100vh !important;
            min-height: 100dvh !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            padding-top: max(1.25rem, env(safe-area-inset-top)) !important;
            padding-bottom: max(1.25rem, env(safe-area-inset-bottom)) !important;
            padding-left: max(1rem, env(safe-area-inset-left)) !important;
            padding-right: max(1rem, env(safe-area-inset-right)) !important;
          }
          .auth-layout-container {
            justify-content: center !important;
            gap: 0 !important;
          }
          .auth-showcase-panel {
            display: none !important;
          }
          .auth-card-panel {
            flex: 1 1 auto !important;
            max-width: 440px !important;
            padding: 2rem 1.75rem !important;
          }
          .auth-mobile-header {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
        }

        /* Mobile Phones (iOS Safari / Android Chrome) */
        @media (max-width: 768px) {
          .auth-card-panel input {
            font-size: 16px !important; /* Prevents auto-zoom on iOS Safari input focus */
            min-height: 44px; /* Apple HIG / Material touch target minimum */
          }
          .auth-card-panel button[type="submit"] {
            min-height: 46px;
          }
        }

        /* Narrow Mobile Screens (iPhone SE, smaller Android devices) */
        @media (max-width: 480px) {
          .auth-card-panel {
            padding: 1.5rem 1.15rem !important;
            border-radius: 1rem !important;
          }
          .auth-register-prompt {
            white-space: normal !important;
            line-height: 1.5 !important;
          }
        }

        /* Handle short desktop screens or open on-screen virtual keyboards */
        @media (max-height: 640px) {
          .auth-page-root {
            height: auto !important;
            min-height: 100vh !important;
            min-height: 100dvh !important;
            overflow-y: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;

