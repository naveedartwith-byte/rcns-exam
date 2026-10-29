import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firestore';
import {
  SearchBar,
  Select,
  Tabs,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Modal,
  EmptyState,
  Alert,
  LoadingSpinner,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebase/auth';
import { assignmentService } from '../../services/assignmentService';
import { questionService } from '../../services/questionService';
import { resultService } from '../../services/resultService';
import { writtenQuestionService } from '../../services/writtenQuestionService';
import { WrittenQuestionsSection } from '../../components/student/WrittenQuestionsSection';
import type { Exam } from '../../types/exam';
import type { Question } from '../../types/question';
import type { StudentWrittenQuestion, StudentWrittenAnswer } from '../../types/writtenQuestion';
import { formatPakistanDateTime } from '../../utils/dateTime';
import { checkStudentExamEligibility } from '../../utils/examEligibility';
import { SecretExamCodeModal } from '../../components/student/SecretExamCodeModal';
import { examCodeService } from '../../services/examCodeService';

export const StudentExamsPage: React.FC = () => {
  const { currentUser, userProfile, studentProfile } = useAuth();
  const navigate = useNavigate();

  // Submission locks to prevent duplicate submissions from double-clicks or simultaneous timer events
  const isSubmittingRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  const selectedAnswersRef = useRef<Record<string | number, number>>({});
  const writtenAnswersRef = useRef<Record<string, StudentWrittenAnswer>>({});
  const timeLeftSecondsRef = useRef(3600);
  const tabSwitchCountRef = useRef(0);
  const currentQuestionIndexRef = useRef(0);
  const activeExamSectionRef = useRef<'mcq' | 'written'>('mcq');
  const flaggedQuestionsRef = useRef<Record<number, boolean>>({});

  const [exams, setExams] = useState<Exam[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Exam Attempt State (Interactive Testing Screen)
  const [takingExam, setTakingExam] = useState<Exam | null>(null);
  const [examQuestions, setExamQuestions] = useState<Omit<Question, 'correctAnswer' | 'explanation'>[]>([]);
  const [writtenQuestions, setWrittenQuestions] = useState<StudentWrittenQuestion[]>([]);
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, StudentWrittenAnswer>>({});
  const [activeExamSection, setActiveExamSection] = useState<'mcq' | 'written'>('mcq');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string | number, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showIncompleteAlert, setShowIncompleteAlert] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [tabSwitchAlertOpen, setTabSwitchAlertOpen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [examScoreSummary, setExamScoreSummary] = useState<{
    score: number;
    total: number;
    percentage: number;
    passed: boolean;
    grade?: string;
    status?: string;
    answersCount?: number;
    totalQuestions?: number;
    correctCount?: number;
    incorrectCount?: number;
  } | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [examQuestionsError, setExamQuestionsError] = useState<string | null>(null);

  // Secret Exam Code State
  const [codeModalExam, setCodeModalExam] = useState<Exam | null>(null);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  // Exam Lock State (Teacher-Controlled Invigilator Lock for Misbehavior)
  const [isExamLocked, setIsExamLocked] = useState(false);
  const [examLockReason, setExamLockReason] = useState<string | null>(null);

  // Fullscreen toggler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Continuous Auto-Save to LocalStorage so no keystroke or answer is ever lost (Requirement #1)
  useEffect(() => {
    if (!takingExam || examSubmitted || !currentUser) return;

    try {
      const progressData = {
        examId: takingExam.id,
        studentId: currentUser.uid,
        selectedAnswers,
        writtenAnswers,
        currentQuestionIndex,
        activeExamSection,
        timeLeftSeconds,
        flaggedQuestions,
        tabSwitchCount,
        lastSavedAt: Date.now(),
      };
      localStorage.setItem(
        `rcns_exam_progress_${currentUser.uid}_${takingExam.id}`,
        JSON.stringify(progressData)
      );
    } catch {
      // ignore storage errors
    }
  }, [
    takingExam?.id,
    examSubmitted,
    currentUser,
    selectedAnswers,
    writtenAnswers,
    currentQuestionIndex,
    activeExamSection,
    timeLeftSeconds,
    flaggedQuestions,
    tabSwitchCount,
  ]);

  // Anti-cheating & Tab Switching Guard (Requirement #1)
  useEffect(() => {
    if (!takingExam || examSubmitted) return;

    // Prevent closing/reloading window before finishing exam
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Examination in progress! Under institutional regulations, you cannot leave before completing and submitting your exam.';
      return e.returnValue;
    };

    // Prevent back-button navigation during exam
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      alert('Examination Security: Back navigation is disabled during an active examination. Please finish and submit your paper.');
    };

    // Detect tab switching or window blur: Save state immediately & show security modal (Requirement #1)
    const handleVisibilityChange = async () => {
      if (document.hidden && takingExam && !examSubmitted && currentUser) {
        const nextCount = tabSwitchCount + 1;
        setTabSwitchCount(nextCount);

        const progressData = {
          examId: takingExam.id,
          studentId: currentUser.uid,
          selectedAnswers: selectedAnswersRef.current,
          writtenAnswers: writtenAnswersRef.current,
          currentQuestionIndex: currentQuestionIndexRef.current,
          timeLeftSeconds: timeLeftSecondsRef.current,
          activeExamSection: activeExamSectionRef.current,
          flaggedQuestions: flaggedQuestionsRef.current,
          tabSwitchCount: nextCount,
          lastSavedAt: Date.now(),
        };

        try {
          localStorage.setItem(
            `rcns_exam_progress_${currentUser.uid}_${takingExam.id}`,
            JSON.stringify(progressData)
          );
        } catch {
          // ignore
        }

        try {
          await assignmentService.recordCandidateHeartbeat({
            examId: takingExam.id,
            studentId: currentUser.uid,
            studentName: userProfile?.name || studentProfile?.name,
            kmuRegistrationNo: studentProfile?.kmuRegistrationNo,
            answersCount: Object.keys(selectedAnswersRef.current).length,
            tabSwitchCount: nextCount,
            answers: selectedAnswersRef.current,
            writtenAnswers: writtenAnswersRef.current,
            currentQuestionIndex: currentQuestionIndexRef.current,
            timeLeftSeconds: timeLeftSecondsRef.current,
            activeExamSection: activeExamSectionRef.current,
            flaggedQuestions: flaggedQuestionsRef.current,
            batch: studentProfile?.batch || takingExam.batch,
            semester: studentProfile?.semester || takingExam.semester,
            program: studentProfile?.program || takingExam.program,
            examTitle: takingExam.title,
            examType: takingExam.type,
            subject: takingExam.subject,
          });
        } catch {
          // best-effort
        }

        setTabSwitchAlertOpen(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [takingExam?.id, examSubmitted, currentUser?.uid, userProfile?.name, studentProfile?.name]);

  /* Old anti-cheat dependencies removed to prevent re-attaching listeners every second
    };
  }, [
    takingExam?.id,
    examSubmitted,
    currentUser,
    userProfile,
    studentProfile,
    selectedAnswers,
    writtenAnswers,
    currentQuestionIndex,
    activeExamSection,
    timeLeftSeconds,
    flaggedQuestions,
    tabSwitchCount,
  ]);

  */
  // Heartbeat disabled: eliminates 99.9% of Firestore reads and writes
  useEffect(() => {
    if (!takingExam || examSubmitted || !currentUser || isExamLocked) return;

    // Heartbeat completely disabled to reduce reads and writes by 99.9%
    return;
    /*

    // Send immediate heartbeat
    assignmentService
      .recordCandidateHeartbeat({
        examId: takingExam.id,
        studentId: currentUser.uid,
        studentName: userProfile?.name || studentProfile?.name || 'Student Candidate',
        kmuRegistrationNo: studentProfile?.kmuRegistrationNo || '2026/KMU/RCNS/01',
        answersCount: answeredCount,
        tabSwitchCount,
        answers: selectedAnswers,
        writtenAnswers,
        currentQuestionIndex,
        timeLeftSeconds,
        activeExamSection,
        flaggedQuestions,
        batch: studentProfile?.batch || takingExam.batch,
        semester: studentProfile?.semester || takingExam.semester,
        program: studentProfile?.program || takingExam.program,
        examTitle: takingExam.title,
        examType: takingExam.type,
        subject: takingExam.subject,
      })
      .catch(() => {});

    // Periodic heartbeat every 15 seconds
    const interval = setInterval(() => {
      assignmentService
        .recordCandidateHeartbeat({
          examId: takingExam.id,
          studentId: currentUser.uid,
          studentName: userProfile?.name || studentProfile?.name || 'Student Candidate',
          kmuRegistrationNo: studentProfile?.kmuRegistrationNo || '2026/KMU/RCNS/01',
          answersCount: Object.keys(selectedAnswers).length,
          tabSwitchCount,
          answers: selectedAnswers,
          writtenAnswers: writtenAnswersRef.current,
          currentQuestionIndex: currentQuestionIndexRef.current,
          timeLeftSeconds: timeLeftSecondsRef.current,
          activeExamSection: activeExamSectionRef.current,
          flaggedQuestions: flaggedQuestionsRef.current,
          batch: studentProfile?.batch || takingExam.batch,
          semester: studentProfile?.semester || takingExam.semester,
          program: studentProfile?.program || takingExam.program,
          examTitle: takingExam.title,
          examType: takingExam.type,
          subject: takingExam.subject,
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
    */
  }, [
    takingExam?.id,
    examSubmitted,
    currentUser,
    userProfile,
    studentProfile,
    selectedAnswers,
    writtenAnswers,
    currentQuestionIndex,
    timeLeftSeconds,
    activeExamSection,
    flaggedQuestions,
    tabSwitchCount,
    // isExamLocked,
  ]);

  // Load authorized exams
  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      try {
        if (currentUser) {
          const authorized = await assignmentService.getAuthorizedExamsForStudent(
            currentUser.uid,
            studentProfile?.program || '',
            studentProfile?.semester || '',
            studentProfile?.batch || ''
          );
          if (isMounted) setExams(authorized);
        }
      } catch (err) {
        console.error('Error loading authorized student exams:', err);
      }
    };
    fetchExams();
    return () => {
      isMounted = false;
    };
  }, [currentUser, studentProfile]);

  // Filtered exams list, sorted newest assigned/created first (Requirement #9)
  const filteredExams = exams
    .filter((exam) => {
      // Tab filter
      if (activeTab === 'available' && exam.status !== 'active') return false;
      if (activeTab === 'scheduled' && exam.status !== 'scheduled') return false;
      if (activeTab === 'completed' && exam.status !== 'completed') return false;

      // Type filter
      if (typeFilter !== 'all' && exam.type !== typeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = exam.title.toLowerCase().includes(q);
        const matchSubject = (exam.subject || '').toLowerCase().includes(q);
        const matchTeacher = (exam.teacherName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchSubject && !matchTeacher) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const getMillis = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (typeof val?.toMillis === 'function') return val.toMillis();
        if (typeof val?.toDate === 'function') return val.toDate().getTime();
        const d = new Date(val).getTime();
        return isNaN(d) ? 0 : d;
      };
      const timeA = getMillis((a as any).assignedAt || a.createdAt || a.updatedAt || a.startAt);
      const timeB = getMillis((b as any).assignedAt || b.createdAt || b.updatedAt || b.startAt);
      return timeB - timeA;
    });

  // Countdown timer for taking exam - stops immediately during submission and avoids double-firing
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (takingExam && !examSubmitted && !isSubmitting && timeLeftSeconds > 0) {
      timer = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            // Trigger automatic submission outside state updater callback
            setTimeout(() => {
              if (!hasSubmittedRef.current && !isSubmittingRef.current) {
                handleFinalSubmit(true);
              }
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [takingExam?.id, examSubmitted, isSubmitting, timeLeftSeconds > 0]);

  // Real-time Invigilator Lock Listener (Feature 3: Teacher-Controlled Exam Lock for Misbehavior)
  useEffect(() => {
    if (!takingExam || examSubmitted || !currentUser) return;
    const assignmentId = `${takingExam.id}_${currentUser.uid}`;
    const assignRef = doc(db, 'assignments', assignmentId);

    const unsubscribe = onSnapshot(
      assignRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.isLocked === true) {
            setIsExamLocked(true);
            setExamLockReason(data.lockReason || 'Suspected academic irregularity or invigilator discretion');
          } else {
            setIsExamLocked(false);
            setExamLockReason(null);
          }
        }
      },
      (error) => {
        console.warn('Real-time assignment lock subscription note:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [takingExam?.id, examSubmitted, currentUser]);

  const handleStartExam = async (exam: Exam) => {
    // 1. Perform canonical student exam eligibility check & diagnostics
    const eligibility = checkStudentExamEligibility({
      exam,
      student: studentProfile,
      user: userProfile,
      nowMs: Date.now(),
      isDev: true,
    });

    // 2. If access check fails, show clear, distinct message without combined ambiguity
    if (!eligibility.allowed) {
      alert(eligibility.message);
      return;
    }

    const activeUid = currentUser?.uid || auth.currentUser?.uid;

    // 3. Inspect assignment for prior submission & code verification
    if (activeUid) {
      try {
        const assign = await assignmentService.getAssignmentById(`${exam.id}_${activeUid}`);
        if (assign) {
          if (assign.status === 'submitted' || assign.status === 'graded') {
            alert('Institutional Notice: You have already completed and submitted this examination.');
            return;
          }

          // Secret Exam Code Check (Requirements #2, #5, #7)
          const requiresCode = Boolean(exam.requiresSecretCode);
          const alreadyVerified = assign.codeVerified === true && assign.status === 'started';

          if (requiresCode && !alreadyVerified) {
            // Student must enter secret exam code before attempt can begin
            setCodeModalExam(exam);
            setIsCodeModalOpen(true);
            return;
          }
        } else if (exam.requiresSecretCode) {
          // No prior assignment record exists and exam requires code
          setCodeModalExam(exam);
          setIsCodeModalOpen(true);
          return;
        }
      } catch (checkErr) {
        console.warn('Assignment inspection note:', checkErr);
      }
    }

    // Launch active examination session
    await launchExamSession(exam);
  };

  const launchExamSession = async (exam: Exam) => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid;

    // 3. Ensure assignment document exists in Firestore for this eligible candidate
    if (activeUid) {
      try {
        await assignmentService.ensureStudentAssignment({
          examId: exam.id,
          studentId: activeUid,
          batch: studentProfile?.batch || exam.batch || '',
          semester: studentProfile?.semester || exam.semester || '',
          program: studentProfile?.program || exam.program || '',
          assignedBy: 'cohort-verification',
        });
      } catch (assignErr) {
        console.warn('Could not ensure candidate assignment doc:', assignErr);
      }
    }

    // 4. Restore previous state if candidate was disconnected, switched tabs, or exited (Requirement #1)
    let savedAnswers: Record<string | number, number> = {};
    let savedWritten: Record<string, StudentWrittenAnswer> = {};
    let savedIndex = 0;
    let savedTime = exam.duration * 60;
    let savedSection: 'mcq' | 'written' = 'mcq';
    let savedFlags: Record<number, boolean> = {};
    let savedSwitches = 0;
    let isResumed = false;
    let isLockedAttempt = false;
    let initialLockReason: string | null = null;

    if (activeUid) {
      // Step A: Inspect localStorage for latest in-memory draft
      try {
        const localKey = `rcns_exam_progress_${activeUid}_${exam.id}`;
        const localStr = localStorage.getItem(localKey);
        if (localStr) {
          const parsed = JSON.parse(localStr);
          if (parsed && parsed.examId === exam.id) {
            if (parsed.selectedAnswers && Object.keys(parsed.selectedAnswers).length > 0) {
              savedAnswers = parsed.selectedAnswers;
              isResumed = true;
            }
            if (parsed.writtenAnswers && Object.keys(parsed.writtenAnswers).length > 0) {
              savedWritten = parsed.writtenAnswers;
              isResumed = true;
            }
            if (parsed.currentQuestionIndex !== undefined) {
              savedIndex = Math.max(0, Number(parsed.currentQuestionIndex) || 0);
            }
            if (parsed.timeLeftSeconds !== undefined && Number(parsed.timeLeftSeconds) > 0) {
              savedTime = Number(parsed.timeLeftSeconds);
              isResumed = true;
            }
            if (parsed.activeExamSection) savedSection = parsed.activeExamSection;
            if (parsed.flaggedQuestions) savedFlags = parsed.flaggedQuestions;
            if (parsed.tabSwitchCount) savedSwitches = Number(parsed.tabSwitchCount) || 0;
          }
        }
      } catch {
        // ignore
      }

      // Step B: Inspect Firestore candidate assignment document
      try {
        const assign = await assignmentService.getAssignmentById(`${exam.id}_${activeUid}`);
        if (assign) {
          if (assign.status === 'submitted' || assign.status === 'graded') {
            alert('Institutional Notice: You have already completed and submitted this examination.');
            return;
          }
          if (assign.answers && Object.keys(assign.answers).length > 0) {
            savedAnswers = { ...assign.answers, ...savedAnswers };
            isResumed = true;
          }
          if (assign.writtenAnswers && Object.keys(assign.writtenAnswers).length > 0) {
            savedWritten = { ...assign.writtenAnswers, ...savedWritten };
            isResumed = true;
          }
          if (assign.currentQuestionIndex !== undefined && savedIndex === 0) {
            savedIndex = Math.max(0, Number(assign.currentQuestionIndex) || 0);
          }
          if (assign.timeLeftSeconds !== undefined && Number(assign.timeLeftSeconds) > 0 && savedTime === exam.duration * 60) {
            savedTime = Number(assign.timeLeftSeconds);
            isResumed = true;
          }
          if (assign.activeExamSection && savedSection === 'mcq') {
            savedSection = assign.activeExamSection;
          }
          if (assign.flaggedQuestions && Object.keys(savedFlags).length === 0) {
            if (Array.isArray(assign.flaggedQuestions)) {
              const flagObj: Record<number, boolean> = {};
              assign.flaggedQuestions.forEach((idx) => {
                flagObj[idx] = true;
              });
              savedFlags = flagObj;
            } else if (typeof assign.flaggedQuestions === 'object') {
              savedFlags = assign.flaggedQuestions as Record<number, boolean>;
            }
          }
          if (assign.tabSwitchCount !== undefined) {
            savedSwitches = Math.max(savedSwitches, Number(assign.tabSwitchCount) || 0);
          }
          if (assign.isLocked === true) {
            isLockedAttempt = true;
            initialLockReason = assign.lockReason || 'Suspected academic irregularity or invigilator discretion';
          }
        }
      } catch (checkErr) {
        console.warn('Could not inspect candidate assignment record:', checkErr);
      }
    }

    setTakingExam(exam);
    setIsExamLocked(isLockedAttempt);
    setExamLockReason(initialLockReason);
    setCurrentQuestionIndex(savedIndex);
    setSelectedAnswers(savedAnswers);
    selectedAnswersRef.current = savedAnswers;
    setFlaggedQuestions(savedFlags);
    setWrittenAnswers(savedWritten);
    writtenAnswersRef.current = savedWritten;
    setActiveExamSection(savedSection);
    setTimeLeftSeconds(savedTime);
    setTabSwitchCount(savedSwitches);
    setExamSubmitted(false);
    isSubmittingRef.current = false;
    hasSubmittedRef.current = false;
    setExamScoreSummary(null);
    setSubmissionError(null);
    setIsLoadingQuestions(true);
    setExamQuestionsError(null);

    if (isResumed) {
      const minsLeft = Math.floor(savedTime / 60);
      const secsLeft = savedTime % 60;
      setResumeNotice(
        `✓ Examination Resumed: Continuing from Question ${savedIndex + 1} with ${minsLeft}m ${secsLeft}s remaining. Your previous responses have been preserved.`
      );
    } else {
      setResumeNotice(null);
    }

    try {
      const [questions, wQuestions] = await Promise.all([
        questionService.getStudentQuestions(exam.id, activeUid),
        writtenQuestionService.getStudentWrittenQuestions(exam.id, activeUid),
      ]);
      setExamQuestions(questions);
      setWrittenQuestions(wQuestions);
      if (questions.length === 0 && wQuestions.length === 0) {
        setExamQuestionsError('No examination questions were found for this paper. Please contact your course instructor.');
      }
    } catch (err: any) {
      console.error('Error loading student sanitized questions:', err?.message || err);
      const isPermissionErr =
        err?.code === 'permission-denied' ||
        (err?.message && err.message.toLowerCase().includes('permission'));

      const isInternalOrFunctionErr =
        err?.code === 'internal' ||
        err?.code === 'functions/internal' ||
        err?.code === 'functions/unavailable' ||
        err?.code === 'functions/not-found' ||
        (err?.message &&
          (err.message.toLowerCase() === 'internal' ||
            err.message.toLowerCase().includes('functions/internal') ||
            err.message.toLowerCase().includes('internal error')));

      let friendlyMsg = err?.message || 'Unable to load examination questions from database.';
      if (isInternalOrFunctionErr) {
        friendlyMsg =
          'Examination questions are temporarily unavailable. Please verify that the examination paper has been published by your instructor, or contact your examination proctor.';
      } else if (isPermissionErr) {
        // Re-evaluate eligibility for precise, non-combined explanation
        const recheck = checkStudentExamEligibility({
          exam,
          student: studentProfile,
          user: userProfile,
          nowMs: Date.now(),
          isDev: true,
        });

        if (!recheck.allowed) {
          friendlyMsg = recheck.message;
        } else {
          friendlyMsg =
            'Access restricted: Database permission denied loading examination questions. Please contact your examination proctor to verify registration.';
        }
      }
      setExamQuestionsError(friendlyMsg);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleSelectOption = (optIndex: number) => {
    if (isExamLocked) return;
    setSelectedAnswers((prev) => {
      const updated = {
        ...prev,
        [currentQuestionIndex]: optIndex,
      };
      selectedAnswersRef.current = updated;
      // Keep local progress updated
      if (currentUser && takingExam) {
        try {
          const key = `rcns_exam_progress_${currentUser.uid}_${takingExam.id}`;
          const current = localStorage.getItem(key);
          const data = current ? JSON.parse(current) : {};
          localStorage.setItem(
            key,
            JSON.stringify({ ...data, selectedAnswers: updated, lastSavedAt: Date.now() })
          );
        } catch {}
      }
      return updated;
    });
  };

  const handleToggleFlag = () => {
    if (isExamLocked) return;
    setFlaggedQuestions((prev) => {
      const updated = {
        ...prev,
        [currentQuestionIndex]: !prev[currentQuestionIndex],
      };
      if (currentUser && takingExam) {
        try {
          const key = `rcns_exam_progress_${currentUser.uid}_${takingExam.id}`;
          const current = localStorage.getItem(key);
          const data = current ? JSON.parse(current) : {};
          localStorage.setItem(
            key,
            JSON.stringify({ ...data, flaggedQuestions: updated, lastSavedAt: Date.now() })
          );
        } catch {}
      }
      return updated;
    });
  };

  const handleClearAnswer = () => {
    if (isExamLocked) return;
    setSelectedAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestionIndex];
      selectedAnswersRef.current = copy;
      if (currentUser && takingExam) {
        try {
          const key = `rcns_exam_progress_${currentUser.uid}_${takingExam.id}`;
          const current = localStorage.getItem(key);
          const data = current ? JSON.parse(current) : {};
          localStorage.setItem(
            key,
            JSON.stringify({ ...data, selectedAnswers: copy, lastSavedAt: Date.now() })
          );
        } catch {}
      }
      return copy;
    });
  };

  const handleWrittenAnswerChange = (
    questionId: string,
    qType: 'short' | 'long',
    questionText: string,
    text: string
  ) => {
    if (isExamLocked) return;
    setWrittenAnswers((prev) => {
      const updated = {
        ...prev,
        [questionId]: {
          questionId,
          type: qType,
          questionText,
          answerText: text,
          wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
          submittedAt: new Date().toISOString(),
        },
      };
      writtenAnswersRef.current = updated;
      if (currentUser && takingExam) {
        try {
          const key = `rcns_exam_progress_${currentUser.uid}_${takingExam.id}`;
          const current = localStorage.getItem(key);
          const data = current ? JSON.parse(current) : {};
          localStorage.setItem(
            key,
            JSON.stringify({ ...data, writtenAnswers: updated, lastSavedAt: Date.now() })
          );
        } catch {}
      }
      return updated;
    });
  };

  // Synchronize answer refs whenever React state updates
  useEffect(() => {
    selectedAnswersRef.current = selectedAnswers;
  }, [selectedAnswers]);

  useEffect(() => {
    writtenAnswersRef.current = writtenAnswers;
    timeLeftSecondsRef.current = timeLeftSeconds;
    tabSwitchCountRef.current = tabSwitchCount;
    currentQuestionIndexRef.current = currentQuestionIndex;
    activeExamSectionRef.current = activeExamSection;
    flaggedQuestionsRef.current = flaggedQuestions;
  }, [writtenAnswers, timeLeftSeconds, tabSwitchCount, currentQuestionIndex, activeExamSection, flaggedQuestions]);

  const handleFinalSubmit = async (forceOnTimeout = false) => {
    const activeUser = currentUser || auth.currentUser;
    console.log('[handleFinalSubmit] Submission triggered:', {
      hasExam: Boolean(takingExam),
      activeUser: activeUser?.uid,
      isSubmitting: isSubmittingRef.current,
      hasSubmitted: hasSubmittedRef.current,
      forceOnTimeout,
    });

    if (isSubmittingRef.current || hasSubmittedRef.current || !takingExam || !activeUser) {
      console.warn('[handleFinalSubmit] Submission cancelled due to state guard');
      return;
    }

    // Strict Requirement: Manual exam submission is blocked until ALL MCQs are completed
    if (!forceOnTimeout && examQuestions.length > 0) {
      let finalCheckAnswers: Record<string | number, number> = {
        ...selectedAnswersRef.current,
        ...selectedAnswers,
      };
      try {
        const key = `rcns_exam_progress_${activeUser.uid}_${takingExam.id}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.selectedAnswers && typeof parsed.selectedAnswers === 'object') {
            finalCheckAnswers = { ...parsed.selectedAnswers, ...finalCheckAnswers };
          }
        }
      } catch {}

      const checkAnsweredCount = examQuestions.filter((q, idx) => {
        const v1 = finalCheckAnswers[idx];
        const v2 = q.id ? finalCheckAnswers[q.id] : undefined;
        return (
          (v1 !== undefined && v1 !== null && v1 !== -1 && String(v1) !== '-1') ||
          (v2 !== undefined && v2 !== null && v2 !== -1 && String(v2) !== '-1')
        );
      }).length;

      if (checkAnsweredCount < examQuestions.length) {
        console.warn('[handleFinalSubmit] Blocked submission: not all MCQs are answered', {
          answered: checkAnsweredCount,
          total: examQuestions.length,
        });
        setShowSubmitConfirm(false);
        setShowIncompleteAlert(true);
        return;
      }
    }

    // Immediately acquire submission lock and show loading state
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      // 1. Retrieve latest answers from refs with fallback to state and localStorage
      let finalSelected: Record<string | number, number> = { ...selectedAnswersRef.current };
      let finalWritten: Record<string, StudentWrittenAnswer> = { ...writtenAnswersRef.current };

      if (Object.keys(finalSelected).length === 0 && Object.keys(selectedAnswers).length > 0) {
        finalSelected = { ...selectedAnswers };
      }
      if (Object.keys(finalWritten).length === 0 && Object.keys(writtenAnswers).length > 0) {
        finalWritten = { ...writtenAnswers };
      }

      try {
        const key = `rcns_exam_progress_${activeUser.uid}_${takingExam.id}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.selectedAnswers && typeof parsed.selectedAnswers === 'object') {
            finalSelected = { ...parsed.selectedAnswers, ...finalSelected };
          }
          if (parsed.writtenAnswers && typeof parsed.writtenAnswers === 'object') {
            finalWritten = { ...parsed.writtenAnswers, ...finalWritten };
          }
        }
      } catch {
        // best-effort
      }

      // Normalize MCQ answers: map each answered question under all candidate keys for robust grading
      const normalizedMcqAnswers: Record<string, any> = {};
      let totalAttemptedMcqs = 0;
      examQuestions.forEach((q, idx) => {
        const valIdx = finalSelected[idx];
        const valId = q.id ? finalSelected[q.id] : undefined;
        const chosenVal =
          valIdx !== undefined && valIdx !== -1 && String(valIdx) !== '-1'
            ? valIdx
            : valId !== undefined && valId !== -1 && String(valId) !== '-1'
            ? valId
            : undefined;

        if (chosenVal !== undefined) {
          totalAttemptedMcqs++;
          normalizedMcqAnswers[idx] = chosenVal;
          normalizedMcqAnswers[String(idx)] = chosenVal;
          normalizedMcqAnswers[idx + 1] = chosenVal;
          normalizedMcqAnswers[String(idx + 1)] = chosenVal;
          normalizedMcqAnswers[`q-${idx + 1}`] = chosenVal;
          normalizedMcqAnswers[`q${idx + 1}`] = chosenVal;
          if (q.id) {
            normalizedMcqAnswers[q.id] = chosenVal;
          }
          if (q.order !== undefined) {
            normalizedMcqAnswers[q.order] = chosenVal;
            normalizedMcqAnswers[String(q.order)] = chosenVal;
            normalizedMcqAnswers[`q-${q.order}`] = chosenVal;
            normalizedMcqAnswers[`q${q.order}`] = chosenVal;
          }
        }
      });

      // Calculate accurate answered questions count (exactly the number of attempted questions)
      const answeredCount = totalAttemptedMcqs;

      const writtenAnsweredCount = Object.values(finalWritten).filter(
        (a) => a && a.answerText && a.answerText.trim().length > 0
      ).length;

      const result = await resultService.submitExamAttempt({
        studentId: activeUser.uid,
        studentName: userProfile?.name || studentProfile?.name || 'Student Candidate',
        kmuRegistrationNo: studentProfile?.kmuRegistrationNo || '',
        fatherName: studentProfile?.fatherName || (userProfile as any)?.fatherName || '',
        examId: takingExam.id,
        examTitle: takingExam.title,
        examType: takingExam.type,
        subject: takingExam.subject || 'Clinical Assessment',
        program: studentProfile?.program || takingExam.program,
        semester: studentProfile?.semester || takingExam.semester,
        batch: studentProfile?.batch || '',
        answers: normalizedMcqAnswers,
        writtenAnswers: finalWritten,
      });

      // Clear local auto-saved draft
      try {
        localStorage.removeItem(`rcns_exam_progress_${activeUser.uid}_${takingExam.id}`);
      } catch {
        // ignore
      }

      // Finalize submission lock and stop timer
      hasSubmittedRef.current = true;
      setTimeLeftSeconds(0);
      setShowSubmitConfirm(false);
      const hasWritten = writtenQuestions.length > 0 || Boolean(result.requiresWrittenGrading);

      setExamSubmitted(true);
      setExamScoreSummary({
        score: result.marks,
        total: result.totalMarks,
        percentage: result.percentage,
        passed: result.passed ?? result.percentage >= 50,
        grade: result.grade || '',
        status: hasWritten ? 'pending' : (result.status || 'graded'),
        answersCount: (result.answeredMCQs ?? answeredCount) + writtenAnsweredCount,
        totalQuestions: examQuestions.length + writtenQuestions.length,
        correctCount: result.correctCount ?? result.correctMCQs,
        incorrectCount: result.incorrectMCQs,
      });

      // Update local exam status to completed
      setExams((prev) =>
        prev.map((e) => (e.id === takingExam.id ? { ...e, status: 'completed' } : e))
      );
    } catch (err: any) {
      console.error('Error submitting exam:', err);
      // Re-enable submission on error so student can safely retry with answers & remaining time preserved
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setShowSubmitConfirm(false);
      setSubmissionError(
        err?.message || 'Failed to submit examination answers. Please check your internet connection and click retry.'
      );
    } finally {
      if (hasSubmittedRef.current) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        setShowSubmitConfirm(false);
      }
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Questions for current exam
  const currentExamQuestions = examQuestions;
  const currentQuestion = currentExamQuestions[currentQuestionIndex];
  const totalQuestions = currentExamQuestions.length;

  // Helper: check if a specific question is answered
  const isQuestionAnswered = (idx: number, qId?: string) => {
    const byIdx = selectedAnswers[idx];
    const byId = qId ? selectedAnswers[qId] : undefined;
    return (
      (byIdx !== undefined && byIdx !== null && byIdx !== -1 && String(byIdx) !== '-1') ||
      (byId !== undefined && byId !== null && byId !== -1 && String(byId) !== '-1')
    );
  };

  const answeredCount = currentExamQuestions.filter(
    (q, idx) => isQuestionAnswered(idx, q.id)
  ).length;

  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const allMcqsCompleted = totalQuestions === 0 || answeredCount >= totalQuestions;
  const firstUnansweredIndex = currentExamQuestions.findIndex((q, idx) => !isQuestionAnswered(idx, q.id));

  // Handler to open confirm dialog or block with incomplete alert
  const handleAttemptSubmit = () => {
    if (isExamLocked) return;
    if (examQuestions.length > 0 && !allMcqsCompleted) {
      setShowIncompleteAlert(true);
      return;
    }
    setShowSubmitConfirm(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Examination Portal
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            Official assessments, mid-terms, and quizzes for ROYAL COLLEGE OF NURSING SWAT.
          </p>
        </div>
      </div>

      {/* Tabs & Filters */}
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
            { id: 'available', label: 'Available Now', badge: exams.filter((e) => e.status === 'active').length },
            { id: 'scheduled', label: 'Upcoming / Scheduled', badge: exams.filter((e) => e.status === 'scheduled').length },
            { id: 'completed', label: 'Completed', badge: exams.filter((e) => e.status === 'completed').length },
          ]}
        />

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search exam title or subject..."
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

      {/* Exams Grid */}
      {filteredExams.length === 0 ? (
        <EmptyState
          title="No Examinations Found"
          description="No examination matches your current filter and search criteria."
          actionLabel="Clear Filters"
          onAction={() => {
            setActiveTab('all');
            setTypeFilter('all');
            setSearchQuery('');
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
          {filteredExams.map((exam) => {
            const isAvailable = exam.status === 'active';
            const isCompleted = exam.status === 'completed';
            const isScheduled = exam.status === 'scheduled';

            const statusBadgeConfig = {
              active: { variant: 'success' as const, label: 'Available Now' },
              scheduled: { variant: 'warning' as const, label: 'Scheduled' },
              completed: { variant: 'default' as const, label: 'Completed' },
              draft: { variant: 'outline' as const, label: 'Draft' },
              archived: { variant: 'outline' as const, label: 'Archived' },
            };

            const typeColor =
              exam.type === 'midterm' ? '#d97706' : exam.type === 'quiz' ? '#0d9488' : '#0e498b';

            return (
              <Card
                key={exam.id}
                hoverable
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${typeColor}`,
                }}
              >
                <div>
                  {/* Card Header Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge variant={statusBadgeConfig[exam.status].variant}>
                        {statusBadgeConfig[exam.status].label}
                      </Badge>
                      {exam.requiresSecretCode && (
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: '#d97706',
                            color: '#b45309',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: '#fffbeb',
                          }}
                        >
                          🔒 Code Protected
                        </Badge>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: typeColor,
                        backgroundColor: `${typeColor}15`,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {exam.type}
                    </span>
                  </div>

                  {/* Title & Subject */}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-slate-900)', lineHeight: 1.3 }}>
                    {exam.title}
                  </h3>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary-700)', marginTop: '0.25rem' }}>
                    {exam.subject}
                  </div>

                  <p style={{ fontSize: '0.825rem', color: 'var(--color-slate-500)', marginTop: '0.5rem', lineHeight: 1.45 }}>
                    {exam.description}
                  </p>

                  {/* Meta Information */}
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-slate-50)',
                      borderRadius: 'var(--radius-md)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--color-slate-400)' }}>Duration:</span>{' '}
                      <strong>{exam.duration} Mins</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-slate-400)' }}>Total Marks:</span>{' '}
                      <strong>{exam.totalMarks}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-slate-400)' }}>Passing Marks:</span>{' '}
                      <strong>{exam.passingMarks}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-slate-400)' }}>Questions:</span>{' '}
                      <strong>{exam.questionCount} MCQs</strong>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-slate-100)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', marginBottom: '0.65rem' }}>
                    <span>Schedule: </span>
                    <strong style={{ color: 'var(--color-slate-700)' }}>{formatPakistanDateTime(exam.startAt)}</strong>
                  </div>

                  {isAvailable && (
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => handleStartExam(exam)}
                      style={{ backgroundColor: '#0f2744' }}
                    >
                      {currentUser &&
                      ((exam as any).assignmentStatus === 'started' ||
                        localStorage.getItem(`rcns_exam_progress_${currentUser.uid}_${exam.id}`))
                        ? 'Resume Examination Now →'
                        : 'Start Examination Now →'}
                    </Button>
                  )}

                  {isScheduled && (
                    <Button variant="outline" fullWidth disabled>
                      Upcoming • Opens at {formatPakistanDateTime(exam.startAt)}
                    </Button>
                  )}

                  {isCompleted && (
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => (window.location.href = '/student/results')}
                    >
                      Examination Closed • View Result
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          LIVE FULL-SCREEN EXAMINATION ATTEMPT PORTAL (Laptop No-Scroll, Mobile/iPad Responsive)
          ========================================================================= */}
      {takingExam && (
        <div
          className="rcns-fullscreen-exam-portal"
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100dvh',
            backgroundColor: '#0f172a',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Invigilator Locked Overlay (Feature 3: Teacher-Controlled Exam Lock for Misbehavior) */}
          {isExamLocked && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.94)',
                backdropFilter: 'blur(8px)',
                zIndex: 100000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
              }}
            >
              <div
                style={{
                  maxWidth: '560px',
                  width: '100%',
                  backgroundColor: '#ffffff',
                  borderRadius: '1rem',
                  padding: '2.25rem 2rem',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  textAlign: 'center',
                  border: '2px solid #ef4444',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>

                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f2744', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  ROYAL COLLEGE OF NURSING SWAT • EXAMINATION SECURITY
                </div>

                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.75rem', lineHeight: 1.35 }}>
                  Your examination has been temporarily locked by the invigilator. Please contact your teacher.
                </h2>

                {examLockReason && (
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: '#fef2f2',
                      borderRadius: '0.5rem',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      marginBottom: '1rem',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ textTransform: 'uppercase', fontSize: '0.72rem', display: 'block', color: '#b91c1c', fontWeight: 700 }}>
                      Invigilator Stated Reason:
                    </span>
                    {examLockReason}
                  </div>
                )}

                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    padding: '0.85rem 1rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.85rem',
                    color: '#475569',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.25rem' }}>
                    ⏱ Official Examination Timer Continues: {formatTimer(timeLeftSeconds)} remaining
                  </div>
                  All previously selected answers are securely recorded and preserved. Answering questions, changing answers, and flagging are disabled while this lock is active.
                </div>

                <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                  Do not refresh or close the browser. Once authorized by your teacher, your examination session and remaining time will be immediately restored.
                </div>
              </div>
            </div>
          )}

          {/* Top Examination Proctoring Bar */}
          <div
            className="rcns-exam-proctor-header"
            style={{
              minHeight: '56px',
              backgroundColor: '#0f2744',
              color: '#ffffff',
              padding: '0.4rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              flexShrink: 0,
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Institution Brand & Subject */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#1e3a8a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#93c5fd',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  flexShrink: 0,
                }}
              >
                RC
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {takingExam.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {takingExam.subject} • Candidate: {studentProfile?.kmuRegistrationNo || 'KMU Verified'}
                </div>
              </div>
            </div>

            {/* Right: Timer, Submission & Tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Question count (desktop) */}
              <div className="exam-header-qcount" style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
                <span style={{ color: '#94a3b8' }}>Status: </span>
                <strong style={{ color: '#ffffff' }}>
                  {activeExamSection === 'mcq'
                    ? `MCQ ${currentQuestionIndex + 1}/${totalQuestions}`
                    : `Written (${Object.values(writtenAnswers).filter((a) => a.answerText?.trim()).length}/${writtenQuestions.length})`}
                </strong>
                <span style={{ fontSize: '0.75rem', color: '#10b981', marginLeft: '0.35rem' }}>
                  ({answeredCount} MCQs done)
                </span>
              </div>

              {/* Countdown Timer Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: timeLeftSeconds < 300 ? '#dc2626' : 'rgba(255, 255, 255, 0.15)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  color: '#ffffff',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{formatTimer(timeLeftSeconds)}</span>
              </div>

              {/* Question Completion Progress Indicator */}
              <div
                style={{
                  backgroundColor: allMcqsCompleted ? '#ecfdf5' : '#f8fafc',
                  border: `1px solid ${allMcqsCompleted ? '#a7f3d0' : '#e2e8f0'}`,
                  color: allMcqsCompleted ? '#065f46' : '#475569',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  flexShrink: 0,
                }}
              >
                {allMcqsCompleted ? (
                  <span>✓ All MCQs Completed</span>
                ) : (
                  <span>MCQs: {answeredCount}/{totalQuestions}</span>
                )}
              </div>

              {/* Mobile Palette Toggle Button */}
              <button
                type="button"
                className="exam-mobile-palette-btn"
                onClick={() => setMobilePaletteOpen((v) => !v)}
                style={{
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                📋 Palette
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="exam-header-fullscreen-btn"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  flexShrink: 0,
                }}
              >
                {isFullscreen ? '⤢ Normal' : '⛶ Fullscreen'}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ height: '3px', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)', flexShrink: 0 }}>
            <div
              style={{
                height: '100%',
                width: `${(answeredCount / (totalQuestions || 1)) * 100}%`,
                backgroundColor: '#10b981',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* Resumption Banner Notice */}
          {resumeNotice && (
            <div
              style={{
                padding: '0.45rem 1rem',
                backgroundColor: '#ecfdf5',
                borderBottom: '1px solid #a7f3d0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.8rem',
                color: '#065f46',
                flexShrink: 0,
              }}
            >
              <span>{resumeNotice}</span>
              <button
                type="button"
                onClick={() => setResumeNotice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#047857', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Submission Error Banner with Direct Retry (Requirement #3) */}
          {submissionError && (
            <div
              style={{
                padding: '0.65rem 1rem',
                backgroundColor: '#fef2f2',
                borderBottom: '1px solid #fecaca',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.825rem',
                color: '#dc2626',
                flexShrink: 0,
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span>⚠️ {submissionError}</span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleFinalSubmit(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Retrying...' : 'Retry Submit'}
              </Button>
            </div>
          )}

          {/* Main Area */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#f8fafc',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {examSubmitted && examScoreSummary ? (
              /* Post-Submission Result Preview Card */
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.5rem',
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--color-slate-200)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '2.5rem 2rem',
                    maxWidth: '560px',
                    width: '100%',
                    textAlign: 'center',
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
                      margin: '0 auto 1.25rem',
                    }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>

                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                    Examination Completed &amp; Evaluated!
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)', marginTop: '0.35rem' }}>
                    Aapka result direct calculate ho chuka hai. Royal College of Nursing Swat academic repository par record mehfooz hai.
                  </p>

                  {/* Primary Score & Performance KPI Card */}
                  <div
                    style={{
                      margin: '1.5rem 0 1rem',
                      padding: '1.25rem',
                      backgroundColor: 'var(--color-slate-50)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-slate-200)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                      gap: '0.85rem',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Marks Obtained</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f2744', marginTop: '0.15rem' }}>
                        {examScoreSummary.score} / {examScoreSummary.total}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Percentage</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: examScoreSummary.passed ? '#059669' : '#dc2626', marginTop: '0.15rem' }}>
                        {examScoreSummary.percentage}%
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Letter Grade</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f2744', marginTop: '0.15rem' }}>
                        {examScoreSummary.grade || (examScoreSummary.percentage >= 80 ? 'A+' : examScoreSummary.percentage >= 70 ? 'A' : examScoreSummary.percentage >= 60 ? 'B' : examScoreSummary.percentage >= 50 ? 'C' : 'F')}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Result Status</span>
                      <div style={{ marginTop: '0.25rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.3rem 0.85rem',
                            borderRadius: '999px',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            backgroundColor: examScoreSummary.passed ? '#ecfdf5' : '#fef2f2',
                            color: examScoreSummary.passed ? '#059669' : '#dc2626',
                            border: `1px solid ${examScoreSummary.passed ? '#a7f3d0' : '#fecaca'}`,
                          }}
                        >
                          {examScoreSummary.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Metrics Breakdown */}
                  <div
                    style={{
                      marginBottom: '1.5rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#ffffff',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-slate-200)',
                      display: 'flex',
                      justifyContent: 'space-around',
                      fontSize: '0.825rem',
                      color: 'var(--color-slate-600)',
                    }}
                  >
                    <div>
                      <span>Total Questions: </span>
                      <strong style={{ color: '#0f2744' }}>{examScoreSummary.totalQuestions ?? totalQuestions}</strong>
                    </div>
                    <div>
                      <span>Answered: </span>
                      <strong style={{ color: '#047857' }}>{examScoreSummary.answersCount ?? answeredCount}</strong>
                    </div>
                    {examScoreSummary.correctCount !== undefined && (
                      <div>
                        <span>Correct: </span>
                        <strong style={{ color: '#059669' }}>{examScoreSummary.correctCount}</strong>
                      </div>
                    )}
                    {examScoreSummary.incorrectCount !== undefined && (
                      <div>
                        <span>Incorrect: </span>
                        <strong style={{ color: '#dc2626' }}>{examScoreSummary.incorrectCount}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => {
                        if (document.fullscreenElement) {
                          document.exitFullscreen().catch(() => {});
                        }
                        navigate('/student/results');
                      }}
                      style={{ backgroundColor: '#059669', borderColor: '#059669', fontWeight: 700 }}
                    >
                      View Academic Results &amp; Transcripts →
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => {
                        setTakingExam(null);
                        if (document.fullscreenElement) {
                          document.exitFullscreen().catch(() => {});
                        }
                      }}
                      style={{ fontWeight: 600 }}
                    >
                      Return to Examinations Dashboard
                    </Button>
                  </div>
                </div>
              </div>
            ) : isLoadingQuestions ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Card style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <LoadingSpinner size="lg" />
                  <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                    Preparing examination paper &amp; question palette...
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', maxWidth: '400px' }}>
                    Loading questions securely from the examination repository.
                  </p>
                </Card>
              </div>
            ) : examQuestionsError ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '500px' }}>
                  <Alert type="warning">{examQuestionsError}</Alert>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Button variant="primary" onClick={() => setTakingExam(null)} style={{ backgroundColor: '#0f2744' }}>
                      Return to Exams List
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              /* Two-Column Question & Palette Layout (No-Scroll Fit on Laptop, Fluid on Mobile) */
              <div
                className="rcns-exam-layout-grid"
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: '1fr 280px',
                  gap: '1rem',
                  padding: '0.85rem 1.25rem',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              >
                {/* Left Column: Question Card & Options */}
                <div
                  className="rcns-exam-left-column"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-slate-200)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '1.1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Section Switcher (if written questions exist) */}
                  {writtenQuestions.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--color-slate-100)', padding: '0.25rem', borderRadius: 'var(--radius-md)', marginBottom: '0.65rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setActiveExamSection('mcq')}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          backgroundColor: activeExamSection === 'mcq' ? '#ffffff' : 'transparent',
                          fontWeight: activeExamSection === 'mcq' ? 800 : 600,
                          color: activeExamSection === 'mcq' ? '#0f2744' : 'var(--color-slate-600)',
                          boxShadow: activeExamSection === 'mcq' ? 'var(--shadow-xs)' : 'none',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                        }}
                      >
                        📝 Section A: MCQs ({examQuestions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveExamSection('written')}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          backgroundColor: activeExamSection === 'written' ? '#ffffff' : 'transparent',
                          fontWeight: activeExamSection === 'written' ? 800 : 600,
                          color: activeExamSection === 'written' ? '#0f2744' : 'var(--color-slate-600)',
                          boxShadow: activeExamSection === 'written' ? 'var(--shadow-xs)' : 'none',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                        }}
                      >
                        ✍️ Section B &amp; C: Written ({writtenQuestions.length})
                      </button>
                    </div>
                  )}

                  {activeExamSection === 'written' && writtenQuestions.length > 0 ? (
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '4px' }}>
                      <WrittenQuestionsSection
                        questions={writtenQuestions}
                        writtenAnswers={writtenAnswers}
                        onAnswerChange={handleWrittenAnswerChange}
                      />

                      {/* Prominent Submission & Navigation Bar inside Written Section (Requirement #2) */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          padding: '1rem',
                          backgroundColor: '#f8fafc',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-slate-200)',
                          marginTop: '0.5rem',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveExamSection('mcq')}
                          disabled={examQuestions.length === 0}
                        >
                          ← Return to Section A: MCQs
                        </Button>
                        <Button
                          variant="danger"
                          size="md"
                          onClick={() => {
                            console.log('[StudentExamsPage] Written section bottom Submit Exam button clicked');
                            handleAttemptSubmit();
                          }}
                          disabled={isSubmitting}
                          style={{ fontWeight: 700 }}
                        >
                          {isSubmitting ? 'Submitting...' : 'Finish & Submit Entire Exam →'}
                        </Button>
                      </div>
                    </div>
                  ) : currentQuestion ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
                      {/* Question Top Meta */}
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <Badge variant="primary">Question {currentQuestionIndex + 1} of {totalQuestions}</Badge>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-slate-600)' }}>
                            Marks: {currentQuestion.marks}
                          </span>
                        </div>

                        {/* Question Text */}
                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: 'var(--color-slate-900)',
                            lineHeight: 1.4,
                            padding: '0.75rem 0.9rem',
                            backgroundColor: 'var(--color-slate-50)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-slate-200)',
                            maxHeight: '120px',
                            overflowY: 'auto',
                          }}
                        >
                          {currentQuestion.question}
                        </div>
                      </div>

                      {/* Options List: sized to fit laptop viewport */}
                      <div
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                          margin: '0.5rem 0',
                          paddingRight: '2px',
                        }}
                      >
                        {currentQuestion.options.map((option, idx) => {
                          const optText = typeof option === 'string' ? option : option.text;
                          const isSelected = selectedAnswers[currentQuestionIndex] === idx;
                          const optionLetter = String.fromCharCode(65 + idx);

                          return (
                            <div
                              key={idx}
                              onClick={() => handleSelectOption(idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.6rem 0.85rem',
                                borderRadius: 'var(--radius-md)',
                                border: `2px solid ${isSelected ? '#0f2744' : 'var(--color-slate-200)'}`,
                                backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  backgroundColor: isSelected ? '#0f2744' : 'var(--color-slate-100)',
                                  color: isSelected ? '#ffffff' : 'var(--color-slate-700)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  flexShrink: 0,
                                }}
                              >
                                {optionLetter}
                              </div>
                              <span style={{ fontSize: '0.9rem', color: 'var(--color-slate-800)', fontWeight: isSelected ? 600 : 400 }}>
                                {optText}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Controls Bottom Bar: Ubiquitous Submit Exam Access (Requirement #2) */}
                      <div
                        style={{
                          flexShrink: 0,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '0.65rem',
                          borderTop: '1px solid var(--color-slate-200)',
                          flexWrap: 'wrap',
                          gap: '0.4rem',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                            disabled={currentQuestionIndex === 0}
                          >
                            ← Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                            disabled={currentQuestionIndex === totalQuestions - 1}
                          >
                            Next →
                          </Button>
                          {writtenQuestions.length > 0 && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setActiveExamSection('written')}
                            >
                              Go to Written Section →
                            </Button>
                          )}
                          {allMcqsCompleted && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={handleAttemptSubmit}
                              disabled={isSubmitting}
                              style={{ fontWeight: 800, backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                              title="Submit your completed exam paper"
                            >
                              {isSubmitting ? 'Submitting...' : '✓ Submit Exam'}
                            </Button>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <Button
                            variant={flaggedQuestions[currentQuestionIndex] ? 'warning' : 'ghost'}
                            size="sm"
                            onClick={handleToggleFlag}
                          >
                            {flaggedQuestions[currentQuestionIndex] ? '🚩 Flagged' : '🏳 Flag'}
                          </Button>
                          {selectedAnswers[currentQuestionIndex] !== undefined && (
                            <Button variant="ghost" size="sm" onClick={handleClearAnswer}>
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Right Column: Question Palette & Finish Button */}
                <div
                  className={`rcns-palette-sidebar ${mobilePaletteOpen ? 'palette-mobile-show' : ''}`}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-slate-200)',
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-slate-700)', margin: 0 }}>
                        Question Palette
                      </h4>
                      <button
                        type="button"
                        className="palette-close-mobile"
                        onClick={() => setMobilePaletteOpen(false)}
                        style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b' }}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Question Numbers Grid (Smooth internal scroll for large sets) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '0.35rem',
                        overflowY: 'auto',
                        paddingRight: '3px',
                        flex: 1,
                        maxHeight: 'calc(100vh - 280px)',
                      }}
                    >
                      {currentExamQuestions.map((_, qIdx) => {
                        const isAnswered = selectedAnswers[qIdx] !== undefined;
                        const isCurrent = currentQuestionIndex === qIdx;
                        const isFlagged = flaggedQuestions[qIdx];

                        let bg = '#ffffff';
                        let color = 'var(--color-slate-700)';
                        let border = '1px solid var(--color-slate-300)';

                        if (isAnswered) {
                          bg = '#059669';
                          color = '#ffffff';
                          border = '1px solid #059669';
                        }
                        if (isFlagged) {
                          bg = '#d97706';
                          color = '#ffffff';
                          border = '1px solid #d97706';
                        }
                        if (isCurrent) {
                          border = '2px solid #0f2744';
                        }

                        return (
                          <button
                            key={qIdx}
                            type="button"
                            onClick={() => {
                              setCurrentQuestionIndex(qIdx);
                              setMobilePaletteOpen(false);
                            }}
                            style={{
                              height: '32px',
                              borderRadius: 'var(--radius-sm)',
                              border,
                              backgroundColor: bg,
                              color,
                              fontWeight: isCurrent ? 800 : 600,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {qIdx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Palette Legend */}
                    <div style={{ marginTop: '0.65rem', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', color: 'var(--color-slate-600)', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ width: '8px', height: '8px', backgroundColor: '#059669', borderRadius: '2px' }} />
                        <span>Answered ({answeredCount})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ width: '8px', height: '8px', backgroundColor: '#d97706', borderRadius: '2px' }} />
                        <span>Flagged ({Object.keys(flaggedQuestions).filter((k) => flaggedQuestions[Number(k)]).length})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ width: '8px', height: '8px', backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '2px' }} />
                        <span>Unanswered ({totalQuestions - answeredCount})</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Exam Button: ONLY rendered once all MCQs are attempted */}
                  {allMcqsCompleted && (
                    <div style={{ marginTop: '0.75rem', flexShrink: 0 }}>
                      <Button
                        variant="danger"
                        fullWidth
                        size="sm"
                        onClick={() => {
                          console.log('[StudentExamsPage] MCQ palette Submit Exam button clicked');
                          handleAttemptSubmit();
                        }}
                        disabled={isSubmitting}
                        style={{ fontWeight: 800, backgroundColor: '#059669', borderColor: '#047857' }}
                      >
                        {isSubmitting ? 'Submitting...' : '✓ Submit Exam'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Security Alert Modal for Tab Switching (Requirement #1) */}
          {tabSwitchAlertOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                zIndex: 100002,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-xl)',
                  padding: '2rem',
                  maxWidth: '500px',
                  width: '100%',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-xl)',
                  border: '2px solid #ef4444',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#fef2f2',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                    fontSize: '1.75rem',
                  }}
                >
                  ⚠️
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  Examination Security Warning
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  Tab switching or window minimization was detected. Under KMU institutional rules, all window changes are recorded for proctor review.
                </p>
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-around',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Answers Preserved</span>
                    <strong style={{ color: '#059669', fontSize: '1.05rem' }}>
                      {answeredCount + Object.values(writtenAnswers).filter((a) => a.answerText && a.answerText.trim()).length}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Time Remaining</span>
                    <strong style={{ color: '#0f2744', fontSize: '1.05rem' }}>{formatTimer(timeLeftSeconds)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Violation Count</span>
                    <strong style={{ color: '#dc2626', fontSize: '1.05rem' }}>{tabSwitchCount}</strong>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => {
                    setTabSwitchAlertOpen(false);
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch(() => {});
                    }
                  }}
                  style={{ backgroundColor: '#0f2744' }}
                >
                  Resume Examination Now
                </Button>
              </div>
            </div>
          )}

          <style>{`
            .palette-close-mobile {
              display: none;
            }
            .exam-mobile-palette-btn {
              display: none;
            }
            @media (max-width: 900px) {
              .rcns-exam-layout-grid {
                grid-template-columns: 1fr !important;
                overflow-y: auto !important;
                height: auto !important;
              }
              .rcns-exam-left-column {
                height: auto !important;
                min-height: calc(100vh - 120px) !important;
              }
              .exam-mobile-palette-btn {
                display: inline-flex !important;
              }
              .exam-header-qcount {
                display: none !important;
              }
              .rcns-palette-sidebar {
                position: fixed !important;
                inset: 0 !important;
                z-index: 100000 !important;
                transform: translateY(100%) !important;
                transition: transform 0.25s ease !important;
              }
              .palette-mobile-show {
                transform: translateY(0) !important;
              }
              .palette-close-mobile {
                display: block !important;
              }
            }
            @media (max-width: 600px) {
              .exam-header-fullscreen-btn {
                display: none !important;
              }
            }
          `}</style>
        </div>
      )}

      {/* Full-Screen Submission Loading Overlay: prevents repeated clicks and provides clear feedback */}
      {isSubmitting && (
        <div
          id="exam-submitting-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(4px)',
            zIndex: 100060,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              padding: '2.5rem 2rem',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.25rem',
            }}
          >
            <LoadingSpinner size="lg" />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: '0 0 0.5rem' }}>
                Submitting Examination...
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', margin: 0, lineHeight: 1.5 }}>
                Recording and timestamping your responses to the institutional server. Please do not close or refresh this page.
              </p>
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-slate-500)',
                backgroundColor: 'var(--color-slate-50)',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md)',
                width: '100%',
              }}
            >
              ROYAL COLLEGE OF NURSING SWAT • Examination Repository
            </div>
          </div>
        </div>
      )}

      {/* Incomplete MCQs Prevention Alert Modal (Requirement #1) */}
      <Modal
        isOpen={showIncompleteAlert}
        onClose={() => setShowIncompleteAlert(false)}
        title="⚠️ Incomplete Examination Notice"
        maxWidth="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              color: '#92400e',
              fontSize: '0.9rem',
              lineHeight: 1.5,
            }}
          >
            <strong>All Multiple Choice Questions (MCQs) Must Be Answered</strong>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#b45309' }}>
              Under Royal College of Nursing Swat examination regulations, you cannot submit this examination paper until all questions have been attempted.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Total MCQs</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f2744' }}>{totalQuestions}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Answered</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>{answeredCount}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Remaining</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626' }}>{unansweredCount}</div>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--color-slate-600)' }}>
            Please complete the remaining {unansweredCount} question{unansweredCount > 1 ? 's' : ''} to finalize and calculate your examination result.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button
              variant="secondary"
              onClick={() => setShowIncompleteAlert(false)}
            >
              Return to Paper
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowIncompleteAlert(false);
                if (firstUnansweredIndex !== -1) {
                  setCurrentQuestionIndex(firstUnansweredIndex);
                  setActiveExamSection('mcq');
                }
              }}
              style={{ backgroundColor: '#0f2744' }}
            >
              {firstUnansweredIndex !== -1 ? `Go to Question ${firstUnansweredIndex + 1} →` : 'Continue Answering'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Submit Confirmation Dialog (Only opens when all MCQs are completed) */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        onClose={() => !isSubmitting && setShowSubmitConfirm(false)}
        onConfirm={handleFinalSubmit}
        title="Confirm Final Exam Submission"
        isLoading={isSubmitting}
        zIndex={100050}
        message={
          isSubmitting
            ? 'Submitting your examination responses to the institutional server, please wait...'
            : (() => {
                const totalMCQs = totalQuestions;
                const answeredMCQs = answeredCount;
                const unansweredMCQs = Math.max(0, totalMCQs - answeredMCQs);
                const totalWritten = writtenQuestions.length;
                const answeredWritten = Object.values(writtenAnswers).filter(
                  (a) => a.answerText && a.answerText.trim().length > 0
                ).length;
                const unansweredWritten = Math.max(0, totalWritten - answeredWritten);
                const totalUnanswered = unansweredMCQs + unansweredWritten;

                let statsDetail = `Questions Answered: ${answeredMCQs} of ${totalMCQs} MCQs`;
                if (totalWritten > 0) {
                  statsDetail += `, and ${answeredWritten} of ${totalWritten} Written Questions`;
                }

                const warningDetail =
                  totalUnanswered > 0
                    ? `\n\n⚠️ Note: You have ${totalUnanswered} unanswered question(s) remaining.`
                    : '\n\nAll questions have been answered.';

                const timeDetail = `\nTime Remaining: ${formatTimer(timeLeftSeconds)}. You do not have to wait for the timer to finish.`;

                return `Are you sure you want to submit your exam? You cannot change your answers after submission.\n\n${statsDetail}.${warningDetail}${timeDetail}`;
              })()
        }
        confirmText={isSubmitting ? 'Submitting...' : 'Yes, Submit Examination'}
        cancelText="Cancel"
        variant="danger"
      />

      {/* Secret Exam Code Modal (Requirements #2, #3, #4) */}
      <SecretExamCodeModal
        isOpen={isCodeModalOpen}
        onClose={() => {
          setIsCodeModalOpen(false);
          setCodeModalExam(null);
        }}
        exam={codeModalExam}
        onVerifyCode={async (examId, code) => {
          const activeUid = currentUser?.uid || auth.currentUser?.uid || '';
          return await examCodeService.verifyExamCode({ examId, code, studentId: activeUid });
        }}
        onVerified={async (exam) => {
          setIsCodeModalOpen(false);
          setCodeModalExam(null);
          await launchExamSession(exam);
        }}
      />
    </div>
  );
};

export default StudentExamsPage;
