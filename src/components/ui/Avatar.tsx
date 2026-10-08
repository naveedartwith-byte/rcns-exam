import React from 'react';

export interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  src?: string;
  roleBadge?: 'student' | 'teacher' | 'admin';
  className?: string;
  style?: React.CSSProperties;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  src,
  roleBadge,
  style,
}) => {
  const getInitials = (str: string): string => {
    if (!str) return 'RC';
    const parts = str.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const sizeMap: Record<string, { dimension: number; fontSize: string }> = {
    xs: { dimension: 28, fontSize: '0.7rem' },
    sm: { dimension: 34, fontSize: '0.8rem' },
    md: { dimension: 40, fontSize: '0.9rem' },
    lg: { dimension: 48, fontSize: '1.1rem' },
    xl: { dimension: 64, fontSize: '1.4rem' },
  };

  const { dimension, fontSize } = sizeMap[size];

  // Deterministic soft color based on name string
  const getBackgroundColor = (str: string) => {
    const colors = [
      '#0f2744',
      '#0e5baa',
      '#0d9488',
      '#047857',
      '#b45309',
      '#4338ca',
      '#6d28d9',
      '#be123c',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${dimension}px`,
        height: `${dimension}px`,
        borderRadius: '50%',
        backgroundColor: getBackgroundColor(name),
        color: '#ffffff',
        fontWeight: 700,
        fontSize,
        letterSpacing: '0.02em',
        boxShadow: 'var(--shadow-xs)',
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}

      {roleBadge && (
        <span
          title={`Role: ${roleBadge}`}
          style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: `${Math.max(10, dimension * 0.3)}px`,
            height: `${Math.max(10, dimension * 0.3)}px`,
            borderRadius: '50%',
            backgroundColor:
              roleBadge === 'admin'
                ? '#dc2626'
                : roleBadge === 'teacher'
                ? '#0d9488'
                : '#2563eb',
            border: '2px solid #ffffff',
          }}
        />
      )}
    </div>
  );
};

export default Avatar;
