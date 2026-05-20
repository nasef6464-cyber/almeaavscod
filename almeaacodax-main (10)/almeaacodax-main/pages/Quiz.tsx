import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft, Clock, CheckCircle, AlertTriangle, Gauge, ChevronRight, Save, Trash2, Heart, FileQuestion, Star, PauseCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useStore } from '../store/useStore';
import { normalizeQuestionHtml } from '../utils/questionHtml';
import { getQuizDifficultyBadgeClass, getQuizDifficultyLabel, getQuizOptionButtonHeightClass, getQuizOptionGridClass, getQuizQuestionMapButtonClass, resolveQuestionFromBank } from '../utils/quizPresentation';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';
import { flattenMockExamQuestionIds, isStandaloneMockExam } from '../utils/mockExam';

const DEFAULT_TIME_MINUTES = 20;
const QUIZ_PROGRESS_KEY = 'quiz_progress';
const QUIZ_PROGRESS_SNAPSHOT_KEY = 'quiz_progress_save';

interface SavedQuizSnapshot {
  entryMode: 'prepared' | 'self';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  selectedPathId: string;
  selectedSubjectId: string;
  selectedSectionId: string;
  questionTypeFilter: 'all' | 'mcq' | 'true_false';
  questionCount: number;
  timeLimitMinutes: number;
  targetSkillIds: string[];
  currentQuestion: number;
  answers: { [key: number]: number };
  timeLeft: number;
  activePreparedQuizId: string;
  sessionQuestions: ReturnType<typeof useStore.getState>['questions'];
}

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    saveExamResult,
    toggleFavorite: toggleStoreFavorite,
    toggleReviewLater: toggleStoreReviewLater,
    favorites: storeFavorites,
    reviewLater: storeReviewLater,
    recordQuestionAttempt,
    skills,
    subjects,
    sections,
    quizzes,
    questions: globalQuestionBank,
    paths,
    user,
  } = useStore();

  const [quizStarted, setQuizStarted] = useState(false);
  const [entryMode, setEntryMode] = useState<'prepared' | 'self'>('prepared');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [selectedPathId, setSelectedPathId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'mcq' | 'true_false'>('all');
  const [questionCount, setQuestionCount] = useState(15);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(DEFAULT_TIME_MINUTES);
  const [targetSkillIds, setTargetSkillIds] = useState<string[]>([]);
  const [activePreparedQuizId, setActivePreparedQuizId] = useState('');

  const [sessionQuestions, setSessionQuestions] = useState<typeof globalQuestionBank>([]);
  const questions = sessionQuestions;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_MINUTES * 60);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<SavedQuizSnapshot | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error' | 'info'>('info');
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const nextEntryMode = mode === 'self' ? 'self' : mode === 'prepared' ? 'prepared' : null;
    const hasSelfQuizConfig =
      params.has('skillIds') ||
      params.has('pathId') ||
      params.has('subjectId') ||
      params.has('sectionId') ||
      params.has('questionCount') ||
      params.has('timeLimit') ||
      params.has('difficulty');

    if (nextEntryMode) {
      setEntryMode(nextEntryMode);
    } else if (hasSelfQuizConfig) {
      setEntryMode('self');
    }

    const pathId = params.get('pathId');
    const subjectId = params.get('subjectId');
    const sectionId = params.get('sectionId');
    const skillIds = params.get('skillIds');
    const level = params.get('difficulty');
    const nextQuestionCount = Number(params.get('questionCount') || '');
    const nextTimeLimit = Number(params.get('timeLimit') || '');
    const autoStart = params.get('autostart') === '1';

    if (pathId !== null) {
      setSelectedPathId(pathId);
    }
    if (subjectId !== null) {
      setSelectedSubjectId(subjectId);
    }
    if (sectionId !== null) {
      setSelectedSectionId(sectionId);
    }
    if (skillIds !== null) {
      setTargetSkillIds(skillIds.split(',').map((id) => id.trim()).filter(Boolean));
    }
    if (level === 'Easy' || level === 'Medium' || level === 'Hard') {
      setDifficulty(level);
    }
    if (!Number.isNaN(nextQuestionCount) && nextQuestionCount > 0) {
      setQuestionCount(Math.max(5, Math.min(60, nextQuestionCount)));
    }
    if (!Number.isNaN(nextTimeLimit) && nextTimeLimit > 0) {
      setTimeLimitMinutes(Math.max(5, Math.min(180, nextTimeLimit)));
    }

    if (autoStart && mode === 'self') {
      window.setTimeout(() => {
        startSelfQuiz();
      }, 0);
    }
  }, [location.search]);

  const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(String(user.role));
  const availablePaths = useMemo(
    () => paths.filter((path) => canSeeHiddenPaths || path.isActive !== false),
    [paths, canSeeHiddenPaths],
  );
  const availablePathIds = useMemo(() => new Set(availablePaths.map((path) => path.id)), [availablePaths]);
  const availableSubjects = useMemo(
    () =>
      subjects.filter(
        (subject) =>
          availablePathIds.has(subject.pathId) &&
          (!selectedPathId || subject.pathId === selectedPathId),
      ),
    [subjects, selectedPathId, availablePathIds],
  );
  const availableSubjectIds = useMemo(
    () => new Set(availableSubjects.map((subject) => subject.id)),
    [availableSubjects],
  );
  const availableSections = useMemo(
    () =>
      sections.filter(
        (section) =>
          availableSubjectIds.has(section.subjectId) &&
          (!selectedSubjectId || section.subjectId === selectedSubjectId),
      ),
    [availableSubjectIds, sections, selectedSubjectId],
  );
  const availableSkillOptions = useMemo(
    () =>
      skills
        .filter((skill) => {
          const pathMatches = !selectedPathId || skill.pathId === selectedPathId;
          const subjectMatches = !selectedSubjectId || skill.subjectId === selectedSubjectId;
          return pathMatches && subjectMatches;
        })
        .sort((a, b) => {
          const sectionA = sections.find((section) => section.id === a.sectionId)?.name || '';
          const sectionB = sections.find((section) => section.id === b.sectionId)?.name || '';
          return sectionA.localeCompare(sectionB, 'ar') || a.name.localeCompare(b.name, 'ar');
        }),
    [sections, selectedPathId, selectedSubjectId, skills],
  );
  const targetSkills = useMemo(
    () => targetSkillIds
      .map((skillId) => skills.find((skill) => skill.id === skillId))
      .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill)),
    [skills, targetSkillIds],
  );
  const targetSkillIdSet = useMemo(() => new Set(targetSkillIds), [targetSkillIds]);
  const visibleTargetSkills = targetSkills.slice(0, 6);
  const skillSections = useMemo(
    () =>
      availableSections
        .map((section) => {
          const sectionSkills = availableSkillOptions.filter((skill) => skill.sectionId === section.id);
          return {
            section,
            skills: sectionSkills,
            selectedCount: sectionSkills.filter((skill) => targetSkillIdSet.has(skill.id)).length,
          };
        })
        .filter((item) => item.skills.length > 0),
    [availableSections, availableSkillOptions, targetSkillIdSet],
  );

  const isQuizExpired = (dueDate?: string) => {
    if (!dueDate) return false;
    const deadline = new Date(`${dueDate}T23:59:59`);
    if (Number.isNaN(deadline.getTime())) return false;
    return Date.now() > deadline.getTime();
  };

  const canUserAccessPreparedQuiz = (quiz: (typeof quizzes)[number]) => {
    if (!quiz.isPublished || (quiz.type ?? 'quiz') !== 'quiz') return false;
    if (isStandaloneMockExam(quiz)) return false;
    if ((quiz.mode || 'regular') !== 'saher') return false;
    if (isQuizExpired(quiz.dueDate)) return false;

    if ((quiz.mode || 'regular') === 'central') {
      const isUserTargeted = (quiz.targetUserIds || []).length === 0 || (quiz.targetUserIds || []).includes(user.id);
      const userGroups = user.groupIds || [];
      const isGroupTargeted =
        (quiz.targetGroupIds || []).length === 0 || (quiz.targetGroupIds || []).some((groupId) => userGroups.includes(groupId));
      if (!isUserTargeted || !isGroupTargeted) return false;
    }
    return true;
  };

  const getResolvedQuestionCount = (quiz: (typeof quizzes)[number]) =>
    flattenMockExamQuestionIds(quiz)
      .map((questionId) => resolveQuestionFromBank(globalQuestionBank, questionId))
      .filter(Boolean).length;

  const preparedQuizCards = useMemo(
    () =>
      quizzes
        .filter((quiz) => canUserAccessPreparedQuiz(quiz))
        .map((quiz) => ({
          quiz,
          questionCount: getResolvedQuestionCount(quiz),
        }))
        .filter((item) => item.questionCount > 0)
        .sort((a, b) => (b.quiz.createdAt || 0) - (a.quiz.createdAt || 0)),
    [quizzes, user.id, user.groupIds, globalQuestionBank],
  );

  const hiddenReadyQuizCount = useMemo(
    () =>
      quizzes.filter((quiz) => {
        if (!quiz.isPublished || (quiz.type ?? 'quiz') !== 'quiz') return false;
        if (isQuizExpired(quiz.dueDate)) return false;
        return isStandaloneMockExam(quiz) || (quiz.mode || 'regular') !== 'saher' || getResolvedQuestionCount(quiz) === 0;
      }).length,
    [quizzes, globalQuestionBank],
  );
  const activePreparedQuizCard = useMemo(
    () => preparedQuizCards.find((item) => item.quiz.id === activePreparedQuizId),
    [activePreparedQuizId, preparedQuizCards],
  );

  const selectedSubjectLabel = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId)?.name || 'عام',
    [subjects, selectedSubjectId],
  );

  const toggleFavorite = (idx: number) => {
    const questionId = questions[idx].id.toString();
    toggleStoreFavorite(questionId);
  };

  const toggleReviewLater = (idx: number) => {
    const questionId = questions[idx].id.toString();
    toggleStoreReviewLater(questionId);
  };

  const showStatus = (message: string, tone: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const setSkillScope = (nextIds: string[]) => {
    setTargetSkillIds(Array.from(new Set(nextIds)));
    setSelectedSectionId('');
  };

  const toggleTargetSkill = (skillId: string) => {
    const next = targetSkillIdSet.has(skillId)
      ? targetSkillIds.filter((id) => id !== skillId)
      : [...targetSkillIds, skillId];
    setSkillScope(next);
  };

  const toggleSectionSkills = (sectionId: string) => {
    const sectionSkillIds = availableSkillOptions.filter((skill) => skill.sectionId === sectionId).map((skill) => skill.id);
    if (sectionSkillIds.length === 0) return;

    const allSelected = sectionSkillIds.every((skillId) => targetSkillIdSet.has(skillId));
    const next = allSelected
      ? targetSkillIds.filter((skillId) => !sectionSkillIds.includes(skillId))
      : [...targetSkillIds, ...sectionSkillIds];
    setSkillScope(next);
  };

  const clearSavedSnapshot = () => {
    localStorage.removeItem(QUIZ_PROGRESS_SNAPSHOT_KEY);
    setSavedSnapshot(null);
  };

  const restoreSavedSnapshot = () => {
    if (!savedSnapshot) return;

    setEntryMode(savedSnapshot.entryMode);
    setDifficulty(savedSnapshot.difficulty);
    setSelectedPathId(savedSnapshot.selectedPathId);
    setSelectedSubjectId(savedSnapshot.selectedSubjectId);
    setSelectedSectionId(savedSnapshot.selectedSectionId);
    setQuestionTypeFilter(savedSnapshot.questionTypeFilter);
    setQuestionCount(savedSnapshot.questionCount);
    setTimeLimitMinutes(savedSnapshot.timeLimitMinutes);
    setTargetSkillIds(savedSnapshot.targetSkillIds || []);
    setActivePreparedQuizId(savedSnapshot.activePreparedQuizId);
    setSessionQuestions(savedSnapshot.sessionQuestions);
    setCurrentQuestion(savedSnapshot.currentQuestion);
    setAnswers(savedSnapshot.answers);
    setTimeLeft(savedSnapshot.timeLeft);
    setSelectedAnswer(savedSnapshot.answers[savedSnapshot.currentQuestion] ?? null);
    setQuizStarted(savedSnapshot.sessionQuestions.length > 0);
    showStatus('تمت استعادة آخر تقدم محفوظ في اختبار ساهر.', 'success');
  };

  useEffect(() => {
    const savedProgress = localStorage.getItem(QUIZ_PROGRESS_KEY);
    if (!savedProgress) return;
    const parsed = JSON.parse(savedProgress) as {
      currentQuestion?: number;
      answers?: { [key: number]: number };
      timeLeft?: number;
    };
    if (typeof parsed.currentQuestion === 'number') setCurrentQuestion(parsed.currentQuestion);
    if (parsed.answers) setAnswers(parsed.answers);
    if (typeof parsed.timeLeft === 'number') setTimeLeft(parsed.timeLeft);
  }, []);

  useEffect(() => {
    const snapshotRaw = localStorage.getItem(QUIZ_PROGRESS_SNAPSHOT_KEY);
    if (!snapshotRaw) return;
    try {
      const parsed = JSON.parse(snapshotRaw) as SavedQuizSnapshot;
      if (parsed?.sessionQuestions?.length) {
        setSavedSnapshot(parsed);
      }
    } catch {
      localStorage.removeItem(QUIZ_PROGRESS_SNAPSHOT_KEY);
    }
  }, []);

  useEffect(() => {
    if (!quizStarted || questions.length === 0) return;
    localStorage.setItem(
      QUIZ_PROGRESS_KEY,
      JSON.stringify({
        currentQuestion,
        answers,
        timeLeft,
      }),
    );
  }, [quizStarted, currentQuestion, answers, timeLeft, questions.length]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (quizStarted) {
      timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [quizStarted]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!quizStarted) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [quizStarted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startSelfQuiz = () => {
    const requestedCount = Math.max(5, Math.min(questionCount, 60));
    const byId = new Map<string, typeof globalQuestionBank[number]>();
    const addQuestions = (pool: typeof globalQuestionBank) => {
      [...pool]
        .sort(() => 0.5 - Math.random())
        .forEach((question) => {
          if (byId.size < requestedCount) {
            byId.set(question.id, question);
          }
        });
    };

    const strictPool = globalQuestionBank.filter((question) => {
      const pathMatches = !selectedPathId || question.pathId === selectedPathId;
      const subjectMatches = !selectedSubjectId || question.subject === selectedSubjectId;
      const sectionMatches = !selectedSectionId || question.sectionId === selectedSectionId;
      const skillMatches = targetSkillIds.length === 0 || (question.skillIds || []).some((skillId) => targetSkillIds.includes(skillId));
      const difficultyMatches = !difficulty || question.difficulty === difficulty;
      const typeMatches = questionTypeFilter === 'all' || question.type === questionTypeFilter;
      return pathMatches && subjectMatches && sectionMatches && skillMatches && difficultyMatches && typeMatches;
    });

    const relaxedPool = globalQuestionBank.filter((question) => {
      const pathMatches = !selectedPathId || question.pathId === selectedPathId;
      const subjectMatches = !selectedSubjectId || question.subject === selectedSubjectId;
      const sectionMatches = !selectedSectionId || question.sectionId === selectedSectionId;
      const skillMatches = targetSkillIds.length === 0 || (question.skillIds || []).some((skillId) => targetSkillIds.includes(skillId));
      const typeMatches = questionTypeFilter === 'all' || question.type === questionTypeFilter;
      return pathMatches && subjectMatches && sectionMatches && skillMatches && typeMatches;
    });

    const fallbackPool = globalQuestionBank.filter((question) => {
      const pathMatches = !selectedPathId || question.pathId === selectedPathId;
      const skillMatches = targetSkillIds.length === 0 || (question.skillIds || []).some((skillId) => targetSkillIds.includes(skillId));
      const typeMatches = questionTypeFilter === 'all' || question.type === questionTypeFilter;
      return pathMatches && skillMatches && typeMatches;
    });
    const contextFillPool = globalQuestionBank.filter((question) => {
      const pathMatches = !selectedPathId || question.pathId === selectedPathId;
      const subjectMatches = !selectedSubjectId || question.subject === selectedSubjectId;
      const sectionMatches = !selectedSectionId || question.sectionId === selectedSectionId;
      const typeMatches = questionTypeFilter === 'all' || question.type === questionTypeFilter;
      return pathMatches && subjectMatches && sectionMatches && typeMatches;
    });
    const broadFillPool = globalQuestionBank.filter((question) => {
      const pathMatches = !selectedPathId || question.pathId === selectedPathId;
      const typeMatches = questionTypeFilter === 'all' || question.type === questionTypeFilter;
      return pathMatches && typeMatches;
    });

    const sourcePool =
      strictPool.length > 0
        ? strictPool
        : relaxedPool.length > 0
          ? relaxedPool
          : fallbackPool.length > 0
            ? fallbackPool
            : contextFillPool.length > 0
              ? contextFillPool
              : broadFillPool;
    if (sourcePool.length === 0) {
      showStatus('لا توجد أسئلة مطابقة للخيارات الحالية. جرّب تغيير المسار أو المادة أو مستوى الصعوبة.', 'error');
      return;
    }

    addQuestions(strictPool);
    addQuestions(relaxedPool);
    addQuestions(fallbackPool);
    addQuestions(contextFillPool);
    addQuestions(broadFillPool);

    const picked = Array.from(byId.values());

    setStatusMessage(null);
    localStorage.removeItem(QUIZ_PROGRESS_KEY);
    localStorage.removeItem(QUIZ_PROGRESS_SNAPSHOT_KEY);
    setSavedSnapshot(null);
    setSessionQuestions(picked);
    setTimeLeft(Math.max(5, timeLimitMinutes) * 60);
    setCurrentQuestion(0);
    setAnswers({});
    setSelectedAnswer(null);
    setQuizStarted(true);
    navigate('/quiz', { replace: true });
  };

  const handleStart = () => {
    if (entryMode === 'prepared') {
      if (!activePreparedQuizCard) {
        showStatus('اختر اختبارًا من الاختبارات الجاهزة أولًا.', 'error');
        return;
      }
      setStatusMessage(null);
      navigate(`/quiz/${activePreparedQuizCard.quiz.id}`);
      return;
    }
    startSelfQuiz();
  };

  const handleAnswerSelect = (index: number) => {
    if (!questions[currentQuestion]) return;

    setSelectedAnswer(index);
    setAnswers((prev) => ({ ...prev, [currentQuestion]: index }));

    const isCorrect = index === questions[currentQuestion].correctOptionIndex;
    recordQuestionAttempt({
      questionId: questions[currentQuestion].id.toString(),
      selectedOptionIndex: index,
      isCorrect,
      timeSpentSeconds: 0,
      date: new Date().toISOString(),
    });
  };

  const handleFinish = () => {
    if (questions.length === 0) return;

    let correct = 0;
    let wrong = 0;
    let unanswered = 0;

    questions.forEach((q, idx) => {
      const ans = answers[idx];
      if (ans === undefined) unanswered++;
      else if (ans === q.correctOptionIndex) correct++;
      else wrong++;
    });

    const score = Math.round((correct / questions.length) * 100);

    const skillStats: Record<string, { total: number; correct: number }> = {};
    questions.forEach((question, idx) => {
      const isCorrect = answers[idx] === question.correctOptionIndex;
      (question.skillIds || []).forEach((skillId) => {
        if (!skillStats[skillId]) {
          skillStats[skillId] = { total: 0, correct: 0 };
        }
        skillStats[skillId].total++;
        if (isCorrect) skillStats[skillId].correct++;
      });
    });

    
    const skillsAnalysis = Object.entries(skillStats).map(([skillId, stats]) => {
      const resolvedSkill = skills.find((skill) => skill.id === skillId);
      const topicSkill = resolvedSkill ? { title: resolvedSkill.name } : undefined;
      const nestedSkill = resolvedSkill ? { name: resolvedSkill.name } : undefined;
      const mastery = Math.round((stats.correct / stats.total) * 100);
      const status: 'weak' | 'average' | 'strong' = mastery < 50 ? 'weak' : mastery >= 80 ? 'strong' : 'average';

      const sectionLabel = resolvedSkill?.sectionId
        ? sections.find((section) => section.id === resolvedSkill.sectionId)?.name
        : resolvedSkill?.subjectId
          ? subjects.find((subject) => subject.id === resolvedSkill.subjectId)?.name
          : undefined;

      return {
        skillId,
        pathId: resolvedSkill?.pathId,
        subjectId: resolvedSkill?.subjectId,
        sectionId: resolvedSkill?.sectionId,
        skill: topicSkill?.title || nestedSkill?.name || 'مهارة غير معروفة',
        mastery,
        status,
        recommendation:
          status === 'weak'
            ? 'بحاجة لمراجعة الدروس والتدريب على نفس المهارة'
            : status === 'average'
              ? 'يمكن التحسين بالتدريب الموجّه على نفس المهارة'
              : 'أداء ممتاز في هذه المهارة',
        section: sectionLabel,
      };
    });

    const questionReview = questions.map((question, idx) => {
      const selectedOptionIndex = answers[idx];
      return {
        questionId: question.id.toString(),
        text: question.text,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        selectedOptionIndex,
        explanation: question.explanation,
        videoUrl: question.videoUrl,
        imageUrl: question.imageUrl,
        isCorrect: selectedOptionIndex === question.correctOptionIndex,
      };
    });

    const resultDate = new Date().toISOString();

    saveExamResult({
      quizId: `self-quiz-${Date.now()}`,
      quizTitle: `اختبار ذاتي - ${selectedSubjectLabel} (${getQuizDifficultyLabel(difficulty)})`,
      score,
      correctAnswers: correct,
      wrongAnswers: wrong,
      unanswered,
      timeSpent: formatTime(Math.max(0, timeLimitMinutes * 60 - timeLeft)),
      date: resultDate,
      skillsAnalysis,
      totalQuestions: questions.length,
      questionReview,
    });

    localStorage.removeItem(QUIZ_PROGRESS_KEY);
    clearSavedSnapshot();
    navigate(`/results?attempt=${encodeURIComponent(resultDate)}`);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((curr) => curr + 1);
      setSelectedAnswer(answers[currentQuestion + 1] ?? null);
      return;
    }
    setShowFinishDialog(true);
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((curr) => curr - 1);
      setSelectedAnswer(answers[currentQuestion - 1] ?? null);
    }
  };

  const handleExitAttempt = () => {
    if (!quizStarted) {
      navigate('/dashboard');
      return;
    }
    setShowExitDialog(true);
  };

  const buildSavedSnapshot = (): SavedQuizSnapshot | null => {
    if (!quizStarted || questions.length === 0) {
      return null;
    }

    return {
      entryMode,
      difficulty,
      selectedPathId,
      selectedSubjectId,
      selectedSectionId,
      questionTypeFilter,
      questionCount,
      timeLimitMinutes,
      targetSkillIds,
      currentQuestion,
      answers,
      timeLeft,
      activePreparedQuizId,
      sessionQuestions: questions,
    };
  };

  const persistSavedSnapshot = (snapshot: SavedQuizSnapshot) => {
    localStorage.setItem(QUIZ_PROGRESS_SNAPSHOT_KEY, JSON.stringify(snapshot));
    setSavedSnapshot(snapshot);
  };

  const handleSaveProgress = () => {
    if (!quizStarted || questions.length === 0) {
      showStatus('ابدأ الاختبار أولًا حتى يمكن حفظ تقدمك.', 'error');
      return;
    }

    const snapshot = buildSavedSnapshot();
    if (!snapshot) return;

    persistSavedSnapshot(snapshot);
    showStatus('تم حفظ تقدمك. يمكنك الاستكمال لاحقًا من نفس الصفحة.', 'success');
  };

  const handlePauseAndSave = () => {
    const snapshot = buildSavedSnapshot();
    if (!snapshot) {
      showStatus('ابدأ الاختبار أولًا حتى يمكن إيقافه مؤقتًا.', 'error');
      return;
    }

    persistSavedSnapshot(snapshot);
    setQuizStarted(false);
    setStatusTone('success');
    setStatusMessage('تم إيقاف الاختبار وحفظ تقدمك. اضغط استعادة التقدم للاستكمال.');
    navigate('/quiz', { replace: true });
  };

  const handleExitAfterSaving = () => {
    const snapshot = buildSavedSnapshot();
    if (snapshot) {
      persistSavedSnapshot(snapshot);
    }
    setShowExitDialog(false);
    navigate('/dashboard?tab=quizzes');
  };

  const handleExitWithoutSaving = () => {
    localStorage.removeItem(QUIZ_PROGRESS_KEY);
    setShowExitDialog(false);
    navigate('/dashboard?tab=quizzes');
  };

  const handleInlineQuestionImageClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as Element | null;
    const image =
      target instanceof HTMLImageElement
        ? target
        : target?.closest('img') instanceof HTMLImageElement
          ? target.closest('img')
          : null;

    if (!image?.src) return;
    event.preventDefault();
    setZoomedImageUrl(image.src);
  };

  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Card className="max-w-3xl w-full p-5 sm:p-7 space-y-5">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">اختبار ساهر</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setEntryMode('prepared')}
              className={`py-3 rounded-lg font-bold transition-colors ${entryMode === 'prepared' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'}`}
            >
              اختبار جاهز
            </button>
            <button
              onClick={() => setEntryMode('self')}
              className={`py-3 rounded-lg font-bold transition-colors ${entryMode === 'self' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'}`}
            >
              اختبار ذاتي
            </button>
          </div>

          {statusMessage && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                statusTone === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : statusTone === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}
            >
              {statusMessage}
            </div>
          )}

          {savedSnapshot && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="font-bold text-amber-900">يوجد تقدم محفوظ</h3>
                <p className="text-sm text-amber-700 mt-1">استكمل من نفس السؤال والوقت.</p>
              </div>
              <div className="grid grid-cols-1 sm:flex gap-3">
                <button
                  onClick={restoreSavedSnapshot}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors"
                >
                  استعادة التقدم
                </button>
                <button
                  onClick={clearSavedSnapshot}
                  className="px-4 py-2 rounded-lg bg-white text-amber-700 border border-amber-300 font-bold hover:bg-amber-100 transition-colors"
                >
                  حذف النسخة
                </button>
              </div>
            </div>
          )}

          {entryMode === 'prepared' ? (
            <div className="space-y-4">
              <p className="text-sm font-bold text-gray-600">اختبار جاهز من الإدارة</p>
              {preparedQuizCards.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {preparedQuizCards.map(({ quiz, questionCount }) => (
                    <button
                      key={quiz.id}
                      onClick={() => setActivePreparedQuizId(quiz.id)}
                      className={`w-full text-right border rounded-xl p-4 transition-colors ${
                        activePreparedQuizId === quiz.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                        <div>
                          <h3 className="font-bold text-gray-800">{quiz.title}</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {subjects.find((s) => s.id === quiz.subjectId)?.name || 'بدون مادة'} • {questionCount} سؤال
                          </p>
                          {quiz.dueDate ? (
                            <p className="text-[11px] text-amber-600 mt-1">
                              متاح حتى: {new Date(quiz.dueDate).toLocaleDateString('ar-SA')}
                            </p>
                          ) : null}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                          (quiz.mode || 'regular') === 'saher' ? 'bg-purple-100 text-purple-700' :
                          (quiz.mode || 'regular') === 'central' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {(quiz.mode || 'regular') === 'saher' ? 'ساهر' : (quiz.mode || 'regular') === 'central' ? 'مركزي' : 'عادي'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-gray-300 rounded-xl">
                  <p className="text-gray-500 text-sm">لا توجد اختبارات جاهزة متاحة حاليًا.</p>
                </div>
              )}
              {hiddenReadyQuizCount > 0 ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-700">
                  تعرض هذه القائمة اختبارات ساهر الجاهزة فقط.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-bold text-gray-600">اختبار ذاتي بمواصفاتك</p>
              {targetSkills.length > 0 ? (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <div className="text-sm font-black text-indigo-800">اختبار إضافي موجه حسب نتيجتك</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {visibleTargetSkills.map((skill) => (
                      <span key={skill.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm">
                        {skill.name}
                      </span>
                    ))}
                    {targetSkills.length > visibleTargetSkills.length ? (
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                        +{targetSkills.length - visibleTargetSkills.length}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs leading-6 text-indigo-700">
                    سنبدأ بهذه المهارات، ولو عدد أسئلتها قليل سنكمل من نفس المادة أو المسار حتى تكون المحاولة مفيدة.
                  </p>
                </div>
              ) : null}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">المسار</label>
                  <select
                    value={selectedPathId}
                    onChange={(e) => {
                      setSelectedPathId(e.target.value);
                      setSelectedSubjectId('');
                      setSelectedSectionId('');
                      setTargetSkillIds([]);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">كل المسارات</option>
                    {availablePaths.map((path) => (
                      <option key={path.id} value={path.id}>{path.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">المادة</label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value);
                      setSelectedSectionId('');
                      setTargetSkillIds([]);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">كل المواد</option>
                    {availableSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">عدد الأسئلة</label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.max(5, Math.min(60, Number(e.target.value) || 5)))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">الوقت (بالدقائق)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Math.max(5, Math.min(180, Number(e.target.value) || 5)))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">نوع الأسئلة</label>
                  <select
                    value={questionTypeFilter}
                    onChange={(e) => setQuestionTypeFilter(e.target.value as typeof questionTypeFilter)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">الكل</option>
                    <option value="mcq">اختيار من متعدد</option>
                    <option value="true_false">صح / خطأ</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-gray-900">نطاق المهارات</h3>
                  <p className="mt-1 text-xs font-bold leading-6 text-gray-500">اختر أكثر من مهارة أو اتركها للجميع.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetSkillIds([]);
                      setSelectedSectionId('');
                    }}
                    className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                      targetSkillIds.length === 0 && !selectedSectionId
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                    }`}
                  >
                    كل المهارات
                  </button>
                </div>

                {skillSections.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="mb-2 text-xs font-black text-gray-700">المهارات الرئيسية</div>
                      <div className="flex flex-wrap gap-2">
                        {skillSections.map(({ section, skills: sectionSkills, selectedCount }) => {
                          const allSelected = selectedSectionId === section.id || selectedCount === sectionSkills.length;
                          const partiallySelected = selectedCount > 0 && !allSelected;
                          return (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => toggleSectionSkills(section.id)}
                              className={`rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                                allSelected
                                  ? 'border-indigo-200 bg-indigo-600 text-white shadow-sm'
                                  : partiallySelected
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-indigo-200 hover:bg-white'
                              }`}
                            >
                              {section.name}
                              <span className="mr-1 opacity-80">({selectedCount || sectionSkills.length})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-black text-gray-700">المهارات الفرعية</span>
                        <span className="text-[11px] font-bold text-gray-400">{targetSkillIds.length || 'كل'} محدد</span>
                      </div>
                      <div className="max-h-44 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
                        <div className="flex flex-wrap gap-2">
                          {availableSkillOptions.map((skill) => {
                            const selected = targetSkillIdSet.has(skill.id);
                            return (
                              <button
                                key={skill.id}
                                type="button"
                                onClick={() => toggleTargetSkill(skill.id)}
                                className={`rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                                  selected
                                    ? 'border-emerald-200 bg-emerald-500 text-white shadow-sm'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-200 hover:text-emerald-700'
                                }`}
                              >
                                {skill.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm font-bold text-gray-500">
                    اختر مسارًا أو مادة لعرض المهارات المتاحة، أو ابدأ الاختبار على كل المهارات.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setDifficulty('Easy')}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    difficulty === 'Easy' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200'
                  }`}
                >
                  <CheckCircle size={18} />
                  سهل
                </button>
                <button
                  onClick={() => setDifficulty('Medium')}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    difficulty === 'Medium' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200'
                  }`}
                >
                  <Gauge size={18} />
                  متوسط
                </button>
                <button
                  onClick={() => setDifficulty('Hard')}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    difficulty === 'Hard' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'
                  }`}
                >
                  <AlertTriangle size={18} />
                  صعب
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={entryMode === 'prepared' && !activePreparedQuizCard}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            {entryMode === 'prepared' ? 'الدخول إلى الاختبار المختار' : 'ابدأ الاختبار الذاتي الآن'}
            <ChevronRight size={24} className={document.dir === 'rtl' ? 'rotate-180' : ''} />
          </button>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <FileQuestion className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-xl font-bold text-gray-800 mb-2">لا توجد أسئلة في الجلسة</h3>
          <p className="text-sm text-gray-500 mb-6">عدّل الإعدادات أو اختر اختبارًا جاهزًا من الإدارة.</p>
          <button
            onClick={() => setQuizStarted(false)}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700"
          >
            العودة للإعدادات
          </button>
        </Card>
      </div>
    );
  }

  const currentOptions = questions[currentQuestion]?.options || [];
  const currentOptionGridClass = getQuizOptionGridClass(currentOptions, 'horizontal');
  const currentOptionHeightClass = getQuizOptionButtonHeightClass(currentOptions, 'horizontal');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b p-3 sm:p-4 shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-start gap-3 sm:gap-4">
            <button className="text-gray-500 hover:text-gray-800 transition-colors" onClick={handleExitAttempt}>
              <ArrowRight />
            </button>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg leading-tight break-words">اختبار ذاتي - {selectedSubjectLabel}</h1>
              <span className={`mt-1 inline-flex text-xs px-2 py-0.5 rounded ${getQuizDifficultyBadgeClass(difficulty)}`}>
                {getQuizDifficultyLabel(difficulty)}
              </span>
            </div>
          </div>
          <div className="self-start sm:self-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePauseAndSave}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs sm:text-sm font-black text-amber-700 transition-colors hover:bg-amber-100"
            >
              <PauseCircle size={15} />
              إيقاف
            </button>
            <div className="flex items-center gap-2 bg-secondary-50 text-secondary-700 px-3 py-1 rounded-lg font-mono font-bold">
              <Clock size={18} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-4 max-w-3xl mx-auto w-full flex flex-col justify-center">
        {statusMessage && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
              statusTone === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : statusTone === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            {statusMessage}
          </div>
        )}

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>التقدم</span>
            <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}%</span>
          </div>
          <ProgressBar percentage={((currentQuestion + 1) / questions.length) * 100} showPercentage={false} color="secondary" />
        </div>

        <div className="rounded-t-2xl border border-b-0 border-indigo-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 text-sm font-black text-indigo-700">
              <span className="rounded-full bg-indigo-50 px-3 py-1">السؤال {currentQuestion + 1} من {questions.length}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{Object.keys(answers).length} محلولة</span>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-slate-50 px-3 py-1 text-sm font-black text-slate-700 sm:self-auto">
              <Clock size={16} />
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        <Card className="rounded-t-none rounded-b-2xl p-3 sm:p-6 min-h-[360px] sm:min-h-[400px] flex flex-col">
          <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                onClick={() => toggleFavorite(currentQuestion)}
                className={`${storeFavorites.includes(questions[currentQuestion].id) ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-white text-slate-700 hover:bg-slate-50'} w-full sm:w-auto px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors`}
              >
                {storeFavorites.includes(questions[currentQuestion].id) ? <Trash2 size={15} /> : <Heart size={15} />}
                {storeFavorites.includes(questions[currentQuestion].id) ? 'في المفضلة' : 'المفضلة'}
              </button>
              <button
                onClick={() => toggleReviewLater(currentQuestion)}
                className={`${storeReviewLater.includes(questions[currentQuestion].id) ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-white text-slate-700 hover:bg-slate-50'} w-full sm:w-auto px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors`}
              >
                <Star size={15} className={storeReviewLater.includes(questions[currentQuestion].id) ? 'fill-current' : ''} />
                {storeReviewLater.includes(questions[currentQuestion].id) ? 'للمراجعة' : 'راجع لاحقًا'}
              </button>
            </div>

            <div className="hidden sm:block text-xs font-bold text-gray-300" aria-hidden="true" />
          </div>

          <div className="flex-1">
            <div
              onClick={handleInlineQuestionImageClick}
              className="text-base sm:text-lg font-medium text-gray-800 leading-loose mb-5 sm:mb-8 text-right break-words [&_img]:cursor-zoom-in"
              dangerouslySetInnerHTML={{ __html: `(${currentQuestion + 1}) ${normalizeQuestionHtml(questions[currentQuestion].text)}` }}
            />
            {questions[currentQuestion].imageUrl && (
              <button
                type="button"
                onClick={() => setZoomedImageUrl(questions[currentQuestion].imageUrl || null)}
                className="mb-5 sm:mb-8 block w-full cursor-zoom-in rounded-2xl border border-gray-200 bg-white p-2 sm:p-3 shadow-sm"
              >
                <img
                  src={questions[currentQuestion].imageUrl}
                  alt="صورة السؤال"
                  className="mx-auto max-h-[260px] sm:max-h-[340px] w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </button>
            )}

            <div className={`grid ${currentOptionGridClass} gap-x-2 sm:gap-x-3 gap-y-2 dir-rtl`}>
              {questions[currentQuestion].options.map((option, idx) => {
                const isSelected = selectedAnswer === idx || answers[currentQuestion] === idx;
                const borderClass = isSelected
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50 bg-white';

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(idx)}
                    className={`${currentOptionHeightClass} px-2 sm:px-2.5 py-1 rounded-xl border-2 transition-all flex items-center justify-between text-right gap-1.5 shadow-sm ${borderClass}`}
                  >
                    <span className="flex-1 text-xs sm:text-sm font-bold text-gray-800 leading-5 text-center break-words">
                      {sanitizeArabicText(option)}
                    </span>
                    <div className="flex items-center shrink-0">
                      <div className={`h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 flex items-center justify-center text-lg font-black ${
                        isSelected ? 'border-current' : 'border-gray-300'
                      }`}>
                        <div className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${
                          isSelected ? 'bg-indigo-600' : 'bg-transparent'
                        }`} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 sm:mt-6 rounded-2xl bg-gray-50 p-2.5 sm:p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-gray-500">
                <span>خريطة الأسئلة</span>
                <span>{Object.keys(answers).length} من {questions.length} محلولة</span>
              </div>
              <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[10px] sm:text-[11px] font-black text-gray-600">
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-amber-100" />السؤال الحالي</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />تمت الإجابة</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full border-2 border-slate-300 bg-white" />لم يجب</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-purple-500 ring-2 ring-purple-100" />للمراجعة</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {questions.map((question, idx) => {
                  const isCurrent = idx === currentQuestion;
                  const isAnswered = answers[idx] !== undefined;
                  const isReviewLater = storeReviewLater.includes(question.id);
                  const mapState = isCurrent
                    ? 'current'
                    : isReviewLater
                      ? 'review'
                      : isAnswered
                        ? 'answered'
                        : 'unanswered';

                  return (
                    <button
                      key={question.id}
                      onClick={() => {
                        setCurrentQuestion(idx);
                        setSelectedAnswer(answers[idx] ?? null);
                      }}
                      className={`h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-lg border-2 text-xs font-black transition-colors ${getQuizQuestionMapButtonClass(mapState)}`}
                      title={isReviewLater ? 'سؤال للمراجعة لاحقًا' : isAnswered ? 'تمت الإجابة' : 'لم تتم الإجابة بعد'}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100">
            <button
              onClick={handleSaveProgress}
              className="inline-flex min-w-[92px] items-center justify-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs sm:text-sm font-bold text-amber-700 hover:bg-amber-100"
            >
              <Save size={15} />
              حفظ
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentQuestion === 0}
                className="inline-flex min-w-[82px] items-center justify-center rounded-xl bg-gray-100 px-3 py-1.5 text-xs sm:text-sm font-bold text-gray-600 disabled:opacity-50"
              >
                السابق
              </button>
              <button
                onClick={handleNext}
                className="inline-flex min-w-[86px] items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs sm:text-sm font-bold text-white hover:bg-indigo-700"
              >
                {currentQuestion === questions.length - 1 ? 'إنهاء الاختبار' : 'التالي'}
                <ArrowLeft size={15} />
              </button>
            </div>
          </div>
        </Card>
      </main>

      {showExitDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <Card className="max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-scale-up">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h3 className="font-bold text-xl text-gray-800 mb-2">هل تريد الخروج؟</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                الاختبار لا يزال جاريًا. الأفضل حفظ التقدم حتى تستطيع الاستكمال لاحقًا.
              </p>
            </div>
            <div className="grid gap-3 mt-6">
              <button
                onClick={handleExitAfterSaving}
                className="bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
              >
                حفظ وخروج
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleExitWithoutSaving}
                  className="bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors"
                >
                  خروج بدون حفظ
                </button>
                <button
                  onClick={() => setShowExitDialog(false)}
                  className="bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {showFinishDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <Card className="max-w-lg w-full p-6 text-center space-y-5 shadow-2xl animate-scale-up border border-amber-100">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={34} />
            </div>
            <div>
              <h3 className="font-black text-xl text-gray-900 mb-3">إنهاء الاختبار؟</h3>
              <div className="mx-auto mb-3 inline-flex rounded-full bg-slate-50 px-4 py-2 text-sm font-black text-slate-700">
                {Object.keys(answers).length} محلولة من {questions.length}
              </div>
              <p className="text-gray-600 text-sm leading-7 font-bold">
                {questions.length - Object.keys(answers).length > 0
                  ? `باقي ${questions.length - Object.keys(answers).length} سؤال بدون إجابة.`
                  : 'كل الأسئلة تمت الإجابة عنها.'}
                {' '}بعد الإنهاء ستظهر النتيجة مباشرة.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowFinishDialog(false)}
                className="bg-gray-100 text-gray-700 py-3 rounded-xl font-black hover:bg-gray-200 transition-colors"
              >
                أكمل الحل
              </button>
              <button
                onClick={() => {
                  setShowFinishDialog(false);
                  handleFinish();
                }}
                className="bg-indigo-600 text-white py-3 rounded-xl font-black hover:bg-indigo-700 transition-colors"
              >
                إنهاء وعرض النتيجة
              </button>
            </div>
          </Card>
        </div>
      )}

      {zoomedImageUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 sm:p-4"
          onClick={() => setZoomedImageUrl(null)}
        >
          <button
            type="button"
            onClick={() => setZoomedImageUrl(null)}
            className="absolute left-3 top-3 sm:left-4 sm:top-4 rounded-full bg-white px-4 py-2 text-sm font-black text-gray-800 shadow-lg"
          >
            إغلاق
          </button>
          <img
            src={zoomedImageUrl}
            alt="تكبير صورة السؤال"
            className="max-h-[82vh] sm:max-h-[90vh] max-w-[96vw] rounded-2xl bg-white object-contain"
            referrerPolicy="no-referrer"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default Quiz;
