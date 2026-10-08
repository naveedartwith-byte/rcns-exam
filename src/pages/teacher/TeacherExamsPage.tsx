import React, { useState } from 'react';
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
  MOCK_EXAMS,
  MOCK_PROGRAMS,
  MOCK_SEMESTERS,
  MOCK_QUESTIONS,
} from '../../mock/mockData';
import type { Question } from '../../types/question';

export const TeacherExamsPage: React.FC = () => {
  const [exams, setExams] = useState(MOCK_EXAMS);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Exam Create/Edit Modal State
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<typeof MOCK_EXAMS[0] | null>(null);
  const [examForm, setExamForm] = useState({
    title: '',
    subject: '',
    type: 'midterm' as 'quiz' | 'exam' | 'midterm',
    semester: 'Semester 4',
    program: 'BS Nursing (Generic)',
    duration: 60,
    totalMarks: 50,
    passingMarks: 25,
    startAt: '2026-10-15T09:00',
    endAt: '2026-10-15T11:00',
    description: '',
    instructions: 'Please answer all multiple choice questions. Zero tolerance for unfair means.',
    status: 'draft' as 'draft' | 'scheduled' | 'active' | 'completed' | 'archived',
  });

  // Question Management Modal State
  const [selectedExamForQuestions, setSelectedExamForQuestions] = useState<typeof MOCK_EXAMS[0] | null>(null);
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

  // Dialog states
  const [showDeleteExamConfirm, setShowDeleteExamConfirm] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Filtered exams
  const filteredExams = exams.filter((e) => {
    if (activeTab !== 'all' && e.status !== activeTab) return false;
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchSubject = e.subject.toLowerCase().includes(q);
      if (!matchTitle && !matchSubject) return false;
    }
    return true;
  });

  // Handlers for Exam Modal
  const handleOpenCreateModal = () => {
    setEditingExam(null);
    setExamForm({
      title: '',
      subject: '',
      type: 'midterm',
      semester: 'Semester 4',
      program: 'BS Nursing (Generic)',
      duration: 60,
      totalMarks: 50,
      passingMarks: 25,
      startAt: '2026-10-15T09:00',
      endAt: '2026-10-15T11:00',
      description: '',
      instructions: 'Please answer all multiple choice questions. Zero tolerance for unfair means.',
      status: 'draft',
    });
    setIsExamModalOpen(true);
  };

  const handleOpenEditModal = (exam: typeof MOCK_EXAMS[0]) => {
    setEditingExam(exam);
    setExamForm({
      title: exam.title,
      subject: exam.subject,
      type: exam.type,
      semester: exam.semester,
      program: exam.program,
      duration: exam.duration,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      startAt: '2026-10-15T09:00',
      endAt: '2026-10-15T11:00',
      description: exam.description,
      instructions: 'Please answer all questions carefully.',
      status: exam.status,
    });
    setIsExamModalOpen(true);
  };

  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingExam) {
      // Update
      setExams((prev) =>
        prev.map((item) =>
          item.id === editingExam.id
            ? {
                ...item,
                ...examForm,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
      setNotification(`Exam "${examForm.title}" updated successfully!`);
    } else {
      // Create
      const newExam: (typeof MOCK_EXAMS)[0] = {
        id: `exam-${Date.now()}`,
        title: examForm.title,
        description: examForm.description,
        subject: examForm.subject,
        type: examForm.type,
        teacherId: 'teacher-1',
        teacherName: 'Dr. Tariq Shah, PhD',
        semester: examForm.semester,
        program: examForm.program,
        duration: Number(examForm.duration),
        totalMarks: Number(examForm.totalMarks),
        passingMarks: Number(examForm.passingMarks),
        questionCount: 0,
        startAt: examForm.startAt,
        endAt: examForm.endAt,
        status: examForm.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setExams((prev) => [newExam, ...prev]);
      setNotification(`New exam "${examForm.title}" created successfully in Draft mode!`);
    }

    setIsExamModalOpen(false);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDuplicateExam = (exam: typeof MOCK_EXAMS[0]) => {
    const dup: typeof MOCK_EXAMS[0] = {
      ...exam,
      id: `exam-dup-${Date.now()}`,
      title: `${exam.title} (Copy)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setExams((prev) => [dup, ...prev]);
    setNotification(`Exam duplicated successfully as a Draft!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteExam = (examId: string) => {
    setExams((prev) => prev.filter((e) => e.id !== examId));
    setShowDeleteExamConfirm(null);
    setNotification('Exam paper deleted.');
    setTimeout(() => setNotification(null), 3000);
  };

  // Handlers for Question Management
  const handleOpenQuestionManager = (exam: typeof MOCK_EXAMS[0]) => {
    setSelectedExamForQuestions(exam);
    const qs = MOCK_QUESTIONS[exam.id] || MOCK_QUESTIONS['exam-1'] || [];
    setQuestionsList(qs);
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

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const opts =
      questionForm.type === 'mcq'
        ? [questionForm.optionA, questionForm.optionB, questionForm.optionC, questionForm.optionD]
        : ['True', 'False'];

    if (editingQuestion) {
      setQuestionsList((prev) =>
        prev.map((q) =>
          q.id === editingQuestion.id
            ? {
                ...q,
                question: questionForm.question,
                options: opts,
                correctAnswer: questionForm.correctAnswer,
                marks: Number(questionForm.marks),
              }
            : q
        )
      );
    } else {
      const newQ: Question = {
        id: `q-${Date.now()}`,
        examId: selectedExamForQuestions?.id || 'exam-1',
        question: questionForm.question,
        options: opts,
        correctAnswer: questionForm.correctAnswer,
        marks: Number(questionForm.marks),
        order: questionsList.length + 1,
      };
      setQuestionsList((prev) => [...prev, newQ]);
    }

    setIsQuestionFormOpen(false);
  };

  const handleDeleteQuestion = (qId: string) => {
    setQuestionsList((prev) => prev.filter((q) => q.id !== qId));
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
            Author, schedule, edit, and manage examination papers and question banks.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenCreateModal} style={{ backgroundColor: '#0f2744' }}>
          + Create Examination Paper
        </Button>
      </div>

      {notification && (
        <Alert type="success" onDismiss={() => setNotification(null)}>
          {notification}
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
            { id: 'scheduled', label: 'Scheduled', badge: exams.filter((e) => e.status === 'scheduled').length },
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
                  <TableHead>Program / Semester</TableHead>
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
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>{exam.semester}</div>
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
                        {exam.status}
                      </Badge>
                    </TableCell>

                    <TableCell style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenQuestionManager(exam)}
                          style={{ backgroundColor: '#0f2744' }}
                          title="Manage Questions"
                        >
                          Questions ({exam.questionCount || 5})
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
          CREATE / EDIT EXAM MULTI-SECTION MODAL
          ========================================================================= */}
      <Modal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        title={editingExam ? 'Edit Examination Paper' : 'Create New Examination Paper'}
        description="Configure evaluation parameters, duration, program target, and passing score."
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
                  { value: 'scheduled', label: 'Scheduled' },
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

          {/* Section 2: Target Academic Class */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '0.75rem' }}>
              2. Academic Target
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <Select
                label="Program"
                options={MOCK_PROGRAMS.map((p) => ({ value: p.name, label: p.name }))}
                value={examForm.program}
                onChange={(e) => setExamForm({ ...examForm, program: e.target.value })}
                required
              />

              <Select
                label="Semester"
                options={MOCK_SEMESTERS.map((s) => ({ value: s, label: s }))}
                value={examForm.semester}
                onChange={(e) => setExamForm({ ...examForm, semester: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Section 3: Duration & Marks */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '0.75rem' }}>
              3. Timing &amp; Grading Metrics
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <Input
                label="Duration (Minutes)"
                type="number"
                value={examForm.duration}
                onChange={(e) => setExamForm({ ...examForm, duration: Number(e.target.value) })}
                required
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)' }}>
                Configured Questions: <strong>{questionsList.length}</strong> (Total Marks:{' '}
                <strong>{questionsList.reduce((acc, q) => acc + (q.marks || 2), 0)}</strong>)
              </span>

              <Button variant="primary" size="sm" onClick={handleOpenAddQuestion} style={{ backgroundColor: '#0f2744' }}>
                + Add New Question
              </Button>
            </div>

            {/* Questions List */}
            {questionsList.length === 0 ? (
              <EmptyState
                title="No Questions Configured"
                description="This examination currently has zero questions. Add Multiple Choice or True/False items."
                actionLabel="+ Add First Question"
                onAction={handleOpenAddQuestion}
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
                          const isCorrect = Number(q.correctAnswer) === oIdx;

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
                              <span>{String.fromCharCode(65 + oIdx)}.</span>
                              <span>{optLabel}</span>
                              {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>✓ Correct</span>}
                            </div>
                          );
                        })}
                      </div>
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
    </div>
  );
};

export default TeacherExamsPage;
