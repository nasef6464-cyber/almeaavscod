import React, { useMemo, useState } from 'react';
import { Question, Quiz } from '../../types';
import { AlertTriangle, CheckCircle2, Plus, Search, Edit2, Trash2, FileQuestion, Lock, LockOpen, Eye, Download, X, BookOpen, Target, PlayCircle, ExternalLink } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { QuizBuilder } from './QuizBuilder';
import { getQuizPlacementDefaults, getQuizPlacementLabel, isMockQuiz, isTrainingQuiz, normalizeQuizPlacement } from '../../utils/quizPlacement';
import {
  getQuizLearningPlacementAccessType,
  isQuizVisibleInLearningSlot,
  LearningPlacementSlot,
  setQuizLearningSlotAccess,
  setQuizLearningSlotVisibility,
} from '../../utils/quizLearningPlacement';
import { isMaterialQuizCandidate } from '../../utils/mockExam';
import { getDefaultQuizSettings } from '../../utils/quizSettings';
import { loadXlsx } from '../../utils/xlsxLoader';

interface QuizzesManagerProps {
  subjectId?: string;
  filterType?: 'quiz' | 'bank';
}

const getQuizManagerParams = () => {
  const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
  return new URLSearchParams(hashQuery || window.location.search);
};

const getStatusMeta = (quiz: Quiz) => {
  if (quiz.approvalStatus === 'rejected') {
    return { label: 'مرفوض', className: 'bg-red-50 text-red-600' };
  }

  if (quiz.approvalStatus === 'pending_review') {
    return { label: 'بانتظار المراجعة', className: 'bg-amber-50 text-amber-600' };
  }

  if (quiz.approvalStatus === 'approved' && quiz.isPublished) {
    return { label: 'معتمد في المستودع', className: 'bg-emerald-50 text-emerald-600' };
  }

  if (quiz.approvalStatus === 'approved') {
    return { label: 'معتمد غير منشور', className: 'bg-blue-50 text-blue-600' };
  }

  return {
    label: quiz.isPublished ? 'منشور قديم' : 'مسودة',
    className: quiz.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600',
  };
};

const getVisibilityMeta = (quiz: Quiz) =>
  quiz.showOnPlatform === false
    ? { label: 'مخفي عن المنصة', className: 'bg-gray-100 text-gray-600' }
    : { label: 'معروض على المنصة', className: 'bg-sky-50 text-sky-700' };

const getAccessMeta = (quiz: Quiz) => {
  if ((quiz.mode || 'regular') === 'central') {
    return { label: 'اختبار موجه', className: 'bg-violet-50 text-violet-700' };
  }

  if (quiz.access.type === 'paid') {
    return { label: 'ضمن باقة / يحتاج تفعيل', className: 'bg-amber-50 text-amber-700' };
  }

  if (quiz.access.type === 'private') {
    return { label: 'خاص / غير مفتوح للجميع', className: 'bg-rose-50 text-rose-700' };
  }

  if (quiz.access.type === 'course_only') {
    return { label: 'داخل دورة فقط', className: 'bg-indigo-50 text-indigo-700' };
  }

  return { label: 'مفتوح للعرض', className: 'bg-emerald-50 text-emerald-700' };
};

const getMeasuredSkillIds = (quiz: Quiz, questions: Question[]) => {
  const directSkillIds = quiz.skillIds || [];
  const questionSkillIds = (quiz.questionIds || []).flatMap((questionId) => {
    const question = questions.find((item) => item.id === questionId);
    return question?.skillIds || [];
  });

  return [...new Set([...directSkillIds, ...questionSkillIds])];
};

const getPlacementPatch = (placement: NonNullable<Quiz['placement']>) => {
  const showInTraining = placement === 'training' || placement === 'both';
  const showInMock = placement === 'mock' || placement === 'both';

  return {
    placement,
    showInTraining,
    showInMock,
    type: showInTraining && !showInMock ? 'bank' : 'quiz',
  } satisfies Pick<Quiz, 'placement' | 'showInTraining' | 'showInMock' | 'type'>;
};

const hasPlacementDrift = (quiz: Quiz) => {
  const normalized = normalizeQuizPlacement(quiz, quiz.type || 'quiz');

  return (
    quiz.type !== normalized.type ||
    quiz.placement !== normalized.placement ||
    quiz.showInTraining !== normalized.showInTraining ||
    quiz.showInMock !== normalized.showInMock
  );
};

const getQuizReadinessMeta = (quiz: Quiz, questions: Question[]) => {
  const issues: string[] = [];
  const measuredSkillIds = getMeasuredSkillIds(quiz, questions);
  const questionCount = quiz.questionIds?.length || 0;
  const isVisible = quiz.showOnPlatform !== false;
  const isApproved = !quiz.approvalStatus || quiz.approvalStatus === 'approved';
  const isDirected = (quiz.targetGroupIds || []).length > 0 || (quiz.targetUserIds || []).length > 0 || (quiz.access.allowedGroupIds || []).length > 0;

  if (!quiz.pathId) issues.push('لم يتم تحديد المسار');
  if (!quiz.subjectId) issues.push('لم يتم تحديد المادة');
  if (questionCount === 0) issues.push('لا توجد أسئلة داخل الاختبار');
  if (measuredSkillIds.length === 0) issues.push('لا توجد مهارات مقاسة من الأسئلة');
  if ((quiz.mode || 'regular') === 'central' && !isDirected) issues.push('الاختبار الموجّه يحتاج مجموعة أو طلابًا محددين');
  if (isVisible && (!quiz.isPublished || !isApproved)) issues.push('ظاهر للمنصة قبل اكتمال الاعتماد والنشر');

  if (issues.length === 0) {
    return {
      label: 'جاهز للنشر الآمن',
      issues,
      className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      icon: 'ready' as const,
    };
  }

  if (issues.length <= 2) {
    return {
      label: 'يحتاج مراجعة بسيطة',
      issues,
      className: 'bg-amber-50 text-amber-700 border-amber-100',
      icon: 'warn' as const,
    };
  }

  return {
    label: 'غير جاهز للطالب',
    issues,
    className: 'bg-rose-50 text-rose-700 border-rose-100',
    icon: 'warn' as const,
  };
};

export const QuizzesManager: React.FC<QuizzesManagerProps> = ({ subjectId, filterType }) => {
  const {
    user,
    quizzes: globalQuizzes,
    deleteQuiz,
    updateQuiz,
    paths,
    subjects,
    sections,
    skills,
    questions,
    users,
    groups,
    addQuiz,
  } = useStore();

  const canReview = user.role === 'admin';
  const managedPathIds = user.managedPathIds || [];
  const managedSubjectIds = user.managedSubjectIds || [];
  const allowedPaths =
    user.role === 'teacher'
      ? paths.filter((path) => managedPathIds.length === 0 || managedPathIds.includes(path.id))
      : paths;
  const allowedSubjects =
    user.role === 'teacher'
      ? subjects.filter((subject) => {
          if (managedSubjectIds.length > 0) return managedSubjectIds.includes(subject.id);
          if (managedPathIds.length > 0) return managedPathIds.includes(subject.pathId);
          return true;
        })
      : subjects;

  const initialManagerParams = useMemo(() => getQuizManagerParams(), []);
  const openedFromReports = initialManagerParams.get('source') === 'reports';
  const [selectedPathId, setSelectedPathId] = useState(initialManagerParams.get('pathId') || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjectId || initialManagerParams.get('subjectId') || '');
  const [selectedSectionId, setSelectedSectionId] = useState(initialManagerParams.get('sectionId') || '');
  const [selectedSkillId, setSelectedSkillId] = useState(initialManagerParams.get('skillId') || '');
  const initialTargetUserId = initialManagerParams.get('targetUserId') || '';
  const initialTargetGroupId = initialManagerParams.get('targetGroupId') || '';
  const [modeFilter, setModeFilter] = useState<'all' | 'regular' | 'saher' | 'central'>(
    initialManagerParams.get('mode') === 'central' ? 'central' : initialManagerParams.get('mode') === 'saher' ? 'saher' : initialManagerParams.get('mode') === 'regular' ? 'regular' : 'all',
  );
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'shown' | 'hidden'>('all');
  const [learningSlotFilter, setLearningSlotFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const activeSubject = useMemo(
    () => allowedSubjects.find((subject) => subject.id === (selectedSubjectId || subjectId)),
    [allowedSubjects, selectedSubjectId, subjectId],
  );
  const activePathId = selectedPathId || activeSubject?.pathId || '';
  const activeSubjectId = selectedSubjectId || subjectId || '';
  const isLearningSpaceManager = Boolean(filterType && activePathId && activeSubjectId);
  const activeLearningSlot: LearningPlacementSlot | null = filterType === 'bank' ? 'training' : filterType === 'quiz' ? 'tests' : null;
  const activeLearningScope = activeLearningSlot && activePathId && activeSubjectId
    ? { pathId: activePathId, subjectId: activeSubjectId, slot: activeLearningSlot }
    : null;
  const activeLearningSlotLabel = activeLearningSlot === 'training' ? 'التدريب' : activeLearningSlot === 'tests' ? 'الاختبارات' : 'هذه المساحة';

  const reportContextSkill = selectedSkillId ? skills.find((skill) => skill.id === selectedSkillId) : undefined;
  const reportContextSubject = selectedSubjectId ? subjects.find((subject) => subject.id === selectedSubjectId) : undefined;
  const reportContextStudent = initialTargetUserId ? users.find((student) => student.id === initialTargetUserId) : undefined;
  const reportContextGroup = initialTargetGroupId ? groups.find((group) => group.id === initialTargetGroupId) : undefined;

  const availableSections = useMemo(
    () =>
      sections
        .filter((section) => section.subjectId === selectedSubjectId && allowedSubjects.some((subject) => subject.id === section.subjectId))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [allowedSubjects, sections, selectedSubjectId],
  );

  const availableSubSkills = useMemo(
    () =>
      skills
        .filter((skill) => {
          if (!selectedSubjectId || skill.subjectId !== selectedSubjectId) return false;
          if (selectedSectionId && skill.sectionId !== selectedSectionId) return false;
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [skills, selectedSectionId, selectedSubjectId],
  );

  const quizzes = useMemo(
    () =>
      globalQuizzes.filter((quiz) => {
        if (!isMaterialQuizCandidate(quiz)) return false;
        if (user.role === 'teacher') {
          if (managedSubjectIds.length > 0 && !managedSubjectIds.includes(quiz.subjectId)) return false;
          if (managedPathIds.length > 0 && quiz.pathId && !managedPathIds.includes(quiz.pathId)) return false;
        }
        if (!isLearningSpaceManager && filterType === 'bank' && !isTrainingQuiz(quiz)) return false;
        if (!isLearningSpaceManager && filterType === 'quiz' && !isMockQuiz(quiz)) return false;
        if (subjectId && quiz.subjectId !== subjectId) return false;
        if (selectedSubjectId && quiz.subjectId !== selectedSubjectId) return false;
        if (
          selectedSectionId &&
          quiz.sectionId !== selectedSectionId &&
          !getMeasuredSkillIds(quiz, questions).some((skillId) => skills.find((skill) => skill.id === skillId)?.sectionId === selectedSectionId)
        ) {
          return false;
        }
        if (selectedPathId && !subjectId && !selectedSubjectId && quiz.pathId !== selectedPathId) return false;
        if (selectedSkillId && !getMeasuredSkillIds(quiz, questions).includes(selectedSkillId)) return false;
        if (isLearningSpaceManager && activeLearningScope) {
          const isVisibleHere = isQuizVisibleInLearningSlot(quiz, activeLearningScope);
          if (learningSlotFilter === 'visible' && !isVisibleHere) return false;
          if (learningSlotFilter === 'hidden' && isVisibleHere) return false;
        }
        if (modeFilter !== 'all' && (quiz.mode || 'regular') !== modeFilter) return false;
        if (visibilityFilter === 'shown' && quiz.showOnPlatform === false) return false;
        if (visibilityFilter === 'hidden' && quiz.showOnPlatform !== false) return false;
        return true;
      }),
    [
      filterType,
      activeLearningScope,
      globalQuizzes,
      isLearningSpaceManager,
      learningSlotFilter,
      managedPathIds,
      managedSubjectIds,
      modeFilter,
      questions,
      selectedPathId,
      selectedSectionId,
      selectedSkillId,
      selectedSubjectId,
      skills,
      subjectId,
      user.role,
      visibilityFilter,
    ],
  );

  const learningSpaceQuizzes = useMemo(
    () => {
      if (!isLearningSpaceManager || !activeLearningScope) return [];

      return globalQuizzes.filter((quiz) => {
        if (!isMaterialQuizCandidate(quiz)) return false;
        if (user.role === 'teacher') {
          if (managedSubjectIds.length > 0 && !managedSubjectIds.includes(quiz.subjectId)) return false;
          if (managedPathIds.length > 0 && quiz.pathId && !managedPathIds.includes(quiz.pathId)) return false;
        }
        if (quiz.pathId !== activeLearningScope.pathId || quiz.subjectId !== activeLearningScope.subjectId) return false;
        if (
          selectedSectionId &&
          quiz.sectionId !== selectedSectionId &&
          !getMeasuredSkillIds(quiz, questions).some((skillId) => skills.find((skill) => skill.id === skillId)?.sectionId === selectedSectionId)
        ) {
          return false;
        }
        if (selectedSkillId && !getMeasuredSkillIds(quiz, questions).includes(selectedSkillId)) return false;
        if (modeFilter !== 'all' && (quiz.mode || 'regular') !== modeFilter) return false;
        if (visibilityFilter === 'shown' && quiz.showOnPlatform === false) return false;
        if (visibilityFilter === 'hidden' && quiz.showOnPlatform !== false) return false;
        return true;
      });
    },
    [
      activeLearningScope,
      globalQuizzes,
      isLearningSpaceManager,
      managedPathIds,
      managedSubjectIds,
      modeFilter,
      questions,
      selectedSectionId,
      selectedSkillId,
      skills,
      user.role,
      visibilityFilter,
    ],
  );

  const filteredQuizzes = useMemo(
    () =>
      quizzes
        .filter((quiz) => quiz.title.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
          if (!activeLearningScope) return (b.createdAt || 0) - (a.createdAt || 0);
          const aVisible = isQuizVisibleInLearningSlot(a, activeLearningScope) ? 1 : 0;
          const bVisible = isQuizVisibleInLearningSlot(b, activeLearningScope) ? 1 : 0;
          return bVisible - aVisible || (b.createdAt || 0) - (a.createdAt || 0);
        }),
    [activeLearningScope, quizzes, searchTerm],
  );

  const counts = useMemo(
    () => ({
      all: globalQuizzes.filter(isMaterialQuizCandidate).length,
      saher: globalQuizzes.filter((quiz) => isMaterialQuizCandidate(quiz) && (quiz.mode || 'regular') === 'saher').length,
      central: globalQuizzes.filter((quiz) => isMaterialQuizCandidate(quiz) && (quiz.mode || 'regular') === 'central').length,
      hidden: globalQuizzes.filter((quiz) => isMaterialQuizCandidate(quiz) && quiz.showOnPlatform === false).length,
    }),
    [globalQuizzes],
  );

  const scopedCounts = useMemo(
    () => {
      const sourceQuizzes = activeLearningScope ? learningSpaceQuizzes : quizzes;
      const readiness = sourceQuizzes.map((quiz) => getQuizReadinessMeta(quiz, questions));

      return {
        total: sourceQuizzes.length,
        visible: sourceQuizzes.filter((quiz) => quiz.showOnPlatform !== false).length,
        hidden: sourceQuizzes.filter((quiz) => quiz.showOnPlatform === false).length,
        visibleHere: activeLearningScope ? sourceQuizzes.filter((quiz) => isQuizVisibleInLearningSlot(quiz, activeLearningScope)).length : 0,
        hiddenHere: activeLearningScope ? sourceQuizzes.filter((quiz) => !isQuizVisibleInLearningSlot(quiz, activeLearningScope)).length : 0,
        pending: sourceQuizzes.filter((quiz) => quiz.approvalStatus === 'pending_review').length,
        ready: readiness.filter((item) => item.issues.length === 0).length,
        needsReview: readiness.filter((item) => item.issues.length > 0).length,
        placementDrift: sourceQuizzes.filter(hasPlacementDrift).length,
      };
    },
    [activeLearningScope, learningSpaceQuizzes, questions, quizzes],
  );

  const managerTitle = filterType === 'bank' ? 'إدارة التدريب من مركز الاختبارات' : filterType === 'quiz' ? 'إدارة الاختبارات من مركز الاختبارات' : 'مركز الاختبارات';
  const managerDescription =
    filterType === 'bank'
      ? 'اختر هنا الاختبارات التي تظهر في تبويب التدريب فقط. أي اختبار جديد تضيفه هنا يبقى محفوظًا داخل مركز الاختبارات ومصنفًا على نفس المسار والمادة.'
      : filterType === 'quiz'
        ? 'اختر هنا الاختبارات التي تظهر في تبويب الاختبارات داخل هذه المادة فقط. الاختبار نفسه يبقى محفوظًا في مركز الاختبارات ويمكن استخدامه في أكثر من مساحة.'
        : 'هذا هو المصدر الرئيسي لكل التدريبات والاختبارات. من هنا تحدد مكان ظهور كل اختبار للطالب.';

  const quizzesWithoutQuestions = useMemo(
    () => globalQuizzes.filter((quiz) => isMaterialQuizCandidate(quiz) && (quiz.questionIds || []).length === 0).length,
    [globalQuizzes],
  );

  const quizzesWithoutMeasuredSkills = useMemo(
    () =>
      globalQuizzes.filter((quiz) => {
        if (!isMaterialQuizCandidate(quiz)) return false;
        return getMeasuredSkillIds(quiz, questions).length === 0;
      }).length,
    [globalQuizzes, questions],
  );

  const measuredSkillNames = (quiz: Quiz) => {
    return getMeasuredSkillIds(quiz, questions).map((skillId) => skills.find((skill) => skill.id === skillId)?.name).filter(Boolean) as string[];
  };

  const measuredSectionNames = (quiz: Quiz) => {
    const uniqueSectionIds = [
      ...new Set(
        getMeasuredSkillIds(quiz, questions)
          .map((skillId) => skills.find((skill) => skill.id === skillId)?.sectionId)
          .filter(Boolean),
      ),
    ];

    return uniqueSectionIds.map((sectionId) => sections.find((section) => section.id === sectionId)?.name).filter(Boolean) as string[];
  };

  const handleCreateNew = () => {
    if (isLearningSpaceManager) {
      handleCreateByMode('regular');
      return;
    }
    setEditingQuizId(null);
    setIsEditing(true);
  };

  const handleCreateByMode = (mode: 'regular' | 'saher' | 'central') => {
    const draftSubjectId = selectedSubjectId || subjectId || '';
    const createdAt = Date.now();
    const draftQuiz: Quiz = {
      id: `quiz_${createdAt}_${mode}`,
      title: mode === 'saher' ? 'اختبار ساهر جديد' : mode === 'central' ? 'اختبار موجّه جديد' : 'اختبار جديد',
      description: '',
      pathId: activePathId,
      subjectId: draftSubjectId,
      ...getQuizPlacementDefaults(filterType || 'quiz'),
      learningPlacements:
        activeLearningSlot && activePathId && draftSubjectId
          ? [{ pathId: activePathId, subjectId: draftSubjectId, slot: activeLearningSlot, accessType: 'free', isVisible: true, order: 0, createdAt }]
          : [],
      mode,
      settings: getDefaultQuizSettings({
        type: filterType || 'quiz',
        mode,
        learningSlot: activeLearningSlot,
      }),
      access: mode === 'central' ? { type: 'private', allowedGroupIds: [] } : { type: 'free', allowedGroupIds: [] },
      questionIds: [],
      skillIds: selectedSkillId ? [selectedSkillId] : [],
      createdAt,
      isPublished: false,
      showOnPlatform: false,
      targetGroupIds: initialTargetGroupId ? [initialTargetGroupId] : [],
      targetUserIds: initialTargetUserId ? [initialTargetUserId] : [],
      dueDate: '',
      approvalStatus: 'draft',
    };

    addQuiz(draftQuiz);
    setEditingQuizId(draftQuiz.id);
    setIsEditing(true);
  };

  const handleEdit = (id: string) => {
    setEditingQuizId(id);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الاختبار نهائيًا؟')) {
      deleteQuiz(id);
    }
  };

  const handleDuplicate = (quiz: Quiz) => {
    addQuiz({
      ...quiz,
      id: `quiz_${Date.now()}_copy`,
      title: `${quiz.title} (نسخة)`,
      approvalStatus: 'draft',
      isPublished: false,
      showOnPlatform: false,
    });
  };

  const handleApprove = (quiz: Quiz) => {
    updateQuiz(quiz.id, {
      approvalStatus: 'approved',
      isPublished: true,
      approvedAt: Date.now(),
    });
  };

  const handleReject = (quiz: Quiz) => {
    updateQuiz(quiz.id, {
      approvalStatus: 'rejected',
      isPublished: false,
    });
  };

  const handleToggleRepositoryPublish = (quiz: Quiz) => {
    updateQuiz(quiz.id, {
      isPublished: !quiz.isPublished,
    });
  };

  const handleTogglePlatformVisibility = (quiz: Quiz) => {
    updateQuiz(quiz.id, {
      showOnPlatform: quiz.showOnPlatform === false,
    });
  };

  const handleSetPlacement = (quiz: Quiz, placement: NonNullable<Quiz['placement']>) => {
    updateQuiz(quiz.id, getPlacementPatch(placement));
  };

  const handleToggleLearningSlotVisibility = (quiz: Quiz) => {
    if (!activeLearningSlot || !activePathId || !activeSubjectId) return;

    const isVisibleHere = isQuizVisibleInLearningSlot(quiz, {
      pathId: activePathId,
      subjectId: activeSubjectId,
      slot: activeLearningSlot,
    });

    updateQuiz(quiz.id, {
      pathId: quiz.pathId || activePathId,
      subjectId: quiz.subjectId || activeSubjectId,
      learningPlacements: setQuizLearningSlotVisibility(
        quiz,
        { pathId: activePathId, subjectId: activeSubjectId, slot: activeLearningSlot },
        !isVisibleHere,
      ),
      showOnPlatform: !isVisibleHere ? true : quiz.showOnPlatform,
      isPublished: !isVisibleHere ? true : quiz.isPublished,
      approvalStatus: !isVisibleHere ? 'approved' : quiz.approvalStatus,
      approvedAt: !isVisibleHere ? quiz.approvedAt || Date.now() : quiz.approvedAt,
    });
  };

  const handleToggleLearningSlotAccess = (quiz: Quiz) => {
    if (!activeLearningScope) return;

    const currentAccess = getQuizLearningPlacementAccessType(quiz, activeLearningScope);
    const nextAccess = currentAccess === 'paid' ? 'free' : 'paid';

    updateQuiz(quiz.id, {
      pathId: quiz.pathId || activePathId,
      subjectId: quiz.subjectId || activeSubjectId,
      learningPlacements: setQuizLearningSlotAccess(quiz, activeLearningScope, nextAccess),
      showOnPlatform: true,
      isPublished: true,
      approvalStatus: 'approved',
      approvedAt: quiz.approvedAt || Date.now(),
    });
  };

  const handlePrepareQuizForLearner = (quiz: Quiz) => {
    const normalizedPlacement = normalizeQuizPlacement(quiz, quiz.type || 'quiz').placement || 'mock';
    const targetPlacement = filterType === 'bank' ? 'training' : filterType === 'quiz' ? 'mock' : normalizedPlacement;

    const learningPlacementPatch =
      activeLearningSlot && activePathId && activeSubjectId
        ? {
            learningPlacements: setQuizLearningSlotVisibility(
              quiz,
              { pathId: activePathId, subjectId: activeSubjectId, slot: activeLearningSlot },
              true,
            ),
          }
        : {};

    updateQuiz(quiz.id, {
      pathId: quiz.pathId || activePathId,
      subjectId: quiz.subjectId || selectedSubjectId || subjectId || '',
      ...(!activeLearningSlot ? getPlacementPatch(targetPlacement) : {}),
      ...learningPlacementPatch,
      showOnPlatform: true,
      isPublished: true,
      approvalStatus: 'approved',
      approvedAt: quiz.approvedAt || Date.now(),
    });
  };

  const handleNormalizeVisiblePlacement = () => {
    const targets = quizzes.filter(hasPlacementDrift);
    targets.forEach((quiz) => {
      updateQuiz(quiz.id, normalizeQuizPlacement(quiz, filterType || quiz.type || 'quiz'));
    });
  };

  const handlePreviewQuiz = (quiz: Quiz) => {
    setPreviewQuiz(quiz);
  };

  const downloadQuizzesReadinessExport = async () => {
    const XLSX = await loadXlsx();
    const workbook = XLSX.utils.book_new();
    const quizRows = [
      [
        'اسم الاختبار',
        'النوع',
        'المسار',
        'المادة',
        'المهارات الرئيسية المقاسة',
        'المهارات الفرعية المقاسة',
        'عدد الأسئلة',
        'حالة المستودع',
        'الظهور على المنصة',
        'نوع الوصول',
        'جاهزية النشر',
        'ملاحظات قبل النشر',
      ],
      ...filteredQuizzes.map((quiz) => {
        const readiness = getQuizReadinessMeta(quiz, questions);
        const status = getStatusMeta(quiz);
        const visibility = getVisibilityMeta(quiz);
        const access = getAccessMeta(quiz);
        const pathName = paths.find((path) => path.id === quiz.pathId)?.name || '-';
        const subjectName = subjects.find((subject) => subject.id === quiz.subjectId)?.name || '-';

        return [
          quiz.title,
          (quiz.mode || 'regular') === 'saher' ? 'ساهر' : (quiz.mode || 'regular') === 'central' ? 'موجه/مركزي' : 'عادي',
          pathName,
          subjectName,
          measuredSectionNames(quiz).join('، ') || '-',
          measuredSkillNames(quiz).join('، ') || '-',
          quiz.questionIds?.length || 0,
          status.label,
          visibility.label,
          access.label,
          readiness.label,
          readiness.issues.join(' | ') || 'جاهز',
        ];
      }),
    ];
    const summaryRows = [
      ['البند', 'القيمة'],
      ['إجمالي العناصر الحالية', scopedCounts.total],
      ['المعروض على المنصة', scopedCounts.visible],
      ['المخفي عن الطلاب', scopedCounts.hidden],
      ['بانتظار المراجعة', scopedCounts.pending],
      ['جاهز للنشر الآمن', scopedCounts.ready],
      ['يحتاج ضبط قبل العرض', scopedCounts.needsReview],
      ['بلا أسئلة', quizzesWithoutQuestions],
      ['بلا مهارات مقاسة', quizzesWithoutMeasuredSkills],
      ['تاريخ التصدير', new Date().toLocaleString('ar-SA')],
    ];

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(quizRows), 'quizzes');
    XLSX.writeFile(workbook, filterType === 'bank' ? 'training-bank-readiness.xlsx' : 'quizzes-readiness.xlsx');
  };

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-120px)] animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">{editingQuizId ? 'تعديل الاختبار' : 'إنشاء اختبار جديد'}</h3>
          <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-700 font-bold text-sm">
            العودة للقائمة
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <QuizBuilder initialQuizId={editingQuizId || undefined} initialSubjectId={selectedSubjectId || undefined} initialType={filterType} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{managerTitle}</h2>
          <p className="text-gray-500 text-sm mt-1">{managerDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadQuizzesReadinessExport}
            className="bg-white text-emerald-700 border border-emerald-100 px-4 py-2 rounded-xl font-bold hover:bg-emerald-50 transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            تصدير الجاهزية
          </button>
          <button
            onClick={handleCreateNew}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            إنشاء اختبار جديد
          </button>
          {!filterType && <button onClick={() => handleCreateByMode('saher')} className="bg-purple-50 text-purple-700 px-4 py-2 rounded-xl font-bold hover:bg-purple-100 transition-colors">
            + اختبار ساهر
          </button>}
          {!filterType && <button onClick={() => handleCreateByMode('central')} className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-bold hover:bg-amber-100 transition-colors">
            + اختبار موجّه
          </button>}
        </div>
      </div>

      {openedFromReports && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-black text-amber-900">فتح من تقرير الأداء</h3>
              <p className="mt-1 text-xs font-bold leading-6 text-amber-800">
                تم ضبط مركز الاختبارات على الاختبارات الموجهة
                {reportContextSkill ? ` ومهارة ${reportContextSkill.name}` : ''}
                {reportContextSubject ? ` في ${reportContextSubject.name}` : ''}
                {reportContextStudent ? ` للطالب ${reportContextStudent.name}` : ''}
                {reportContextGroup ? ` للمجموعة ${reportContextGroup.name}` : ''}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCreateByMode('central')}
              className="self-start rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-600"
            >
              إنشاء اختبار متابعة الآن
            </button>
          </div>
        </div>
      )}

      {filterType && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-black text-indigo-900">الاستدعاء هنا من مركز الاختبارات نفسه</h3>
              <p className="mt-1 text-xs font-bold leading-6 text-indigo-700">
                لا توجد نسخة منفصلة داخل مساحة التعلم. أي اختبار تعدله هنا هو نفس الاختبار الموجود في مركز الاختبارات، والفصل يتم فقط بتحديد مكان الظهور:
                {filterType === 'bank' ? ' تدريب هذه المادة.' : ' اختبارات هذه المادة.'}
              </p>
            </div>
            <div className="rounded-xl bg-white px-4 py-3 text-xs font-black text-slate-700">
              {activeSubject ? `المادة الحالية: ${activeSubject.name}` : 'اختر مادة لضمان الربط الصحيح'}
            </div>
          </div>
        </div>
      )}

      {isLearningSpaceManager && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-black text-emerald-700">ظاهر للطالب هنا</p>
            <p className="mt-2 text-3xl font-black text-emerald-700">{scopedCounts.visibleHere}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-black text-gray-500">متاح في المستودع</p>
            <p className="mt-2 text-3xl font-black text-gray-900">{scopedCounts.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-black text-amber-700">غير ظاهر هنا</p>
            <p className="mt-2 text-3xl font-black text-amber-700">{scopedCounts.hiddenHere}</p>
          </div>
        </div>
      )}

      {isLearningSpaceManager && (
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-xs font-bold leading-6 text-slate-500">
              الظاهر للطالب في {activeLearningSlotLabel} هو ما تم اختياره من هذه اللوحة فقط. الباقي محفوظ في مركز الاختبارات ويمكن استدعاؤه لاحقًا.
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'visible' as const, label: 'الظاهر للطالب', count: scopedCounts.visibleHere },
                { value: 'hidden' as const, label: 'إضافة من المستودع', count: scopedCounts.hiddenHere },
                { value: 'all' as const, label: 'عرض الكل', count: scopedCounts.total },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setLearningSlotFilter(item.value)}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                    learningSlotFilter === item.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                  }`}
                >
                  {item.label}
                  <span className="mr-2 rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-slate-700">{item.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLearningSpaceManager && <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">إجمالي العناصر في هذا المستودع</p>
          <p className="text-2xl font-black text-gray-900">{scopedCounts.total}</p>
        </div>
        <div className="bg-white border border-purple-100 rounded-xl p-4">
          <p className="text-xs text-purple-500 mb-1">المعروض حاليًا على المنصة</p>
          <p className="text-2xl font-black text-purple-700">{scopedCounts.visible}</p>
        </div>
        <div className="bg-white border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-600 mb-1">المخفي عن الطلاب</p>
          <p className="text-2xl font-black text-amber-700">{scopedCounts.hidden}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">بانتظار المراجعة</p>
          <p className="text-2xl font-black text-gray-800">{scopedCounts.pending}</p>
        </div>
        <div className="bg-white border border-red-100 rounded-xl p-4">
          <p className="text-xs text-red-500 mb-1">بلا أسئلة</p>
          <p className="text-2xl font-black text-red-600">{quizzesWithoutQuestions}</p>
        </div>
        <div className="bg-white border border-indigo-100 rounded-xl p-4">
          <p className="text-xs text-indigo-500 mb-1">تصنيف قديم يحتاج تثبيت</p>
          <p className="text-2xl font-black text-indigo-700">{scopedCounts.placementDrift}</p>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-4">
          <p className="text-xs text-emerald-600 mb-1">جاهز للنشر الآمن</p>
          <p className="text-2xl font-black text-emerald-700">{scopedCounts.ready}</p>
        </div>
        <div className="bg-white border border-rose-100 rounded-xl p-4">
          <p className="text-xs text-rose-500 mb-1">يحتاج ضبط قبل العرض</p>
          <p className="text-2xl font-black text-rose-600">{scopedCounts.needsReview}</p>
        </div>
      </div>}

      {!filterType && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-purple-100 rounded-xl p-4">
            <p className="text-xs text-purple-500 mb-1">اختبارات ساهر</p>
            <p className="text-2xl font-black text-purple-700">{counts.saher}</p>
          </div>
          <div className="bg-white border border-amber-100 rounded-xl p-4">
            <p className="text-xs text-amber-600 mb-1">اختبارات موجّهة</p>
            <p className="text-2xl font-black text-amber-700">{counts.central}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">كل الاختبارات في النظام</p>
            <p className="text-2xl font-black text-gray-800">{counts.all}</p>
          </div>
        </div>
      )}

      {!isLearningSpaceManager && <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-1">عناصر بلا مهارات مقاسة</div>
        <div className="text-2xl font-black text-gray-900">{quizzesWithoutMeasuredSkills}</div>
      </div>}

      {!isLearningSpaceManager && scopedCounts.placementDrift > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-black text-indigo-900">يوجد اختبارات قديمة تحتاج تثبيت التصنيف</h3>
              <p className="mt-1 text-xs leading-6 text-indigo-700">
                هذا لا يحذف أي شيء. سيضيف حقول الظهور الحديثة حتى يعرف النظام هل الاختبار يظهر في التدريب أو المحاكي أو الاثنين.
              </p>
            </div>
            <button
              onClick={handleNormalizeVisiblePlacement}
              className="self-start rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700"
            >
              تثبيت تصنيف العناصر الحالية
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {!subjectId && (
          <>
            <select
              value={selectedPathId}
              onChange={(event) => {
                setSelectedPathId(event.target.value);
                setSelectedSubjectId('');
                setSelectedSectionId('');
                setSelectedSkillId('');
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">كل المسارات</option>
              {allowedPaths.map((path) => (
                <option key={path.id} value={path.id}>
                  {path.name}
                </option>
              ))}
            </select>

            <select
              value={selectedSubjectId}
              onChange={(event) => {
                setSelectedSubjectId(event.target.value);
                setSelectedSectionId('');
                setSelectedSkillId('');
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={!selectedPathId}
            >
              <option value="">كل المواد</option>
              {allowedSubjects
                .filter((subject) => subject.pathId === selectedPathId)
                .map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
            </select>
          </>
        )}

        <select
          value={selectedSectionId}
          onChange={(event) => {
            setSelectedSectionId(event.target.value);
            setSelectedSkillId('');
          }}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={!selectedSubjectId}
        >
          <option value="">كل المهارات الرئيسية</option>
          {availableSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>

        <select
          value={selectedSkillId}
          onChange={(event) => setSelectedSkillId(event.target.value)}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={!selectedSubjectId}
        >
          <option value="">كل المهارات الفرعية</option>
          {availableSubSkills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>

        {!filterType && (
          <select
            value={modeFilter}
            onChange={(event) => setModeFilter(event.target.value as typeof modeFilter)}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">كل الأنماط</option>
            <option value="regular">اختبار عادي</option>
            <option value="saher">اختبار ساهر</option>
            <option value="central">اختبار موجّه</option>
          </select>
        )}

        {isLearningSpaceManager && (
          <select
            value={learningSlotFilter}
            onChange={(event) => setLearningSlotFilter(event.target.value as typeof learningSlotFilter)}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">كل اختبارات المستودع</option>
            <option value="visible">الظاهر هنا فقط</option>
            <option value="hidden">غير الظاهر هنا</option>
          </select>
        )}

        <select
          value={visibilityFilter}
          onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">كل حالات العرض</option>
          <option value="shown">المعروض فقط</option>
          <option value="hidden">المخفي فقط</option>
        </select>

        <div className="relative md:col-span-2 xl:col-span-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="ابحث في عنوان الاختبار..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">عنوان الاختبار</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">النوع</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">عدد الأسئلة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">المادة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">المهارات المقاسة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">النمط</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">الحالة</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredQuizzes.map((quiz) => {
                const measuredSkills = measuredSkillNames(quiz);
                const measuredSections = measuredSectionNames(quiz);
                const statusMeta = getStatusMeta(quiz);
                const visibilityMeta = getVisibilityMeta(quiz);
                const readinessMeta = getQuizReadinessMeta(quiz, questions);
                const isVisibleHereForRow = activeLearningScope ? isQuizVisibleInLearningSlot(quiz, activeLearningScope) : false;
                const accessHereForRow = activeLearningScope ? getQuizLearningPlacementAccessType(quiz, activeLearningScope) : 'inherit';
                const accessHereLabel = accessHereForRow === 'paid' ? 'ضمن باقة هنا' : accessHereForRow === 'free' ? 'مجاني هنا' : 'حسب الأصل';
                const accessHereClassName =
                  accessHereForRow === 'paid'
                    ? 'bg-amber-100 text-amber-700'
                    : accessHereForRow === 'free'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600';

                return (
                  <tr
                    key={quiz.id}
                    className={`transition-colors hover:bg-gray-50 ${isVisibleHereForRow ? 'bg-emerald-50/35' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-500">
                          <FileQuestion size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{quiz.title}</div>
                          <div className="text-[11px] text-gray-400 mt-1">
                            {quiz.ownerType === 'teacher'
                              ? 'اختبار معلم'
                              : quiz.ownerType === 'school'
                                ? 'اختبار مدرسة'
                                : 'اختبار المنصة'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <span className="text-sm font-bold text-gray-700">{getQuizPlacementLabel(quiz)}</span>
                        {hasPlacementDrift(quiz) ? (
                          <div className="inline-flex w-fit rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                            يحتاج تثبيت
                          </div>
                        ) : null}
                        <div className="text-[11px] text-gray-400">من مركز الاختبارات</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{quiz.questionIds?.length || 0} سؤال</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-bold">
                        {subjects.find((subject) => subject.id === quiz.subjectId)?.name || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 max-w-xs">
                        {measuredSkills.length > 0 ? (
                          <>
                            {measuredSections.slice(0, 1).map((sectionName) => (
                              <span key={`${quiz.id}-${sectionName}`} className="px-2 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700">
                                {sectionName}
                              </span>
                            ))}
                            {measuredSkills.slice(0, 3).map((skillName) => (
                              <span key={`${quiz.id}-${skillName}`} className="px-2 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                                {skillName}
                              </span>
                            ))}
                            {measuredSkills.length > 3 && <span className="text-xs text-gray-500">+{measuredSkills.length - 3}</span>}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">لا توجد مهارات مقاسة بعد</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          (quiz.mode || 'regular') === 'central'
                            ? 'bg-amber-50 text-amber-700'
                            : (quiz.mode || 'regular') === 'saher'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {(quiz.mode || 'regular') === 'central' ? 'موجّه' : (quiz.mode || 'regular') === 'saher' ? 'ساهر' : 'عادي'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {isLearningSpaceManager ? (
                          <>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                                isVisibleHereForRow ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isVisibleHereForRow ? <CheckCircle2 size={13} /> : <Eye size={13} />}
                              {isVisibleHereForRow ? 'ظاهر هنا' : 'غير ظاهر هنا'}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${accessHereClassName}`}>
                              {accessHereForRow === 'paid' ? <Lock size={13} /> : <LockOpen size={13} />}
                              {accessHereLabel}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${readinessMeta.className}`}
                              title={readinessMeta.issues.join('، ') || 'لا توجد ملاحظات'}
                            >
                              {readinessMeta.icon === 'ready' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                              {readinessMeta.issues.length === 0 ? 'جاهز' : 'يحتاج ضبط'}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${visibilityMeta.className}`}>{visibilityMeta.label}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getAccessMeta(quiz).className}`}>{getAccessMeta(quiz).label}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold ${readinessMeta.className}`} title={readinessMeta.issues.join('، ') || 'لا توجد ملاحظات'}>
                              {readinessMeta.icon === 'ready' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                              {readinessMeta.label}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!isLearningSpaceManager && canReview && quiz.approvalStatus !== 'approved' && (
                          <button
                            onClick={() => handleApprove(quiz)}
                            className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            اعتماد
                          </button>
                        )}
                        {!isLearningSpaceManager && canReview && quiz.approvalStatus !== 'rejected' && (
                          <button
                            onClick={() => handleReject(quiz)}
                            className="px-3 py-1 text-xs font-bold text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            رفض
                          </button>
                        )}
                        {readinessMeta.issues.length > 0 && (
                          <button
                            onClick={() => handlePrepareQuizForLearner(quiz)}
                            className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                            title="ضبط النشر والاعتماد ومكان الظهور حسب هذه المساحة"
                          >
                            {isLearningSpaceManager ? 'تجهيز' : 'تجهيز العرض'}
                          </button>
                        )}
                        {activeLearningSlot && activePathId && activeSubjectId && (
                          <>
                          <button
                            onClick={() => handleToggleLearningSlotVisibility(quiz)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                              isQuizVisibleInLearningSlot(quiz, { pathId: activePathId, subjectId: activeSubjectId, slot: activeLearningSlot })
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            title="هذا الزر يتحكم في ظهوره داخل هذه المساحة فقط"
                          >
                            {isQuizVisibleInLearningSlot(quiz, { pathId: activePathId, subjectId: activeSubjectId, slot: activeLearningSlot })
                              ? 'ظاهر للطالب هنا'
                              : 'أظهر للطالب هنا'}
                          </button>
                          <button
                            onClick={() => handleToggleLearningSlotAccess(quiz)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                              accessHereForRow === 'paid'
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            }`}
                            title="هذا الضبط خاص بمكان العرض الحالي فقط ولا يغير أصل الاختبار في المستودع"
                          >
                            {accessHereForRow === 'paid' ? 'ضمن باقة هنا' : 'مجاني هنا'}
                          </button>
                          </>
                        )}
                        {!isLearningSpaceManager && (
                          <button
                            onClick={() => handleDuplicate(quiz)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="نسخ"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        )}
                        <button onClick={() => handleEdit(quiz.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handlePreviewQuiz(quiz)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="معاينة الاختبار قبل النشر">
                          <Eye size={18} />
                        </button>
                        {!isLearningSpaceManager && (
                          <>
                            <button
                              onClick={() => handleToggleRepositoryPublish(quiz)}
                              className={`p-2 rounded-lg transition-colors ${
                                quiz.isPublished ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'
                              }`}
                              title={quiz.isPublished ? 'إلغاء النشر من المستودع' : 'نشر داخل المستودع'}
                            >
                              {quiz.isPublished ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                            </button>
                            <button
                              onClick={() => handleTogglePlatformVisibility(quiz)}
                              className={`p-2 rounded-lg transition-colors ${
                                quiz.showOnPlatform === false
                                  ? 'text-gray-500 hover:bg-gray-100'
                                  : 'text-sky-600 hover:bg-sky-50'
                              }`}
                              title={quiz.showOnPlatform === false ? 'فتح العرض على المنصة' : 'إخفاء العرض عن المنصة'}
                            >
                              {quiz.showOnPlatform === false ? <Lock size={18} /> : <LockOpen size={18} />}
                            </button>
                          </>
                        )}
                        {!filterType && <div className="flex rounded-xl border border-gray-100 bg-gray-50 p-1">
                          <button
                            onClick={() => handleSetPlacement(quiz, 'training')}
                            className={`rounded-lg px-2 py-1 text-[11px] font-black transition ${
                              isTrainingQuiz(quiz) && !isMockQuiz(quiz) ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-white'
                            }`}
                            title="إظهاره في التدريب فقط"
                          >
                            تدريب
                          </button>
                          <button
                            onClick={() => handleSetPlacement(quiz, 'mock')}
                            className={`rounded-lg px-2 py-1 text-[11px] font-black transition ${
                              isMockQuiz(quiz) && !isTrainingQuiz(quiz) ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-white'
                            }`}
                            title="إظهاره في الاختبارات فقط"
                          >
                            اختبار
                          </button>
                          <button
                            onClick={() => handleSetPlacement(quiz, 'both')}
                            className={`rounded-lg px-2 py-1 text-[11px] font-black transition ${
                              isMockQuiz(quiz) && isTrainingQuiz(quiz) ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-white'
                            }`}
                            title="إظهاره في التدريب والاختبارات"
                          >
                            الاثنين
                          </button>
                        </div>}
                        {!isLearningSpaceManager && (
                          <button onClick={() => handleDelete(quiz.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredQuizzes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    لا توجد اختبارات مطابقة للبحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewQuiz ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6" onClick={() => setPreviewQuiz(null)}>
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <div className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">معاينة الاختبار</div>
                <h3 className="mt-3 text-xl font-black text-gray-900">{previewQuiz.title}</h3>
                <p className="mt-1 text-sm leading-7 text-gray-500">هذه المعاينة مختصرة وواضحة قبل النشر أو قبل الفتح للطالب.</p>
              </div>
              <button
                onClick={() => setPreviewQuiz(null)}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                aria-label="إغلاق المعاينة"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-black text-slate-500">المسار</div>
                <div className="mt-2 text-sm font-black text-slate-900">{paths.find((path) => path.id === previewQuiz.pathId)?.name || 'غير محدد'}</div>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-4">
                <div className="text-xs font-black text-indigo-500">المادة</div>
                <div className="mt-2 text-sm font-black text-indigo-900">{subjects.find((subject) => subject.id === previewQuiz.subjectId)?.name || 'غير محدد'}</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <div className="text-xs font-black text-emerald-500">النمط</div>
                <div className="mt-2 text-sm font-black text-emerald-900">
                  {(previewQuiz.mode || 'regular') === 'saher' ? 'ساهر' : (previewQuiz.mode || 'regular') === 'central' ? 'موجه / مركزي' : 'عادي'}
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <div className="text-xs font-black text-amber-500">الأسئلة</div>
                <div className="mt-2 text-sm font-black text-amber-900">{previewQuiz.questionIds?.length || 0} سؤال</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-black text-gray-800">
                  <PlayCircle size={16} className="text-violet-500" />
                  جاهزية النشر
                </div>
                <div className="mt-4 grid gap-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                    الحالة: {getStatusMeta(previewQuiz).label}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                    الظهور: {getVisibilityMeta(previewQuiz).label}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                    الوصول: {getAccessMeta(previewQuiz).label}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                    الجاهزية: {getQuizReadinessMeta(previewQuiz, questions).label}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(measuredSectionNames(previewQuiz) || []).slice(0, 4).map((sectionName) => (
                    <span key={sectionName} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                      {sectionName}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-sm font-black text-gray-800">
                  <BookOpen size={16} className="text-emerald-500" />
                  أول أسئلة داخل الاختبار
                </div>
                <div className="mt-4 space-y-3">
                  {(previewQuiz.questionIds || []).slice(0, 3).map((questionId, index) => {
                    const question = questions.find((item) => item.id === questionId);
                    return (
                      <div key={questionId} className="rounded-2xl border border-white bg-white p-3 shadow-sm">
                        <div className="text-[11px] font-black text-gray-400">سؤال {index + 1}</div>
                        <div className="mt-1 text-sm font-bold text-gray-800 line-clamp-2">
                          {question?.text || question?.imageUrl ? 'سؤال مرتبط بالمركز' : 'لا يوجد نص محفوظ لهذا السؤال'}
                        </div>
                        <div className="mt-2 text-xs font-bold text-gray-500">
                          {question?.skillIds?.length ? `مهارات: ${question.skillIds.length}` : 'بدون مهارات فرعية محفوظة'}
                        </div>
                      </div>
                    );
                  })}
                  {(previewQuiz.questionIds || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm font-bold text-gray-500">
                      لا توجد أسئلة داخل هذا الاختبار بعد.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => window.open(`${window.location.origin}/#/quiz/${previewQuiz.id}`, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-700"
              >
                <ExternalLink size={16} />
                فتح الاختبار
              </button>
              <button
                onClick={() => setPreviewQuiz(null)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 hover:bg-gray-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
