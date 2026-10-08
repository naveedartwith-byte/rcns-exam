import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string | React.ReactNode;
  description?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, id, style, ...props }, ref) => {
    const inputId = id || `checkbox-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label
          htmlFor={inputId}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            userSelect: 'none',
            opacity: props.disabled ? 0.6 : 1,
            ...style,
          }}
        >
          <input
            id={inputId}
            ref={ref}
            type="checkbox"
            style={{
              width: '18px',
              height: '18px',
              marginTop: '2px',
              accentColor: 'var(--color-primary-800)',
              cursor: 'pointer',
            }}
            {...props}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-slate-800)' }}>
              {label}
            </span>
            {description && (
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', marginTop: '1px' }}>
                {description}
              </span>
            )}
          </div>
        </label>
        {error && (
          <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginLeft: '1.75rem' }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
export default Checkbox;
