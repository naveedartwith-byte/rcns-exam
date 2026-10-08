import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pills';
  style?: React.CSSProperties;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  style,
}) => {
  if (variant === 'pills') {
    return (
      <div
        style={{
          display: 'inline-flex',
          padding: '0.25rem',
          backgroundColor: 'var(--color-slate-100)',
          borderRadius: 'var(--radius-md)',
          gap: '0.25rem',
          ...style,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                backgroundColor: isActive ? '#ffffff' : 'transparent',
                color: isActive ? 'var(--color-primary-900)' : 'var(--color-slate-600)',
                boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
              }}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isActive ? 'var(--color-primary-50)' : 'var(--color-slate-200)',
                    color: isActive ? 'var(--color-primary-700)' : 'var(--color-slate-700)',
                    fontWeight: 700,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Default underline style
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-slate-200)',
        gap: '1.5rem',
        overflowX: 'auto',
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 0.25rem',
              fontSize: '0.9rem',
              fontWeight: isActive ? 700 : 500,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--color-primary-800)' : 'var(--color-slate-500)',
              borderBottom: `2px solid ${isActive ? 'var(--color-primary-800)' : 'transparent'}`,
              marginBottom: '-1px',
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isActive ? 'var(--color-primary-100)' : 'var(--color-slate-100)',
                  color: isActive ? 'var(--color-primary-900)' : 'var(--color-slate-600)',
                  fontWeight: 700,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
