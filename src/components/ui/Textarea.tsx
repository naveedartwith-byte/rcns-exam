import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  requiredIndicator?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, requiredIndicator = false, style, id, ...props }, ref) => {
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%' }}>
        {label && (
          <label
            htmlFor={textareaId}
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--color-slate-700)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {label}
            {(requiredIndicator || props.required) && (
              <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>*</span>
            )}
          </label>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          style={{
            width: '100%',
            padding: '0.625rem 0.875rem',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            color: 'var(--color-slate-900)',
            backgroundColor: '#ffffff',
            border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-slate-300)'}`,
            borderRadius: 'var(--radius-md)',
            outline: 'none',
            minHeight: '80px',
            resize: 'vertical',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
            boxShadow: error ? '0 0 0 1px var(--color-danger)' : 'var(--shadow-xs)',
            ...style,
          }}
          {...props}
        />

        {error && (
          <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', fontWeight: 500 }}>
            {error}
          </span>
        )}

        {!error && helperText && (
          <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
export default Textarea;
