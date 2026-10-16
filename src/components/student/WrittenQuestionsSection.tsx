import React from 'react';
import { Badge, Card, Textarea } from '../ui';
import type { StudentWrittenQuestion, StudentWrittenAnswer } from '../../types/writtenQuestion';

interface WrittenQuestionsSectionProps {
  questions: StudentWrittenQuestion[];
  writtenAnswers: Record<string, StudentWrittenAnswer>;
  onAnswerChange: (questionId: string, qType: 'short' | 'long', questionText: string, text: string) => void;
  isReadOnly?: boolean;
}

export const WrittenQuestionsSection: React.FC<WrittenQuestionsSectionProps> = ({
  questions,
  writtenAnswers,
  onAnswerChange,
  isReadOnly = false,
}) => {
  if (questions.length === 0) {
    return null;
  }

  const shortQuestions = questions.filter((q) => q.type === 'short');
  const longQuestions = questions.filter((q) => q.type === 'long');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Short Questions Block */}
      {shortQuestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--color-slate-200)', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                Section B: Short Questions
              </h3>
              <Badge variant="primary">{shortQuestions.length} Questions</Badge>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-slate-600)' }}>
              Total Section Marks: {shortQuestions.reduce((s, q) => s + q.maxMarks, 0)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {shortQuestions.map((q, idx) => {
              const currentAns = writtenAnswers[q.id]?.answerText || '';
              const wordCount = currentAns.trim() ? currentAns.trim().split(/\s+/).length : 0;
              const charCount = currentAns.length;
              const isAnswered = currentAns.trim().length > 0;

              return (
                <Card
                  key={q.id}
                  style={{
                    padding: '1.25rem',
                    borderLeft: `4px solid ${isAnswered ? '#059669' : '#0f2744'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: isAnswered ? '#ecfdf5' : 'var(--color-slate-100)',
                          color: isAnswered ? '#059669' : 'var(--color-slate-700)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--color-slate-900)' }}>
                        Short Question {idx + 1}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge variant="outline">Marks: {q.maxMarks}</Badge>
                      {isAnswered ? (
                        <Badge variant="success">✓ Answered</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div
                    style={{
                      fontSize: '0.975rem',
                      fontWeight: 600,
                      color: 'var(--color-slate-800)',
                      backgroundColor: 'var(--color-slate-50)',
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      lineHeight: 1.5,
                      border: '1px solid var(--color-slate-200)',
                    }}
                  >
                    {q.question}
                  </div>

                  {/* Textarea */}
                  <div>
                    <Textarea
                      placeholder={isReadOnly ? 'No response provided.' : 'Type your answer clearly and concisely...'}
                      rows={4}
                      value={currentAns}
                      onChange={(e) => onAnswerChange(q.id, 'short', q.question, e.target.value)}
                      disabled={isReadOnly}
                      style={{
                        width: '100%',
                        fontSize: '0.925rem',
                        lineHeight: 1.5,
                        fontFamily: 'inherit',
                      }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>
                      <div>
                        {q.minWords || q.maxWords ? (
                          <span>
                            Guidance: {q.minWords ? `Min ${q.minWords} words` : ''} {q.maxWords ? `• Max ${q.maxWords} words` : ''}
                          </span>
                        ) : (
                          <span>Provide a structured nursing/clinical answer</span>
                        )}
                      </div>
                      <div>
                        <strong>{wordCount}</strong> words | {charCount} chars
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Long Questions Block */}
      {longQuestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: shortQuestions.length > 0 ? '0.5rem' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--color-slate-200)', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                Section C: Long Questions
              </h3>
              <Badge variant="warning">{longQuestions.length} Questions</Badge>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-slate-600)' }}>
              Total Section Marks: {longQuestions.reduce((s, q) => s + q.maxMarks, 0)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {longQuestions.map((q, idx) => {
              const currentAns = writtenAnswers[q.id]?.answerText || '';
              const wordCount = currentAns.trim() ? currentAns.trim().split(/\s+/).length : 0;
              const charCount = currentAns.length;
              const isAnswered = currentAns.trim().length > 0;

              return (
                <Card
                  key={q.id}
                  style={{
                    padding: '1.25rem',
                    borderLeft: `4px solid ${isAnswered ? '#d97706' : '#0f2744'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: isAnswered ? '#fef3c7' : 'var(--color-slate-100)',
                          color: isAnswered ? '#d97706' : 'var(--color-slate-700)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--color-slate-900)' }}>
                        Long Question {idx + 1}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge variant="outline">Marks: {q.maxMarks}</Badge>
                      {isAnswered ? (
                        <Badge variant="success">✓ Answered</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div
                    style={{
                      fontSize: '0.975rem',
                      fontWeight: 600,
                      color: 'var(--color-slate-800)',
                      backgroundColor: 'var(--color-slate-50)',
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      lineHeight: 1.5,
                      border: '1px solid var(--color-slate-200)',
                    }}
                  >
                    {q.question}
                  </div>

                  {/* Textarea */}
                  <div>
                    <Textarea
                      placeholder={isReadOnly ? 'No response provided.' : 'Type your comprehensive response, clinical assessment steps, and interventions here...'}
                      rows={7}
                      value={currentAns}
                      onChange={(e) => onAnswerChange(q.id, 'long', q.question, e.target.value)}
                      disabled={isReadOnly}
                      style={{
                        width: '100%',
                        fontSize: '0.925rem',
                        lineHeight: 1.5,
                        fontFamily: 'inherit',
                      }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>
                      <div>
                        {q.minWords || q.maxWords ? (
                          <span>
                            Guidance: {q.minWords ? `Min ${q.minWords} words` : ''} {q.maxWords ? `• Max ${q.maxWords} words` : ''}
                          </span>
                        ) : (
                          <span>Provide a comprehensive clinical care plan / detailed essay</span>
                        )}
                      </div>
                      <div>
                        <strong>{wordCount}</strong> words | {charCount} chars
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WrittenQuestionsSection;
