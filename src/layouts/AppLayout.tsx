import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo, Avatar, Dropdown } from '../components/ui';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
}

export interface AppLayoutProps {
  portalTitle: string;
  navItems: NavItem[];
  role: 'student' | 'teacher' | 'admin';
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  portalTitle,
  navItems,
  role,
}) => {
  const { userProfile, studentProfile, teacherProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    navigate('/login');
  };

  // User display name & info
  const displayName =
    userProfile?.name ||
    (role === 'student' ? 'Muhammad Farhan' : role === 'teacher' ? 'Dr. Tariq Shah' : 'Admin User');
  
  const displaySubtitle =
    role === 'student'
      ? studentProfile?.kmuRegistrationNo || '2026/KMU-RCNS/001'
      : role === 'teacher'
      ? teacherProfile?.department || 'Faculty Member'
      : 'System Administrator';

  const roleBadgeColor =
    role === 'admin'
      ? { bg: '#fef2f2', text: '#dc2626', label: 'Admin Portal' }
      : role === 'teacher'
      ? { bg: '#ecfdf5', text: '#059669', label: 'Faculty Portal' }
      : { bg: '#eff6ff', text: '#2563eb', label: 'Student Portal' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-app)', fontFamily: 'var(--font-sans)' }}>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 998,
          }}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        style={{
          width: sidebarCollapsed ? '78px' : '260px',
          backgroundColor: '#0f2744',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width var(--transition-base), transform var(--transition-base)',
          flexShrink: 0,
          zIndex: 999,
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
        className={mobileMenuOpen ? 'mobile-sidebar-open' : 'mobile-sidebar-closed'}
      >
        {/* Sidebar Header / Logo */}
        <div
          style={{
            padding: sidebarCollapsed ? '1.25rem 0.75rem' : '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          }}
        >
          <Logo variant="light" subtitle={!sidebarCollapsed} size={sidebarCollapsed ? 'sm' : 'md'} />
        </div>

        {/* Portal Identifier Pill */}
        {!sidebarCollapsed && (
          <div style={{ padding: '0.75rem 1.5rem 0.25rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#94a3b8',
              }}
            >
              {portalTitle}
            </span>
          </div>
        )}

        {/* Navigation Items */}
        <nav
          style={{
            flex: 1,
            padding: sidebarCollapsed ? '0.75rem 0.5rem' : '0.75rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            overflowY: 'auto',
          }}
        >
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== `/${role}` && item.path !== `/${role}/dashboard` && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                title={sidebarCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: sidebarCollapsed ? '0.75rem' : '0.65rem 0.85rem',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  color: isActive ? '#ffffff' : '#cbd5e1',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#cbd5e1';
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isActive ? 1 : 0.8 }}>
                  {item.icon}
                </span>
                {!sidebarCollapsed && (
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                )}
                {!sidebarCollapsed && item.badge !== undefined && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile & Collapse Toggle */}
        <div
          style={{
            padding: sidebarCollapsed ? '0.75rem 0.5rem' : '1rem 1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          }}
        >
          {!sidebarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
              <Avatar name={displayName} size="sm" roleBadge={role} />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displaySubtitle}
                </span>
              </div>
            </div>
          ) : (
            <Avatar name={displayName} size="sm" roleBadge={role} />
          )}

          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-collapse-btn"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {sidebarCollapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Navbar */}
        <header
          style={{
            height: '64px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid var(--color-slate-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          {/* Mobile Hamburger & Academic Institution Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-menu-trigger"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-slate-700)',
                display: 'none',
              }}
              aria-label="Toggle mobile navigation"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: roleBadgeColor.bg,
                  color: roleBadgeColor.text,
                }}
              >
                {roleBadgeColor.label}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-slate-400)', display: 'none' }} className="institution-nav-label">
                | ROYAL COLLEGE OF NURSING SWAT
              </span>
            </div>
          </div>

          {/* Right Top Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Session Indicator */}
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-slate-600)',
                backgroundColor: 'var(--color-slate-100)',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
              }}
              className="academic-session-pill"
            >
              Academic Session 2025–2026
            </div>

            {/* Notification Bell Mockup */}
            <div
              style={{
                position: 'relative',
                color: 'var(--color-slate-600)',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#ef4444',
                  borderRadius: '50%',
                }}
              />
            </div>

            {/* User Profile Dropdown */}
            <Dropdown
              trigger={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.35rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-slate-100)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Avatar name={displayName} size="xs" roleBadge={role} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                    {displayName.split(' ')[0]}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              }
              items={[
                {
                  id: 'profile',
                  label: 'My Academic Profile',
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ),
                  onClick: () => navigate(`/${role}/profile`),
                },
                ...(role === 'admin'
                  ? [
                      {
                        id: 'settings',
                        label: 'System Settings',
                        icon: (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                        ),
                        onClick: () => navigate('/admin/settings'),
                      },
                    ]
                  : []),
                {
                  id: 'logout',
                  label: 'Sign Out',
                  danger: true,
                  divider: true,
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  ),
                  onClick: handleLogout,
                },
              ]}
            />
          </div>
        </header>

        {/* Page Content Outlet */}
        <main style={{ flex: 1, padding: '1.75rem 2rem', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <Outlet />
        </main>

        {/* Global Academic Footer */}
        <footer
          style={{
            padding: '1.25rem 2rem',
            borderTop: '1px solid var(--color-slate-200)',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8125rem',
            color: 'var(--color-slate-500)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <strong>ROYAL COLLEGE OF NURSING SWAT</strong> — Examination &amp; Result Management System
          </div>
          <div>
            Affiliated with Khyber Medical University (KMU) &copy; {new Date().getFullYear()}
          </div>
        </footer>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .mobile-sidebar-closed {
            position: fixed !important;
            transform: translateX(-100%) !important;
          }
          .mobile-sidebar-open {
            position: fixed !important;
            transform: translateX(0) !important;
          }
          .mobile-menu-trigger {
            display: flex !important;
          }
          .sidebar-collapse-btn {
            display: none !important;
          }
          .institution-nav-label {
            display: none !important;
          }
          .academic-session-pill {
            display: none !important;
          }
        }
        @media (min-width: 901px) {
          .mobile-sidebar-closed, .mobile-sidebar-open {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AppLayout;
