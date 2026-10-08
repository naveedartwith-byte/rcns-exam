import React from 'react';

interface LogoProps {
  variant?: 'light' | 'dark' | 'collapsed';
  subtitle?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'dark',
  subtitle = true,
  size = 'md',
  className = '',
}) => {
  const isLight = variant === 'light';
  const isCollapsed = variant === 'collapsed';

  const logoSizes = {
    sm: 36,
    md: 46,
    lg: 58,
  };

  const titleSizes = {
    sm: '0.85rem',
    md: '1.05rem',
    lg: '1.25rem',
  };

  const logoDimension = logoSizes[size];

  return (
    <div
      className={`rcns-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '0.6rem' : '0.85rem',
        userSelect: 'none',
        textDecoration: 'none',
      }}
    >
      {/* Official College Logo Image */}
      <img
        src="/rcns-logo.png"
        alt="Royal College of Nursing Swat Official Logo"
        width={logoDimension}
        height={logoDimension}
        style={{
          width: `${logoDimension}px`,
          height: `${logoDimension}px`,
          objectFit: 'contain',
          borderRadius: '50%',
          flexShrink: 0,
          boxShadow: isLight
            ? '0 2px 8px rgba(0, 0, 0, 0.25)'
            : '0 2px 6px rgba(15, 39, 68, 0.12)',
        }}
        loading="eager"
      />

      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: titleSizes[size],
              fontWeight: 800,
              color: isLight ? '#ffffff' : '#0f2744',
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
            }}
          >
            ROYAL COLLEGE OF NURSING SWAT
          </span>
          {subtitle && (
            <span
              style={{
                fontSize: size === 'lg' ? '0.75rem' : '0.68rem',
                fontWeight: 600,
                color: isLight ? '#94a3b8' : '#0d9488',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginTop: '2px',
              }}
            >
              Affiliated with KMU Peshawar
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;

