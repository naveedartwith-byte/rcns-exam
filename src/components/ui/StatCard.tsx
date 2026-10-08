import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'primary' | 'teal' | 'gold' | 'rose' | 'slate';
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'primary',
  onClick,
  style,
}) => {
  const colorMap = {
    primary: {
      bgIcon: 'var(--color-primary-50)',
      textIcon: 'var(--color-primary-800)',
      borderColor: 'var(--color-primary-100)',
    },
    teal: {
      bgIcon: '#ccfbf1',
      textIcon: '#0d9488',
      borderColor: '#99f6e4',
    },
    gold: {
      bgIcon: '#fef3c7',
      textIcon: '#d97706',
      borderColor: '#fde68a',
    },
    rose: {
      bgIcon: '#ffe4e6',
      textIcon: '#e11d48',
      borderColor: '#fecdd3',
    },
    slate: {
      bgIcon: 'var(--color-slate-100)',
      textIcon: 'var(--color-slate-700)',
      borderColor: 'var(--color-slate-200)',
    },
  };

  const current = colorMap[variant];

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-slate-200)',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-xs)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--transition-fast)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {title}
          </span>
          <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--color-slate-900)', fontFamily: 'var(--font-heading)', marginTop: '0.25rem', lineHeight: 1.1 }}>
            {value}
          </div>
        </div>

        {icon && (
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: current.bgIcon,
              color: current.textIcon,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem', fontSize: '0.8rem' }}>
          {trend && (
            <span
              style={{
                fontWeight: 700,
                color: trend.isPositive ? '#059669' : '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.15rem',
              }}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {subtitle && (
            <span style={{ color: 'var(--color-slate-500)' }}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
