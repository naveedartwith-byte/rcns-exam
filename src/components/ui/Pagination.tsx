import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  style?: React.CSSProperties;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  style,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 0',
        fontSize: '0.85rem',
        color: 'var(--color-slate-600)',
        flexWrap: 'wrap',
        gap: '0.5rem',
        ...style,
      }}
    >
      <div>
        {totalItems !== undefined && itemsPerPage !== undefined ? (
          <span>
            Showing <strong style={{ color: 'var(--color-slate-900)' }}>{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</strong> to{' '}
            <strong style={{ color: 'var(--color-slate-900)' }}>{Math.min(currentPage * itemsPerPage, totalItems)}</strong> of{' '}
            <strong style={{ color: 'var(--color-slate-900)' }}>{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-slate-200)',
            backgroundColor: '#ffffff',
            color: currentPage === 1 ? 'var(--color-slate-400)' : 'var(--color-slate-700)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          Previous
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
          // Show first, last, current, and adjacent pages
          if (
            pageNum === 1 ||
            pageNum === totalPages ||
            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
          ) {
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                style={{
                  minWidth: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isActive ? 'var(--color-primary-800)' : 'var(--color-slate-200)'}`,
                  backgroundColor: isActive ? 'var(--color-primary-800)' : '#ffffff',
                  color: isActive ? '#ffffff' : 'var(--color-slate-700)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8rem',
                }}
              >
                {pageNum}
              </button>
            );
          } else if (
            (pageNum === currentPage - 2 && pageNum > 1) ||
            (pageNum === currentPage + 2 && pageNum < totalPages)
          ) {
            return (
              <span key={pageNum} style={{ padding: '0 0.25rem', color: 'var(--color-slate-400)' }}>
                ...
              </span>
            );
          }
          return null;
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-slate-200)',
            backgroundColor: '#ffffff',
            color: currentPage === totalPages ? 'var(--color-slate-400)' : 'var(--color-slate-700)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;
