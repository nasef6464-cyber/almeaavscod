import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { User, Activity, QuestionAttempt, QuizResult, Question, Role, Group, Skill, CategoryPath, CategorySubject, CategorySection, B2BPackage, AccessCode, AnnouncementAd, Course, NestedSkill, LibraryItem, Quiz, Lesson, PackageContentType, StudyPlan, SkillProgress } from '../types';
import { normalizeIdList } from '../utils/entityIds';
import { isDevSessionUser } from '../utils/devSession';
import { normalizeQuizPlacement } from '../utils/quizPlacement';

const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | boolean> }).env;
const USE_REAL_API = runtimeEnv?.PROD === true || runtimeEnv?.VITE_USE_REAL_API !== 'false';
const shouldSyncUserToApi = (user?: User | null) => Boolean(USE_REAL_API && user?.email && !isDevSessionUser(user));

interface AppState {
    user: User;
    users: User[];
    groups: Group[];
    b2bPackages: B2BPackage[];
    accessCodes: AccessCode[];
    announcementAds: AnnouncementAd[];
    
    // Core Content
    courses: Course[];
    questions: Question[];
    quizzes: Quiz[];
    lessons: Lesson[];
    topics: import('../types').Topic[];
    
    // Taxonomy & Skills
    paths: CategoryPath[];
    levels: import('../types').CategoryLevel[];
    subjects: CategorySubject[];
    sections: CategorySection[];
    skills: Skill[];
    nestedSkills: NestedSkill[];
    libraryItems: LibraryItem[];
    addLibraryItem: (item: LibraryItem) => void;
    updateLibraryItem: (id: string, item: Partial<LibraryItem>) => void;
    deleteLibraryItem: (id: string) => void;
    
    enrolledCourses: string[];
    enrolledPaths: string[];
    completedLessons: string[];
    examResults: QuizResult[];
    questionAttempts: QuestionAttempt[];
    favorites: string[];
    reviewLater: string[];
    recentActivity: Activity[];
    studyPlans: StudyPlan[];
    skillProgress: SkillProgress[];
    
    // Actions
    hydrateUsers: (users: User[]) => void;
    hydrateCourses: (courses: Course[]) => void;
    hydrateQuestions: (questions: Question[]) => void;
    hydrateQuizzes: (quizzes: Quiz[]) => void;
    hydrateTaxonomy: (payload: {
        paths?: CategoryPath[];
        levels?: import('../types').CategoryLevel[];
        subjects?: CategorySubject[];
        sections?: CategorySection[];
        skills?: Skill[];
    }) => void;
    hydrateContentBootstrap: (payload: {
        topics?: import('../types').Topic[];
        lessons?: Lesson[];
        libraryItems?: LibraryItem[];
        groups?: Group[];
        b2bPackages?: B2BPackage[];
        accessCodes?: AccessCode[];
        announcementAds?: AnnouncementAd[];
        studyPlans?: StudyPlan[];
    }) => void;
    hydrateExamResults: (results: QuizResult[]) => void;
    hydrateSkillProgress: (items: SkillProgress[]) => void;
    hydrateQuestionAttempts: (attempts: QuestionAttempt[]) => void;
    enrollCourse: (courseId: string) => void;
    redeemAccessCode: (code: string) => Promise<void>;
    enrollPath: (pathId: string) => void;
    unenrollPath: (pathId: string) => void;
    markLessonComplete: (lessonId: string, courseId: string, lessonTitle: string) => void;
    saveExamResult: (result: QuizResult) => void;
    recordQuestionAttempt: (attempt: QuestionAttempt) => void;
    toggleFavorite: (questionId: string) => void;
    toggleReviewLater: (questionId: string) => void;
    addActivity: (activity: Omit<Activity, 'id' | 'date'>) => void;
    checkAccess: (contentId: string, isPremiumContent: boolean) => boolean;
    hasScopedPackageAccess: (contentType: PackageContentType, pathId?: string, subjectId?: string) => boolean;
    getMatchingPackage: (contentType: PackageContentType, pathId?: string, subjectId?: string) => B2BPackage | null;
    changeRole: (role: Role) => void;
    createStudyPlan: (plan: StudyPlan) => void;
    updateStudyPlan: (planId: string, data: Partial<StudyPlan>) => void;
    deleteStudyPlan: (planId: string) => void;
    archiveStudyPlan: (planId: string) => void;

    // Admin Actions
    addUser: (user: User) => void;
    updateUser: (userId: string, data: Partial<User>) => void;
    toggleUserStatus: (userId: string) => void;
    
    // Course Actions
    addCourse: (course: Course) => Promise<Course | null>;
    updateCourse: (courseId: string, data: Partial<Course>) => Promise<Course | null>;
    deleteCourse: (courseId: string) => Promise<void>;

    // Question Actions
    addQuestion: (question: Question) => Promise<void>;
    updateQuestion: (questionId: string, data: Partial<Question>) => void;
    deleteQuestion: (questionId: string) => void;

    // Quiz Actions
    addQuiz: (quiz: Quiz) => void;
    updateQuiz: (quizId: string, data: Partial<Quiz>) => void;
    deleteQuiz: (quizId: string) => void;

    // Lesson Actions
    addLesson: (lesson: Lesson) => void;
    updateLesson: (lessonId: string, data: Partial<Lesson>) => void;
    deleteLesson: (lessonId: string) => void;

    // Topic Actions
    addTopic: (topic: import('../types').Topic) => void;
    updateTopic: (topicId: string, data: Partial<import('../types').Topic>) => void;
    deleteTopic: (topicId: string) => void;
    
    // Group Actions
    createGroup: (group: Group) => void;
    updateGroup: (groupId: string, data: Partial<Group>) => void;
    deleteGroup: (groupId: string) => void;
    assignStudentToGroup: (userId: string, groupId: string) => void;
    removeStudentFromGroup: (userId: string, groupId: string) => void;
    assignSupervisorToGroup: (userId: string, groupId: string) => void;
    removeSupervisorFromGroup: (userId: string, groupId: string) => void;
    assignCourseToGroup: (courseId: string, groupId: string) => void;
    removeCourseFromGroup: (courseId: string, groupId: string) => void;

    // B2B Actions
    createB2BPackage: (pkg: B2BPackage) => void;
    updateB2BPackage: (id: string, data: Partial<B2BPackage>) => void;
    deleteB2BPackage: (id: string) => void;
    createAnnouncementAd: (ad: AnnouncementAd) => void;
    updateAnnouncementAd: (id: string, data: Partial<AnnouncementAd>) => void;
    deleteAnnouncementAd: (id: string) => void;
    createAccessCode: (code: AccessCode) => void;
    deleteAccessCode: (id: string) => void;

    // Taxonomy Actions
    addPath: (path: CategoryPath) => void;
    updatePath: (pathId: string, data: Partial<CategoryPath>) => void;
    deletePath: (pathId: string) => void;
    addLevel: (level: import('../types').CategoryLevel) => void;
    updateLevel: (levelId: string, data: Partial<import('../types').CategoryLevel>) => void;
    deleteLevel: (levelId: string) => void;
    addSubject: (subject: CategorySubject) => void;
    updateSubject: (subjectId: string, data: Partial<CategorySubject>) => void;
    deleteSubject: (subjectId: string) => void;
    addSection: (section: CategorySection) => void;
    updateSection: (sectionId: string, data: Partial<CategorySection>) => void;
    deleteSection: (sectionId: string) => void;

    // Skill Actions
    createSkill: (skill: Skill) => void;
    updateSkill: (skillId: string, data: Partial<Skill>) => void;
    deleteSkill: (skillId: string) => void;
    linkSkillToLesson: (skillId: string, lessonId: string) => void;
    unlinkSkillFromLesson: (skillId: string, lessonId: string) => void;
    
    // Nested Skill Actions
    updateNestedSkills: (skills: NestedSkill[]) => void;

    // Library Actions
}

const createGuestUser = (): User => ({
    id: 'guest',
    name: 'حساب ضيف',
    avatar: 'https://i.pravatar.cc/150?u=guest',
    role: Role.STUDENT,
    points: 0,
    badges: [],
    groupIds: [],
    subscription: {
        plan: 'free',
        purchasedCourses: [],
        purchasedPackages: []
    }
});

const packageMatchesScope = (
    pkg: B2BPackage,
    contentType: PackageContentType,
    pathId?: string,
    subjectId?: string,
) => {
    if (pkg.status !== 'active') {
        return false;
    }

    const contentTypes = Array.isArray(pkg.contentTypes) && pkg.contentTypes.length ? pkg.contentTypes : ['all'];
    const matchesType = contentTypes.includes('all') || contentTypes.includes(contentType);
    if (!matchesType) {
        return false;
    }

    const pathIds = Array.isArray(pkg.pathIds) ? pkg.pathIds : [];
    const subjectIds = Array.isArray(pkg.subjectIds) ? pkg.subjectIds : [];
    const matchesPath = !pathId || pathIds.length === 0 || pathIds.includes(pathId);
    const matchesSubject = !subjectId || subjectIds.length === 0 || subjectIds.includes(subjectId);

    return matchesPath && matchesSubject;
};

const isPublicPackageAvailable = (course: Course) =>
    Boolean(
        course.isPackage &&
        course.showOnPlatform !== false &&
        course.isPublished !== false &&
        (!course.approvalStatus || course.approvalStatus === 'approved'),
    );

const getUserSchoolIds = (groups: Group[], userGroupIds: string[] = []) => {
    const ids = new Set<string>();

    userGroupIds.forEach((groupId) => {
        const group = groups.find((item) => item.id === groupId);
        if (!group) {
            return;
        }

        if (group.type === 'SCHOOL') {
            ids.add(group.id);
        }

        if (group.parentId) {
            ids.add(group.parentId);
        }
    });

    return ids;
};

const getQuizResultIdentity = (result: Partial<QuizResult> | null | undefined) => {
    if (!result) return '';

    const date = String(result.date || '');
    const quizId = String(result.quizId || '');
    const userId = String(result.userId || '');
    if (date) {
        return [userId, quizId, date].filter(Boolean).join(':');
    }

    return [userId, quizId, result.quizTitle, result.score, result.timeSpent]
        .filter((item) => item !== undefined && item !== null && String(item) !== '')
        .map(String)
        .join(':');
};

const normalizeQuizResultForStore = (result: QuizResult): QuizResult => ({
    ...result,
    userId: result.userId ? String(result.userId) : result.userId,
    quizId: String(result.quizId || ''),
    quizTitle: String(result.quizTitle || 'اختبار'),
    date: String(result.date || new Date().toISOString()),
    source: result.source ? String(result.source) : result.source,
    returnTo: result.returnTo ? String(result.returnTo) : result.returnTo,
    score: Number(result.score || 0),
    totalQuestions: Number(result.totalQuestions || 0),
    correctAnswers: Number(result.correctAnswers || 0),
    wrongAnswers: Number(result.wrongAnswers || 0),
    unanswered: Number(result.unanswered || 0),
    timeSpent: String(result.timeSpent || '0 دقيقة'),
});

const mergeQuizResultsForStore = (
    existingResults: QuizResult[],
    incomingResults: QuizResult[],
    currentUserId?: string,
) => {
    const merged = new Map<string, QuizResult>();

    [...incomingResults, ...existingResults]
        .filter(Boolean)
        .map(normalizeQuizResultForStore)
        .filter((result) => result.quizId && result.date)
        .forEach((result) => {
            const belongsToCurrentUser =
                !currentUserId ||
                currentUserId === 'guest' ||
                currentUserId.startsWith('dev-') ||
                !result.userId ||
                result.userId === currentUserId;

            if (!belongsToCurrentUser) {
                return;
            }

            const identity = getQuizResultIdentity(result);
            if (identity && !merged.has(identity)) {
                merged.set(identity, result);
            }
        });

    return Array.from(merged.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 250);
};

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            user: createGuestUser(),
            users: [],
            groups: [],
            b2bPackages: [],
            accessCodes: [],
            announcementAds: [],
            courses: [],
            questions: [],
            quizzes: [],
            lessons: [],
            topics: [],
            paths: [],
            levels: [],
            subjects: [],
            sections: [],
            skills: [],
            nestedSkills: [],
            libraryItems: [],
            addLibraryItem: (item) => {
                const normalizedItem = {
                    ...item,
                    showOnPlatform: typeof item.showOnPlatform === 'boolean' ? item.showOnPlatform : false,
                };
                api.createLibraryItem(normalizedItem).catch(console.error);
                set((state) => ({ libraryItems: [normalizedItem, ...state.libraryItems] }));
            },
            updateLibraryItem: (id, item) => {
                api.updateLibraryItem(id, item).catch(console.error);
                set((state) => ({
                    libraryItems: state.libraryItems.map(i => i.id === id ? { ...i, ...item } : i)
                }));
            },
            deleteLibraryItem: (id) => {
                api.deleteLibraryItem(id).catch(console.error);
                set((state) => ({
                    libraryItems: state.libraryItems.filter(i => i.id !== id),
                    topics: state.topics.map((topic) => {
                        if (!topic.libraryItemIds?.includes(id)) return topic;
                        const nextLibraryItemIds = topic.libraryItemIds.filter((itemId) => itemId !== id);
                        api.updateTopic(topic.id, { libraryItemIds: nextLibraryItemIds }).catch(console.error);
                        return { ...topic, libraryItemIds: nextLibraryItemIds };
                    })
                }));
            },
            enrolledCourses: [],
            enrolledPaths: [],
            completedLessons: [],
            examResults: [],
            questionAttempts: [],
            favorites: [],
            reviewLater: [],
            recentActivity: [],
            studyPlans: [],
            skillProgress: [],

            hydrateUsers: (users) => set(() => ({
                users
            })),

            hydrateCourses: (courses) => set(() => ({
                courses
            })),

            hydrateQuestions: (questions) => set(() => ({
                questions
            })),

            hydrateQuizzes: (quizzes) => set(() => ({
                quizzes: quizzes.map((quiz) => normalizeQuizPlacement(quiz))
            })),

            hydrateTaxonomy: (payload) => set((state) => ({
                paths: payload.paths !== undefined
                  ? payload.paths
                      .map((path: any) => ({
                        ...path,
                        id: String(path?.id || path?._id || ''),
                      }))
                      .filter((path: any) => path.id && path.name)
                  : state.paths,
                levels: payload.levels !== undefined
                  ? payload.levels
                      .map((level: any) => ({
                        ...level,
                        id: String(level?.id || level?._id || ''),
                        pathId: String(level?.pathId || ''),
                      }))
                      .filter((level: any) => level.id && level.pathId)
                  : state.levels,
                subjects: payload.subjects !== undefined
                  ? payload.subjects
                      .map((subject: any) => ({
                        ...subject,
                        id: String(subject?.id || subject?._id || ''),
                        pathId: String(subject?.pathId || ''),
                      }))
                      .filter((subject: any) => subject.id && subject.pathId && subject.name)
                  : state.subjects,
                sections: payload.sections !== undefined
                  ? payload.sections
                      .map((section: any) => ({
                        ...section,
                        id: String(section?.id || section?._id || ''),
                        subjectId: String(section?.subjectId || ''),
                      }))
                      .filter((section: any) => section.id && section.subjectId && section.name)
                  : state.sections,
                skills: payload.skills !== undefined
                  ? payload.skills
                      .map((skill: any) => ({
                        ...skill,
                        id: String(skill?.id || skill?._id || ''),
                        pathId: String(skill?.pathId || ''),
                        subjectId: String(skill?.subjectId || ''),
                        sectionId: String(skill?.sectionId || ''),
                        lessonIds: Array.isArray(skill?.lessonIds) ? skill.lessonIds.map(String) : [],
                        questionIds: Array.isArray(skill?.questionIds) ? skill.questionIds.map(String) : [],
                        createdAt: typeof skill?.createdAt === 'number' ? skill.createdAt : Date.now(),
                      }))
                      .filter((skill: any) => skill.id && skill.pathId && skill.subjectId && skill.sectionId && skill.name)
                  : state.skills,
            })),

            hydrateContentBootstrap: (payload) => set((state) => ({
                topics: payload.topics !== undefined
                  ? payload.topics
                      .map((topic: any) => ({
                        ...topic,
                        id: String(topic?.id || topic?._id || ''),
                        lessonIds: normalizeIdList(topic?.lessonIds),
                        quizIds: normalizeIdList(topic?.quizIds),
                        libraryItemIds: normalizeIdList(topic?.libraryItemIds),
                      }))
                      .filter((topic: any) => topic.id && topic.subjectId && topic.title)
                  : state.topics,
                lessons: payload.lessons !== undefined
                  ? payload.lessons
                      .map((lesson: any) => ({
                        ...lesson,
                        id: String(lesson?.id || lesson?._id || ''),
                        skillIds: normalizeIdList(lesson?.skillIds),
                      }))
                      .filter((lesson: any) => lesson.id && lesson.title)
                  : state.lessons,
                libraryItems: payload.libraryItems !== undefined
                  ? payload.libraryItems
                      .map((item: any) => ({
                        ...item,
                        id: String(item?.id || item?._id || ''),
                        pathId: item?.pathId ? String(item.pathId) : undefined,
                        sectionId: item?.sectionId ? String(item.sectionId) : undefined,
                        skillIds: Array.isArray(item?.skillIds) ? item.skillIds.map(String) : [],
                      }))
                      .filter((item: any) => item.id && item.title)
                  : state.libraryItems,
                groups: payload.groups !== undefined
                  ? payload.groups
                      .map((group: any) => ({
                        ...group,
                        id: String(group?.id || group?._id || ''),
                      }))
                      .filter((group: any) => group.id && group.name)
                  : state.groups,
                b2bPackages: payload.b2bPackages !== undefined
                  ? payload.b2bPackages
                      .map((pkg: any) => ({
                        ...pkg,
                        id: String(pkg?.id || pkg?._id || ''),
                        schoolId: String(pkg?.schoolId || ''),
                        courseIds: Array.isArray(pkg?.courseIds) ? pkg.courseIds.map(String) : [],
                        contentTypes: Array.isArray(pkg?.contentTypes) && pkg.contentTypes.length ? pkg.contentTypes.map(String) : ['all'],
                        pathIds: Array.isArray(pkg?.pathIds) ? pkg.pathIds.map(String) : [],
                        subjectIds: Array.isArray(pkg?.subjectIds) ? pkg.subjectIds.map(String) : [],
                      }))
                      .filter((pkg: any) => pkg.id && pkg.schoolId && pkg.name)
                  : state.b2bPackages,
                accessCodes: payload.accessCodes !== undefined
                  ? payload.accessCodes
                      .map((code: any) => ({
                        ...code,
                        id: String(code?.id || code?._id || ''),
                        schoolId: String(code?.schoolId || ''),
                        packageId: String(code?.packageId || ''),
                      }))
                      .filter((code: any) => code.id && code.schoolId && code.packageId && code.code)
                  : state.accessCodes,
                announcementAds: payload.announcementAds !== undefined
                  ? payload.announcementAds
                      .map((ad: any) => ({
                        ...ad,
                        id: String(ad?.id || ad?._id || ''),
                        title: String(ad?.title || ''),
                        audience: ['all', 'guest', 'student', 'parent', 'staff'].includes(ad?.audience) ? ad.audience : 'all',
                        isActive: ad?.isActive !== false,
                        priority: Number(ad?.priority ?? 0),
                        createdAt: typeof ad?.createdAt === 'number' ? ad.createdAt : Date.now(),
                      }))
                      .filter((ad: any) => ad.id && ad.title)
                  : state.announcementAds,
                studyPlans: payload.studyPlans !== undefined
                  ? payload.studyPlans
                      .map((plan: any) => ({
                        ...plan,
                        id: String(plan?.id || plan?._id || ''),
                        subjectIds: Array.isArray(plan?.subjectIds) ? plan.subjectIds.map(String) : [],
                        courseIds: Array.isArray(plan?.courseIds) ? plan.courseIds.map(String) : [],
                        offDays: Array.isArray(plan?.offDays) ? plan.offDays.map(String) : [],
                      }))
                      .filter((plan: any) => plan.id && plan.userId && plan.name && plan.pathId)
                  : state.studyPlans,
            })),

            hydrateExamResults: (results) => set((state) => ({
                examResults: mergeQuizResultsForStore(
                    state.examResults,
                    Array.isArray(results) ? results : [],
                    state.user?.id,
                ),
            })),

            hydrateQuestionAttempts: (attempts) => set(() => ({
                questionAttempts: attempts
                    .map((attempt: any) => ({
                        questionId: String(attempt?.questionId || ''),
                        selectedOptionIndex: Number(attempt?.selectedOptionIndex ?? -1),
                        isCorrect: Boolean(attempt?.isCorrect),
                        timeSpentSeconds: Number(attempt?.timeSpentSeconds ?? 0),
                        date: String(attempt?.date || attempt?.createdAt || new Date().toISOString()),
                    }))
                    .filter((attempt) => attempt.questionId)
            })),

            hydrateSkillProgress: (items) => set(() => ({
                skillProgress: items
                    .map((item: any) => ({
                        ...item,
                        id: String(item?.id || item?._id || ''),
                        userId: String(item?.userId || ''),
                        skillId: String(item?.skillId || ''),
                        skill: String(item?.skill || ''),
                        mastery: Number(item?.mastery || 0),
                        attempts: Number(item?.attempts || 0),
                    }))
                    .filter((item: SkillProgress) => item.userId && item.skillId)
            })),

            enrollCourse: (courseId) => {
                if (get().enrolledCourses.includes(courseId)) return;

                set((current) => ({
                    enrolledCourses: [...current.enrolledCourses, courseId],
                }));
            },

            redeemAccessCode: async (code) => {
                const response = await api.redeemAccessCode({ code }) as { user?: any };
                const backendUser = response?.user;
                if (!backendUser) {
                    return;
                }

                set((state) => ({
                    user: {
                        ...state.user,
                        subscription: {
                            ...state.user.subscription,
                            plan: backendUser?.subscription?.plan ?? state.user.subscription?.plan ?? 'free',
                            expiresAt: backendUser?.subscription?.expiresAt ?? state.user.subscription?.expiresAt,
                            purchasedCourses: Array.isArray(backendUser?.subscription?.purchasedCourses)
                                ? backendUser.subscription.purchasedCourses.map(String)
                                : state.user.subscription?.purchasedCourses || [],
                            purchasedPackages: Array.isArray(backendUser?.subscription?.purchasedPackages)
                                ? backendUser.subscription.purchasedPackages.map(String)
                                : state.user.subscription?.purchasedPackages || [],
                        },
                    },
                    enrolledCourses: Array.isArray(backendUser?.enrolledCourses)
                        ? backendUser.enrolledCourses.map(String)
                        : state.enrolledCourses,
                }));
            },

            enrollPath: (pathId) => set((state) => {
                if (state.enrolledPaths?.includes(pathId)) return state;
                const nextEnrolledPaths = [...(state.enrolledPaths || []), pathId];
                if (shouldSyncUserToApi(state.user)) {
                    api.updateMyPreferences({
                        favorites: state.favorites,
                        reviewLater: state.reviewLater,
                        enrolledPaths: nextEnrolledPaths,
                    }).catch(console.error);
                }
                return {
                    enrolledPaths: nextEnrolledPaths
                };
            }),

            unenrollPath: (pathId) => set((state) => {
                const nextEnrolledPaths = (state.enrolledPaths || []).filter(id => id !== pathId);
                if (shouldSyncUserToApi(state.user)) {
                    api.updateMyPreferences({
                        favorites: state.favorites,
                        reviewLater: state.reviewLater,
                        enrolledPaths: nextEnrolledPaths,
                    }).catch(console.error);
                }
                return {
                    enrolledPaths: nextEnrolledPaths
                };
            }),

            markLessonComplete: (lessonId, courseId, lessonTitle) => {
                const state = get();
                if (state.completedLessons.includes(lessonId)) return;
                
                const newActivity: Activity = {
                    id: Date.now().toString(),
                    type: 'lesson_complete',
                    title: `أكملت درس: ${lessonTitle}`,
                    date: new Date().toISOString(),
                    link: `/course/${courseId}`
                };

                set((state) => ({
                    completedLessons: [...state.completedLessons, lessonId],
                    recentActivity: [newActivity, ...state.recentActivity].slice(0, 10) // Keep last 10
                }));
            },

            saveExamResult: (result) => {
                const state = get();
                const newActivity: Activity = {
                    id: Date.now().toString(),
                    type: 'quiz_complete',
                    title: `أنهيت اختبار: ${result.quizTitle} بنتيجة ${result.score}%`,
                    date: new Date().toISOString(),
                    link: `/results`
                };

                set((state) => ({
                    examResults: mergeQuizResultsForStore(state.examResults, [result], state.user?.id),
                    recentActivity: [newActivity, ...state.recentActivity].slice(0, 10)
                }));
            },

            recordQuestionAttempt: (attempt) => {
                const state = get();
                if (shouldSyncUserToApi(state.user)) {
                    const { isCorrect: _localOnly, ...serverAttempt } = attempt;
                    api.createQuestionAttempt(serverAttempt).catch(console.error);
                }
                set((state) => ({
                    questionAttempts: [...state.questionAttempts, attempt]
                }));
            },

            toggleFavorite: (questionId) => set((state) => ({
                favorites: (() => {
                    const nextFavorites = state.favorites.includes(questionId)
                        ? state.favorites.filter(id => id !== questionId)
                        : [...state.favorites, questionId];

                    if (shouldSyncUserToApi(state.user)) {
                        api.updateMyPreferences({
                            favorites: nextFavorites,
                            reviewLater: state.reviewLater,
                        }).catch(console.error);
                    }

                    return nextFavorites;
                })()
            })),

            toggleReviewLater: (questionId) => set((state) => ({
                reviewLater: (() => {
                    const nextReviewLater = state.reviewLater.includes(questionId)
                        ? state.reviewLater.filter(id => id !== questionId)
                        : [...state.reviewLater, questionId];

                    if (shouldSyncUserToApi(state.user)) {
                        api.updateMyPreferences({
                            favorites: state.favorites,
                            reviewLater: nextReviewLater,
                        }).catch(console.error);
                    }

                    return nextReviewLater;
                })()
            })),

            addActivity: (activity) => {
                const state = get();
                const newActivity = { ...activity, id: Date.now().toString(), date: new Date().toISOString() };
                
                set((state) => ({
                    recentActivity: [
                        newActivity,
                        ...state.recentActivity
                    ].slice(0, 10)
                }));
            },

            checkAccess: (contentId, isPremiumContent) => {
                const state = get();
                if (!isPremiumContent) return true;
                if (state.user.subscription.plan === 'premium') return true;
                if (state.enrolledCourses.includes(contentId)) return true;
                if (state.user.subscription.purchasedCourses.includes(contentId)) return true;
                if (state.user.subscription.purchasedPackages.includes(contentId)) return true;
                return false;
            },
            hasScopedPackageAccess: (contentType, pathId, subjectId) => {
                const state = get();
                if (state.user.subscription.plan === 'premium') return true;

                const purchasedPackageIds = new Set(state.user.subscription?.purchasedPackages || []);
                const hasDirectPackage = state.b2bPackages.some((pkg) => purchasedPackageIds.has(pkg.id) && packageMatchesScope(pkg, contentType, pathId, subjectId));
                if (hasDirectPackage) {
                    return true;
                }

                const hasPublicPathPackage = state.courses.some((course) => {
                    if (!isPublicPackageAvailable(course) || !purchasedPackageIds.has(course.id)) {
                        return false;
                    }

                    const packagePathId = course.pathId || course.category;
                    const packageSubjectId = course.subjectId || course.subject;
                    const packageContentTypes = course.packageContentTypes?.length ? course.packageContentTypes : ['all'];
                    const matchesType = packageContentTypes.includes('all') || packageContentTypes.includes(contentType);
                    const matchesPath = !pathId || !packagePathId || packagePathId === pathId;
                    const matchesSubject = !subjectId || !packageSubjectId || packageSubjectId === subjectId;

                    return matchesType && matchesPath && matchesSubject;
                });
                if (hasPublicPathPackage) {
                    return true;
                }

                const schoolIds = getUserSchoolIds(state.groups, state.user.groupIds || []);
                if (schoolIds.size === 0) {
                    return false;
                }

                return state.b2bPackages.some((pkg) => schoolIds.has(pkg.schoolId) && packageMatchesScope(pkg, contentType, pathId, subjectId));
            },
            getMatchingPackage: (contentType, pathId, subjectId) => {
                const state = get();
                const schoolIds = getUserSchoolIds(state.groups, state.user.groupIds || []);
                if (schoolIds.size === 0) {
                    return null;
                }

                const prioritizedPackages = [...state.b2bPackages]
                    .filter((pkg) => schoolIds.has(pkg.schoolId) && packageMatchesScope(pkg, contentType, pathId, subjectId))
                    .sort((a, b) => {
                        const aSpecificity = (a.subjectIds?.length || 0) * 4 + (a.pathIds?.length || 0) * 2 + (a.contentTypes?.includes('all') ? 0 : 1);
                        const bSpecificity = (b.subjectIds?.length || 0) * 4 + (b.pathIds?.length || 0) * 2 + (b.contentTypes?.includes('all') ? 0 : 1);
                        return bSpecificity - aSpecificity;
                    });

                return prioritizedPackages[0] || null;
            },

            changeRole: (role) => set((state) => ({
                user: { ...state.user, role }
            })),

            createStudyPlan: (plan) => {
                api.createStudyPlan(plan).catch(console.error);
                set((state) => ({
                    studyPlans: [
                        plan,
                        ...state.studyPlans.filter(existingPlan => existingPlan.id !== plan.id)
                    ]
                }));
            },

            updateStudyPlan: (planId, data) => {
                const updatedAt = Date.now();
                api.updateStudyPlan(planId, { ...data, updatedAt }).catch(console.error);
                set((state) => ({
                    studyPlans: state.studyPlans.map(plan =>
                        plan.id === planId
                            ? { ...plan, ...data, updatedAt }
                            : plan
                    )
                }));
            },

            deleteStudyPlan: (planId) => {
                api.deleteStudyPlan(planId).catch(console.error);
                set((state) => ({
                    studyPlans: state.studyPlans.filter(plan => plan.id !== planId)
                }));
            },

            archiveStudyPlan: (planId) => {
                const updatedAt = Date.now();
                api.updateStudyPlan(planId, { status: 'archived', updatedAt }).catch(console.error);
                set((state) => ({
                    studyPlans: state.studyPlans.map(plan =>
                        plan.id === planId
                            ? { ...plan, status: 'archived', updatedAt }
                            : plan
                    )
                }));
            },

            addUser: (user) => set((state) => ({
                users: [...state.users, user]
            })),

            updateUser: (userId, data) => set((state) => {
                api.updateAdminUser(userId, data).catch(console.error);
                return {
                    users: state.users.map(u => u.id === userId ? { ...u, ...data } : u),
                    // Also update current user if it's the same
                    user: state.user.id === userId ? { ...state.user, ...data } : state.user
                };
            }),

            toggleUserStatus: (userId) => set((state) => {
                const targetUser = state.users.find(u => u.id === userId);
                const nextStatus = !(targetUser?.isActive ?? true);
                api.updateAdminUser(userId, { isActive: nextStatus }).catch(console.error);
                return {
                    users: state.users.map(u => u.id === userId ? { ...u, isActive: nextStatus } : u)
                };
            }),

            // Course Actions
            addCourse: async (course) => {
                const normalizedCourse = {
                    ...course,
                    showOnPlatform: typeof course.showOnPlatform === 'boolean' ? course.showOnPlatform : false,
                };
                try {
                    const created = await api.createCourse(normalizedCourse) as any;
                    const persistedCourse = {
                        ...normalizedCourse,
                        ...created,
                        id: String(created?.id || created?._id || normalizedCourse.id),
                    } as Course;
                    set((state) => ({
                        courses: [persistedCourse, ...state.courses.filter((item) => item.id !== persistedCourse.id)],
                    }));
                    return persistedCourse;
                } catch (error) {
                    console.error('Failed to persist course:', error);
                    throw error;
                }
            },
            updateCourse: async (courseId, data) => {
                try {
                    const updated = await api.updateCourse(courseId, data) as any;
                    const persistedCourse = {
                        ...data,
                        ...updated,
                        id: String(updated?.id || updated?._id || courseId),
                    } as Course;
                    set((state) => ({
                        courses: state.courses.map(c => c.id === courseId ? { ...c, ...persistedCourse } : c)
                    }));
                    return persistedCourse;
                } catch (error) {
                    console.error('Failed to persist course update:', error);
                    throw error;
                }
            },
            deleteCourse: async (courseId) => {
                try {
                    await api.deleteCourse(courseId);
                    set((state) => ({
                        courses: state.courses.filter(c => c.id !== courseId)
                    }));
                } catch (error) {
                    console.error('Failed to delete course:', error);
                    throw error;
                }
            },

            // Question Actions
            addQuestion: async (question) => {
                const created = await api.createQuestion(question) as any;
                const normalizedQuestion = {
                    ...question,
                    id: String(created?.id || created?._id || question.id),
                };
                set((state) => ({
                    questions: [normalizedQuestion, ...state.questions.filter((item) => item.id !== normalizedQuestion.id)]
                }));
            },
            updateQuestion: (questionId, data) => {
                api.updateQuestion(questionId, data).catch(console.error);
                set((state) => ({
                    questions: state.questions.map(q => q.id === questionId ? { ...q, ...data } : q)
                }));
            },
            deleteQuestion: (questionId) => {
                api.deleteQuestion(questionId).catch(console.error);
                set((state) => ({
                    questions: state.questions.filter(q => q.id !== questionId)
                }));
            },

            // Quiz Actions
            addQuiz: (quiz) => {
                const normalizedQuiz = normalizeQuizPlacement({
                    ...quiz,
                    showOnPlatform: typeof quiz.showOnPlatform === 'boolean' ? quiz.showOnPlatform : false,
                });
                api.createQuiz(normalizedQuiz).catch(console.error);
                set((state) => ({
                    quizzes: [normalizedQuiz, ...state.quizzes]
                }));
            },
            updateQuiz: (quizId, data) => {
                const shouldNormalizePlacement =
                    'type' in data ||
                    'placement' in data ||
                    'showInTraining' in data ||
                    'showInMock' in data;
                const updatePayload = shouldNormalizePlacement ? normalizeQuizPlacement(data) : data;
                api.updateQuiz(quizId, updatePayload).catch(console.error);
                set((state) => ({
                    quizzes: state.quizzes.map(q => q.id === quizId ? (shouldNormalizePlacement ? normalizeQuizPlacement({ ...q, ...updatePayload }) : { ...q, ...updatePayload }) : q)
                }));
            },
            deleteQuiz: (quizId) => {
                api.deleteQuiz(quizId).catch(console.error);
                set((state) => ({
                    quizzes: state.quizzes.filter(q => q.id !== quizId),
                    topics: state.topics.map((topic) => {
                        if (!topic.quizIds?.includes(quizId)) return topic;
                        const nextQuizIds = topic.quizIds.filter((id) => id !== quizId);
                        api.updateTopic(topic.id, { quizIds: nextQuizIds }).catch(console.error);
                        return { ...topic, quizIds: nextQuizIds };
                    })
                }));
            },

            // Lesson Actions
            addLesson: (lesson) => {
                const normalizedLesson = {
                    ...lesson,
                    showOnPlatform: typeof lesson.showOnPlatform === 'boolean' ? lesson.showOnPlatform : false,
                };
                api.createLesson(normalizedLesson).catch(console.error);
                set((state) => ({
                    lessons: [normalizedLesson, ...state.lessons]
                }));
            },
            updateLesson: (lessonId, data) => {
                api.updateLesson(lessonId, data).catch(console.error);
                set((state) => ({
                    lessons: state.lessons.map(l => l.id === lessonId ? { ...l, ...data } : l)
                }));
            },
            deleteLesson: (lessonId) => {
                api.deleteLesson(lessonId).catch(console.error);
                set((state) => ({
                    lessons: state.lessons.filter(l => l.id !== lessonId),
                    topics: state.topics.map((topic) => {
                        if (!topic.lessonIds?.includes(lessonId)) return topic;
                        const nextLessonIds = topic.lessonIds.filter((id) => id !== lessonId);
                        api.updateTopic(topic.id, { lessonIds: nextLessonIds }).catch(console.error);
                        return { ...topic, lessonIds: nextLessonIds };
                    })
                }));
            },

            // Topic Actions
            addTopic: (topic) => {
                const normalizedTopic = {
                    ...topic,
                    showOnPlatform: typeof topic.showOnPlatform === 'boolean' ? topic.showOnPlatform : false,
                };
                api.createTopic(normalizedTopic).catch(console.error);
                set((state) => ({
                    topics: [...state.topics, normalizedTopic]
                }));
            },
            updateTopic: (topicId, data) => {
                api.updateTopic(topicId, data).catch(console.error);
                set((state) => ({
                    topics: state.topics.map(t => t.id === topicId ? { ...t, ...data } : t)
                }));
            },
            deleteTopic: (topicId) => {
                api.deleteTopic(topicId).catch(console.error);
                set((state) => ({
                    topics: state.topics.filter(t => t.id !== topicId)
                }));
            },

            // Group Actions
            createGroup: (group) => set((state) => {
                api.createGroup(group).catch(console.error);
                return {
                    groups: [...state.groups, group]
                };
            }),

            updateGroup: (groupId, data) => set((state) => {
                api.updateGroup(groupId, data).catch(console.error);
                return {
                    groups: state.groups.map(g => g.id === groupId ? { ...g, ...data } : g)
                };
            }),

            deleteGroup: (groupId) => set((state) => {
                api.deleteGroup(groupId).catch(console.error);
                const newGroups = state.groups.filter(g => g.id !== groupId);
                const newUsers = state.users.map(u => ({
                    ...u,
                    schoolId: u.schoolId === groupId ? undefined : u.schoolId,
                    groupIds: u.groupIds?.filter(id => id !== groupId) || []
                }));
                
                const currentUser = newUsers.find(u => u.id === state.user.id) || state.user;

                return {
                    groups: newGroups,
                    users: newUsers,
                    user: currentUser
                };
            }),

            assignStudentToGroup: (userId, groupId) => set((state) => {
                const targetGroup = state.groups.find(g => g.id === groupId);
                const currentUser = state.users.find(u => u.id === userId);
                if (!targetGroup || !currentUser) return state;

                let nextSchoolId = currentUser.schoolId;
                let nextGroupIds = [...(currentUser.groupIds || [])];
                let groupsToPersist = new Set<string>();
                let newGroups = [...state.groups];

                const removeUserFromGroup = (targetId: string, student = true) => {
                    newGroups = newGroups.map(group => {
                        if (group.id !== targetId) return group;
                        groupsToPersist.add(group.id);
                        return student
                            ? { ...group, studentIds: group.studentIds.filter(id => id !== userId), totalStudents: Math.max(0, (group.totalStudents || group.studentIds.length || 1) - 1) }
                            : { ...group, supervisorIds: group.supervisorIds.filter(id => id !== userId), totalSupervisors: Math.max(0, (group.totalSupervisors || group.supervisorIds.length || 1) - 1) };
                    });
                };

                const addUserToGroup = (targetId: string, student = true) => {
                    newGroups = newGroups.map(group => {
                        if (group.id !== targetId) return group;
                        if (student && group.studentIds.includes(userId)) return group;
                        if (!student && group.supervisorIds.includes(userId)) return group;
                        groupsToPersist.add(group.id);
                        return student
                            ? { ...group, studentIds: [...group.studentIds, userId], totalStudents: (group.totalStudents || group.studentIds.length || 0) + 1 }
                            : { ...group, supervisorIds: [...group.supervisorIds, userId], totalSupervisors: (group.totalSupervisors || group.supervisorIds.length || 0) + 1 };
                    });
                };

                const clearSchoolClassMemberships = (schoolId?: string) => {
                    if (!schoolId) return;
                    const schoolClassIds = state.groups
                        .filter(group => group.type === 'CLASS' && group.parentId === schoolId)
                        .map(group => group.id);

                    schoolClassIds.forEach(classId => removeUserFromGroup(classId, true));
                    nextGroupIds = nextGroupIds.filter(id => !schoolClassIds.includes(id));
                };

                if (targetGroup.type === 'SCHOOL') {
                    if (currentUser.schoolId && currentUser.schoolId !== targetGroup.id) {
                        removeUserFromGroup(currentUser.schoolId, true);
                        clearSchoolClassMemberships(currentUser.schoolId);
                    }

                    nextSchoolId = targetGroup.id;
                    addUserToGroup(targetGroup.id, true);
                } else {
                    if (targetGroup.parentId && currentUser.schoolId !== targetGroup.parentId) {
                        if (currentUser.schoolId) {
                            removeUserFromGroup(currentUser.schoolId, true);
                            clearSchoolClassMemberships(currentUser.schoolId);
                        }
                        nextSchoolId = targetGroup.parentId;
                        addUserToGroup(targetGroup.parentId, true);
                    }

                    if (!nextGroupIds.includes(targetGroup.id)) {
                        nextGroupIds = [...nextGroupIds, targetGroup.id];
                    }
                    addUserToGroup(targetGroup.id, true);
                }

                const normalizedGroupIds = Array.from(new Set(nextGroupIds));
                api.updateAdminUser(userId, {
                    schoolId: nextSchoolId || null,
                    groupIds: normalizedGroupIds,
                }).catch(console.error);

                Array.from(groupsToPersist).forEach(persistedGroupId => {
                    const persistedGroup = newGroups.find(group => group.id === persistedGroupId);
                    if (persistedGroup) {
                        api.updateGroup(persistedGroup.id, {
                            studentIds: persistedGroup.studentIds,
                            totalStudents: persistedGroup.totalStudents,
                            supervisorIds: persistedGroup.supervisorIds,
                            totalSupervisors: persistedGroup.totalSupervisors,
                        }).catch(console.error);
                    }
                });

                const newUsers = state.users.map(existingUser => {
                    if (existingUser.id !== userId) return existingUser;
                    return {
                        ...existingUser,
                        schoolId: nextSchoolId,
                        groupIds: normalizedGroupIds,
                    };
                });

                return {
                    groups: newGroups,
                    users: newUsers,
                    user: newUsers.find(u => u.id === state.user.id) || state.user
                };
            }),

            removeStudentFromGroup: (userId, groupId) => set((state) => {
                const targetGroup = state.groups.find(group => group.id === groupId);
                const currentUser = state.users.find(user => user.id === userId);
                if (!targetGroup || !currentUser) return state;

                let nextSchoolId = currentUser.schoolId;
                let nextGroupIds = [...(currentUser.groupIds || [])];
                let groupsToPersist = new Set<string>();

                const newGroups = state.groups.map(group => {
                    if (group.id !== groupId) return group;
                    groupsToPersist.add(group.id);
                    return {
                        ...group,
                        studentIds: group.studentIds.filter(id => id !== userId),
                        totalStudents: Math.max(0, (group.totalStudents || group.studentIds.length || 1) - 1),
                    };
                }).map(group => {
                    if (targetGroup.type === 'SCHOOL' && group.type === 'CLASS' && group.parentId === groupId && group.studentIds.includes(userId)) {
                        groupsToPersist.add(group.id);
                        return {
                            ...group,
                            studentIds: group.studentIds.filter(id => id !== userId),
                            totalStudents: Math.max(0, (group.totalStudents || group.studentIds.length || 1) - 1),
                        };
                    }
                    return group;
                });

                if (targetGroup.type === 'SCHOOL') {
                    nextSchoolId = undefined;
                    const relatedClassIds = state.groups.filter(group => group.type === 'CLASS' && group.parentId === groupId).map(group => group.id);
                    nextGroupIds = nextGroupIds.filter(id => !relatedClassIds.includes(id));
                } else {
                    nextGroupIds = nextGroupIds.filter(id => id !== groupId);
                }

                api.updateAdminUser(userId, {
                    schoolId: nextSchoolId || null,
                    groupIds: nextGroupIds,
                }).catch(console.error);

                Array.from(groupsToPersist).forEach(persistedGroupId => {
                    const persistedGroup = newGroups.find(group => group.id === persistedGroupId);
                    if (persistedGroup) {
                        api.updateGroup(persistedGroup.id, {
                            studentIds: persistedGroup.studentIds,
                            totalStudents: persistedGroup.totalStudents,
                        }).catch(console.error);
                    }
                });

                const newUsers = state.users.map(existingUser => {
                    if (existingUser.id !== userId) return existingUser;
                    return {
                        ...existingUser,
                        schoolId: nextSchoolId,
                        groupIds: nextGroupIds,
                    };
                });

                return {
                    groups: newGroups,
                    users: newUsers,
                    user: newUsers.find(u => u.id === state.user.id) || state.user
                };
            }),

            assignSupervisorToGroup: (userId, groupId) => set((state) => {
                const targetGroup = state.groups.find(group => group.id === groupId);
                const currentUser = state.users.find(user => user.id === userId);
                if (!targetGroup || !currentUser) return state;

                const nextGroupIds = currentUser.groupIds?.includes(groupId)
                    ? (currentUser.groupIds || [])
                    : [...(currentUser.groupIds || []), groupId];

                api.updateAdminUser(userId, {
                    groupIds: nextGroupIds,
                }).catch(console.error);

                const newGroups = state.groups.map(group => {
                    if (group.id === groupId && !group.supervisorIds.includes(userId)) {
                        const updated = { ...group, supervisorIds: [...group.supervisorIds, userId], totalSupervisors: (group.totalSupervisors || group.supervisorIds.length || 0) + 1 };
                        api.updateGroup(group.id, {
                            supervisorIds: updated.supervisorIds,
                            totalSupervisors: updated.totalSupervisors,
                        }).catch(console.error);
                        return updated;
                    }
                    return group;
                });

                const newUsers = state.users.map(existingUser => existingUser.id === userId ? { ...existingUser, groupIds: nextGroupIds } : existingUser);
                return {
                    groups: newGroups,
                    users: newUsers,
                    user: newUsers.find(u => u.id === state.user.id) || state.user,
                };
            }),

            removeSupervisorFromGroup: (userId, groupId) => set((state) => {
                const currentUser = state.users.find(user => user.id === userId);
                if (!currentUser) return state;

                const nextGroupIds = (currentUser.groupIds || []).filter(id => id !== groupId);
                api.updateAdminUser(userId, {
                    groupIds: nextGroupIds,
                }).catch(console.error);

                const newGroups = state.groups.map(group => {
                    if (group.id === groupId) {
                        const updated = { ...group, supervisorIds: group.supervisorIds.filter(id => id !== userId), totalSupervisors: Math.max(0, (group.totalSupervisors || group.supervisorIds.length || 1) - 1) };
                        api.updateGroup(group.id, {
                            supervisorIds: updated.supervisorIds,
                            totalSupervisors: updated.totalSupervisors,
                        }).catch(console.error);
                        return updated;
                    }
                    return group;
                });

                const newUsers = state.users.map(existingUser => existingUser.id === userId ? { ...existingUser, groupIds: nextGroupIds } : existingUser);
                return {
                    groups: newGroups,
                    users: newUsers,
                    user: newUsers.find(u => u.id === state.user.id) || state.user,
                };
            }),

            assignCourseToGroup: (courseId, groupId) => set((state) => {
                const newGroups = state.groups.map(group => {
                    if (group.id === groupId && !group.courseIds.includes(courseId)) {
                        const updated = { ...group, courseIds: [...group.courseIds, courseId], totalCourses: (group.totalCourses || group.courseIds.length || 0) + 1 };
                        api.updateGroup(group.id, {
                            courseIds: updated.courseIds,
                            totalCourses: updated.totalCourses,
                        }).catch(console.error);
                        return updated;
                    }
                    return group;
                });
                return { groups: newGroups };
            }),

            removeCourseFromGroup: (courseId, groupId) => set((state) => {
                const newGroups = state.groups.map(group => {
                    if (group.id === groupId) {
                        const updated = { ...group, courseIds: group.courseIds.filter(id => id !== courseId), totalCourses: Math.max(0, (group.totalCourses || group.courseIds.length || 1) - 1) };
                        api.updateGroup(group.id, {
                            courseIds: updated.courseIds,
                            totalCourses: updated.totalCourses,
                        }).catch(console.error);
                        return updated;
                    }
                    return group;
                });
                return { groups: newGroups };
            }),

            // B2B Actions
            createB2BPackage: (pkg) => set((state) => {
                const normalizedPackage: B2BPackage = {
                    ...pkg,
                    contentTypes: Array.isArray(pkg.contentTypes) && pkg.contentTypes.length ? pkg.contentTypes : ['all'],
                    pathIds: Array.isArray(pkg.pathIds) ? pkg.pathIds : [],
                    subjectIds: Array.isArray(pkg.subjectIds) ? pkg.subjectIds : [],
                };
                api.createB2BPackage(normalizedPackage).catch(console.error);
                return {
                    b2bPackages: [...state.b2bPackages, normalizedPackage]
                };
            }),
            updateB2BPackage: (id, data) => set((state) => {
                const normalizedData: Partial<B2BPackage> = {
                    ...data,
                    ...(data.contentTypes ? { contentTypes: data.contentTypes as PackageContentType[] } : {}),
                    ...(data.pathIds ? { pathIds: data.pathIds } : {}),
                    ...(data.subjectIds ? { subjectIds: data.subjectIds } : {}),
                };
                api.updateB2BPackage(id, normalizedData).catch(console.error);
                return {
                    b2bPackages: state.b2bPackages.map((p): B2BPackage => {
                        if (p.id !== id) {
                            return p;
                        }

                        return {
                            ...p,
                            ...normalizedData,
                            contentTypes: normalizedData.contentTypes ?? p.contentTypes,
                            pathIds: normalizedData.pathIds ?? p.pathIds,
                            subjectIds: normalizedData.subjectIds ?? p.subjectIds,
                        };
                    })
                };
            }),
            deleteB2BPackage: (id) => set((state) => {
                api.deleteB2BPackage(id).catch(console.error);
                return {
                    b2bPackages: state.b2bPackages.filter(p => p.id !== id),
                    accessCodes: state.accessCodes.filter(code => code.packageId !== id)
                };
            }),
            createAnnouncementAd: (ad) => set((state) => {
                const normalizedAd: AnnouncementAd = {
                    ...ad,
                    audience: ad.audience || 'all',
                    displayMode: ad.displayMode || 'modal',
                    frequency: ad.frequency || 'session',
                    imageFit: ad.imageFit || 'cover',
                    delaySeconds: Math.max(0, Math.min(30, Number(ad.delaySeconds ?? 0))),
                    isActive: ad.isActive !== false,
                    priority: Number(ad.priority ?? 0),
                    createdAt: ad.createdAt || Date.now(),
                    updatedAt: Date.now(),
                };
                api.createAnnouncementAd(normalizedAd).catch(console.error);
                return {
                    announcementAds: [...state.announcementAds, normalizedAd].sort((a, b) => a.priority - b.priority),
                };
            }),
            updateAnnouncementAd: (id, data) => set((state) => {
                const normalizedData: Partial<AnnouncementAd> = {
                    ...data,
                    ...(data.priority !== undefined ? { priority: Number(data.priority) } : {}),
                    ...(data.delaySeconds !== undefined ? { delaySeconds: Math.max(0, Math.min(30, Number(data.delaySeconds || 0))) } : {}),
                    updatedAt: Date.now(),
                };
                api.updateAnnouncementAd(id, normalizedData).catch(console.error);
                return {
                    announcementAds: state.announcementAds
                        .map((ad) => (ad.id === id ? { ...ad, ...normalizedData } : ad))
                        .sort((a, b) => a.priority - b.priority),
                };
            }),
            deleteAnnouncementAd: (id) => set((state) => {
                api.deleteAnnouncementAd(id).catch(console.error);
                return {
                    announcementAds: state.announcementAds.filter((ad) => ad.id !== id),
                };
            }),
            createAccessCode: (code) => set((state) => {
                api.createAccessCode(code).catch(console.error);
                return {
                    accessCodes: [...state.accessCodes, code]
                };
            }),
            deleteAccessCode: (id) => set((state) => {
                api.deleteAccessCode(id).catch(console.error);
                return {
                    accessCodes: state.accessCodes.filter(c => c.id !== id)
                };
            }),

            // Taxonomy Actions
            addPath: (path) => {
                api.createPath(path).catch(console.error);
                set((state) => ({
                    paths: [...state.paths, path]
                }));
            },
            updatePath: (pathId, data) => {
                api.updatePath(pathId, data).catch(console.error);
                set((state) => ({
                    paths: state.paths.map(p => p.id === pathId ? { ...p, ...data } : p)
                }));
            },
            deletePath: (pathId) => {
                api.deletePath(pathId).catch(console.error);
                set((state) => ({
                    paths: state.paths.filter(p => p.id !== pathId),
                    subjects: state.subjects.filter(s => s.pathId !== pathId),
                    levels: state.levels.filter(l => l.pathId !== pathId),
                    sections: state.sections.filter(section => {
                        const subject = state.subjects.find(s => s.id === section.subjectId);
                        return subject?.pathId !== pathId;
                    }),
                    skills: state.skills.filter(skill => skill.pathId !== pathId)
                }));
            },
            addLevel: (level) => {
                api.createLevel(level).catch(console.error);
                set((state) => ({
                    levels: [...state.levels, level]
                }));
            },
            updateLevel: (levelId, data) => {
                api.updateLevel(levelId, data).catch(console.error);
                set((state) => ({
                    levels: state.levels.map(l => l.id === levelId ? { ...l, ...data } : l)
                }));
            },
            deleteLevel: (levelId) => {
                api.deleteLevel(levelId).catch(console.error);
                set((state) => ({
                    levels: state.levels.filter(l => l.id !== levelId),
                    subjects: state.subjects.filter(s => s.levelId !== levelId),
                    sections: state.sections.filter(section => {
                        const subject = state.subjects.find(s => s.id === section.subjectId);
                        return subject?.levelId !== levelId;
                    }),
                    skills: state.skills.filter(skill => {
                        const subject = state.subjects.find(s => s.id === skill.subjectId);
                        return subject?.levelId !== levelId;
                    })
                }));
            },
            addSubject: (subject) => {
                api.createSubject(subject).catch(console.error);
                set((state) => ({
                    subjects: [...state.subjects, subject]
                }));
            },
            updateSubject: (subjectId, data) => {
                api.updateSubject(subjectId, data).catch(console.error);
                set((state) => ({
                    subjects: state.subjects.map(s => s.id === subjectId ? { ...s, ...data } : s)
                }));
            },
            deleteSubject: (subjectId) => {
                api.deleteSubject(subjectId).catch(console.error);
                set((state) => ({
                    subjects: state.subjects.filter(s => s.id !== subjectId),
                    sections: state.sections.filter(sec => sec.subjectId !== subjectId),
                    skills: state.skills.filter(skill => skill.subjectId !== subjectId),
                    lessons: state.lessons.map(lesson =>
                        lesson.subjectId === subjectId ? { ...lesson, sectionId: undefined, skillIds: [] } : lesson
                    ),
                    questions: state.questions.map(question =>
                        question.subject === subjectId ? { ...question, sectionId: undefined, skillIds: [] } : question
                    ),
                    libraryItems: state.libraryItems.map(item =>
                        item.subjectId === subjectId ? { ...item, sectionId: undefined, skillIds: [] } : item
                    ),
                    quizzes: state.quizzes.map(quiz =>
                        quiz.subjectId === subjectId ? { ...quiz, sectionId: undefined, skillIds: [] } : quiz
                    )
                }));
            },
            addSection: (section) => {
                api.createSection(section).catch(console.error);
                set((state) => ({
                    sections: [...state.sections.filter(existingSection => existingSection.id !== section.id), section]
                }));
            },
            updateSection: (sectionId, data) => {
                api.updateSection(sectionId, data).catch(console.error);
                set((state) => ({
                    sections: state.sections.map(section => section.id === sectionId ? { ...section, ...data } : section)
                }));
            },
            deleteSection: (sectionId) => {
                api.deleteSection(sectionId).catch(console.error);
                set((state) => ({
                    sections: state.sections.filter(section => section.id !== sectionId),
                    skills: state.skills.filter(skill => skill.sectionId !== sectionId),
                    lessons: state.lessons.map(lesson =>
                        lesson.sectionId === sectionId ? { ...lesson, sectionId: undefined } : lesson
                    ),
                    questions: state.questions.map(question =>
                        question.sectionId === sectionId ? { ...question, sectionId: undefined } : question
                    )
                }));
            },

            // Skill Actions
            createSkill: (skill) => {
                api.createSkill(skill).catch(console.error);
                set((state) => ({
                    skills: [...state.skills.filter(existingSkill => existingSkill.id !== skill.id), skill]
                }));
            },

            updateSkill: (skillId, data) => {
                api.updateSkill(skillId, data).catch(console.error);
                set((state) => ({
                    skills: state.skills.map(s => s.id === skillId ? { ...s, ...data } : s)
                }));
            },

            deleteSkill: (skillId) => {
                api.deleteSkill(skillId).catch(console.error);
                set((state) => ({
                    skills: state.skills.filter(s => s.id !== skillId),
                    lessons: state.lessons.map(lesson => ({
                        ...lesson,
                        skillIds: lesson.skillIds.filter(id => id !== skillId)
                    })),
                    questions: state.questions.map(question => ({
                        ...question,
                        skillIds: question.skillIds.filter(id => id !== skillId)
                    })),
                    libraryItems: state.libraryItems.map(item => ({
                        ...item,
                        skillIds: (item.skillIds || []).filter(id => id !== skillId)
                    })),
                    quizzes: state.quizzes.map(quiz => ({
                        ...quiz,
                        skillIds: (quiz.skillIds || []).filter(id => id !== skillId)
                    }))
                }));
            },

            linkSkillToLesson: (skillId, lessonId) => set((state) => ({
                skills: state.skills.map(s => {
                    if (s.id === skillId && !s.lessonIds.includes(lessonId)) {
                        return { ...s, lessonIds: [...s.lessonIds, lessonId] };
                    }
                    return s;
                })
            })),

            unlinkSkillFromLesson: (skillId, lessonId) => set((state) => ({
                skills: state.skills.map(s => {
                    if (s.id === skillId) {
                        return { ...s, lessonIds: s.lessonIds.filter(id => id !== lessonId) };
                    }
                    return s;
                })
            })),
            
            // Nested Skill Actions
            updateNestedSkills: (skills) => set(() => ({
                nestedSkills: skills,
            }))
        }),
        {
            name: 'learning-platform-storage', // unique name
            version: 3,
            partialize: (state) => Object.fromEntries(
                Object.entries(state).filter(([key]) => !['paths', 'levels', 'subjects', 'sections', 'skills', 'nestedSkills', 'libraryItems', 'questions', 'users', 'courses', 'topics', 'lessons', 'quizzes', 'groups', 'b2bPackages', 'accessCodes', 'announcementAds', 'skillProgress'].includes(key))
            ),
            migrate: (persistedState: any) => {
                if (!persistedState || typeof persistedState !== 'object') {
                    return persistedState;
                }

                return {
                    ...persistedState,
                    courses: [],
                    questions: [],
                    quizzes: [],
                    lessons: [],
                    topics: [],
                    groups: [],
                    b2bPackages: [],
                    accessCodes: [],
                    announcementAds: [],
                    paths: [],
                    levels: [],
                    subjects: [],
                    sections: [],
                    skills: [],
                    nestedSkills: [],
                    libraryItems: [],
                    studyPlans: Array.isArray(persistedState.studyPlans) ? persistedState.studyPlans : [],
                    skillProgress: [],
                };
            }
        }
    )
);
