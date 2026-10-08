import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  ...props
}) => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontFamily: 'inherit',
    fontWeight: 600,
    borderRadius: 'var(--radius-md)',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.65 : 1,
    transition: 'all var(--transition-fast)',
    border: '1px solid transparent',
    textDecoration: 'none',
    width: fullWidth ? '100%' : 'auto',
    position: 'relative',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: '0.375rem 0.75rem',
      fontSize: '0.8125rem',
      height: '32px',
    },
    md: {
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
      height: '40px',
    },
    lg: {
      padding: '0.675rem 1.5rem',
      fontSize: '1rem',
      height: '48px',
    },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: '#0f2744',
      color: '#ffffff',
      borderColor: '#0f2744',
      boxShadow: 'var(--shadow-xs)',
    },
    secondary: {
      backgroundColor: '#f1f5f9',
      color: '#1e293b',
      borderColor: '#e2e8f0',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#0f2744',
      borderColor: '#cbd5e1',
    },
    danger: {
      backgroundColor: '#ef4444',
      color: '#ffffff',
      borderColor: '#dc2626',
    },
    warning: {
      backgroundColor: '#f59e0b',
      color: '#ffffff',
      borderColor: '#d97706',
    },
    success: {
      backgroundColor: '#10b981',
      color: '#ffffff',
      borderColor: '#059669',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#475569',
      borderColor: 'transparent',
    },
  };

  const computedStyle: React.CSSProperties = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={computedStyle}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin"
          style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            style={{ opacity: 0.25 }}
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            style={{ opacity: 0.75 }}
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!isLoading && leftIcon && <span style={{ display: 'inline-flex' }}>{leftIcon}</span>}
      <span>{children}</span>
      {!isLoading && rightIcon && <span style={{ display: 'inline-flex' }}>{rightIcon}</span>}
    </button>
  );
};

export default Button;
