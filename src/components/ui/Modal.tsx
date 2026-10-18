import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  zIndex?: number;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  zIndex = 100050,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthStyles: Record<string, string> = {
    sm: '400px',
    md: '550px',
    lg: '750px',
    xl: '950px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          transition: 'opacity var(--transition-fast)',
        }}
      />

      {/* Modal Dialog Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="rcns-modal-dialog animate-fade-in"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: widthStyles[maxWidth],
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--color-slate-200)',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          className="rcns-modal-header"
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-slate-100)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <div>
            <h3 id="modal-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-slate-900)' }}>
              {title}
            </h3>
            {description && (
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-slate-500)' }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-slate-400)',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          className="rcns-modal-body"
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="rcns-modal-footer"
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-slate-100)',
              backgroundColor: 'var(--color-slate-50)',
              display: 'flex',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .rcns-modal-header {
            padding: 1rem !important;
          }
          .rcns-modal-body {
            padding: 1rem !important;
          }
          .rcns-modal-footer {
            padding: 0.75rem 1rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Modal;
