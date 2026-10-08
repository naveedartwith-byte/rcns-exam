import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[] | string[];
  placeholder?: string;
  requiredIndicator?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, requiredIndicator = false, style, id, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    const formattedOptions: SelectOption[] = options.map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%' }}>
        {label && (
          <label
            htmlFor={selectId}
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

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <select
            id={selectId}
            ref={ref}
            style={{
              width: '100%',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              paddingLeft: '0.875rem',
              paddingRight: '2.25rem',
              fontSize: '0.9rem',
              color: 'var(--color-slate-900)',
              backgroundColor: '#ffffff',
              border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-slate-300)'}`,
              borderRadius: 'var(--radius-md)',
              outline: 'none',
              appearance: 'none',
              cursor: 'pointer',
              boxShadow: error ? '0 0 0 1px var(--color-danger)' : 'var(--shadow-xs)',
              ...style,
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {formattedOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Custom Dropdown Chevron */}
          <div
            style={{
              position: 'absolute',
              right: '0.75rem',
              color: 'var(--color-slate-400)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

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

Select.displayName = 'Select';
export default Select;
