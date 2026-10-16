import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Textarea,
  Badge,
  Alert,
  LoadingSpinner,
  ConfirmDialog,
} from '../ui';
import type { Exam } from '../../types/exam';
import type { WrittenQuestion, WrittenQuestionType } from '../../types/writtenQuestion';
import { writtenQuestionService } from '../../services/writtenQuestionService';
import { useAuth } from '../../hooks/useAuth';

interface WrittenQuestionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  onQuestionsUpdated?: () => void;
}

export const WrittenQuestionManagerModal: React.FC<WrittenQuestionManagerModalProps> = ({
  isOpen,
  onClose,
  exam,
  onQuestionsUpdated,
}) => {
  const { currentUser } = useAuth();
  const [questions, setQuestions] = useState<WrittenQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'danger'; text: string } | null>(null);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<WrittenQuestion | null>(null);
  const [formType, setFormType] = useState<WrittenQuestionType>('short');
  const [formPrompt, setFormPrompt] = useState('');
  const [formMaxMarks, setFormMaxMarks] = useState<number>(5);
  const [formGuidelines, setFormGuidelines] = useState('');
  const [formMinWords, setFormMinWords] = useState<string>('');
  const [formMaxWords, setFormMaxWords] = useState<string>('');

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchQuestions = async () => {
    if (!exam) return;
    setIsLoading(true);
    try {
      const qs = await writtenQuestionService.getWrittenQuestionsByExamId(exam.id);
      setQuestions(qs);
    } catch (err: any) {
      console.error('Error fetching written questions:', err);
      setFeedback({ type: 'danger', text: 'Could not load written questions from database.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && exam) {
      fetchQuestions();
      setFeedback(null);
      setIsFormOpen(false);
      setEditingQuestion(null);
    }
  }, [isOpen, exam?.id]);

  const handleOpenAddForm = (type: WrittenQuestionType) => {
    setEditingQuestion(null);
    setFormType(type);
    setFormPrompt('');
    setFormMaxMarks(type === 'short' ? 5 : 10);
    setFormGuidelines('');
    setFormMinWords('');
    setFormMaxWords('');
    setIsFormOpen(true);
    setFeedback(null);
  };

  const handleOpenEditForm = (q: WrittenQuestion) => {
    setEditingQuestion(q);
    setFormType(q.type);
    setFormPrompt(q.question);
    setFormMaxMarks(q.maxMarks);
    setFormGuidelines(q.guidelines || '');
    setFormMinWords(q.minWords ? String(q.minWords) : '');
    setFormMaxWords(q.maxWords ? String(q.maxWords) : '');
    setIsFormOpen(true);
    setFeedback(null);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exam || !formPrompt.trim()) return;

    const cleanMax = Math.max(1, Math.floor(Number(formMaxMarks) || (formType === 'short' ? 5 : 10)));
    setIsSaving(true);
    try {
      if (editingQuestion) {
        await writtenQuestionService.updateWrittenQuestion(editingQuestion.id, {
          type: formType,
          question: formPrompt.trim(),
          maxMarks: cleanMax,
          guidelines: formGuidelines.trim(),
          minWords: formMinWords ? Number(formMinWords) : undefined,
          maxWords: formMaxWords ? Number(formMaxWords) : undefined,
        });
        setFeedback({ type: 'success', text: `Updated ${formType === 'short' ? 'Short Question' : 'Long Question'} successfully.` });
      } else {
        const nextOrder = questions.length + 1;
        await writtenQuestionService.addWrittenQuestion({
          examId: exam.id,
          type: formType,
          question: formPrompt.trim(),
          maxMarks: cleanMax,
          order: nextOrder,
          guidelines: formGuidelines.trim(),
          minWords: formMinWords ? Number(formMinWords) : undefined,
          maxWords: formMaxWords ? Number(formMaxWords) : undefined,
          createdBy: currentUser?.uid,
        });
        setFeedback({ type: 'success', text: `Added new ${formType === 'short' ? 'Short Question' : 'Long Question'} successfully.` });
      }

      // Automatically sync sanitized representations to exam document for students
      await writtenQuestionService.syncSanitizedWrittenQuestions(exam.id);

      setIsFormOpen(false);
      setEditingQuestion(null);
      await fetchQuestions();
      if (onQuestionsUpdated) onQuestionsUpdated();
    } catch (err: any) {
      console.error('Error saving written question:', err);
      setFeedback({ type: 'danger', text: err?.message || 'Failed to save question.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!exam) return;
    try {
      await writtenQuestionService.deleteWrittenQuestion(id);
      await writtenQuestionService.syncSanitizedWrittenQuestions(exam.id);
      setFeedback({ type: 'success', text: 'Question deleted successfully.' });
      await fetchQuestions();
      if (onQuestionsUpdated) onQuestionsUpdated();
    } catch (err: any) {
      console.error('Error deleting written question:', err);
      setFeedback({ type: 'danger', text: 'Failed to delete question.' });
    }
    setDeleteId(null);
  };

  const handleManualSync = async () => {
    if (!exam) return;
    setIsSyncing(true);
    try {
      const sanitized = await writtenQuestionService.syncSanitizedWrittenQuestions(exam.id);
      setFeedback({
        type: 'success',
        text: `Successfully published ${sanitized.length} sanitized written question(s) for students!`,
      });
      if (onQuestionsUpdated) onQuestionsUpdated();
    } catch (err: any) {
      console.error('Error syncing questions:', err);
      setFeedback({ type: 'danger', text: 'Error syncing questions.' });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!exam) return null;

  const shortQuestions = questions.filter((q) => q.type === 'short');
  const longQuestions = questions.filter((q) => q.type === 'long');
  const totalWrittenMarks = questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0);
  const mcqQuestionsCount = Number(exam.questionCount) || (exam.sanitizedQuestions ? exam.sanitizedQuestions.length : 0);
  const mcqMarks = Number(exam.totalMarks) ? Number(exam.totalMarks) - totalWrittenMarks : mcqQuestionsCount * 2;
  const safeMcqMarks = Math.max(0, mcqMarks);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Written Questions Manager: ${exam.title}`}
      description={`Program: ${exam.program} • Semester: ${exam.semester} • Batch: ${exam.batch || '—'}`}
      maxWidth="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)' }}>
            Summary: <strong>{mcqQuestionsCount} MCQs</strong> ({safeMcqMarks}m) +{' '}
            <strong>{shortQuestions.length} Short Qs</strong> ({shortQuestions.reduce((s, q) => s + q.maxMarks, 0)}m) +{' '}
            <strong>{longQuestions.length} Long Qs</strong> ({longQuestions.reduce((s, q) => s + q.maxMarks, 0)}m) ={' '}
            <strong style={{ color: '#0f2744' }}>{safeMcqMarks + totalWrittenMarks} Total Marks</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing || questions.length === 0}
            >
              {isSyncing ? 'Publishing...' : '📡 Publish to Students'}
            </Button>
            <Button variant="primary" size="sm" onClick={onClose} style={{ backgroundColor: '#0f2744' }}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {feedback && (
          <Alert type={feedback.type} onDismiss={() => setFeedback(null)}>
            {feedback.text}
          </Alert>
        )}

        {/* Top Actions: Add Short Question / Add Long Question */}
        {!isFormOpen && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              backgroundColor: 'var(--color-slate-50)',
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-slate-200)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
                Written Examination Paper Structure
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)', marginTop: '0.2rem' }}>
                Add Short Questions (clinical scenarios/brief answers) and Long Questions (comprehensive care plans).
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenAddForm('short')}
                style={{ backgroundColor: '#047857', borderColor: '#047857' }}
              >
                + Add Short Question
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenAddForm('long')}
                style={{ backgroundColor: '#0f2744', borderColor: '#0f2744' }}
              >
                + Add Long Question
              </Button>
            </div>
          </div>
        )}

        {/* Create / Edit Question Form */}
        {isFormOpen && (
          <form
            onSubmit={handleSaveQuestion}
            style={{
              backgroundColor: '#ffffff',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '2px solid #0f2744',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
                {editingQuestion ? 'Edit Written Question' : `Create New ${formType === 'short' ? 'Short Question' : 'Long Question'}`}
              </div>
              <Badge variant={formType === 'short' ? 'primary' : 'warning'}>
                {formType === 'short' ? 'Short Question' : 'Long Question'}
              </Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-slate-700)', marginBottom: '0.35rem' }}>
                  Question Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => {
                    const val = e.target.value as WrittenQuestionType;
                    setFormType(val);
                    if (!editingQuestion) setFormMaxMarks(val === 'short' ? 5 : 10);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-slate-300)',
                    fontSize: '0.9rem',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="short">Short Question (e.g. 5 Marks)</option>
                  <option value="long">Long Question (e.g. 10 or 15 Marks)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-slate-700)', marginBottom: '0.35rem' }}>
                  Maximum Marks <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formMaxMarks}
                  onChange={(e) => setFormMaxMarks(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                />
              </div>
            </div>

            <div>
              <Textarea
                label="Question Prompt / Clinical Scenario *"
                placeholder="Enter the complete question prompt, scenario, or inquiry..."
                rows={4}
                value={formPrompt}
                onChange={(e) => setFormPrompt(e.target.value)}
                required
              />
            </div>

            <div>
              <Textarea
                label="Confidential Teacher Rubric / Model Answer (Visible ONLY to Faculty)"
                placeholder="Optional key points, model criteria, or marking scheme to assist during manual evaluation..."
                rows={3}
                value={formGuidelines}
                onChange={(e) => setFormGuidelines(e.target.value)}
              />
              <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.25rem' }}>
                🛡️ Strictly protected: This field is confidential and never transmitted to student browsers.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Input
                type="number"
                label="Minimum Expected Words (Optional Guidance)"
                placeholder="e.g. 50"
                value={formMinWords}
                onChange={(e) => setFormMinWords(e.target.value)}
              />
              <Input
                type="number"
                label="Maximum Word Limit (Optional Guidance)"
                placeholder="e.g. 250"
                value={formMaxWords}
                onChange={(e) => setFormMaxWords(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSaving} style={{ backgroundColor: '#0f2744' }}>
                {isSaving ? 'Saving Question...' : editingQuestion ? 'Update Question' : 'Save Question'}
              </Button>
            </div>
          </form>
        )}

        {/* Questions List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <LoadingSpinner size="md" />
            <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', marginTop: '0.5rem' }}>
              Loading written questions...
            </div>
          </div>
        ) : questions.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2.5rem 1rem',
              backgroundColor: 'var(--color-slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-slate-300)',
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>
              No Written Questions Configured Yet
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--color-slate-500)', marginTop: '0.35rem' }}>
              Click <strong>"+ Add Short Question"</strong> or <strong>"+ Add Long Question"</strong> above to construct written sections for this examination.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Short Questions Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)', margin: 0 }}>
                  Short Questions ({shortQuestions.length})
                </h4>
                <Badge variant="primary">{shortQuestions.reduce((s, q) => s + q.maxMarks, 0)} Marks Total</Badge>
              </div>

              {shortQuestions.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                  No short questions added yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {shortQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      style={{
                        padding: '0.85rem 1rem',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--color-slate-200)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857' }}>
                            SQ #{idx + 1}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-slate-600)' }}>
                            • Max Marks: {q.maxMarks}
                          </span>
                          {q.guidelines && (
                            <Badge variant="outline" size="sm">Rubric Configured</Badge>
                          )}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--color-slate-900)', lineHeight: 1.45, fontWeight: 500 }}>
                          {q.question}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditForm(q)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(q.id)} style={{ color: '#dc2626' }}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Long Questions Section */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)', margin: 0 }}>
                  Long Questions ({longQuestions.length})
                </h4>
                <Badge variant="warning">{longQuestions.reduce((s, q) => s + q.maxMarks, 0)} Marks Total</Badge>
              </div>

              {longQuestions.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                  No long questions added yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {longQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      style={{
                        padding: '0.85rem 1rem',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--color-slate-200)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#d97706' }}>
                            LQ #{idx + 1}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-slate-600)' }}>
                            • Max Marks: {q.maxMarks}
                          </span>
                          {q.guidelines && (
                            <Badge variant="outline" size="sm">Rubric Configured</Badge>
                          )}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--color-slate-900)', lineHeight: 1.45, fontWeight: 500 }}>
                          {q.question}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditForm(q)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(q.id)} style={{ color: '#dc2626' }}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDeleteQuestion(deleteId)}
        title="Delete Written Question"
        message="Are you sure you want to delete this question? This action cannot be undone."
      />
    </Modal>
  );
};

export default WrittenQuestionManagerModal;
