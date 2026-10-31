import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, LoadingSpinner } from '../ui';
import { adminService } from '../../services/adminService';
import type { StorageMetrics } from '../../types/admin';

function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const StorageUsageCard: React.FC = () => {
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await adminService.getStorageMetrics(isManual);
      setMetrics(data);
    } catch (err: any) {
      console.error('Error fetching admin storage metrics:', err);
      setError('Unable to retrieve storage telemetry from Firestore.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  // Radius for SVG circular indicator
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const percentage = metrics ? Math.min(100, Math.max(0, metrics.usagePercentage)) : 0;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const strokeColor =
    metrics?.status === 'critical'
      ? '#dc2626'
      : metrics?.status === 'warning'
      ? '#d97706'
      : '#0d9488';

  const badgeVariant =
    metrics?.status === 'critical'
      ? 'danger'
      : metrics?.status === 'warning'
      ? 'warning'
      : 'success';

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner text="Querying Cloud Firestore storage telemetry..." />
        </div>
      </Card>
    );
  }

  if (error || !metrics || metrics.source === 'unavailable') {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
              Cloud Database Storage Quota
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
              Service: Cloud Firestore (Database Footprint)
            </span>
          </div>
          <Badge variant="outline">Usage Unavailable</Badge>
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', margin: '0 0 1rem 0' }}>
            Live cloud quota metrics require Google Cloud Monitoring permissions or backend telemetry synchronization.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={() => fetchMetrics(true)}>
              Retry Connection
            </Button>
            {metrics?.consoleUsageUrl && (
              <a
                href={metrics.consoleUsageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#0f2744',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Open Firebase Console ↗
              </a>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
              Institutional Database Storage &amp; Quota
            </h3>
            <Badge variant={badgeVariant}>
              {metrics.status === 'healthy' ? 'Optimal Quota' : metrics.status === 'warning' ? 'Approaching Limit' : 'Critical Capacity'}
            </Badge>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            Measuring <strong>{metrics.serviceName}</strong> (Project: <code>{metrics.projectId}</code>)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMetrics(true)}
            isLoading={refreshing}
            title="Recalculate storage footprint"
          >
            ↻ Refresh
          </Button>

          <a
            href={metrics.consoleUsageUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View authoritative live billing metrics in Google Firebase Console"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-slate-300)',
              backgroundColor: '#ffffff',
              color: 'var(--color-slate-700)',
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <span>Firebase Console</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>

      {/* Circular Progress Gauge (Clean & Centered) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
        <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background track circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="#e2e8f0"
              strokeWidth="12"
              fill="transparent"
            />
            {/* Animated Progress Circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke={strokeColor}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              style={{
                transition: 'stroke-dashoffset 0.8s ease-in-out, stroke 0.3s ease',
              }}
            />
          </svg>

          {/* Inner text content */}
          <div
            style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--color-slate-900)', lineHeight: 1 }}>
              {metrics.usagePercentage < 0.01 && metrics.usagePercentage > 0 ? '< 0.01%' : `${metrics.usagePercentage}%`}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', textTransform: 'uppercase', fontWeight: 700, marginTop: '0.25rem' }}>
              Used Quota
            </span>
          </div>
        </div>

        <div style={{ marginTop: '0.85rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)', fontWeight: 600 }}>
            {formatBytes(metrics.usedBytes)} of {formatBytes(metrics.totalQuotaBytes)}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default StorageUsageCard;
