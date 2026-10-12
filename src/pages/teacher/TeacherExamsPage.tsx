import React, { useState, useEffect } from 'react';
import {
  SearchBar,
  Select,
  Tabs,
  Badge,
  Button,
  Card,
  Modal,
  ConfirmDialog,
  Input,
  Textarea,
  Alert,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableContainer,
  EmptyState,
} from '../../components/ui';
import {
  MOCK_PROGRAMS,
  MOCK_BATCHES,
  MOCK_SEMESTERS,
} from '../../mock/mockData';
import { useAuth } from '../../hooks/useAuth';
import { examService } from '../../services/examService';
import { questionService } from '../../services/questionService';
import { assignmentService } from '../../services/assignmentService';
import { BulkMcqImportModal } from '../../components/teacher/BulkMcqImportModal';
import {
  formatPakistanDateTime,
  toDatetimeLocalPktString,
  fromDatetimeLocalToPktIso,
  calculateEndAtPkt,
  validateSchedule,
  getEffectiveExamStatus,
} from '../../utils/dateTime';
import type { Exam } from '../../types/exam';
import type { Question } from '../../types/question';

export const TeacherExamsPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Load teacher's exams
  const fetchTeacherExams = async () => {
    try {
      if (currentUser) {
        const fetched = await examService.getExamsByTeacher(currentUser.uid);
        // Annotate with dynamic effective status
        const withStatus = fetched.map((e) => ({
          ...e,
          status: getEffectiveExamStatus(e),
        }));
        setExams(withStatus);
      }
    } catch (err) {
      console.error('Error fetching teacher exams:', err);
    }
  };

  useEffect(() => {
    fetchTeacherExams();
  }, [currentUser]);

  // Exam Create/Edit Modal State
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examModalError, setExamModalError] = useState<string | null>(null);

  const [examForm, setExamForm] = useState({
    title: '',
    subject: '',
    type: 'midterm' as 'quiz' | 'exam' | 'midterm',
    batch: 'Batch 15th',
    semester: 'Semester 4',
    program: 'BS Nursing (Generic)',
    duration: 60,
    totalMarks: 50,
    passingMarks: 25,
    startAt: toDatetimeLocalPktString(Date.now() + 60 * 60 * 1000),
    endAt: toDatetimeLocalPktString(Date.now() + 120 * 60 * 1000),
    description: '',
    instructions: 'Please answer all multiple choice questions. Zero tolerance for unfair means.',
    status: 'draft' as 'draft' | 'scheduled' | 'active' | 'completed' | 'archived',
  });

  // Dedicated Cohort Assignment Modal State (ISSUE 2)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    examId: '',
    batch: '',
    semester: '',
    program: 'BS Nursing (Generic)',
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Question Management Modal State
  const [selectedExamForQuestions, setSelectedExamForQuestions] = useState<Exam | null>(null);
  const [questionsList, setQuestionsList] = useState<Question[]>([]);
  const [isQuestionFormOpen, setIsQuestionFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question: '',
    type: 'mcq' as 'mcq' | 'true_false',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 0,
    marks: 2,
    explanation: '',
  });

  // Bulk MCQ Import Modal State
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [bulkImportTargetExam, setBulkImportTargetExam] = useState<Exam | null>(null);

  // Dialog states
  const [showDeleteExamConfirm, setShowDeleteExamConfirm] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Filtered exams
  const filteredExams = exams.filter((e) => {
    if (activeTab !== 'all' && e.status !== activeTab) return false;
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchSubject = (e.subject || '').toLowerCase().includes(q);
      if (!matchTitle && !matchSubject) return false;
    }
    return true;
  });

  // Handlers for Exam Modal
  const handleOpenCreateModal = () => {
    setEditingExam(null);
    setExamModalError(null);
    const startPkt = toDatetimeLocalPktString(Date.now() + 60 * 60 * 1000);
    const endPkt = toDatetimeLocalPktString(Date.now() + 120 * 60 * 1000);

    setExamForm({
      title: '',
      subject: '',
      type: 'midterm',
      batch: 'Batch 15th',
      semester: 'Semester 4',
      program: 'BS Nursing (Generic)',
      duration: 60,
      totalMarks: 50,
      passingMarks: 25,
      startAt: startPkt,
      endAt: endPkt,
      description: '',
      instructions: 'Please answer all multiple choice questions. Zero tolerance for unfair means.',
      status: 'scheduled',
    });
    setIsExamModalOpen(true);
  };

  const handleOpenEditModal = (exam: Exam) => {
    setEditingExam(exam);
    setExamModalError(null);

    const startLocal = toDatetimeLocalPktString(exam.startAt);
    const endLocal = toDatetimeLocalPktString(exam.endAt);

    setExamForm({
      title: exam.title,
      subject: exam.subject || '',
      type: exam.type,
      batch: exam.batch || 'Batch 15th',
      semester: exam.semester || 'Semester 4',
      program: exam.program,
      duration: exam.duration,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks || Math.round(exam.totalMarks * 0.5),
      startAt: startLocal,
      endAt: endLocal,
      description: exam.description || '',
      instructions: exam.instructions || 'Please answer all questions carefully.',
      status: exam.status,
    });
    setIsExamModalOpen(true);
  };

  // Auto-calculate end time based on start time + duration in PKT
  const handleAutoCalculateEndAt = () => {
    const endCalculated = calculateEndAtPkt(examForm.startAt, Number(examForm.duration));
    if (endCalculated) {
      setExamForm((prev) => ({
        ...prev,
        endAt: toDatetimeLocalPktString(endCalculated),
      }));
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setExamModalError(null);

    // Validate schedule (ISSUE 3)
    const scheduleValidation = validateSchedule(
      examForm.startAt,
      examForm.endAt,
      Number(examForm.duration)
    );
    if (scheduleValidation) {
      setExamModalError(scheduleValidation);
      return;
    }

    if (!examForm.batch) {
      setExamModalError('Please select the enrolled Batch.');
      return;
    }
    if (!examForm.semester) {
      setExamModalError('Please select the Semester for the chosen Batch.');
      return;
    }

    // Convert local PKT inputs to explicit ISO strings (+05:00)
    const startIso = fromDatetimeLocalToPktIso(examForm.startAt);
    const endIso = fromDatetimeLocalToPktIso(examForm.endAt);

    try {
      if (editingExam) {
        // Update in Firestore
        await examService.updateExam(editingExam.id, {
          ...examForm,
          startAt: startIso,
          endAt: endIso,
          duration: Number(examForm.duration),
          totalMarks: Number(examForm.totalMarks),
          passingMarks: Number(examForm.passingMarks),
        });
        // Automatically assign/sync cohort if status is scheduled or active
        if (examForm.status === 'scheduled' || examForm.status === 'active') {
          await assignmentService.assignExamToCohort({
            examId: editingExam.id,
            batch: examForm.batch,
            semester: examForm.semester,
            program: examForm.program,
            assignedBy: currentUser.uid,
          });
        }

        setNotification({ type: 'success', text: `Exam "${examForm.title}" updated successfully with Pakistan Standard Time schedule!` });
      } else {
        // Create in Firestore
        const newExamId = await examService.createExam({
          ...examForm,
          startAt: startIso,
          endAt: endIso,
          teacherId: currentUser.uid,
          teacherName: userProfile?.name || 'Faculty Member',
          duration: Number(examForm.duration),
          totalMarks: Number(examForm.totalMarks),
          passingMarks: Number(examForm.passingMarks),
          questionCount: 0,
        });

        // Automatically assign cohort if status is scheduled or active
        if (examForm.status === 'scheduled' || examForm.status === 'active') {
          await assignmentService.assignExamToCohort({
            examId: newExamId,
            batch: examForm.batch,
            semester: examForm.semester,
            program: examForm.program,
            assignedBy: currentUser.uid,
          });
        }

        setNotification({ type: 'success', text: `New exam "${examForm.title}" created and scheduled for ${examForm.batch}!` });
      }

      fetchTeacherExams();
      setIsExamModalOpen(false);
    } catch (err: any) {
      console.error('Error saving exam:', err);
      setExamModalError(err.message || 'Error saving examination paper.');
    }
  };

  // Dedicated Cohort Assignment Handlers (ISSUE 2)
  const handleOpenAssignModal = (targetExam?: Exam) => {
    setAssignError(null);
    const initialExamId = targetExam?.id || (exams[0]?.id || '');
    const selectedEx = exams.find((x) => x.id === initialExamId);

    setAssignForm({
      examId: initialExamId,
      batch: selectedEx?.batch || '',
      semester: selectedEx?.semester || '',
      program: selectedEx?.program || 'BS Nursing (Generic)',
    });
    setIsAssignModalOpen(true);
  };

  const handleSaveCohortAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setAssignError(null);

    if (!assignForm.examId) {
      setAssignError('Please select an Examination or Quiz.');
      return;
    }
    if (!assignForm.batch) {
      setAssignError('Please select the Batch (e.g. Batch 13th).');
      return;
    }
    if (!assignForm.semester) {
      setAssignError('Please select the Semester for this batch.');
      return;
    }

    setIsAssigning(true);
    try {
      const result = await assignmentService.assignExamToCohort({
        examId: assignForm.examId,
        batch: assignForm.batch,
        semester: assignForm.semester,
        program: assignForm.program,
        assignedBy: currentUser.uid,
      });

      setNotification({
        type: 'success',
        text: result.message,
      });

      setIsAssignModalOpen(false);
      fetchTeacherExams();
    } catch (err: any) {
      console.error('Error assigning exam to cohort:', err);
      setAssignError(err.message || 'Failed to complete cohort assignment.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDuplicateExam = async (exam: Exam) => {
    if (!currentUser) return;
    try {
      await examService.createExam({
        ...exam,
        title: `${exam.title} (Copy)`,
        status: 'draft',
        teacherId: currentUser.uid,
        teacherName: userProfile?.name || 'Faculty Member',
      });
      setNotification({ type: 'success', text: `Exam duplicated successfully as a Draft!` });
      fetchTeacherExams();
    } catch (err) {
      console.error('Error duplicating exam:', err);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    try {
      await examService.deleteExam(examId);
      setNotification({ type: 'success', text: 'Exam paper deleted from registry.' });
      fetchTeacherExams();
    } catch (err) {
      console.error('Error deleting exam:', err);
    }
    setShowDeleteExamConfirm(null);
  };

  // Handlers for Question Management
  const handleOpenQuestionManager = async (exam: Exam) => {
    setSelectedExamForQuestions(exam);
    try {
      const qs = await questionService.getQuestionsByExamId(exam.id);
      setQuestionsList(qs);
      setSelectedExamForQuestions((prev) => (prev && prev.id === exam.id ? { ...prev, questionCount: qs.length } : exam));
    } catch (err) {
      console.error('Error loading questions for exam:', err);
    }
  };

  const handleOpenBulkImport = (exam: Exam) => {
    setBulkImportTargetExam(exam);
    setIsBulkImportModalOpen(true);
  };

  const handleOpenAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionForm({
      question: '',
      type: 'mcq',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 0,
      marks: 2,
      explanation: '',
    });
    setIsQuestionFormOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamForQuestions) return;

    const opts =
      questionForm.type === 'mcq'
        ? [questionForm.optionA, questionForm.optionB, questionForm.optionC, questionForm.optionD]
        : ['True', 'False'];

    let updatedList: Question[] = [];
    if (editingQuestion) {
      updatedList = questionsList.map((q) =>
        q.id === editingQuestion.id
          ? {
              ...q,
              question: questionForm.question,
              options: opts,
              correctAnswer: questionForm.correctAnswer,
              marks: Number(questionForm.marks),
            }
          : q
      );
    } else {
      const newQ: Question = {
        id: `q-${Date.now()}`,
        examId: selectedExamForQuestions.id,
        question: questionForm.question,
        options: opts,
        correctAnswer: questionForm.correctAnswer,
        marks: Number(questionForm.marks),
        order: questionsList.length + 1,
      };
      updatedList = [...questionsList, newQ];
    }

    setQuestionsList(updatedList);
    try {
      await questionService.saveQuestionsForExam(selectedExamForQuestions.id, updatedList);
    } catch (err) {
      console.error('Error saving questions batch:', err);
    }

    setIsQuestionFormOpen(false);
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!selectedExamForQuestions) return;
    const updated = questionsList.filter((q) => q.id !== qId);
    setQuestionsList(updated);
    try {
      await questionService.saveQuestionsForExam(selectedExamForQuestions.id, updated);
    } catch (err) {
      console.error('Error saving updated question list:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Exams &amp; Quizzes Management
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            Author, schedule with Pakistan Standard Time, assign to student batches, and manage question banks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="md"
            onClick={() => handleOpenAssignModal()}
            style={{ borderColor: '#0f2744', color: '#0f2744', fontWeight: 700 }}
          >
            👥 Assign Quiz / Exam to Cohort
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreateModal}
            style={{ backgroundColor: '#0f2744' }}
          >
            + Create Examination Paper
          </Button>
        </div>
      </div>

      {notification && (
        <Alert type={notification.type} onDismiss={() => setNotification(null)}>
          {notification.text}
        </Alert>
      )}

      {/* Tabs & Search Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#ffffff',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-slate-200)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
          tabs={[
            { id: 'all', label: 'All Exams', badge: exams.length },
            { id: 'draft', label: 'Drafts', badge: exams.filter((e) => e.status === 'draft').length },
            { id: 'scheduled', label: 'Upcoming', badge: exams.filter((e) => e.status === 'scheduled').length },
            { id: 'active', label: 'Active', badge: exams.filter((e) => e.status === 'active').length },
            { id: 'completed', label: 'Completed', badge: exams.filter((e) => e.status === 'completed').length },
          ]}
        />

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search title, course code..."
          />

          <div style={{ width: '150px' }}>
            <Select
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'quiz', label: 'Quiz' },
                { value: 'midterm', label: 'Mid-Term' },
                { value: 'exam', label: 'Final Exam' },
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Examinations Table */}
      {filteredExams.length === 0 ? (
        <EmptyState
          title="No Examination Papers Found"
          description="Create a new exam or change your filter conditions."
          actionLabel="Create Exam Now"
          onAction={handleOpenCreateModal}
        />
      ) : (
        <Card padding="none">
          <TableContainer style={{ border: 'none', borderRadius: 'var(--radius-lg)' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paper Title &amp; Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Program / Target Cohort</TableHead>
                  <TableHead>Schedule (PKT)</TableHead>
                  <TableHead>Duration &amp; Marks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell>
                      <div style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>{exam.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>{exam.subject}</div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{exam.type.toUpperCase()}</Badge>
                    </TableCell>

                    <TableCell>
                      <div style={{ fontWeight: 600 }}>{exam.program}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-600)' }}>
                        {exam.batch ? <strong>{exam.batch} • </strong> : <span style={{ color: '#d97706' }}>Cohort Unassigned • </span>}
                        {exam.semester}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                        {formatPakistanDateTime(exam.startAt)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                        Closes: {formatPakistanDateTime(exam.endAt)}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div>
                        <strong>{exam.duration}</strong> mins • <strong>{exam.totalMarks}</strong> marks
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>
                        Passing: {exam.passingMarks}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          exam.status === 'active'
                            ? 'success'
                            : exam.status === 'scheduled'
                            ? 'warning'
                            : exam.status === 'completed'
                            ? 'default'
                            : 'outline'
                        }
                      >
                        {exam.status === 'scheduled' ? 'UPCOMING' : exam.status.toUpperCase()}
                      </Badge>
                    </TableCell>

                    <TableCell style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenAssignModal(exam)}
                          style={{ backgroundColor: '#0284c7', color: '#ffffff', borderColor: '#0284c7', fontWeight: 600 }}
                          title="Assign to Student Batch & Semester"
                        >
                          👥 Assign
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenQuestionManager(exam)}
                          style={{ backgroundColor: '#0f2744' }}
                          title="Manage Questions"
                        >
                          Questions ({exam.questionCount || 0})
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenBulkImport(exam)}
                          style={{ borderColor: '#0f2744', color: '#0f2744', fontWeight: 600 }}
                          title="Bulk Import MCQs from Text"
                        >
                          ⚡ Import
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEditModal(exam)}
                        >
                          Edit
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateExam(exam)}
                          title="Duplicate Exam"
                        >
                          Copy
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setShowDeleteExamConfirm(exam.id)}
                          title="Delete Exam"
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* =========================================================================
          ASSIGN QUIZ / EXAM TO BATCH & SEMESTER MODAL (ISSUE 2)
          ========================================================================= */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Examination to Student Cohort"
        description="Select the examination paper, choose the enrolled Batch first, and then pick the Semester."
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveCohortAssignment}
              isLoading={isAssigning}
              disabled={!assignForm.examId || !assignForm.batch || !assignForm.semester}
              style={{ backgroundColor: '#0f2744' }}
            >
              Save &amp; Assign Exam
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveCohortAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {assignError && (
            <Alert type="danger" onDismiss={() => setAssignError(null)}>
              {assignError}
            </Alert>
          )}

          {/* 1. Select Exam/Quiz */}
          <Select
            label="1. Select Exam / Quiz"
            options={[
              { value: '', label: '-- Select an Examination / Quiz --' },
              ...exams.map((e) => ({
                value: e.id,
                label: `[${e.type.toUpperCase()}] ${e.title} (${e.subject || 'Course'})`,
              })),
            ]}
            value={assignForm.examId}
            onChange={(e) => {
              const selectedEx = exams.find((x) => x.id === e.target.value);
              setAssignForm({
                ...assignForm,
                examId: e.target.value,
                program: selectedEx?.program || assignForm.program,
                batch: selectedEx?.batch || assignForm.batch,
                semester: selectedEx?.semester || assignForm.semester,
              });
            }}
            required
            requiredIndicator
            helperText="Choose the paper to assign"
          />

          {/* 2. Select Batch (Must come before Semester) */}
          <Select
            label="2. Select Batch"
            options={[
              { value: '', label: '-- Select Batch (e.g. Batch 13th) --' },
              ...MOCK_BATCHES.map((b) => ({ value: b, label: b })),
            ]}
            value={assignForm.batch}
            onChange={(e) => {
              const newBatch = e.target.value;
              setAssignForm((prev) => ({
                ...prev,
                batch: newBatch,
                // Clear semester when batch changes
                semester: '',
              }));
            }}
            required
            requiredIndicator
            helperText="Select enrolled batch first before semester is enabled"
          />

          {/* 3. Select Semester (Disabled until Batch is selected) */}
          <Select
            label="3. Select Semester"
            options={[
              {
                value: '',
                label: assignForm.batch ? '-- Select Semester --' : '-- Please select Batch first --',
              },
              ...MOCK_SEMESTERS.map((s) => ({ value: s, label: s })),
            ]}
            value={assignForm.semester}
            onChange={(e) => setAssignForm({ ...assignForm, semester: e.target.value })}
            disabled={!assignForm.batch}
            required
            requiredIndicator
            helperText={
              assignForm.batch
                ? `Choose current semester for ${assignForm.batch}`
                : 'Select Batch above to enable semester dropdown'
            }
          />

          {/* 4. Academic Program */}
          <Select
            label="4. Academic Program"
            options={MOCK_PROGRAMS.map((p) => ({ value: p.name, label: p.name }))}
            value={assignForm.program}
            onChange={(e) => setAssignForm({ ...assignForm, program: e.target.value })}
            required
            helperText="Curriculum program track"
          />

          {/* Live Cohort Summary Box */}
          {assignForm.examId && assignForm.batch && assignForm.semester && (
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                fontSize: '0.85rem',
                color: '#166534',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>✓ Cohort Target Ready:</div>
              <div>
                Candidates in <strong>{assignForm.batch}</strong>, <strong>{assignForm.semester}</strong> ({assignForm.program}) will be authorized to see this assessment in their portal.
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* =========================================================================
          CREATE / EDIT EXAM MULTI-SECTION MODAL (WITH PST SCHEDULING & BATCH)
          ========================================================================= */}
      <Modal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        title={editingExam ? 'Edit Examination Paper' : 'Create New Examination Paper'}
        description="Configure evaluation parameters, duration, batch target, and Pakistan Standard Time schedule."
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsExamModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveExam} style={{ backgroundColor: '#0f2744' }}>
              {editingExam ? 'Save Changes' : 'Create Examination Paper'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveExam} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {examModalError && (
            <Alert type="danger" onDismiss={() => setExamModalError(null)}>
              {examModalError}
            </Alert>
          )}

          {/* Section 1: Basic Information */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '0.75rem' }}>
              1. Basic Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <Input
                label="Examination Title"
                placeholder="e.g. Mid-Term: Adult Health Nursing I"
                value={examForm.title}
                onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                required
                requiredIndicator
              />

              <Input
                label="Subject & Course Code"
                placeholder="e.g. Adult Health Nursing I (NUR-201)"
                value={examForm.subject}
                onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })}
                required
                requiredIndicator
              />

              <Select
                label="Examination Type"
                options={[
                  { value: 'midterm', label: 'Mid-Term Examination' },
                  { value: 'quiz', label: 'Class Quiz' },
                  { value: 'exam', label: 'Final Examination' },
                ]}
                value={examForm.type}
                onChange={(e) => setExamForm({ ...examForm, type: e.target.value as any })}
                required
                requiredIndicator
              />

              <Select
                label="Paper Status"
                options={[
                  { value: 'draft', label: 'Draft (Not Visible to Students)' },
                  { value: 'scheduled', label: 'Scheduled (Visible as Upcoming)' },
                  { value: 'active', label: 'Active (Open for Testing)' },
                  { value: 'completed', label: 'Completed' },
                ]}
                value={examForm.status}
                onChange={(e) => setExamForm({ ...examForm, status: e.target.value as any })}
                required
                requiredIndicator
              />
            </div>
          </div>

          {/* Section 2: Target Academic Class (Batch placed BEFORE Semester - ISSUE 2) */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '0.75rem' }}>
              2. Academic Target Cohort
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <Select
                label="Academic Program"
                options={MOCK_PROGRAMS.map((p) => ({ value: p.name, label: p.name }))}
                value={examForm.program}
                onChange={(e) => setExamForm({ ...examForm, program: e.target.value })}
                required
              />

              {/* Batch selection FIRST */}
              <Select
                label="Batch"
                options={[
                  { value: '', label: '-- Select Batch --' },
                  ...MOCK_BATCHES.map((b) => ({ value: b, label: b })),
                ]}
                value={examForm.batch}
                onChange={(e) => {
                  const newBatch = e.target.value;
                  setExamForm({
                    ...examForm,
                    batch: newBatch,
                    // Clear semester when batch changes
                    semester: newBatch ? examForm.semester : '',
                  });
                }}
                required
                requiredIndicator
                helperText="Select enrolled batch first"
              />

              {/* Semester selection (Disabled until Batch is chosen) */}
              <Select
                label="Semester"
                options={[
                  {
                    value: '',
                    label: examForm.batch ? '-- Select Semester --' : '-- Please select Batch first --',
                  },
                  ...MOCK_SEMESTERS.map((s) => ({ value: s, label: s })),
                ]}
                value={examForm.semester}
                onChange={(e) => setExamForm({ ...examForm, semester: e.target.value })}
                disabled={!examForm.batch}
                required
                requiredIndicator
                helperText={examForm.batch ? 'Target academic semester' : 'Select Batch above to enable'}
              />
            </div>
          </div>

          {/* Section 3: Exact Schedule in Pakistan Standard Time (ISSUE 3) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-800)', margin: 0 }}>
                3. Exact Schedule &amp; Timing (Pakistan Standard Time - PKT, UTC+05:00)
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoCalculateEndAt}
                title="Automatically calculate End Time from Start Time + Duration"
              >
                ⚡ Auto-Calculate End Time
              </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <Input
                label="Scheduled Start Date & Time (PKT)"
                type="datetime-local"
                value={examForm.startAt}
                onChange={(e) => setExamForm({ ...examForm, startAt: e.target.value })}
                required
                requiredIndicator
                helperText="Local Pakistan Time (UTC+05:00)"
              />

              <Input
                label="Scheduled End Date & Time (PKT)"
                type="datetime-local"
                value={examForm.endAt}
                onChange={(e) => setExamForm({ ...examForm, endAt: e.target.value })}
                required
                requiredIndicator
                helperText="Deadline for exam window"
              />

              <Input
                label="Duration (Minutes)"
                type="number"
                value={examForm.duration}
                onChange={(e) => setExamForm({ ...examForm, duration: Number(e.target.value) })}
                required
                requiredIndicator
                helperText="Allocated candidate testing time"
              />

              <Input
                label="Total Marks"
                type="number"
                value={examForm.totalMarks}
                onChange={(e) => setExamForm({ ...examForm, totalMarks: Number(e.target.value) })}
                required
              />

              <Input
                label="Passing Marks"
                type="number"
                value={examForm.passingMarks}
                onChange={(e) => setExamForm({ ...examForm, passingMarks: Number(e.target.value) })}
                required
              />
            </div>

            {/* Live Schedule Preview Box */}
            <div
              style={{
                marginTop: '1rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary-50)',
                border: '1px solid var(--color-primary-200)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, color: 'var(--color-primary-900)' }}>
                  🕒 Effective Schedule Window (Pakistan Time):
                </span>
                <div style={{ marginTop: '0.2rem', color: 'var(--color-primary-800)' }}>
                  <strong>Opens:</strong> {formatPakistanDateTime(examForm.startAt)} &nbsp;→&nbsp;
                  <strong>Closes:</strong> {formatPakistanDateTime(examForm.endAt)}
                </div>
              </div>
              <Badge variant="primary">
                Duration: {examForm.duration} Mins
              </Badge>
            </div>
          </div>

          {/* Section 4: Instructions */}
          <div>
            <Textarea
              label="Examination Instructions & Candidate Guidelines"
              rows={3}
              value={examForm.instructions}
              onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          QUESTION MANAGEMENT UI MODAL
          ========================================================================= */}
      {selectedExamForQuestions && (
        <Modal
          isOpen={Boolean(selectedExamForQuestions)}
          onClose={() => setSelectedExamForQuestions(null)}
          title={`Question Bank: ${selectedExamForQuestions.title}`}
          description={`Subject: ${selectedExamForQuestions.subject} • Total Questions: ${questionsList.length}`}
          maxWidth="xl"
          footer={
            <Button variant="primary" onClick={() => setSelectedExamForQuestions(null)} style={{ backgroundColor: '#0f2744' }}>
              Done / Close Manager
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)' }}>
                Configured Questions: <strong>{questionsList.length}</strong> (Total Marks:{' '}
                <strong>{questionsList.reduce((acc, q) => acc + (Number(q.marks) || 2), 0)}</strong>)
              </span>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenBulkImport(selectedExamForQuestions)}
                  style={{ borderColor: '#0f2744', color: '#0f2744', fontWeight: 600 }}
                >
                  ⚡ Bulk Import MCQs
                </Button>
                <Button variant="primary" size="sm" onClick={handleOpenAddQuestion} style={{ backgroundColor: '#0f2744' }}>
                  + Add Single Question
                </Button>
              </div>
            </div>

            {/* Questions List */}
            {questionsList.length === 0 ? (
              <EmptyState
                title="No Questions Configured"
                description="This examination currently has zero questions. Add questions one-by-one or use Bulk MCQ Import."
                actionLabel="⚡ Bulk Import MCQs"
                onAction={() => handleOpenBulkImport(selectedExamForQuestions)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
                {questionsList.map((q, idx) => {
                  const opts = Array.isArray(q.options) ? q.options : [];

                  return (
                    <div
                      key={q.id || idx}
                      style={{
                        padding: '1.25rem',
                        backgroundColor: 'var(--color-slate-50)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-slate-200)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <span
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: '#0f2744',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-slate-900)', lineHeight: 1.45 }}>
                              {q.question}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', marginTop: '0.2rem' }}>
                              Marks: {q.marks || 2}
                              {q.explanation && <span style={{ marginLeft: '1rem', fontStyle: 'italic' }}>• Has explanation</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteQuestion(q.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>

                      {/* Options rendering */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '1rem', marginLeft: '2.5rem' }}>
                        {opts.map((opt, oIdx) => {
                          const optLabel = typeof opt === 'string' ? opt : opt.text;
                          const optLetter = String.fromCharCode(65 + oIdx);
                          const isCorrect =
                            Number(q.correctAnswer) === oIdx ||
                            String(q.correctAnswer).trim().toUpperCase() === optLetter ||
                            String(q.correctAnswer).trim().toLowerCase() === String(optLabel).trim().toLowerCase();

                          return (
                            <div
                              key={oIdx}
                              style={{
                                padding: '0.5rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.825rem',
                                border: `1px solid ${isCorrect ? '#059669' : 'var(--color-slate-200)'}`,
                                backgroundColor: isCorrect ? '#ecfdf5' : '#ffffff',
                                color: isCorrect ? '#065f46' : 'var(--color-slate-700)',
                                fontWeight: isCorrect ? 700 : 400,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                              }}
                            >
                              <span>{optLetter}.</span>
                              <span>{optLabel}</span>
                              {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>✓ Correct</span>}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            marginLeft: '2.5rem',
                            fontSize: '0.78rem',
                            color: 'var(--color-slate-600)',
                            fontStyle: 'italic',
                          }}
                        >
                          <strong>Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* =========================================================================
          ADD / EDIT QUESTION MODAL
          ========================================================================= */}
      <Modal
        isOpen={isQuestionFormOpen}
        onClose={() => setIsQuestionFormOpen(false)}
        title="Add Question to Paper"
        description="Support for Multiple Choice (4 Options) and True/False questions."
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsQuestionFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveQuestion} style={{ backgroundColor: '#0f2744' }}>
              Save Question
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <Select
              label="Question Format"
              options={[
                { value: 'mcq', label: 'Multiple Choice (4 Options)' },
                { value: 'true_false', label: 'True / False' },
              ]}
              value={questionForm.type}
              onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value as any })}
            />

            <Input
              label="Marks"
              type="number"
              value={questionForm.marks}
              onChange={(e) => setQuestionForm({ ...questionForm, marks: Number(e.target.value) })}
              required
            />
          </div>

          <Textarea
            label="Question Prompt / Text"
            placeholder="Type the clinical case study or academic question..."
            rows={3}
            value={questionForm.question}
            onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
            required
            requiredIndicator
          />

          {questionForm.type === 'mcq' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>
                Answer Options (Select correct option):
              </span>

              {[
                { label: 'Option A', val: questionForm.optionA, key: 'optionA', idx: 0 },
                { label: 'Option B', val: questionForm.optionB, key: 'optionB', idx: 1 },
                { label: 'Option C', val: questionForm.optionC, key: 'optionC', idx: 2 },
                { label: 'Option D', val: questionForm.optionD, key: 'optionD', idx: 3 },
              ].map((item) => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="radio"
                    name="correctAnswerOption"
                    checked={questionForm.correctAnswer === item.idx}
                    onChange={() => setQuestionForm({ ...questionForm, correctAnswer: item.idx })}
                    style={{ width: '18px', height: '18px', accentColor: '#0f2744', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <Input
                      placeholder={item.label}
                      value={item.val}
                      onChange={(e) => setQuestionForm({ ...questionForm, [item.key]: e.target.value })}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>
                Select Correct State:
              </span>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="tfCorrect"
                    checked={questionForm.correctAnswer === 0}
                    onChange={() => setQuestionForm({ ...questionForm, correctAnswer: 0 })}
                  />
                  <span>True</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="tfCorrect"
                    checked={questionForm.correctAnswer === 1}
                    onChange={() => setQuestionForm({ ...questionForm, correctAnswer: 1 })}
                  />
                  <span>False</span>
                </label>
              </div>
            </div>
          )}

          <Textarea
            label="Explanation / Rationale (Optional for review)"
            placeholder="Explain why the selected answer is correct..."
            rows={2}
            value={questionForm.explanation}
            onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
          />
        </form>
      </Modal>

      {/* Delete Exam Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(showDeleteExamConfirm)}
        onClose={() => setShowDeleteExamConfirm(null)}
        onConfirm={() => showDeleteExamConfirm && handleDeleteExam(showDeleteExamConfirm)}
        title="Delete Examination Paper"
        message="Are you sure you want to permanently delete this examination? All configured questions will be removed."
        confirmText="Delete Exam"
        variant="danger"
      />

      {/* Bulk MCQ Import Modal */}
      <BulkMcqImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        exam={bulkImportTargetExam}
        teacherId={currentUser?.uid}
        onImportSuccess={async (result) => {
          setNotification({ type: 'success', text: `Successfully imported ${result.importedCount} questions!` });
          fetchTeacherExams();
          if (
            selectedExamForQuestions &&
            bulkImportTargetExam &&
            selectedExamForQuestions.id === bulkImportTargetExam.id
          ) {
            const updatedQs = await questionService.getQuestionsByExamId(bulkImportTargetExam.id);
            setQuestionsList(updatedQs);
            setSelectedExamForQuestions((prev) => (prev ? { ...prev, questionCount: updatedQs.length } : null));
          }
          setTimeout(() => setNotification(null), 4000);
        }}
        onOpenQuestionManager={(targetExam) => {
          handleOpenQuestionManager(targetExam);
        }}
      />
    </div>
  );
};

export default TeacherExamsPage;
