import React from 'react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  style?: React.CSSProperties;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  onClear,
  style,
}) => {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        maxWidth: '360px',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '0.75rem',
          color: 'var(--color-slate-400)',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          paddingTop: '0.45rem',
          paddingBottom: '0.45rem',
          paddingLeft: '2.25rem',
          paddingRight: value ? '2rem' : '0.75rem',
          fontSize: '0.85rem',
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-slate-300)',
          borderRadius: 'var(--radius-md)',
          outline: 'none',
          color: 'var(--color-slate-900)',
          transition: 'border-color var(--transition-fast)',
        }}
      />

      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            if (onClear) onClear();
          }}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: '0.5rem',
            background: 'none',
            border: 'none',
            color: 'var(--color-slate-400)',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchBar;
