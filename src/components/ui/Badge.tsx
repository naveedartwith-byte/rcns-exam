import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  style,
  ...props
}) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-primary-50)',
      color: 'var(--color-primary-800)',
      border: '1px solid var(--color-primary-200)',
    },
    success: {
      backgroundColor: 'var(--color-success-bg)',
      color: '#065f46',
      border: '1px solid var(--color-success-border)',
    },
    warning: {
      backgroundColor: 'var(--color-warning-bg)',
      color: '#92400e',
      border: '1px solid var(--color-warning-border)',
    },
    danger: {
      backgroundColor: 'var(--color-danger-bg)',
      color: '#991b1b',
      border: '1px solid var(--color-danger-border)',
    },
    info: {
      backgroundColor: 'var(--color-info-bg)',
      color: '#075985',
      border: '1px solid var(--color-info-border)',
    },
    default: {
      backgroundColor: 'var(--color-slate-100)',
      color: 'var(--color-slate-700)',
      border: '1px solid var(--color-slate-200)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--color-slate-600)',
      border: '1px solid var(--color-slate-300)',
    },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: '0.125rem 0.5rem',
      fontSize: '0.72rem',
    },
    md: {
      padding: '0.25rem 0.65rem',
      fontSize: '0.78rem',
    },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        textTransform: 'capitalize',
        lineHeight: 1.2,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
