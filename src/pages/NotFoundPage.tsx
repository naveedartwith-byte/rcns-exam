import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getDefaultDashboardRoute } from '../utils/permissions';
import { Logo, Button } from '../components/ui';

export const NotFoundPage: React.FC = () => {
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
              fontSize: '5rem',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              color: '#0f2744',
              lineHeight: 1,
              marginBottom: '1rem',
            }}
          >
            404
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
            Academic Page Not Found
          </h2>

          <p style={{ fontSize: '0.95rem', color: 'var(--color-slate-500)', marginTop: '0.5rem', lineHeight: 1.6 }}>
            The requested examination resource, portal route, or result file does not exist or has been relocated.
          </p>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to={returnRoute} style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md" style={{ backgroundColor: '#0f2744' }}>
                Return to Dashboard
              </Button>
            </Link>
            {currentUser ? (
              <Button variant="outline" size="md" onClick={handleSwitchAccount}>
                Switch Account
              </Button>
            ) : (
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button variant="outline" size="md">
                  Sign In to Portal
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--color-slate-400)' }}>
          ROYAL COLLEGE OF NURSING SWAT • KMU Affiliated Examination System
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
