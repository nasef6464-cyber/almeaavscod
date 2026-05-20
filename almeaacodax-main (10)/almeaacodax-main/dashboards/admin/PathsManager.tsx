import React, { useState } from 'react';
import { CoursesManager } from './CoursesManager';
import { QuestionBankManager } from './QuestionBankManager';
import { FoundationManager } from './FoundationManager';
import { SkillsTreeManager } from './SkillsTreeManager';
import { QuizBuilder } from './QuizBuilder';
import { QuizzesManager } from './QuizzesManager';
import { LibraryManager } from './LibraryManager';
import { 
  FolderOpen, BookOpen, Target, FileQuestion, 
  Award, Library, ChevronLeft, Plus, Settings,
  Layers, Package, LayoutGrid, X, Lock, LockOpen,
  Eye, EyeOff, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Course, PackageContentType, PathDisplaySettings } from '../../types';
import { isMockQuiz, isTrainingQuiz } from '../../utils/quizPlacement';
import { isMaterialQuizCandidate } from '../../utils/mockExam';

const publicPackageContentOptions: Array<{ value: PackageContentType; label: string; description: string }> = [
  { value: 'courses', label: 'الدورات', description: 'يفتح الدورات المرتبطة بالمسار.' },
  { value: 'foundation', label: 'التأسيس', description: 'يفتح الموضوعات والدروس التأسيسية.' },
  { value: 'banks', label: 'التدريب', description: 'يفتح بنوك التدريب والأسئلة.' },
  { value: 'tests', label: 'الاختبارات', description: 'يفتح الاختبارات المنشورة داخل المادة.' },
  { value: 'library', label: 'المكتبة', description: 'يفتح ملفات ومراجع المكتبة.' },
];

const getPathIcon = (path: any) => {
  if (path?.iconUrl) return <img src={path.iconUrl} alt={path.name} className="w-8 h-8 object-contain" />;
  return path?.icon || '📚';
};

const colorMap: Record<string, { soft: string; text: string; border: string }> = {
  gray: { soft: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
  indigo: { soft: '#e0e7ff', text: '#4f46e5', border: '#c7d2fe' },
  amber: { soft: '#fef3c7', text: '#b45309', border: '#fde68a' },
  emerald: { soft: '#d1fae5', text: '#047857', border: '#a7f3d0' },
  purple: { soft: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  rose: { soft: '#ffe4e6', text: '#be123c', border: '#fecdd3' },
  blue: { soft: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
};

const resolveColor = (value?: string) => {
  if (!value) return colorMap.gray;
  if (value.startsWith('#')) {
    return { soft: `${value}18`, text: value, border: `${value}33` };
  }
  return colorMap[value] || colorMap.gray;
};

const defaultPathDisplaySettings: Required<PathDisplaySettings> = {
  showSubjectCards: true,
  showMockExamCard: true,
  showPackageCard: true,
};

const resolvePathDisplaySettings = (path?: { settings?: PathDisplaySettings | null }): Required<PathDisplaySettings> => ({
  ...defaultPathDisplaySettings,
  ...(path?.settings || {}),
});

const getSubjectIcon = (subject: any) => {
  if (subject?.iconUrl) return <img src={subject.iconUrl} alt={subject.name} className="w-8 h-8 object-contain" />;
  return subject?.icon || '📖';
};

export const PathsManager: React.FC = () => {
  const { paths, levels, subjects, courses, questions, lessons, quizzes, libraryItems, topics, addCourse, updateCourse, deleteCourse } = useStore();
  const initialQuery = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : window.location.search);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(initialQuery.get('path') || null);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initialQuery.get('subject') || null);
  
  // Tabs for Path Overview
  const [pathTab, setPathTab] = useState<'levels' | 'subjects' | 'packages' | 'settings'>('subjects');
  // Tabs for Subject Workspace
  const requestedSubjectTab = initialQuery.get('subjectTab') || initialQuery.get('courseTab') || initialQuery.get('workspace');
  const [subjectTab, setSubjectTab] = useState<'courses' | 'skills' | 'questions' | 'exams' | 'library' | 'settings'>(
    ['courses', 'skills', 'questions', 'exams', 'library', 'settings'].includes(requestedSubjectTab || '')
      ? requestedSubjectTab as 'courses' | 'skills' | 'questions' | 'exams' | 'library' | 'settings'
      : 'courses',
  );

  // Modals state
  const [isPathModalOpen, setIsPathModalOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<any>(null);
  const [newPathName, setNewPathName] = useState('');
  const [newPathColor, setNewPathColor] = useState('indigo');
  const [newPathIcon, setNewPathIcon] = useState('📚');
  const [newPathIconUrl, setNewPathIconUrl] = useState('');
  const [newPathIconStyle, setNewPathIconStyle] = useState<'default' | 'modern' | 'minimal' | 'playful'>('default');
  const [newPathIsActive, setNewPathIsActive] = useState(true);
  const [newPathParentId, setNewPathParentId] = useState('');
  const [newPathDesc, setNewPathDesc] = useState('');
  const [newPathShowInNavbar, setNewPathShowInNavbar] = useState(true);
  const [newPathShowSubjectCards, setNewPathShowSubjectCards] = useState(true);
  const [newPathShowMockExamCard, setNewPathShowMockExamCard] = useState(true);
  const [newPathShowPackageCard, setNewPathShowPackageCard] = useState(true);

  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<any>(null);
  const [newLevelName, setNewLevelName] = useState('');
  
  // Delete Confirmation Modal State
  const [deleteDialog, setDeleteDialog] = useState<{isOpen: boolean, id: string | null, type: string, title: string, message: string}>({isOpen: false, id: null, type: '', title: '', message: ''});
  
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('indigo');
  const [newSubjectIcon, setNewSubjectIcon] = useState('📖');
  const [newSubjectIconUrl, setNewSubjectIconUrl] = useState('');
  const [newSubjectIconStyle, setNewSubjectIconStyle] = useState<'default' | 'modern' | 'minimal' | 'playful'>('default');

  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Course | null>(null);
  const [packageTitle, setPackageTitle] = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [packagePrice, setPackagePrice] = useState('0');
  const [packageOriginalPrice, setPackageOriginalPrice] = useState('');
  const [packageThumbnail, setPackageThumbnail] = useState('');
  const [packageFeaturesText, setPackageFeaturesText] = useState('');
  const [packageVisible, setPackageVisible] = useState(false);
  const [packagePublished, setPackagePublished] = useState(true);
  const [packageContentTypes, setPackageContentTypes] = useState<PackageContentType[]>(['all']);
  const [packageSubjectId, setPackageSubjectId] = useState('');
  const [packageAppliesGlobally, setPackageAppliesGlobally] = useState(false);

  const currentPath = paths.find(p => p.id === selectedPathId);
  const currentPathDisplaySettings = resolvePathDisplaySettings(currentPath);
  const pathLevels = levels?.filter(l => l.pathId === selectedPathId) || [];
  const currentLevel = levels?.find(l => l.id === selectedLevelId);
  const pathSubjects = subjects.filter(s => s.pathId === selectedPathId && (selectedLevelId ? s.levelId === selectedLevelId : true));
  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const pathPackages = courses.filter((course: any) => {
    if (!course.isPackage) return false;
    const packagePathId = course.pathId || course.category;
    const contentTypes = course.packageContentTypes?.length ? course.packageContentTypes : ['all'];
    const isGlobalMembership = !packagePathId && (course.packageType === 'membership' || contentTypes.includes('all'));
    return packagePathId === selectedPathId || isGlobalMembership;
  });
  const isPublicPackageVisible = (pkg: Course) =>
    pkg.showOnPlatform !== false &&
    pkg.isPublished !== false &&
    (!pkg.approvalStatus || pkg.approvalStatus === 'approved');
  const isApprovedForLearner = (item: any) => !item.approvalStatus || item.approvalStatus === 'approved';
  const isVisibleForLearner = (item: any) => item.showOnPlatform !== false && isApprovedForLearner(item);
  const isPublishedForLearner = (item: any) => isVisibleForLearner(item) && item.isPublished !== false;
  const needsAdminReview = (item: any) =>
    item.approvalStatus === 'pending_review' ||
    item.approvalStatus === 'rejected' ||
    (item.showOnPlatform !== false && !isApprovedForLearner(item)) ||
    (typeof item.isPublished === 'boolean' && item.showOnPlatform !== false && item.isPublished === false);
  const pathScopedContent = {
    courses: courses.filter((course: any) => (course.pathId || course.category) === selectedPathId && !course.isPackage),
    packages: pathPackages,
    lessons: lessons.filter((lesson: any) => lesson.pathId === selectedPathId || subjects.some((subject: any) => subject.pathId === selectedPathId && subject.id === lesson.subjectId)),
    topics: topics.filter((topic: any) => topic.pathId === selectedPathId || subjects.some((subject: any) => subject.pathId === selectedPathId && subject.id === topic.subjectId)),
    quizzes: quizzes.filter((quiz: any) => quiz.pathId === selectedPathId || subjects.some((subject: any) => subject.pathId === selectedPathId && subject.id === quiz.subjectId)),
    library: libraryItems.filter((item: any) => item.pathId === selectedPathId || subjects.some((subject: any) => subject.pathId === selectedPathId && subject.id === item.subjectId)),
  };
  const publicationRows = [
    {
      id: 'courses',
      title: 'الدورات',
      total: pathScopedContent.courses.length,
      visible: pathScopedContent.courses.filter((item: any) => item.showOnPlatform !== false && item.isPublished !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      locked: pathScopedContent.courses.filter((item: any) => item.isLocked || item.accessControl === 'enrolled' || item.accessControl === 'specific_groups').length,
    },
    {
      id: 'packages',
      title: 'الباقات والعروض العامة',
      total: pathScopedContent.packages.length,
      visible: pathScopedContent.packages.filter((item: any) => item.showOnPlatform !== false && item.isPublished !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      locked: pathScopedContent.packages.filter((item: any) => item.price > 0).length,
    },
    {
      id: 'topics',
      title: 'موضوعات التأسيس',
      total: pathScopedContent.topics.length,
      visible: pathScopedContent.topics.filter((item: any) => item.showOnPlatform !== false).length,
      locked: pathSubjects.filter((subject: any) => subject.settings?.lockSkillsForNonSubscribers).length,
    },
    {
      id: 'lessons',
      title: 'الدروس والفيديوهات',
      total: pathScopedContent.lessons.length,
      visible: pathScopedContent.lessons.filter((item: any) => item.showOnPlatform !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      locked: pathScopedContent.lessons.filter((item: any) => item.isLocked || item.accessControl === 'enrolled' || item.accessControl === 'specific_groups').length,
    },
    {
      id: 'quizzes',
      title: 'الاختبارات والتدريبات',
      total: pathScopedContent.quizzes.length,
      visible: pathScopedContent.quizzes.filter((item: any) => item.showOnPlatform !== false && item.isPublished !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      locked: pathScopedContent.quizzes.filter((item: any) => item.access?.type && item.access.type !== 'free').length,
    },
    {
      id: 'library',
      title: 'المكتبة',
      total: pathScopedContent.library.length,
      visible: pathScopedContent.library.filter((item: any) => item.showOnPlatform !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      locked: pathSubjects.filter((subject: any) => subject.settings?.lockLibraryForNonSubscribers).length,
    },
  ];
  const visibleItemsCount = publicationRows.reduce((sum, row) => sum + row.visible, 0);
  const hiddenItemsCount = publicationRows.reduce((sum, row) => sum + Math.max(row.total - row.visible, 0), 0);
  const lockedItemsCount = publicationRows.reduce((sum, row) => sum + row.locked, 0);
  const subjectScopedContent = currentSubject
    ? {
        courses: courses.filter((course: any) => !course.isPackage && course.subjectId === currentSubject.id),
        topics: topics.filter((topic: any) => topic.subjectId === currentSubject.id),
        lessons: lessons.filter((lesson: any) => lesson.subjectId === currentSubject.id),
        training: quizzes.filter((quiz: any) => quiz.subjectId === currentSubject.id && isMaterialQuizCandidate(quiz) && isTrainingQuiz(quiz)),
        tests: quizzes.filter((quiz: any) => quiz.subjectId === currentSubject.id && isMaterialQuizCandidate(quiz) && isMockQuiz(quiz)),
        library: libraryItems.filter((item: any) => item.subjectId === currentSubject.id),
      }
    : null;
  const subjectWorkspaceRows = subjectScopedContent
    ? [
        {
          id: 'courses' as const,
          title: 'الدورات',
          tab: 'courses' as const,
          total: subjectScopedContent.courses.length,
          visible: subjectScopedContent.courses.filter(isPublishedForLearner).length,
          review: subjectScopedContent.courses.filter(needsAdminReview).length,
        },
        {
          id: 'skills' as const,
          title: 'التأسيس',
          tab: 'skills' as const,
          total: subjectScopedContent.topics.length,
          visible: subjectScopedContent.topics.filter((topic: any) => topic.showOnPlatform !== false).length,
          review: subjectScopedContent.topics.filter((topic: any) => topic.showOnPlatform === false).length,
        },
        {
          id: 'questions' as const,
          title: 'التدريب',
          tab: 'questions' as const,
          total: subjectScopedContent.training.length,
          visible: subjectScopedContent.training.filter(isPublishedForLearner).length,
          review: subjectScopedContent.training.filter(needsAdminReview).length,
        },
        {
          id: 'exams' as const,
          title: 'المحاكي',
          tab: 'exams' as const,
          total: subjectScopedContent.tests.length,
          visible: subjectScopedContent.tests.filter(isPublishedForLearner).length,
          review: subjectScopedContent.tests.filter(needsAdminReview).length,
        },
        {
          id: 'library' as const,
          title: 'المكتبة',
          tab: 'library' as const,
          total: subjectScopedContent.library.length,
          visible: subjectScopedContent.library.filter(isVisibleForLearner).length,
          review: subjectScopedContent.library.filter(needsAdminReview).length,
        },
      ]
    : [];
  const subjectWorkspaceTotals = {
    total: subjectWorkspaceRows.reduce((sum, row) => sum + row.total, 0),
    visible: subjectWorkspaceRows.reduce((sum, row) => sum + row.visible, 0),
    review: subjectWorkspaceRows.reduce((sum, row) => sum + row.review, 0),
  };
  const subjectWorkspaceWarnings = currentSubject
    ? [
        ...(subjectScopedContent?.topics.length ? [] : ['لا توجد موضوعات تأسيس بعد']),
        ...(subjectScopedContent?.lessons.length ? [] : ['لا توجد دروس مرتبطة بهذه المادة']),
        ...(currentSubject.settings?.showBanks === false || subjectScopedContent?.training.length ? [] : ['تبويب التدريب مفتوح لكن لا توجد تدريبات']),
        ...(currentSubject.settings?.showTests === false || subjectScopedContent?.tests.length ? [] : ['تبويب الاختبارات مفتوح لكن لا توجد اختبارات مختارة']),
        ...(subjectWorkspaceTotals.review > 0 ? [`${subjectWorkspaceTotals.review} عنصر يحتاج مراجعة قبل أن يكون واضحًا للطالب`] : []),
      ]
    : [];
  const getPathReadinessSummary = (pathId: string) => {
    const scopedSubjects = subjects.filter((subject: any) => subject.pathId === pathId);
    const subjectIds = new Set(scopedSubjects.map((subject: any) => subject.id));
    const scopedCourses = courses.filter((course: any) => (course.pathId || course.category) === pathId && !course.isPackage);
    const scopedPackages = courses.filter((course: any) => (course.pathId || course.category) === pathId && course.isPackage);
    const scopedTopics = topics.filter((topic: any) => topic.pathId === pathId || subjectIds.has(topic.subjectId));
    const scopedLessons = lessons.filter((lesson: any) => lesson.pathId === pathId || subjectIds.has(lesson.subjectId));
    const scopedQuizzes = quizzes.filter((quiz: any) => quiz.pathId === pathId || subjectIds.has(quiz.subjectId));
    const scopedLibrary = libraryItems.filter((item: any) => item.pathId === pathId || subjectIds.has(item.subjectId));

    const rows = [
      {
        total: scopedCourses.length,
        visible: scopedCourses.filter((item: any) => item.showOnPlatform !== false && item.isPublished !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      },
      {
        total: scopedPackages.length,
        visible: scopedPackages.filter((item: any) => item.showOnPlatform !== false && item.isPublished !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      },
      {
        total: scopedTopics.length,
        visible: scopedTopics.filter((item: any) => item.showOnPlatform !== false).length,
      },
      {
        total: scopedLessons.length,
        visible: scopedLessons.filter((item: any) => item.showOnPlatform !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      },
      {
        total: scopedQuizzes.length,
        visible: scopedQuizzes.filter((item: any) => item.showOnPlatform !== false && item.isPublished !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      },
      {
        total: scopedLibrary.length,
        visible: scopedLibrary.filter((item: any) => item.showOnPlatform !== false && (!item.approvalStatus || item.approvalStatus === 'approved')).length,
      },
    ];

    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const visible = rows.reduce((sum, row) => sum + row.visible, 0);
    const hidden = rows.reduce((sum, row) => sum + Math.max(row.total - row.visible, 0), 0);
    const visiblePackages = scopedPackages.filter((pkg: Course) => isPublicPackageVisible(pkg)).length;

    return { total, visible, hidden, subjects: scopedSubjects.length, packages: visiblePackages };
  };

  const handlePreviewPath = (pathId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const firstSubject = subjects.find((subject: any) => subject.pathId === pathId);
    const subjectQuery = firstSubject ? `?subject=${firstSubject.id}` : '';
    window.open(`/#/category/${pathId}${subjectQuery}`, '_blank', 'noopener,noreferrer');
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>, setUrl: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPath = () => {
    if (!newPathName.trim()) return;
    
    if (editingPath) {
      useStore.getState().updatePath(editingPath.id, {
        name: newPathName.trim(),
        color: newPathColor,
        icon: newPathIcon,
        iconUrl: newPathIconUrl,
        iconStyle: newPathIconStyle,
        description: newPathDesc,
        showInNavbar: newPathShowInNavbar,
        isActive: newPathIsActive,
        parentPathId: newPathParentId || null,
        settings: {
          ...(editingPath.settings || {}),
          showSubjectCards: newPathShowSubjectCards,
          showMockExamCard: newPathShowMockExamCard,
          showPackageCard: newPathShowPackageCard,
        },
      });
    } else {
      const pId = `p_${Date.now()}`;
      const newPath = {
        id: pId,
        name: newPathName.trim(),
        color: newPathColor,
        icon: newPathIcon,
        iconUrl: newPathIconUrl,
        iconStyle: newPathIconStyle,
        description: newPathDesc,
        showInNavbar: newPathShowInNavbar,
        isActive: newPathIsActive,
        parentPathId: newPathParentId || null,
        settings: {
          showSubjectCards: newPathShowSubjectCards,
          showMockExamCard: newPathShowMockExamCard,
          showPackageCard: newPathShowPackageCard,
        },
      };
      
      useStore.getState().addPath(newPath);
    }
    
    setEditingPath(null);
    setNewPathName('');
    setNewPathColor('indigo');
    setNewPathIcon('📚');
    setNewPathIconUrl('');
    setNewPathIconStyle('default');
    setNewPathParentId('');
    setNewPathDesc('');
    setNewPathShowInNavbar(false);
    setNewPathIsActive(false);
    setNewPathShowSubjectCards(true);
    setNewPathShowMockExamCard(true);
    setNewPathShowPackageCard(true);
    setIsPathModalOpen(false);
  };

  const openEditPath = (path: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPath(path);
    setNewPathName(path.name);
    setNewPathColor(path.color || 'indigo');
    setNewPathIcon(path.icon || '📚');
    setNewPathIconUrl(path.iconUrl || '');
    setNewPathIconStyle(path.iconStyle || 'default');
    setNewPathDesc(path.description || '');
    setNewPathShowInNavbar(path.showInNavbar !== false);
    setNewPathIsActive(path.isActive !== false);
    setNewPathParentId(path.parentPathId || '');
    const displaySettings = resolvePathDisplaySettings(path);
    setNewPathShowSubjectCards(displaySettings.showSubjectCards);
    setNewPathShowMockExamCard(displaySettings.showMockExamCard);
    setNewPathShowPackageCard(displaySettings.showPackageCard);
    setIsPathModalOpen(true);
  };

  const handleDeletePath = (pathId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialog({
      isOpen: true,
      id: pathId,
      type: 'path',
      title: 'حذف مسار',
      message: 'هل أنت متأكد من حذف هذا المسار وجميع مواده ومراحله؟'
    });
  };

  const handleTogglePathActive = (path: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const shouldShowPath = path.isActive === false;
    useStore.getState().updatePath(path.id, {
      isActive: shouldShowPath,
      ...(shouldShowPath ? { showInNavbar: true } : {}),
    });
  };

  const handleTogglePathDisplaySetting = (key: keyof PathDisplaySettings, enabled: boolean) => {
    if (!currentPath) return;
    useStore.getState().updatePath(currentPath.id, {
      settings: {
        ...(currentPath.settings || {}),
        [key]: enabled,
      },
    });
  };

  const handleAddLevel = () => {
    if (!newLevelName.trim() || !selectedPathId) return;

    if (editingLevel) {
      useStore.getState().updateLevel(editingLevel.id, {
        name: newLevelName.trim()
      });
    } else {
      const newLevel = {
        id: `l_${Date.now()}`,
        pathId: selectedPathId,
        name: newLevelName.trim()
      };
      useStore.getState().addLevel(newLevel);
    }
    setEditingLevel(null);
    setNewLevelName('');
    setIsLevelModalOpen(false);
  };

  const openEditLevel = (level: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLevel(level);
    setNewLevelName(level.name);
    setIsLevelModalOpen(true);
  };

  const handleDeleteLevel = (levelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialog({
      isOpen: true,
      id: levelId,
      type: 'level',
      title: 'حذف مرحلة دراسية',
      message: 'هل أنت متأكد من حذف هذه المرحلة؟ سيتم حذف جميع المواد بداخلها أيضاً.'
    });
  };

  const handleAddSubject = () => {
    if (!newSubjectName.trim() || !selectedPathId) return;
    
    if (editingSubject) {
       useStore.getState().updateSubject(editingSubject.id, {
         name: newSubjectName.trim(),
         levelId: selectedLevelId || null,
         color: newSubjectColor,
         icon: newSubjectIcon,
         iconUrl: newSubjectIconUrl,
         iconStyle: newSubjectIconStyle
       });
    } else {
      const newSubject = {
        id: `sub_${Date.now()}`,
        pathId: selectedPathId,
        levelId: selectedLevelId || null,
        name: newSubjectName.trim(),
        color: newSubjectColor,
        icon: newSubjectIcon,
        iconUrl: newSubjectIconUrl,
        iconStyle: newSubjectIconStyle
      };
      useStore.getState().addSubject(newSubject);
    }
    
    setEditingSubject(null);
    setNewSubjectName('');
    setNewSubjectIconUrl('');
    setNewSubjectIconStyle('default');
    setIsSubjectModalOpen(false);
  };

  const openEditSubject = (subject: any, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingSubject(subject);
      setNewSubjectName(subject.name);
      setNewSubjectColor(subject.color || 'indigo');
      setNewSubjectIcon(subject.icon || '📖');
      setNewSubjectIconUrl(subject.iconUrl || '');
      setNewSubjectIconStyle(subject.iconStyle || 'default');
      setIsSubjectModalOpen(true);
  };

  const handleDeleteSubject = (subjectId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteDialog({
          isOpen: true,
          id: subjectId,
          type: 'subject',
          title: 'حذف مادة',
          message: 'هل أنت متأكد من حذف هذه المادة؟'
      });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.id) return;
    
    if (deleteDialog.type === 'path') {
      useStore.getState().deletePath(deleteDialog.id);
      if (selectedPathId === deleteDialog.id) setSelectedPathId(null);
    } else if (deleteDialog.type === 'level') {
      useStore.getState().deleteLevel(deleteDialog.id);
    } else if (deleteDialog.type === 'subject') {
      useStore.getState().deleteSubject(deleteDialog.id);
      if (selectedSubjectId === deleteDialog.id) setSelectedSubjectId(null);
    } else if (deleteDialog.type === 'package') {
      try {
        await deleteCourse(deleteDialog.id);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'تعذر حذف الباقة على الخادم.');
        return;
      }
    }
    
    setDeleteDialog({ ...deleteDialog, isOpen: false });
  };

  const resetPackageForm = () => {
    setEditingPackage(null);
    setPackageTitle('');
    setPackageDescription('');
    setPackagePrice('0');
    setPackageOriginalPrice('');
    setPackageThumbnail('');
    setPackageFeaturesText('');
    setPackageVisible(false);
    setPackagePublished(true);
    setPackageContentTypes(['all']);
    setPackageSubjectId('');
    setPackageAppliesGlobally(false);
  };

  const openPackageModal = (pkg?: Course) => {
    if (pkg) {
      setEditingPackage(pkg);
      setPackageTitle(pkg.title || '');
      setPackageDescription(pkg.description || '');
      setPackagePrice(String(pkg.price ?? 0));
      setPackageOriginalPrice(pkg.originalPrice ? String(pkg.originalPrice) : '');
      setPackageThumbnail(pkg.thumbnail || '');
      setPackageFeaturesText((pkg.features || []).join('\n'));
      setPackageVisible(pkg.showOnPlatform !== false);
      setPackagePublished(pkg.isPublished !== false);
      setPackageContentTypes(pkg.packageContentTypes?.length ? pkg.packageContentTypes : ['all']);
      setPackageSubjectId(pkg.subjectId || pkg.subject || '');
      setPackageAppliesGlobally(!(pkg.pathId || pkg.category) && (pkg.packageType === 'membership' || (pkg.packageContentTypes || []).includes('all')));
    } else {
      resetPackageForm();
    }

    setIsPackageModalOpen(true);
  };

  const handleSavePathPackage = () => {
    if (!selectedPathId || !packageTitle.trim()) return;

    const price = Number(packagePrice) || 0;
    const originalPrice = packageOriginalPrice.trim() ? Number(packageOriginalPrice) || undefined : undefined;
    const features = packageFeaturesText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    const normalizedContentTypes = packageContentTypes.length ? packageContentTypes : ['all' as PackageContentType];
    const scopedSubjectId = packageAppliesGlobally ? '' : packageSubjectId.trim();
    const scopedPathId = packageAppliesGlobally ? '' : selectedPathId;

    const packageData: Partial<Course> = {
      title: packageTitle.trim(),
      description: packageDescription.trim(),
      thumbnail: packageThumbnail.trim() || 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80',
      instructor: 'منصة المئة',
      price,
      currency: 'ر.س',
      duration: 0,
      level: 'Beginner',
      rating: 5,
      progress: 0,
      category: scopedPathId,
      pathId: scopedPathId,
      subject: scopedSubjectId || undefined,
      subjectId: scopedSubjectId || undefined,
      features: features.length ? features : ['وصول منظم لمحتوى المسار', 'متابعة التقدم داخل المنصة'],
      isPackage: true,
      packageType: packageAppliesGlobally ? 'membership' : 'courses',
      packageContentTypes: packageAppliesGlobally ? ['all'] : normalizedContentTypes,
      originalPrice,
      includedCourses: courses
        .filter((course) => (
          (packageAppliesGlobally || (course.pathId || course.category) === selectedPathId) &&
          (!scopedSubjectId || course.subjectId === scopedSubjectId || course.subject === scopedSubjectId) &&
          !course.isPackage
        ))
        .map((course) => course.id),
      isPublished: packagePublished,
      showOnPlatform: packageVisible,
      approvalStatus: packagePublished ? 'approved' : 'draft',
      approvedAt: packagePublished ? Date.now() : undefined,
      fakeRating: 5,
      fakeStudentsCount: editingPackage?.fakeStudentsCount || 0,
      modules: editingPackage?.modules || [],
      files: editingPackage?.files || [],
      qa: editingPackage?.qa || [],
    };

    if (editingPackage?.id) {
      updateCourse(editingPackage.id, packageData);
    } else {
      addCourse({
        ...packageData,
        id: `pkg_${Date.now()}`,
      } as Course);
    }

    resetPackageForm();
    setIsPackageModalOpen(false);
  };

  const handleTogglePackageVisibility = (pkg: Course) => {
    const nextVisible = !isPublicPackageVisible(pkg);
    updateCourse(pkg.id, {
      showOnPlatform: nextVisible,
      isPublished: nextVisible,
      approvalStatus: nextVisible ? 'approved' : 'draft',
      approvedAt: nextVisible ? Date.now() : undefined,
    });
  };

  const handlePreviewPathPackage = (pkg: Course) => {
    if (!selectedPathId) return;
    const previewSubjectId = pkg.subjectId || pkg.subject || pathSubjects[0]?.id;
    const subjectQuery = previewSubjectId ? `?subject=${previewSubjectId}&tab=courses&package=${pkg.id}` : `?package=${pkg.id}`;
    window.open(`/#/category/${selectedPathId}${subjectQuery}`, '_blank', 'noopener,noreferrer');
  };

  const togglePackageContentType = (type: PackageContentType) => {
    setPackageContentTypes((current) => {
      if (type === 'all') {
        return ['all'];
      }

      const withoutAll = current.filter((item) => item !== 'all');
      const next = withoutAll.includes(type)
        ? withoutAll.filter((item) => item !== type)
        : [...withoutAll, type];

      return next.length ? next : ['all'];
    });
  };

  const getPackageScopeLabel = (pkg: Course) => {
    if (pkg.packageType === 'membership' && !(pkg.pathId || pkg.category)) {
      return 'عضوية شاملة';
    }

    const contentTypes = pkg.packageContentTypes?.length ? pkg.packageContentTypes : ['all'];
    if (contentTypes.includes('all')) {
      return 'شاملة';
    }

    return contentTypes
      .map((type) => publicPackageContentOptions.find((option) => option.value === type)?.label)
      .filter(Boolean)
      .join(' + ');
  };

  const getPathPackageSubjectLabel = (pkg: Course) => {
    if (pkg.packageType === 'membership' && !(pkg.pathId || pkg.category)) {
      return 'كل المنصة';
    }

    const scopedSubjectId = pkg.subjectId || pkg.subject;
    if (!scopedSubjectId) return 'كل مواد المسار';
    return pathSubjects.find((subject) => subject.id === scopedSubjectId)?.name || 'مادة محددة';
  };

  const getPathPackageCoverage = (pkg: Course) => {
    const contentTypes = pkg.packageContentTypes?.length ? pkg.packageContentTypes : ['all' as PackageContentType];
    const coversAll = contentTypes.includes('all' as PackageContentType);
    const hasType = (type: PackageContentType) => coversAll || contentTypes.includes(type);
    const pkgPathId = pkg.pathId || pkg.category || selectedPathId || '';
    const pkgSubjectId = pkg.subjectId || pkg.subject || '';
    const subjectIdsInPath = new Set(subjects.filter((subject: any) => subject.pathId === pkgPathId).map((subject: any) => subject.id));
    const isInScope = (item: { pathId?: string; subjectId?: string; subject?: string }) => {
      const itemSubjectId = item.subjectId || item.subject || '';
      const pathMatches = !pkgPathId || item.pathId === pkgPathId || subjectIdsInPath.has(itemSubjectId);
      const subjectMatches = !pkgSubjectId || itemSubjectId === pkgSubjectId;
      return pathMatches && subjectMatches;
    };

    const counts = {
      courses: courses.filter((course: any) => !course.isPackage && hasType('courses') && isInScope(course)).length,
      foundation: topics.filter((topic: any) => hasType('foundation') && isInScope(topic)).length,
        banks: quizzes.filter((quiz: any) => hasType('banks') && isMaterialQuizCandidate(quiz) && isTrainingQuiz(quiz) && isInScope(quiz)).length,
        tests: quizzes.filter((quiz: any) => hasType('tests') && isMaterialQuizCandidate(quiz) && isMockQuiz(quiz) && isInScope(quiz)).length,
      library: libraryItems.filter((item: any) => hasType('library') && isInScope(item)).length,
    };
    const total = counts.courses + counts.foundation + counts.banks + counts.tests + counts.library;
    const warnings = [
      (pkg.price || 0) <= 0 ? 'السعر غير محدد' : '',
      total === 0 ? 'لا يوجد محتوى داخل نطاق الباقة' : '',
      pkg.showOnPlatform !== false && pkg.isPublished === false ? 'ظاهرة لكن غير معتمدة' : '',
      pkg.showOnPlatform !== false && pkg.approvalStatus && pkg.approvalStatus !== 'approved' ? 'تحتاج اعتماد قبل البيع' : '',
    ].filter(Boolean);

    return { counts, total, warnings, isReady: warnings.length === 0 };
  };

  const handleDeletePackage = (pkg: Course) => {
    setDeleteDialog({
      isOpen: true,
      id: pkg.id,
      type: 'package',
      title: 'حذف باقة',
      message: `هل أنت متأكد من حذف باقة "${pkg.title}"؟ سيؤثر ذلك فقط على العرض العام ولن يمس باقات المدارس.`,
    });
  };

  const renderDeleteModal = () => {
    if (!deleteDialog.isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center animate-fade-in p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="p-6">
                    <h3 className="font-bold text-xl text-gray-800 mb-2">{deleteDialog.title}</h3>
                    <p className="text-gray-600 mb-6">{deleteDialog.message}</p>
                    
                    <div className="flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
                            className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            إلغاء
                        </button>
                        <button 
                            type="button"
                            onClick={confirmDelete}
                            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                        >
                            تأكيد الحذف
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // ---------------------------------------------------------------------------
  // VIEW 1: List of All Paths
  // ---------------------------------------------------------------------------
  if (!selectedPathId) {
    return (
      <>
        {renderDeleteModal()}
        <div className="space-y-6 animate-fade-in relative">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">إدارة المسارات التعليمية</h2>
            <p className="text-gray-500 text-sm mt-1">اختر المسار لإدارة مواده وباقاته.</p>
          </div>
          <button 
            onClick={() => {
              setEditingPath(null);
              setNewPathName('');
              setNewPathColor('indigo');
              setNewPathIcon('📚');
              setNewPathIconUrl('');
              setNewPathIconStyle('default');
              setNewPathParentId('');
              setNewPathDesc('');
              setNewPathShowInNavbar(false);
              setNewPathIsActive(false);
              setNewPathShowSubjectCards(true);
              setNewPathShowMockExamCard(true);
              setNewPathShowPackageCard(true);
              setIsPathModalOpen(true);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            إضافة مسار جديد
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paths.map((path, index) => {
            const pathSubs = subjects.filter(s => s.pathId === path.id);
            const readiness = getPathReadinessSummary(path.id);
            return (
              <div 
                key={`path-${path.id}-${index}`}
                onClick={() => setSelectedPathId(path.id)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: resolveColor(path.color).soft, color: resolveColor(path.color).text }}
                  >
                    {getPathIcon(path)}
                  </div>
                  <div className="flex gap-2">
                      <button
                        onClick={(e) => handleTogglePathActive(path, e)}
                        className={`transition-colors p-2 rounded-lg ${
                          path.isActive === false
                            ? 'text-gray-500 hover:bg-gray-100'
                            : 'text-sky-600 hover:bg-sky-50'
                        }`}
                        title={path.isActive === false ? 'إظهار المسار على المنصة' : 'إخفاء المسار عن المنصة'}
                      >
                        {path.isActive === false ? <Lock size={18} /> : <LockOpen size={18} />}
                      </button>
                      <button onClick={(e) => openEditPath(path, e)} className="text-gray-400 hover:text-indigo-600 transition-colors p-2">
                        <Settings size={18} />
                      </button>
                      <button onClick={(e) => handleDeletePath(path.id, e)} className="text-gray-400 hover:text-red-600 transition-colors p-2">
                        <X size={18} />
                      </button>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{path.name}</h3>
                <div className="mb-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-bold ${
                      path.isActive === false ? 'bg-gray-100 text-gray-600' : 'bg-sky-50 text-sky-700'
                    }`}
                  >
                    {path.isActive === false ? 'مخفي عن المنصة' : 'ظاهر على المنصة'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Layers size={14} /> {pathSubs.length} مواد</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="rounded-xl bg-emerald-50 px-2 py-2 text-emerald-700">
                    <div className="text-base font-black">{readiness.visible}</div>
                    <div>ظاهر</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-2 py-2 text-gray-700">
                    <div className="text-base font-black">{readiness.hidden}</div>
                    <div>مخفي</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-2 py-2 text-amber-700">
                    <div className="text-base font-black">{readiness.packages}</div>
                    <div>باقات</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={(e) => handlePreviewPath(path.id, e)}
                    className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                  >
                    <Eye size={14} />
                    معاينة
                  </button>
                  <span className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-black ${
                    readiness.total === 0
                      ? 'bg-gray-100 text-gray-600'
                      : readiness.hidden > 0
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {readiness.total === 0 ? 'قيد البناء' : readiness.hidden > 0 ? 'يحتاج مراجعة' : 'جاهز'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal for adding path */}
        {isPathModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-800">{editingPath ? 'تعديل المسار' : 'إضافة مسار جديد'}</h3>
                <button onClick={() => { setIsPathModalOpen(false); setEditingPath(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم المسار</label>
                  <input
                    type="text"
                    value={newPathName}
                    onChange={(e) => setNewPathName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="مثال: القدرات, التحصيلي..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">وصف قصير (يظهر في القوائم)</label>
                  <input
                    type="text"
                    value={newPathDesc}
                    onChange={(e) => setNewPathDesc(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="تأسيس شامل، تدريب مكثف..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">اللون المميز (اختر من القائمة أو لون مخصص)</label>
                    <div className="flex items-center gap-2">
                        <select
                          value={newPathColor.startsWith('#') ? 'custom' : newPathColor}
                          onChange={(e) => {
                              if (e.target.value !== 'custom') setNewPathColor(e.target.value);
                              else setNewPathColor('#6366f1');
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white flex-1"
                        >
                          <option value="indigo">نيلي (Indigo)</option>
                          <option value="blue">أزرق (Blue)</option>
                          <option value="sky">أزرق فاتح (Sky)</option>
                          <option value="cyan">سماوي (Cyan)</option>
                          <option value="teal">أخضر مزرق (Teal)</option>
                          <option value="emerald">أخضر (Emerald)</option>
                          <option value="green">أخضر طبيعي (Green)</option>
                          <option value="lime">ليموني (Lime)</option>
                          <option value="yellow">أصفر (Yellow)</option>
                          <option value="amber">كهرماني (Amber)</option>
                          <option value="orange">برتقالي (Orange)</option>
                          <option value="red">أحمر (Red)</option>
                          <option value="rose">وردي أحمر (Rose)</option>
                          <option value="pink">وردي فاتح (Pink)</option>
                          <option value="fuchsia">فوشيا (Fuchsia)</option>
                          <option value="purple">بنفسجي (Purple)</option>
                          <option value="violet">بنفسجي فاتح (Violet)</option>
                          <option value="slate">رمادي مزرق (Slate)</option>
                          <option value="gray">رمادي (Gray)</option>
                          <option value="custom">لون مخصص (كود Hex)</option>
                        </select>
                        {newPathColor.startsWith('#') && (
                            <input 
                                type="color" 
                                value={newPathColor} 
                                onChange={(e) => setNewPathColor(e.target.value)}
                                className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 shadow-sm"
                                title="اختر لون مخصص"
                            />
                        )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">الأيقونة (إيموجي أو صورة)</label>
                    <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newPathIcon}
                          onChange={(e) => setNewPathIcon(e.target.value)}
                          className="w-16 px-2 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center text-xl"
                          placeholder="📚"
                          maxLength={2}
                          disabled={!!newPathIconUrl}
                        />
                        <div className="flex-1 relative">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => handleIconUpload(e, setNewPathIconUrl)} 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title="رفع أيقونة صورة"
                            />
                            <div className="w-full h-full min-h-[46px] border border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 text-sm font-bold text-indigo-600 hover:bg-gray-100 transition-colors">
                                {newPathIconUrl ? 'تغيير الصورة المرفوعة' : 'رفع صورة...'}
                            </div>
                        </div>
                        {newPathIconUrl && (
                            <button onClick={() => setNewPathIconUrl('')} className="p-2 text-red-500 hover:bg-red-50 rounded-xl">
                                <X size={20} />
                            </button>
                        )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">نمط الأيقونة والتصميم</label>
                    <select
                      value={newPathIconStyle}
                      onChange={(e) => setNewPathIconStyle(e.target.value as any)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="default">الافتراضي (دائري بسيط)</option>
                      <option value="modern">حديث (بطاقات مفرغة)</option>
                      <option value="minimal">بسيط (بدون خلفيات)</option>
                      <option value="playful">مرح (ألوان زاهية وظلال)</option>
                    </select>
                  </div>
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">مسار رئيسي أم متفرع؟ (اختياري)</label>
                   <select
                      value={newPathParentId}
                      onChange={(e) => setNewPathParentId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                   >
                      <option value="">مسار رئيسي (مستقل)</option>
                      {paths.filter(p => (!editingPath || p.id !== editingPath.id) && !p.parentPathId).map((p, pidx) => (
                          <option key={`popt-${p.id}-${pidx}`} value={p.id}>متفرع من: {p.name}</option>
                      ))}
                   </select>
                </div>
                <div className="space-y-3 mt-4">
                  <label className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg cursor-pointer border border-transparent hover:border-gray-200">
                    <input 
                      type="checkbox" 
                      checked={newPathIsActive} 
                      onChange={e => setNewPathIsActive(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded"
                    />
                    <span className="font-medium text-gray-700">تفعيل وعرض هذا المسار للطلاب</span>
                  </label>
                  <label className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg cursor-pointer border border-transparent hover:border-gray-200">
                    <input 
                      type="checkbox" 
                      checked={newPathShowInNavbar} 
                      onChange={e => setNewPathShowInNavbar(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded"
                    />
                    <span className="font-medium text-gray-700">إظهار هذا المسار في القائمة العلوية الرئيسة</span>
                  </label>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                    <div className="mb-3 text-sm font-black text-indigo-800">بطاقات صفحة المسار</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPathShowSubjectCards}
                          onChange={(e) => setNewPathShowSubjectCards(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        المواد
                      </label>
                      <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPathShowMockExamCard}
                          onChange={(e) => setNewPathShowMockExamCard(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        الاختبارات المحاكية
                      </label>
                      <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPathShowPackageCard}
                          onChange={(e) => setNewPathShowPackageCard(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        العروض والباقات
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsPathModalOpen(false); setEditingPath(null); }} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors">
                  إلغاء
                </button>
                <button type="button" onClick={handleAddPath} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                  {editingPath ? 'حفظ التعديلات' : 'إضافة'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: Path Overview (Subjects & Packages)
  // ---------------------------------------------------------------------------
  if (selectedPathId && !selectedSubjectId) {
    return (
      <>
        {renderDeleteModal()}
        <div className="space-y-6 animate-fade-in pb-12">
        {/* Path Header */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedPathId(null)}
              className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft size={20} className="rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getPathIcon(currentPath)}</span>
                <h2 className="text-xl font-bold text-gray-800">إدارة: {currentPath?.name}</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">إدارة مواد المسار والباقات الشاملة.</p>
            </div>
          </div>
        </div>

        {/* Path Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-shrink-0">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setPathTab('levels')}
              className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
                pathTab === 'levels' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Target size={18} />
              المراحل الدراسية
            </button>
            <button
              onClick={() => setPathTab('subjects')}
              className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
                pathTab === 'subjects' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid size={18} />
              المواد الدراسية
            </button>
            <button
              onClick={() => setPathTab('packages')}
              className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
                pathTab === 'packages' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Package size={18} />
              الباقات الشاملة
            </button>
            <button
              onClick={() => setPathTab('settings')}
              className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
                pathTab === 'settings' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Settings size={18} />
              إعدادات المسار
            </button>
          </div>
        </div>

        {/* Path Content */}
        <div className="space-y-6 overflow-visible pb-8">
          {pathTab === 'levels' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <p className="text-gray-600">
                    يمكنك تقسيم المسار إلى مراحل دراسية (مثلاً: الصف الأول، الصف الثاني). المواد ستكون تابعة لكل مرحلة.
                  </p>
                  <button 
                    onClick={() => setIsLevelModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Plus size={18} />
                    إضافة مرحلة دراسية
                  </button>
              </div>

              {pathLevels.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                      <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-bold text-gray-800">لا توجد مراحل دراسية</h3>
                      <p className="text-gray-500 mt-2">قم بإضافة مرحلة دراسية للبدء في تصنيف المواد داخله.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {pathLevels.map((level, lidx) => {
                          const levelSubjects = subjects.filter(s => s.levelId === level.id);
                          return (
                              <div key={`lvl-${level.id}-${lidx}`} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                                  <div className="flex justify-between items-start mb-4">
                                      <h3 className="text-xl font-bold text-gray-800">{level.name}</h3>
                                      <div className="flex gap-2">
                                          <button onClick={(e) => openEditLevel(level, e)} className="text-gray-400 hover:text-indigo-600 transition-colors p-1">
                                              <Settings size={16} />
                                          </button>
                                          <button onClick={(e) => handleDeleteLevel(level.id, e)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                                              <X size={16} />
                                          </button>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                                      <Layers size={16} /> 
                                      <span>{levelSubjects.length} مواد مرتبطة</span>
                                  </div>
                                  <div className="space-y-3">
                                      <h4 className="font-bold text-sm text-gray-700">مواد هذه المرحلة:</h4>
                                      <div className="flex flex-wrap gap-2">
                                          {levelSubjects.map((sub, sidx) => (
                                              <span key={`lsub-${sub.id}-${sidx}`} className="bg-gray-50 px-3 py-1 rounded-lg text-sm text-gray-600 border border-gray-100">
                                                  {sub.name}
                                              </span>
                                          ))}
                                          {levelSubjects.length === 0 && <span className="text-sm text-gray-400">لا توجد مواد</span>}
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
            </div>
          )}

          {pathTab === 'subjects' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => setIsSubjectModalOpen(true)}
                  className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2"
                >
                  <Plus size={18} />
                  إضافة مادة جديدة
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pathSubjects.map((subject, sidx) => {
                  const subjectCoursesCount = courses.filter(c => !c.isPackage && (c.subject === subject.id || c.subjectId === subject.id)).length;
                  const subjectQuestionsCount = questions.filter(q => q.subject === subject.id).length;
                  return (
                    <div 
                      key={`psub-${subject.id}-${sidx}`}
                      onClick={() => setSelectedSubjectId(subject.id)}
                      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                          style={{ backgroundColor: resolveColor(subject.color).soft, color: resolveColor(subject.color).text }}
                        >
                          {getSubjectIcon(subject)}
                        </div>
                        <div className="flex gap-2">
                           <button onClick={(e) => openEditSubject(subject, e)} className="text-gray-400 hover:text-indigo-600 transition-colors p-2">
                              <Settings size={16} />
                           </button>
                           <button onClick={(e) => handleDeleteSubject(subject.id, e)} className="text-gray-400 hover:text-red-600 transition-colors p-2">
                              <X size={16} />
                           </button>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2">{subject.name}</h3>
                      <div className="flex items-center gap-4 text-xs font-bold text-gray-500">
                        <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md"><BookOpen size={14} /> {subjectCoursesCount} دورات</span>
                        <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md"><FileQuestion size={14} /> {subjectQuestionsCount} سؤال</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pathTab === 'packages' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Package size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">إدارة الباقات والعروض العامة</h3>
                      <p className="text-gray-500 max-w-2xl leading-7">
                        هذه الباقات تظهر للطالب المستقل داخل صفحة المسار بجانب المواد عند تفعيلها. باقات المدارس منفصلة وتدار من المدارس/المالية ولا تظهر هنا كعرض شراء عام.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => openPackageModal()}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-2 justify-center"
                  >
                    <Plus size={18} />
                    إنشاء باقة جديدة
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                  <div className="text-sm font-bold text-amber-700">إجمالي الباقات</div>
                  <div className="mt-2 text-3xl font-black text-amber-700">{pathPackages.length}</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <div className="text-sm font-bold text-emerald-700">ظاهرة للطلاب</div>
                  <div className="mt-2 text-3xl font-black text-emerald-700">
                    {pathPackages.filter((pkg) => isPublicPackageVisible(pkg)).length}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="text-sm font-bold text-gray-700">مخفية/قيد الإعداد</div>
                  <div className="mt-2 text-3xl font-black text-gray-700">
                    {pathPackages.filter((pkg) => !isPublicPackageVisible(pkg)).length}
                  </div>
                </div>
              </div>

              {pathPackages.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
                  <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">لا توجد باقات لهذا المسار بعد</h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-6">ابدأ بإنشاء باقة عامة تظهر للطلاب المستقلين داخل صفحة المسار عند تفعيلها.</p>
                  <button
                    onClick={() => openPackageModal()}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                  >
                    <Plus size={18} />
                    إنشاء أول باقة
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {pathPackages.map((pkg) => {
                    const coverage = getPathPackageCoverage(pkg);
                    return (
                    <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="p-5 flex gap-4">
                        <img
                          src={pkg.thumbnail || 'https://via.placeholder.com/300x180'}
                          alt={pkg.title}
                          className="w-24 h-24 rounded-2xl object-cover bg-gray-100 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-lg font-black text-gray-800 leading-tight">{pkg.title}</h4>
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{pkg.description || 'باقة عامة مرتبطة بهذا المسار.'}</p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                                !isPublicPackageVisible(pkg)
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {!isPublicPackageVisible(pkg) ? 'مخفية' : 'ظاهرة'}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-black text-emerald-600">{pkg.price || 0} {pkg.currency || 'ر.س'}</span>
                            {pkg.originalPrice ? <span className="text-gray-400 line-through">{pkg.originalPrice} {pkg.currency || 'ر.س'}</span> : null}
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{pkg.features?.length || 0} مزايا</span>
                            <span className="text-gray-400">•</span>
                            <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">{getPackageScopeLabel(pkg)}</span>
                            <span className="text-gray-400">•</span>
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">{getPathPackageSubjectLabel(pkg)}</span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-600 sm:grid-cols-5">
                            {[
                              ['دورات', coverage.counts.courses],
                              ['تأسيس', coverage.counts.foundation],
                              ['تدريب', coverage.counts.banks],
                              ['اختبارات', coverage.counts.tests],
                              ['مكتبة', coverage.counts.library],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-xl bg-gray-50 px-2 py-2 text-center">
                                <span className="text-gray-400">{label}</span>
                                <span className="mx-1 text-gray-900">{value}</span>
                              </div>
                            ))}
                          </div>
                          {coverage.warnings.length > 0 ? (
                            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                              قبل الإظهار: {coverage.warnings.join('، ')}
                            </div>
                          ) : (
                            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                              جاهزة للعرض والبيع: تغطي {coverage.total} عنصرًا داخل نطاقها.
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => handlePreviewPathPackage(pkg)}
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 border border-gray-100"
                        >
                          <Eye size={16} />
                          معاينة العرض
                        </button>
                        <button
                          onClick={() => handleTogglePackageVisibility(pkg)}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
                            !isPublicPackageVisible(pkg)
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {!isPublicPackageVisible(pkg) ? <Eye size={16} /> : <EyeOff size={16} />}
                          {!isPublicPackageVisible(pkg) ? 'إظهار' : 'إخفاء'}
                        </button>
                        <button
                          onClick={() => openPackageModal(pkg)}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
                        >
                          <Settings size={16} />
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDeletePackage(pkg)}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
                        >
                          <X size={16} />
                          حذف
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {pathTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700 mb-3">
                      <Settings size={14} />
                      إعدادات المسار ومراجعة النشر
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">مراجعة ما سيظهر للطالب</h3>
                    <p className="text-gray-500 max-w-2xl leading-7">
                      هذه اللوحة لا تغيّر شكل المنصة، لكنها تساعدك كمدير تعرف بسرعة ما الموجود داخل المستودع وما المعروض فعلًا في واجهة الطالب، وما المحتوى المقفول للباقات.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={(event) => currentPath && openEditPath(currentPath, event)}
                      className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
                    >
                      <Settings size={16} />
                      تعديل بيانات المسار
                    </button>
                    <button
                      onClick={(event) => currentPath && handleTogglePathActive(currentPath, event)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
                        currentPath?.isActive === false
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {currentPath?.isActive === false ? <Eye size={16} /> : <EyeOff size={16} />}
                      {currentPath?.isActive === false ? 'إظهار المسار' : 'إخفاء المسار مؤقتًا'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="text-lg font-black text-gray-900">ترتيب وبطاقات واجهة المسار</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      المواد تظهر أولًا، ثم الاختبارات المحاكية، ثم العروض والباقات. يمكنك إخفاء أي بطاقة لا تناسب هذا المسار.
                    </p>
                  </div>
                  <button
                    onClick={() => currentPath && window.open(`/#/category/${currentPath.id}`, '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-50 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                  >
                    <Eye size={16} />
                    معاينة صفحة المسار
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { key: 'showSubjectCards' as const, title: 'بطاقات المواد', note: 'الكمي، اللفظي، أو مواد المسار.' },
                    { key: 'showMockExamCard' as const, title: 'بطاقة الاختبارات المحاكية', note: 'تظهر فقط عند احتياج المسار لها.' },
                    { key: 'showPackageCard' as const, title: 'بطاقة العروض والباقات', note: 'مدخل شراء أو فتح باقات المسار.' },
                  ].map((item) => {
                    const enabled = currentPathDisplaySettings[item.key] !== false;
                    return (
                      <label
                        key={item.key}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                          enabled ? 'border-emerald-100 bg-emerald-50' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => handleTogglePathDisplaySetting(item.key, event.target.checked)}
                          className="mt-1 h-5 w-5 rounded text-indigo-600"
                        />
                        <span>
                          <span className={`block text-sm font-black ${enabled ? 'text-emerald-800' : 'text-gray-700'}`}>{item.title}</span>
                          <span className="mt-1 block text-xs leading-6 text-gray-500">{item.note}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-bold">ظاهر للطالب</span>
                  </div>
                  <div className="mt-3 text-3xl font-black text-emerald-700">{visibleItemsCount}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center gap-2 text-gray-700">
                    <EyeOff size={18} />
                    <span className="text-sm font-bold">مخفي أو غير منشور</span>
                  </div>
                  <div className="mt-3 text-3xl font-black text-gray-700">{hiddenItemsCount}</div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                  <div className="flex items-center gap-2 text-amber-700">
                    <Lock size={18} />
                    <span className="text-sm font-bold">مقفول/مرتبط بباقة</span>
                  </div>
                  <div className="mt-3 text-3xl font-black text-amber-700">{lockedItemsCount}</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-5 gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-black text-gray-500">
                  <div className="col-span-2">الجزء</div>
                  <div className="text-center">الإجمالي</div>
                  <div className="text-center">ظاهر</div>
                  <div className="text-center">مقفول</div>
                </div>
                {publicationRows.map((row) => {
                  const hidden = Math.max(row.total - row.visible, 0);
                  return (
                    <div key={row.id} className="grid grid-cols-5 gap-2 border-b border-gray-50 px-4 py-4 text-sm last:border-0">
                      <div className="col-span-2">
                        <div className="font-black text-gray-900">{row.title}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {hidden > 0 ? `${hidden} عنصر يحتاج إظهار/اعتماد قبل ظهوره للطلاب` : 'كل العناصر الجاهزة ظاهرة حسب الإعدادات'}
                        </div>
                      </div>
                      <div className="text-center font-black text-gray-800">{row.total}</div>
                      <div className="text-center font-black text-emerald-700">{row.visible}</div>
                      <div className="text-center font-black text-amber-700">{row.locked}</div>
                    </div>
                  );
                })}
              </div>

              {currentPath?.isActive === false ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-800 flex gap-3">
                  <AlertTriangle size={18} className="mt-1 shrink-0" />
                  <div>
                    هذا المسار مخفي حاليًا عن الطلاب. يمكنك العمل عليه وإضافة محتوى وباقات، ثم إظهاره عندما تكتمل المراجعة.
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Modal for adding Subject */}
        {isSubjectModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-800">{editingSubject ? 'تعديل المادة' : 'إضافة مادة جديدة'}</h3>
                <button onClick={() => { setIsSubjectModalOpen(false); setEditingSubject(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم المادة</label>
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="مثال: الكمي, اللفظي..."
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">اللون المميز (اختر من القائمة أو لون مخصص)</label>
                    <div className="flex items-center gap-2">
                        <select
                          value={newSubjectColor.startsWith('#') ? 'custom' : newSubjectColor}
                          onChange={(e) => {
                              if (e.target.value !== 'custom') setNewSubjectColor(e.target.value);
                              else setNewSubjectColor('#6366f1');
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white flex-1"
                        >
                          <option value="indigo">نيلي (Indigo)</option>
                          <option value="blue">أزرق (Blue)</option>
                          <option value="sky">أزرق فاتح (Sky)</option>
                          <option value="cyan">سماوي (Cyan)</option>
                          <option value="teal">أخضر مزرق (Teal)</option>
                          <option value="emerald">أخضر (Emerald)</option>
                          <option value="green">أخضر طبيعي (Green)</option>
                          <option value="lime">ليموني (Lime)</option>
                          <option value="yellow">أصفر (Yellow)</option>
                          <option value="amber">كهرماني (Amber)</option>
                          <option value="orange">برتقالي (Orange)</option>
                          <option value="red">أحمر (Red)</option>
                          <option value="rose">وردي أحمر (Rose)</option>
                          <option value="pink">وردي فاتح (Pink)</option>
                          <option value="fuchsia">فوشيا (Fuchsia)</option>
                          <option value="purple">بنفسجي (Purple)</option>
                          <option value="violet">بنفسجي فاتح (Violet)</option>
                          <option value="slate">رمادي مزرق (Slate)</option>
                          <option value="gray">رمادي (Gray)</option>
                          <option value="custom">لون مخصص (كود Hex)</option>
                        </select>
                        {newSubjectColor.startsWith('#') && (
                            <input 
                                type="color" 
                                value={newSubjectColor} 
                                onChange={(e) => setNewSubjectColor(e.target.value)}
                                className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 shadow-sm"
                                title="اختر لون مخصص"
                            />
                        )}
                    </div>
                  </div>
                  
                  {pathLevels.length > 0 && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">اختر المرحلة (اختياري)</label>
                      <select
                        value={selectedLevelId || ''}
                        onChange={(e) => setSelectedLevelId(e.target.value || null)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      >
                        <option value="">بدون مرحلة (عامة)</option>
                        {pathLevels.map((l, lidx) => (
                          <option key={`poptlvl-${l.id}-${lidx}`} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">الأيقونة (إيموجي أو صورة)</label>
                    <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newSubjectIcon}
                          onChange={(e) => setNewSubjectIcon(e.target.value)}
                          className="w-16 px-2 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center text-xl"
                          placeholder="📖"
                          maxLength={2}
                          disabled={!!newSubjectIconUrl}
                        />
                        <div className="flex-1 relative">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => handleIconUpload(e, setNewSubjectIconUrl)} 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title="رفع أيقونة صورة"
                            />
                            <div className="w-full h-full min-h-[46px] border border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 text-sm font-bold text-indigo-600 hover:bg-gray-100 transition-colors">
                                {newSubjectIconUrl ? 'تغيير الصورة المرفوعة' : 'رفع صورة...'}
                            </div>
                        </div>
                        {newSubjectIconUrl && (
                            <button onClick={() => setNewSubjectIconUrl('')} className="p-2 text-red-500 hover:bg-red-50 rounded-xl">
                                <X size={20} />
                            </button>
                        )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">نمط الأيقونة والتصميم</label>
                    <select
                      value={newSubjectIconStyle}
                      onChange={(e) => setNewSubjectIconStyle(e.target.value as any)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="default">الافتراضي (دائري بسيط)</option>
                      <option value="modern">حديث (بطاقات مفرغة)</option>
                      <option value="minimal">بسيط (بدون خلفيات)</option>
                      <option value="playful">مرح (ألوان زاهية وظلال)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsSubjectModalOpen(false); setEditingSubject(null); }} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors">
                  إلغاء
                </button>
                <button type="button" onClick={handleAddSubject} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                  {editingSubject ? 'حفظ التعديلات' : 'إضافة'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isPackageModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center animate-fade-in p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{editingPackage ? 'تعديل باقة عامة' : 'إنشاء باقة عامة جديدة'}</h3>
                  <p className="text-xs text-gray-500 mt-1">هذه الباقة تخص المسار الحالي وتظهر للطلاب المستقلين فقط عند تفعيل الظهور.</p>
                </div>
                <button
                  onClick={() => {
                    setIsPackageModalOpen(false);
                    resetPackageForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم الباقة</label>
                  <input
                    type="text"
                    value={packageTitle}
                    onChange={(e) => setPackageTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="مثال: باقة القدرات الشاملة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">وصف مختصر</label>
                  <textarea
                    value={packageDescription}
                    onChange={(e) => setPackageDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[90px]"
                    placeholder="اكتب وصفًا واضحًا لما تحتويه الباقة."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">السعر</label>
                    <input
                      type="number"
                      min="0"
                      value={packagePrice}
                      onChange={(e) => setPackagePrice(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">السعر قبل الخصم</label>
                    <input
                      type="number"
                      min="0"
                      value={packageOriginalPrice}
                      onChange={(e) => setPackageOriginalPrice(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="اختياري"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">رابط صورة الباقة</label>
                    <input
                      type="url"
                      value={packageThumbnail}
                      onChange={(e) => setPackageThumbnail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="اختياري"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نطاق الباقة داخل المسار</label>
                  <select
                    value={packageSubjectId}
                    onChange={(e) => setPackageSubjectId(e.target.value)}
                    disabled={packageAppliesGlobally}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="">كل مواد المسار</option>
                    {pathSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    استخدمها لو أردت باقة للكمي فقط أو اللفظي فقط مثلًا. لو تركتها على كل المواد ستكون باقة عامة للمسار كله.
                  </p>
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={packageAppliesGlobally}
                    onChange={(e) => {
                      setPackageAppliesGlobally(e.target.checked);
                      if (e.target.checked) {
                        setPackageSubjectId('');
                        setPackageContentTypes(['all']);
                      }
                    }}
                    className="mt-1 h-5 w-5 rounded text-emerald-600"
                  />
                  <span>
                    <span className="block text-sm font-black text-emerald-900">عضوية عامة تفتح كل المنصة</span>
                    <span className="text-xs leading-6 text-emerald-700">
                      تظهر كخيار شراء شامل في كل المسارات، وتفتح الدورات والتأسيس والتدريب والاختبارات والمكتبة عند اعتماد الدفع.
                    </span>
                  </span>
                </label>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">مزايا الباقة</label>
                  <textarea
                    value={packageFeaturesText}
                    onChange={(e) => setPackageFeaturesText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                    placeholder={'اكتب كل ميزة في سطر مستقل\nمثال: تشمل الدورات والتدريبات\nمثال: متابعة تقدم الطالب'}
                  />
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <label className="block text-sm font-black text-gray-800">ماذا تفتح هذه الباقة؟</label>
                      <p className="mt-1 text-xs text-gray-500">اختر نطاق الباقة بدقة. لو اخترت شاملة ستفتح كل أجزاء المسار للطالب المستقل.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePackageContentType('all')}
                      disabled={packageAppliesGlobally}
                      className={`rounded-xl px-3 py-2 text-xs font-black ${
                        packageContentTypes.includes('all')
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      شاملة
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {publicPackageContentOptions.map((option) => {
                      const checked = packageContentTypes.includes('all') || packageContentTypes.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                            checked
                              ? 'border-indigo-200 bg-white text-indigo-800'
                              : 'border-transparent bg-white/70 text-gray-600 hover:border-gray-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePackageContentType(option.value)}
                            disabled={packageAppliesGlobally}
                            className="mt-1 h-5 w-5 rounded text-indigo-600"
                          />
                          <span>
                            <span className="block text-sm font-black">{option.label}</span>
                            <span className="text-xs text-gray-500">{option.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg cursor-pointer border border-transparent hover:border-gray-200">
                    <input
                      type="checkbox"
                      checked={packagePublished}
                      onChange={(e) => setPackagePublished(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                    />
                    <span>
                      <span className="block font-bold text-gray-700">اعتماد الباقة</span>
                      <span className="text-xs text-gray-500">تجعل الباقة جاهزة للنشر عند تفعيل الظهور.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg cursor-pointer border border-transparent hover:border-gray-200">
                    <input
                      type="checkbox"
                      checked={packageVisible}
                      onChange={(e) => setPackageVisible(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                    />
                    <span>
                      <span className="block font-bold text-gray-700">إظهار في صفحة المسار</span>
                      <span className="text-xs text-gray-500">يمكنك تركها مخفية أثناء التجهيز.</span>
                    </span>
                  </label>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsPackageModalOpen(false);
                    resetPackageForm();
                  }}
                  className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePathPackage}
                  className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {editingPackage ? 'حفظ التعديلات' : 'إنشاء الباقة'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for adding Level */}
        {isLevelModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-800">{editingLevel ? 'تعديل المرحلة' : 'إضافة مرحلة دراسية'}</h3>
                <button type="button" onClick={() => { setIsLevelModalOpen(false); setEditingLevel(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم المرحلة</label>
                <input
                  type="text"
                  value={newLevelName}
                  onChange={(e) => setNewLevelName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="مثال: الصف الأول المتوسط..."
                  autoFocus
                />
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsLevelModalOpen(false); setEditingLevel(null); }} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors">
                  إلغاء
                </button>
                <button type="button" onClick={handleAddLevel} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                  {editingLevel ? 'حفظ التعديلات' : 'إضافة'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 3: Subject Workspace (Courses, Skills, Questions, etc.)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Subject Header (Breadcrumb style) */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedSubjectId(null)}
            className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft size={20} className="rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-gray-400 mb-1">
              <span>{currentPath?.name}</span>
              <ChevronLeft size={14} />
              <span className="text-indigo-600">المواد</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getSubjectIcon(currentSubject)}</span>
              <h2 className="text-xl font-bold text-gray-800">مساحة عمل: {currentSubject?.name}</h2>
            </div>
          </div>
        </div>
      </div>

      {currentSubject && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_2fr]">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-indigo-500">جاهزية مساحة المادة للطالب</div>
                <h3 className="mt-1 text-xl font-black text-gray-900">{currentSubject.name}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
                  <span className="rounded-full bg-white px-3 py-1 text-gray-700">{subjectWorkspaceTotals.total} عنصر</span>
                  <span className="rounded-full bg-white px-3 py-1 text-emerald-700">{subjectWorkspaceTotals.visible} ظاهر</span>
                  <span className="rounded-full bg-white px-3 py-1 text-amber-700">{subjectWorkspaceTotals.review} مراجعة</span>
                </div>
              </div>
              <div className={`rounded-2xl p-3 ${subjectWorkspaceWarnings.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {subjectWorkspaceWarnings.length === 0 ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {subjectWorkspaceWarnings.length > 0 ? (
                subjectWorkspaceWarnings.slice(0, 3).map((warning) => (
                  <div key={warning} className="rounded-xl bg-white px-3 py-2 text-xs font-black leading-6 text-amber-700">
                    {warning}
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-white px-3 py-2 text-xs font-black leading-6 text-emerald-700">
                  المساحة جاهزة مبدئيًا: يوجد محتوى ظاهر ولا توجد ملاحظات نشر عاجلة.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {subjectWorkspaceRows.map((row) => {
              const isTabDisabled =
                (row.id === 'skills' && currentSubject.settings?.showSkills === false) ||
                (row.id === 'questions' && currentSubject.settings?.showBanks === false) ||
                (row.id === 'exams' && currentSubject.settings?.showTests === false) ||
                (row.id === 'library' && currentSubject.settings?.showLibrary === false) ||
                (row.id === 'courses' && currentSubject.settings?.showCourses === false);

              return (
                <button
                  key={row.id}
                  onClick={() => setSubjectTab(row.tab)}
                  className={`rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-sm ${
                    subjectTab === row.tab ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-gray-900">{row.title}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${isTabDisabled ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>
                      {isTabDisabled ? 'مخفي' : 'مفعل'}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="text-lg font-black text-gray-900">{row.total}</div>
                      <div className="text-[10px] font-bold text-gray-400">كلي</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-emerald-700">{row.visible}</div>
                      <div className="text-[10px] font-bold text-gray-400">ظاهر</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-amber-700">{row.review}</div>
                      <div className="text-[10px] font-bold text-gray-400">مراجعة</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subject Workspace Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-shrink-0">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setSubjectTab('courses')}
            className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
              subjectTab === 'courses' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <BookOpen size={18} />
            إدارة الدورات
          </button>
          <button
            onClick={() => setSubjectTab('skills')}
            className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
              subjectTab === 'skills' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Target size={18} />
            إدارة التأسيس (المواضيع)
          </button>
          <button
            onClick={() => setSubjectTab('questions')}
            className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
              subjectTab === 'questions' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileQuestion size={18} />
            إدارة التدريب
          </button>
          <button
            onClick={() => setSubjectTab('exams')}
            className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
              subjectTab === 'exams' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Award size={18} />
            إدارة الاختبارات
          </button>
          <button
            onClick={() => setSubjectTab('library')}
            className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
              subjectTab === 'library' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Library size={18} />
            إدارة المكتبة
          </button>
          <button
            onClick={() => setSubjectTab('settings')}
            className={`flex-1 py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[150px] ${
              subjectTab === 'settings' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Settings size={18} />
            التحكم بصفحة الطالب
          </button>
        </div>
      </div>

      {/* Subject Workspace Content Area */}
      <div className="space-y-6 overflow-visible pb-8">
        {subjectTab === 'courses' && (
          <div className="animate-fade-in">
            <CoursesManager subjectId={currentSubject?.id || ''} />
          </div>
        )}
        
        {subjectTab === 'skills' && (
          <FoundationManager subjectId={currentSubject?.id || ''} />
        )}

        {subjectTab === 'questions' && (
          <div className="animate-fade-in p-6">
            <QuizzesManager subjectId={currentSubject?.id || ''} filterType="bank" />
          </div>
        )}

        {subjectTab === 'exams' && (
          <div className="animate-fade-in p-6">
            <QuizzesManager subjectId={currentSubject?.id || ''} filterType="quiz" />
          </div>
        )}

        {subjectTab === 'library' && (
          <div className="animate-fade-in p-6">
            <LibraryManager subjectId={currentSubject?.id || ''} />
          </div>
        )}

        {subjectTab === 'settings' && currentSubject && (
          <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center animate-fade-in">
            <div className="w-20 h-20 bg-gray-50 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings size={40} />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">التحكم بصفحة الطالب ({currentSubject.name})</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">من هنا يمكنك التحكم بما يظهر للطالب في صفحة التعلم الخاصة بهذه المادة.</p>
            
            <div className="max-w-2xl mx-auto text-right space-y-4">
              {[
                { key: 'showCourses', label: 'تبويب "الدورات"', desc: 'إظهار أو إخفاء تبويب الدورات بالكامل.', default: true },
                { key: 'showSkills', label: 'تبويب "التأسيس" (الموضوعات)', desc: 'إظهار أو إخفاء تبويب التأسيس بالكامل.', default: true },
                { key: 'lockSkillsForNonSubscribers', label: 'قفل التأسيس لغير المشتركين', desc: 'سيظهر المحتوى وعليه علامة 🔒 للطلاب غير المشتركين.', default: false },
                { key: 'showBanks', label: 'تبويب "التدريب الحر"', desc: 'إظهار أو إخفاء تبويب التدريب بالكامل.', default: true },
                { key: 'lockBanksForNonSubscribers', label: 'قفل التدريب لغير المشتركين', desc: 'سيظهر التدريب وعليها علامة 🔒 للطلاب غير المشتركين.', default: false },
                { key: 'showTests', label: 'تبويب "الاختبارات"', desc: 'إظهار أو إخفاء تبويب الاختبارات بالكامل.', default: true },
                { key: 'lockTestsForNonSubscribers', label: 'قفل الاختبارات لغير المشتركين', desc: 'سيظهر الاختبار وعليه علامة 🔒 للطلاب غير المشتركين.', default: false },
                { key: 'showLibrary', label: 'تبويب "المكتبة"', desc: 'إظهار أو إخفاء تبويب المكتبة بالكامل.', default: true },
                { key: 'lockLibraryForNonSubscribers', label: 'قفل المكتبة لغير المشتركين', desc: 'سيظهر الملف وعليه علامة 🔒 للطلاب غير المشتركين.', default: false },
              ].map((setting) => {
                  const val = currentSubject.settings?.[setting.key as keyof typeof currentSubject.settings] ?? setting.default;
                  return (
                      <div key={setting.key} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => {
                          const currentSettings = currentSubject.settings || {};
                          useStore.getState().updateSubject(currentSubject.id, {
                              settings: {
                                  ...currentSettings,
                                  [setting.key]: !val
                              }
                          });
                      }}>
                        <div>
                          <h4 className="font-bold text-gray-800">{setting.label}</h4>
                          <p className="text-xs text-gray-500 mt-1">{setting.desc}</p>
                        </div>
                        <input 
                            type="checkbox" 
                            checked={val as boolean} 
                            onChange={() => {}} // handled by parent div
                            className="w-5 h-5 text-indigo-600 rounded cursor-pointer" 
                        />
                      </div>
                  );
              })}
            </div>
          </div>
        )}
      </div>

      {renderDeleteModal()}
    </div>
  );
};
