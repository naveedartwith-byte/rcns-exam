import React from 'react';
import { ExamResultsReportsView } from '../../components/reports/ExamResultsReportsView';

export const AdminResultsPage: React.FC = () => {
  return <ExamResultsReportsView userRole="admin" />;
};

export default AdminResultsPage;
