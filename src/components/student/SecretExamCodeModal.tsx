import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import type { Exam } from '../../types/exam';

export interface SecretExamCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  onVerified: (exam: Exam) => void;
  onVerifyCode: (examId: string, code: string) => Promise<{ success: boolean; message?: string }>;
}

export const SecretExamCodeModal: React.FC<SecretExamCodeModalProps> = ({
  isOpen,
  onClose,
  exam,
  onVerified,
  onVerifyCode,
}) => {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !exam) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      setErrorMessage('Please enter the Secret Exam Code provided by your instructor.');
      return;
    }

    if (cleanCode.length < 4) {
      setErrorMessage('Secret Exam Code must be at least 4 characters.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const result = await onVerifyCode(exam.id, cleanCode);
      if (result.success) {
        setCode('');
        setShowCode(false);
        onVerified(exam);
      } else {
        setErrorMessage(
          result.message ||
            'Incorrect secret exam code. Please check with your course instructor.'
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          'Failed to verify examination code. Please check your network connection.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    if (isVerifying) return;
    setCode('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Enter Secret Exam Code"
      description="Institutional Security Verification • Royal College of Nursing Swat"
      maxWidth="sm"
      zIndex={100050}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isVerifying}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isVerifying}
            style={{ backgroundColor: '#0f2744', fontWeight: 700 }}
          >
            {isVerifying ? 'Verifying Code...' : 'Verify Code & Start Exam →'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Exam Context Banner */}
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--color-slate-50)',
            border: '1px solid var(--color-slate-200)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f2744', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {exam.type.toUpperCase()} • {exam.subject || 'Course Examination'}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
            {exam.title}
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--color-slate-600)', marginTop: '0.4rem' }}>
            <span>⏱️ Duration: <strong>{exam.duration} Mins</strong></span>
            <span>📝 Marks: <strong>{exam.totalMarks}</strong></span>
          </div>
        </div>

        {errorMessage && (
          <Alert type="danger" onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        {/* Secret Code Input Field */}
        <div>
          <label
            htmlFor="secret-exam-code-input"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--color-slate-800)',
              marginBottom: '0.4rem',
            }}
          >
            Secret Exam Code <span style={{ color: 'var(--color-danger-600)' }}>*</span>
          </label>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="secret-exam-code-input"
              type={showCode ? 'text' : 'password'}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g. RCNS-7K9M"
              autoFocus
              disabled={isVerifying}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: '0.75rem 3rem 0.75rem 0.9rem',
                fontSize: '1.05rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                letterSpacing: '0.12em',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--color-slate-300)',
                outline: 'none',
                transition: 'border-color 0.15s ease',
                backgroundColor: '#ffffff',
                color: 'var(--color-slate-900)',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#0f2744')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--color-slate-300)')}
            />

            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              disabled={isVerifying}
              title={showCode ? 'Hide Code' : 'Show Code'}
              style={{
                position: 'absolute',
                right: '0.6rem',
                background: 'none',
                border: 'none',
                padding: '0.35rem 0.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-slate-600)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {showCode ? '🙈 Hide' : '👁️ Show'}
            </button>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', marginTop: '0.4rem', lineHeight: 1.4 }}>
            Ask your course instructor in the hall for this examination's secret code. Every exam has its own unique code.
          </p>
        </div>

        {/* Security watermark */}
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--color-slate-400)',
            textAlign: 'center',
            paddingTop: '0.25rem',
          }}
        >
          ROYAL COLLEGE OF NURSING SWAT • Examination Proctoring System
        </div>
      </form>
    </Modal>
  );
};

export default SecretExamCodeModal;
