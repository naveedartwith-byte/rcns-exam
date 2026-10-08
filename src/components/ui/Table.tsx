import React from 'react';

export const TableContainer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div
    style={{
      width: '100%',
      overflowX: 'auto',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-slate-200)',
      backgroundColor: '#ffffff',
      boxShadow: 'var(--shadow-xs)',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, style, ...props }) => (
  <table
    style={{
      width: '100%',
      borderCollapse: 'collapse',
      textAlign: 'left',
      fontSize: '0.875rem',
      ...style,
    }}
    {...props}
  >
    {children}
  </table>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, style, ...props }) => (
  <thead
    style={{
      backgroundColor: 'var(--color-slate-50)',
      borderBottom: '1px solid var(--color-slate-200)',
      ...style,
    }}
    {...props}
  >
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, style, ...props }) => (
  <tbody style={{ ...style }} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, style, ...props }) => (
  <tr
    style={{
      borderBottom: '1px solid var(--color-slate-100)',
      transition: 'background-color var(--transition-fast)',
      ...style,
    }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-slate-50)')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, style, ...props }) => (
  <th
    style={{
      padding: '0.875rem 1.25rem',
      fontWeight: 600,
      color: 'var(--color-slate-700)',
      fontSize: '0.8rem',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      ...style,
    }}
    {...props}
  >
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, style, ...props }) => (
  <td
    style={{
      padding: '1rem 1.25rem',
      color: 'var(--color-slate-700)',
      verticalAlign: 'middle',
      ...style,
    }}
    {...props}
  >
    {children}
  </td>
);
