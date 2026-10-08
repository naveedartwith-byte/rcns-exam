import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
  bordered?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverable = false,
  bordered = true,
  padding = 'md',
  style,
  ...props
}) => {
  const paddings: Record<string, string> = {
    none: '0',
    sm: '0.875rem 1rem',
    md: '1.25rem 1.5rem',
    lg: '1.75rem 2rem',
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: bordered ? '1px solid var(--color-slate-200)' : 'none',
        boxShadow: 'var(--shadow-sm)',
        padding: paddings[padding],
        transition: hoverable ? 'all var(--transition-base)' : 'none',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', ...style }} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, style, ...props }) => (
  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)', margin: 0, ...style }} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, style, ...props }) => (
  <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', marginTop: '0.25rem', margin: 0, ...style }} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div style={{ ...style }} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-slate-100)', ...style }} {...props}>
    {children}
  </div>
);

export default Card;
