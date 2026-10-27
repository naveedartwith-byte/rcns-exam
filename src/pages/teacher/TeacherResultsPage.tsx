import React from 'react';
import { ExamResultsReportsView } from '../../components/reports/ExamResultsReportsView';

export const TeacherResultsPage: React.FC = () => {
  return <ExamResultsReportsView userRole="teacher" />;
};

export default TeacherResultsPage;
