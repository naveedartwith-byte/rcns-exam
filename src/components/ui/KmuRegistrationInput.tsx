import React, { useState, useEffect, useRef } from 'react';
import { parseKmuRegistration } from '../../utils/kmuRegistration';

export interface KmuRegistrationInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  requiredIndicator?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const KmuRegistrationInput: React.FC<KmuRegistrationInputProps> = ({
  label = 'KMU Registration Number',
  value,
  onChange,
  error,
  helperText = 'Your permanent student login identifier',
  required = false,
  requiredIndicator = false,
  disabled = false,
  id,
  style,
}) => {
  const [year, setYear] = useState('');
  const [sequence, setSequence] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const yearInputRef = useRef<HTMLInputElement>(null);
  const seqInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when prop value changes externally
  useEffect(() => {
    if (!value) {
      setYear('');
      setSequence('');
      return;
    }

    // Try parsing standard KMU format: YYYY/KMU/RCNS/NNN or YYYY-KMU-RCNS-NNN
    const match = value.trim().match(/^(\d{0,4})[/-]KMU[/-]RCNS[/-](\d*)$/i);
    if (match) {
      setYear(match[1]);
      setSequence(match[2]);
    } else {
      // Fallback parser if incomplete
      const parsed = parseKmuRegistration(value);
      if (parsed) {
        setYear(parsed.year.toString());
        setSequence(parsed.sequenceNumber.toString().padStart(2, '0'));
      }
    }
  }, [value]);

  const updateCombinedValue = (newYear: string, newSeq: string) => {
    const cleanYear = newYear.replace(/\D/g, '').slice(0, 4);
    const cleanSeq = newSeq.replace(/\D/g, '').slice(0, 6);

    if (!cleanYear && !cleanSeq) {
      onChange('');
    } else {
      onChange(`${cleanYear}/KMU/RCNS/${cleanSeq}`);
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYear(val);
    updateCombinedValue(val, sequence);

    // Auto-advance to sequence number when 4-digit year entered
    if (val.length === 4 && seqInputRef.current) {
      seqInputRef.current.focus();
      seqInputRef.current.select();
    }
  };

  const handleSeqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setSequence(val);
    updateCombinedValue(year, val);
  };

  const handleSeqKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If sequence is empty and Backspace pressed, move back to year input
    if (e.key === 'Backspace' && !sequence && yearInputRef.current) {
      yearInputRef.current.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text').trim();
    const match = pastedText.match(/^(\d{4})[/-_]KMU[/-_]RCNS[/-_](\d{1,})$/i);
    if (match) {
      e.preventDefault();
      const pYear = match[1];
      const pSeq = match[2];
      setYear(pYear);
      setSequence(pSeq);
      onChange(`${pYear}/KMU/RCNS/${pSeq}`);
      if (seqInputRef.current) {
        seqInputRef.current.focus();
      }
    }
  };

  const inputId = id || (label ? `kmu-input-${label.toLowerCase().replace(/\s+/g, '-')}` : 'kmu-reg-input');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%', ...style }}>
      {label && (
        <label
          htmlFor={`${inputId}-year`}
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
          {(requiredIndicator || required) && (
            <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>*</span>
          )}
        </label>
      )}

      {/* Structured KMU Input Container with fixed /KMU/RCNS/ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: disabled ? 'var(--color-slate-100)' : '#ffffff',
          border: `1.5px solid ${
            error
              ? 'var(--color-danger)'
              : isFocused
              ? 'var(--color-primary-600)'
              : 'var(--color-slate-300)'
          }`,
          borderRadius: 'var(--radius-md)',
          boxShadow: isFocused
            ? error
              ? '0 0 0 3px rgba(239, 68, 68, 0.15)'
              : '0 0 0 3px rgba(15, 39, 68, 0.12)'
            : 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          overflow: 'hidden',
          minHeight: '42px',
        }}
      >
        {/* Left Icon */}
        <div
          style={{
            paddingLeft: '0.75rem',
            paddingRight: '0.35rem',
            color: isFocused ? 'var(--color-primary-700)' : 'var(--color-slate-400)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        {/* 1. Year Input (4 digits) */}
        <input
          id={`${inputId}-year`}
          ref={yearInputRef}
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="2026"
          value={year}
          disabled={disabled}
          required={required}
          onChange={handleYearChange}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          title="Enrollment Year (e.g. 2026)"
          style={{
            width: '68px',
            padding: '0.5rem 0.25rem',
            fontSize: '0.925rem',
            fontWeight: 700,
            color: 'var(--color-slate-900)',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            textAlign: 'center',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        />

        {/* 2. Fixed Pre-Written Text: /KMU/RCNS/ (Clean text without background box) */}
        <span
          style={{
            userSelect: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 0.15rem',
            margin: '0',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#0f2744',
            fontSize: '0.925rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-mono, monospace)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            pointerEvents: 'none',
            opacity: 0.9,
          }}
        >
          /KMU/RCNS/
        </span>

        {/* 3. Sequence / Roll Number Input */}
        <input
          id={`${inputId}-seq`}
          ref={seqInputRef}
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="001"
          value={sequence}
          disabled={disabled}
          required={required}
          onChange={handleSeqChange}
          onKeyDown={handleSeqKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          title="Student Roll / Sequence Number (e.g. 001)"
          style={{
            flex: 1,
            minWidth: '60px',
            padding: '0.5rem 0.65rem',
            fontSize: '0.925rem',
            fontWeight: 700,
            color: 'var(--color-slate-900)',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        />
      </div>

      {/* Helper text or error message */}
      {error ? (
        <span style={{ fontSize: '0.775rem', color: 'var(--color-danger)', fontWeight: 500 }}>
          {error}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: '0.775rem', color: 'var(--color-slate-500)' }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
};

export default KmuRegistrationInput;
