import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './user';

export interface AdminProfile {
  uid: string;
  role: Extract<UserRole, 'admin'>;
  name: string;
  email: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  time: string;
  description: string;
}

export interface AdminDashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalExams: number;
  activeExams: number;
  totalResults?: number;
  totalSubmissions?: number;
  overallPassRate: number;
  recentActivity: ActivityItem[];
}

export interface StorageMetrics {
  serviceName: string;
  serviceType: 'firestore' | 'storage';
  usedBytes: number;
  totalQuotaBytes: number;
  usagePercentage: number;
  remainingBytes: number;
  documentCount?: number;
  lastUpdated: string;
  source: 'live_telemetry' | 'estimated_footprint' | 'unavailable';
  projectId: string;
  status: 'healthy' | 'warning' | 'critical' | 'unavailable';
  consoleUsageUrl: string;
}

