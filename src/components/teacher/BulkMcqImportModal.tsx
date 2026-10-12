import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Badge,
  Textarea,
  Input,
  Select,
  Alert,
  EmptyState,
  LoadingSpinner,
} from '../ui';
import { parseMCQText, SAMPLE_MCQ_TEMPLATE } from '../../utils/mcqParser';
import { validateParsedMCQ, detectDuplicates } from '../../utils/mcqValidator';
import { questionService, BulkImportResult } from '../../services/questionService';
import type { Exam } from '../../types/exam';
import type { ParsedMCQ, BulkImportSummary } from '../../types/question';

interface BulkMcqImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  teacherId?: string;
  onImportSuccess?: (result: BulkImportResult) => void;
  onOpenQuestionManager?: (exam: Exam) => void;
}

export const BulkMcqImportModal: React.FC<BulkMcqImportModalProps> = ({
  isOpen,
  onClose,
  exam,
  teacherId,
  onImportSuccess,
  onOpenQuestionManager,
}) => {
  // Step state: 'input' | 'preview' | 'success'
  const [step, setStep] = useState<'input' | 'preview' | 'success'>('input');
  const [rawText, setRawText] = useState('');
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Parsed summary state
  const [parsedData, setParsedData] = useState<BulkImportSummary>({
    totalDetected: 0,
    validCount: 0,
    errorCount: 0,
    duplicateCount: 0,
    parsedQuestions: [],
  });

  // Preview filtering state: 'all' | 'valid' | 'errors'
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'errors'>('all');

  // Inline editing of a question
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ParsedMCQ | null>(null);

  // Import configuration
  const [defaultMarks, setDefaultMarks] = useState(2);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

  // Reset modal state when closed or opened
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setImportError(null);
      setImportResult(null);
      setEditingQuestionId(null);
      setEditForm(null);
    }
  }, [isOpen]);

  // Handle template download
  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_MCQ_TEMPLATE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Royal_College_MCQ_Template.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle sample copy
  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_MCQ_TEMPLATE);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Handle parsing action
  const handleParseQuestions = () => {
    if (!rawText.trim()) return;
    const summary = parseMCQText(rawText);
    setParsedData(summary);
    setStep('preview');
  };

  // Handle Clear / Reset
  const handleReset = () => {
    if (parsedData.parsedQuestions.length > 0 || rawText.trim().length > 0) {
      if (window.confirm('Are you sure you want to clear the pasted text and all parsed questions?')) {
        setRawText('');
        setParsedData({
          totalDetected: 0,
          validCount: 0,
          errorCount: 0,
          duplicateCount: 0,
          parsedQuestions: [],
        });
        setStep('input');
        setEditingQuestionId(null);
      }
    }
  };

  // Inline edit handlers
  const handleStartEdit = (q: ParsedMCQ) => {
    setEditingQuestionId(q.id);
    setEditForm({ ...q });
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    const validated = validateParsedMCQ(editForm);

    const updatedList = parsedData.parsedQuestions.map((q) =>
      q.id === editForm.id ? validated : q
    );

    const withDuplicates = detectDuplicates(updatedList);
    const finalized = withDuplicates.map((q) => validateParsedMCQ(q));

    const validCount = finalized.filter((q) => q.isValid).length;
    const errorCount = finalized.filter((q) => !q.isValid).length;
    const duplicateCount = finalized.filter((q) => q.isDuplicate).length;

    setParsedData({
      totalDetected: finalized.length,
      validCount,
      errorCount,
      duplicateCount,
      parsedQuestions: finalized,
    });

    setEditingQuestionId(null);
    setEditForm(null);
  };

  const handleDeleteParsedQuestion = (id: string) => {
    const updated = parsedData.parsedQuestions.filter((q) => q.id !== id);
    const withDuplicates = detectDuplicates(updated);
    const finalized = withDuplicates.map((q, idx) => validateParsedMCQ({ ...q, order: idx + 1 }));

    const validCount = finalized.filter((q) => q.isValid).length;
    const errorCount = finalized.filter((q) => !q.isValid).length;
    const duplicateCount = finalized.filter((q) => q.isDuplicate).length;

    setParsedData({
      totalDetected: finalized.length,
      validCount,
      errorCount,
      duplicateCount,
      parsedQuestions: finalized,
    });
  };

  // Handle final import into Firestore
  const handleExecuteImport = async () => {
    if (!exam) {
      setImportError('Please select an exam first.');
      return;
    }

    if (parsedData.validCount === 0) {
      setImportError('There are no valid questions to import.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const result = await questionService.bulkImportQuestions({
        examId: exam.id,
        questions: parsedData.parsedQuestions,
        createdBy: teacherId,
        defaultMarks,
        replaceExisting,
      });

      setImportResult(result);
      setStep('success');

      if (onImportSuccess) {
        onImportSuccess(result);
      }
    } catch (err: any) {
      console.error('Error during bulk import:', err);
      setImportError(err.message || 'Failed to import questions. Please check permissions.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  // Filter questions for display in preview
  const displayedQuestions = parsedData.parsedQuestions.filter((q) => {
    if (filterTab === 'valid') return q.isValid;
    if (filterTab === 'errors') return !q.isValid;
    return true;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk MCQ Import System"
      description={
        exam
          ? `Target Paper: ${exam.title} (${exam.subject || 'Exam Paper'}) • ${exam.program}`
          : 'Please select an exam first'
      }
      maxWidth="xl"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            {step === 'preview' && (
              <Button variant="outline" size="sm" onClick={() => setStep('input')} disabled={isImporting}>
                ← Back to Editor
              </Button>
            )}
            {step === 'input' && parsedData.parsedQuestions.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep('preview')}>
                View Current Preview ({parsedData.totalDetected}) →
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Button variant="outline" onClick={onClose} disabled={isImporting}>
              {step === 'success' ? 'Close' : 'Cancel'}
            </Button>

            {step === 'input' && (
              <Button
                variant="primary"
                onClick={handleParseQuestions}
                disabled={!rawText.trim()}
                style={{ backgroundColor: '#0f2744' }}
              >
                Parse Questions &amp; Preview →
              </Button>
            )}

            {step === 'preview' && (
              <Button
                variant="primary"
                onClick={handleExecuteImport}
                disabled={isImporting || parsedData.validCount === 0}
                style={{ backgroundColor: '#0f2744' }}
              >
                {isImporting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LoadingSpinner size="sm" /> Importing to Firestore...
                  </span>
                ) : (
                  `Import Valid Questions (${parsedData.validCount})`
                )}
              </Button>
            )}

            {step === 'success' && exam && onOpenQuestionManager && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onOpenQuestionManager(exam);
                }}
                style={{ backgroundColor: '#0f2744' }}
              >
                View Question Bank ({importResult?.totalQuestionsInExam || 0})
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Warning if no exam selected */}
        {!exam && (
          <Alert type="warning">
            Please select an examination paper from the Exams list before importing questions.
          </Alert>
        )}

        {importError && (
          <Alert type="danger" onDismiss={() => setImportError(null)}>
            {importError}
          </Alert>
        )}

        {/* =========================================================================
            STEP 1: TEXTAREA INPUT & FORMAT ASSISTANT
            ========================================================================= */}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Top Toolbar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                backgroundColor: 'var(--color-slate-50)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-200)',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                  Format Assistant:
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFormatGuide(!showFormatGuide)}
                >
                  {showFormatGuide ? 'Hide Format Guide' : 'View Format Guide'}
                </Button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Button variant="outline" size="sm" onClick={handleCopySample}>
                  {copySuccess ? '✓ Sample Copied!' : 'Copy Sample MCQs'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  📥 Download MCQ Template (.txt)
                </Button>
              </div>
            </div>

            {/* Expandable Format Guide */}
            {showFormatGuide && (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  fontSize: '0.85rem',
                  color: 'var(--color-slate-700)',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f2744', marginBottom: '0.5rem' }}>
                  Supported MCQ Structure:
                </div>
                <pre
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-slate-200)',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    lineHeight: '1.4',
                    margin: '0 0 0.5rem 0',
                    color: '#0f2744',
                  }}
                >
{`1. What is the primary function of red blood cells?
A) Transport oxygen
B) Fight infections
C) Clot blood
D) Produce antibodies
Answer: A
Explanation: Hemoglobin inside red blood cells binds and transports oxygen.`}
                </pre>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', lineHeight: '1.4' }}>
                  • Numbering variations supported: <code>1.</code>, <code>2)</code>, <code>Q1.</code>, <code>Question 1:</code><br />
                  • Option variations supported: <code>A)</code>, <code>A.</code>, <code>(A)</code>, <code>Option A:</code><br />
                  • Answer variations supported: <code>Answer: A</code>, <code>Correct Answer: A</code>, <code>Correct: A</code>, <code>Ans: A</code><br />
                  • Optional: <code>Explanation: ...</code> or <code>Rationale: ...</code>
                </div>
              </div>
            )}

            {/* Textarea */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                  Paste MCQ Text Block (20, 50, 100+ questions supported):
                </label>
                {rawText.trim() && (
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-danger-600)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear Text
                  </button>
                )}
              </div>

              <Textarea
                placeholder="Paste your MCQs here...&#10;&#10;1. What is normal adult blood pressure?&#10;A) 120/80 mmHg&#10;B) 140/90 mmHg&#10;C) 90/60 mmHg&#10;D) 160/100 mmHg&#10;Answer: A&#10;Explanation: 120/80 mmHg is the normal baseline."
                rows={14}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.45',
                  backgroundColor: '#ffffff',
                }}
              />
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 2: PREVIEW & VALIDATION SCREEN
            ========================================================================= */}
        {step === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Summary Statistics Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-slate-200)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>
                  TOTAL DETECTED
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                  {parsedData.totalDetected}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #a7f3d0',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600 }}>
                  VALID FOR IMPORT
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
                  {parsedData.validCount}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: parsedData.errorCount > 0 ? '#fef2f2' : '#f8fafc',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${parsedData.errorCount > 0 ? '#fecaca' : '#e2e8f0'}`,
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: parsedData.errorCount > 0 ? '#991b1b' : 'var(--color-slate-500)',
                    fontWeight: 600,
                  }}
                >
                  ERRORS
                </div>
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: parsedData.errorCount > 0 ? '#dc2626' : 'var(--color-slate-600)',
                  }}
                >
                  {parsedData.errorCount}
                </div>
              </div>

              {parsedData.duplicateCount > 0 && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #fde68a',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                    DUPLICATES DETECTED
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>
                    {parsedData.duplicateCount}
                  </div>
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: filterTab === 'all' ? '#0f2744' : 'var(--color-slate-200)',
                    backgroundColor: filterTab === 'all' ? '#0f2744' : '#ffffff',
                    color: filterTab === 'all' ? '#ffffff' : 'var(--color-slate-700)',
                    cursor: 'pointer',
                  }}
                >
                  All ({parsedData.totalDetected})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterTab('valid')}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: filterTab === 'valid' ? '#059669' : 'var(--color-slate-200)',
                    backgroundColor: filterTab === 'valid' ? '#059669' : '#ffffff',
                    color: filterTab === 'valid' ? '#ffffff' : 'var(--color-slate-700)',
                    cursor: 'pointer',
                  }}
                >
                  Valid Only ({parsedData.validCount})
                </button>

                {parsedData.errorCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTab('errors')}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: filterTab === 'errors' ? '#dc2626' : '#fecaca',
                      backgroundColor: filterTab === 'errors' ? '#dc2626' : '#fef2f2',
                      color: filterTab === 'errors' ? '#ffffff' : '#b91c1c',
                      cursor: 'pointer',
                    }}
                  >
                    Needs Attention ({parsedData.errorCount})
                  </button>
                )}
              </div>

              {/* Import Options (Marks & Replace) */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-slate-600)' }}>Marks/Q:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={defaultMarks}
                    onChange={(e) => setDefaultMarks(Number(e.target.value) || 2)}
                    style={{
                      width: '60px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-slate-300)',
                    }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--color-slate-700)' }}>
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                  />
                  <span>Replace existing questions</span>
                </label>
              </div>
            </div>

            {/* Questions List Preview */}
            {displayedQuestions.length === 0 ? (
              <EmptyState
                title="No Questions in this Filter"
                description="Try switching the filter tab above to view all parsed items."
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  maxHeight: '440px',
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                }}
              >
                {displayedQuestions.map((q) => {
                  const isEditing = editingQuestionId === q.id;

                  if (isEditing && editForm) {
                    return (
                      <div
                        key={q.id}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 'var(--radius-md)',
                          border: '2px solid #0f2744',
                          padding: '1.25rem',
                          boxShadow: 'var(--shadow-md)',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', color: '#0f2744' }}>
                          Edit Question #{q.order}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <Textarea
                            label="Question Prompt"
                            rows={2}
                            value={editForm.questionText}
                            onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                          />

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                            <Input
                              label="Option A"
                              value={editForm.optionA}
                              onChange={(e) => setEditForm({ ...editForm, optionA: e.target.value })}
                            />
                            <Input
                              label="Option B"
                              value={editForm.optionB}
                              onChange={(e) => setEditForm({ ...editForm, optionB: e.target.value })}
                            />
                            <Input
                              label="Option C"
                              value={editForm.optionC}
                              onChange={(e) => setEditForm({ ...editForm, optionC: e.target.value })}
                            />
                            <Input
                              label="Option D"
                              value={editForm.optionD}
                              onChange={(e) => setEditForm({ ...editForm, optionD: e.target.value })}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', alignItems: 'center' }}>
                            <Select
                              label="Correct Answer"
                              options={[
                                { value: '', label: '-- Select Answer --' },
                                { value: 'A', label: 'A' },
                                { value: 'B', label: 'B' },
                                { value: 'C', label: 'C' },
                                { value: 'D', label: 'D' },
                              ]}
                              value={editForm.correctAnswer}
                              onChange={(e) => setEditForm({ ...editForm, correctAnswer: e.target.value as any })}
                            />

                            <Input
                              label="Marks"
                              type="number"
                              value={editForm.marks || defaultMarks}
                              onChange={(e) => setEditForm({ ...editForm, marks: Number(e.target.value) })}
                            />
                          </div>

                          <Input
                            label="Explanation (Optional)"
                            value={editForm.explanation || ''}
                            onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                          />

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <Button variant="outline" size="sm" onClick={() => setEditingQuestionId(null)}>
                              Cancel
                            </Button>
                            <Button variant="primary" size="sm" onClick={handleSaveEdit} style={{ backgroundColor: '#0f2744' }}>
                              Save &amp; Revalidate
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: '1rem 1.25rem',
                        backgroundColor: q.isValid ? 'var(--color-slate-50)' : '#fef2f2',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${q.isValid ? 'var(--color-slate-200)' : '#fca5a5'}`,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <span
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: q.isValid ? '#0f2744' : '#dc2626',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              flexShrink: 0,
                            }}
                          >
                            {q.order}
                          </span>

                          <div>
                            <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--color-slate-900)', lineHeight: '1.4' }}>
                              {q.questionText || <em style={{ color: '#dc2626' }}>[Missing Question Text]</em>}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                              {q.isValid ? (
                                <Badge variant="success">✓ Valid MCQ</Badge>
                              ) : (
                                <Badge variant="danger">⚠ Invalid ({q.errors.length} errors)</Badge>
                              )}

                              {q.isDuplicate && (
                                <Badge variant="warning">Duplicate Prompt</Badge>
                              )}

                              <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', alignSelf: 'center' }}>
                                Marks: {q.marks || defaultMarks}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <Button variant="outline" size="sm" onClick={() => handleStartEdit(q)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteParsedQuestion(q.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>

                      {/* Error Messages */}
                      {q.errors.length > 0 && (
                        <div
                          style={{
                            margin: '0.75rem 0 0.5rem 2.25rem',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: '#fee2e2',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid #f87171',
                            fontSize: '0.8rem',
                            color: '#991b1b',
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Validation Errors:</div>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                            {q.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Options Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '0.4rem',
                          marginTop: '0.75rem',
                          marginLeft: '2.25rem',
                        }}
                      >
                        {[
                          { key: 'A', text: q.optionA },
                          { key: 'B', text: q.optionB },
                          { key: 'C', text: q.optionC },
                          { key: 'D', text: q.optionD },
                        ].map((opt) => {
                          const isCorrect = q.correctAnswer === opt.key;
                          return (
                            <div
                              key={opt.key}
                              style={{
                                padding: '0.4rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.8rem',
                                border: `1px solid ${isCorrect ? '#059669' : 'var(--color-slate-200)'}`,
                                backgroundColor: isCorrect ? '#ecfdf5' : '#ffffff',
                                color: isCorrect ? '#065f46' : 'var(--color-slate-700)',
                                fontWeight: isCorrect ? 700 : 400,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                              }}
                            >
                              <span>{opt.key})</span>
                              <span style={{ flex: 1 }}>{opt.text || <em style={{ color: '#dc2626' }}>[Missing]</em>}</span>
                              {isCorrect && <span style={{ fontSize: '0.75rem' }}>✓ Correct</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            marginLeft: '2.25rem',
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
        )}

        {/* =========================================================================
            STEP 3: SUCCESS CONFIRMATION
            ========================================================================= */}
        {step === 'success' && importResult && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '2rem 1rem',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 800,
                border: '2px solid #a7f3d0',
              }}
            >
              ✓
            </div>

            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: '0 0 0.25rem 0' }}>
                Import Successful!
              </h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-slate-600)', margin: 0 }}>
                <strong>{importResult.importedCount}</strong> multiple choice questions have been securely saved to the examination paper.
              </p>
              {importResult.skippedCount > 0 && (
                <p style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: '0.4rem' }}>
                  ({importResult.skippedCount} questions were skipped due to validation errors)
                </p>
              )}
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-slate-50)',
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-200)',
                fontSize: '0.85rem',
                color: 'var(--color-slate-700)',
              }}
            >
              Total Questions in Paper: <strong>{importResult.totalQuestionsInExam}</strong>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkMcqImportModal;
