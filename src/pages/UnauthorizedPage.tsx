import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getDefaultDashboardRoute } from '../utils/permissions';
import { Logo, Button } from '../components/ui';

export const UnauthorizedPage: React.FC = () => {
  const { role, logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const returnRoute = currentUser ? getDefaultDashboardRoute(role) : '/login';

  const handleSwitchAccount = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Logout error during switch account:', err);
    }
    navigate('/login', { replace: true });
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
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '520px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <Logo variant="dark" size="lg" />
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-slate-200)',
            boxShadow: 'var(--shadow-lg)',
            padding: '3rem 2rem',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-danger-bg)',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
            403 - Restricted Access
          </h2>

          <p style={{ fontSize: '0.95rem', color: 'var(--color-slate-600)', marginTop: '0.5rem', lineHeight: 1.6 }}>
            You do not have the required authorization or academic role to view this section of the ROYAL COLLEGE OF NURSING SWAT Examination System.
          </p>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to={returnRoute} style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md" style={{ backgroundColor: '#0f2744' }}>
                Return to Your Dashboard
              </Button>
            </Link>
            <Button variant="outline" size="md" onClick={handleSwitchAccount}>
              Switch Account
            </Button>
          </div>
        </div>

        <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--color-slate-400)' }}>
          ROYAL COLLEGE OF NURSING SWAT • Secure Institutional Gateway
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
