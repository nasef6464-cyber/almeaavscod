
import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';
import { adapter } from './services/adapter';
import { api } from './services/api';
import { useStore } from './store/useStore';
import { RequireRole } from './components/auth/RequireRole';
import { normalizePathId } from './utils/normalizePathId';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AnnouncementAdsOverlay } from './components/AnnouncementAdsOverlay';
import { PlatformFontBootstrap } from './components/PlatformFontBootstrap';
import { APP_VERSION } from './utils/appVersion';
import { installGlobalClientTelemetry } from './services/clientTelemetry';

import { RoleSwitcher } from './components/RoleSwitcher';

// Lazy Load Pages
const Landing = React.lazy(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Quiz = React.lazy(() => import('./pages/Quiz'));
const Results = React.lazy(() => import('./pages/Results'));
const MockExams = React.lazy(() => import('./pages/MockExams'));
const Quizzes = React.lazy(() => import('./pages/Quizzes'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Favorites = React.lazy(() => import('./pages/Favorites'));
const Plan = React.lazy(() => import('./pages/Plan'));
const QA = React.lazy(() => import('./pages/QA'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Courses = React.lazy(() => import('./pages/Courses'));
const QuizGenerator = React.lazy(() => import('./components/QuizGenerator').then(module => ({ default: module.QuizGenerator })));
const Achievements = React.lazy(() => import('./pages/Achievements').then(module => ({ default: module.Achievements })));
const Qudrat = React.lazy(() => import('./pages/Qudrat').then(module => ({ default: module.Qudrat })));
const QudratSection = React.lazy(() => import('./pages/QudratSection').then(module => ({ default: module.QudratSection })));
const Tahsili = React.lazy(() => import('./pages/Tahsili').then(module => ({ default: module.Tahsili })));
const TahsiliSubject = React.lazy(() => import('./pages/TahsiliSubject').then(module => ({ default: module.TahsiliSubject })));
const Blog = React.lazy(() => import('./pages/Blog'));
const CourseView = React.lazy(() => import('./pages/CourseView'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = React.lazy(() => import('./pages/VerifyEmail'));
const BookSession = React.lazy(() => import('./pages/BookSession').then(module => ({ default: module.BookSession })));
const LiveSessions = React.lazy(() => import('./pages/LiveSessions'));
const QuizPage = React.lazy(() => import('./pages/QuizPage').then(module => ({ default: module.QuizPage })));
const GenericPathPage = React.lazy(() => import('./pages/GenericPathPage').then(module => ({ default: module.GenericPathPage })));
const CertificatePage = React.lazy(() => import('./pages/CertificatePage'));
const Pricing = React.lazy(() => import('./pages/Pricing').then(m => ({ default: m.Pricing })));
const ReviewSession = React.lazy(() => import('./pages/ReviewSession').then(m => ({ default: m.ReviewSession })));

// Dashboards
const loadAdminDashboardModule = () => import('./dashboards/admin/AdminDashboard');
const AdminDashboard = React.lazy(() => loadAdminDashboardModule().then(module => ({ default: module.AdminDashboard })));

const prefetchCommonRouteModules = (role?: string | null) => {
  void import('./pages/Dashboard');
  void import('./pages/GenericPathPage');
  void import('./pages/Quizzes');
  void import('./pages/MockExams');
  void import('./pages/Courses');

  if (role === 'admin' || role === 'teacher' || role === 'supervisor') {
    void loadAdminDashboardModule();
  }
};

const DATA_BOOTSTRAP_BLOCKING_PREFIXES = [
  '/quiz',
  '/results',
];

const DATA_BOOTSTRAP_START_PREFIXES = [
  '/dashboard',
  '/admin-dashboard',
  '/instructor-dashboard',
  '/supervisor-dashboard',
  '/parent-dashboard',
  '/category',
  '/quiz',
  '/results',
  '/courses',
  '/course',
  '/quizzes',
  '/mock-exams',
  '/my-quizzes',
  '/reports',
  '/favorites',
  '/plan',
  '/qa',
  '/book-session',
  '/live-sessions',
  '/profile',
  '/admin/quiz-gen',
  '/achievements',
];

const getInitialRouterPath = () => {
  const pathname = window.location.pathname || '/';
  const hashPath = window.location.hash.replace(/^#/, '');

  if ((pathname === '/' || !pathname) && hashPath.startsWith('/')) {
    return hashPath.split(/[?#]/)[0];
  }

  return pathname;
};

const shouldBlockInitialBootstrap = () => {
  const path = getInitialRouterPath();
  return DATA_BOOTSTRAP_BLOCKING_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

const isDataBootstrapBlockingPath = (path: string) =>
  DATA_BOOTSTRAP_BLOCKING_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const shouldStartInitialBootstrap = () => {
  const path = getInitialRouterPath();
  return DATA_BOOTSTRAP_START_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

const shouldStartBootstrapForPath = (path: string) =>
  DATA_BOOTSTRAP_START_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const QUESTION_BOOTSTRAP_DEFER_PREFIXES = [
  '/category',
  '/dashboard',
  '/admin-dashboard',
  '/instructor-dashboard',
  '/supervisor-dashboard',
  '/parent-dashboard',
  '/reports',
];

const shouldDeferQuestionBootstrap = (path: string) =>
  QUESTION_BOOTSTRAP_DEFER_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const SKILL_PROGRESS_BOOTSTRAP_DEFER_PREFIXES = [
  '/category',
];

const shouldDeferSkillProgressBootstrap = (path: string) =>
  SKILL_PROGRESS_BOOTSTRAP_DEFER_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

type BootstrapProfile = {
  loadCourses: boolean;
  loadQuizzes: boolean;
  loadTaxonomy: boolean;
  loadContent: boolean;
  contentScope: 'full' | 'learning';
  loadQuestions: boolean;
  loadSkillProgress: boolean;
};

const MINIMAL_BOOTSTRAP_PROFILE: BootstrapProfile = {
  loadCourses: false,
  loadQuizzes: false,
  loadTaxonomy: true,
  loadContent: false,
  contentScope: 'learning',
  loadQuestions: false,
  loadSkillProgress: false,
};

const FULL_BOOTSTRAP_PROFILE: BootstrapProfile = {
  loadCourses: true,
  loadQuizzes: true,
  loadTaxonomy: true,
  loadContent: true,
  contentScope: 'full',
  loadQuestions: true,
  loadSkillProgress: true,
};

const resolveBootstrapProfile = (path: string): BootstrapProfile => {
  if (path === '/' || path === '/blog') {
    return MINIMAL_BOOTSTRAP_PROFILE;
  }

  if (path.startsWith('/category/') || path === '/courses' || path.startsWith('/course/')) {
    return {
      ...FULL_BOOTSTRAP_PROFILE,
      contentScope: 'learning',
      loadQuestions: false,
      loadSkillProgress: false,
    };
  }

  if (
    path.startsWith('/admin-dashboard') ||
    path.startsWith('/instructor-dashboard') ||
    path.startsWith('/supervisor-dashboard') ||
    path.startsWith('/parent-dashboard')
  ) {
    return {
      ...FULL_BOOTSTRAP_PROFILE,
      loadQuestions: false,
      loadSkillProgress: false,
    };
  }

  if (
    path.startsWith('/quiz') ||
    path.startsWith('/results') ||
    path.startsWith('/reports') ||
    path.startsWith('/dashboard')
  ) {
    return FULL_BOOTSTRAP_PROFILE;
  }

  return {
    ...FULL_BOOTSTRAP_PROFILE,
    loadQuestions: false,
    loadSkillProgress: false,
  };
};

const SEO_BASE_URL = 'https://almeaavscod.vercel.app';

const SEO_PRIVATE_PREFIXES = [
  '/dashboard',
  '/admin-dashboard',
  '/instructor-dashboard',
  '/supervisor-dashboard',
  '/parent-dashboard',
  '/quiz',
  '/results',
  '/my-quizzes',
  '/reports',
  '/favorites',
  '/plan',
  '/qa',
  '/book-session',
  '/live-sessions',
  '/profile',
  '/admin',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

const upsertMeta = (selector: string, attribute: 'name' | 'property', name: string, content: string) => {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const SeoRouteMeta: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname || '/';
    const isPrivate = SEO_PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    const isCategory = path.startsWith('/category/');
    const isBlog = path === '/blog';
    const isCourses = path === '/courses' || path.startsWith('/course/');

    const title = isPrivate
      ? 'منصة المئة | مساحة الطالب'
      : isCategory
        ? 'مسارات القدرات والتحصيلي | منصة المئة'
        : isBlog
          ? 'مدونة منصة المئة'
          : isCourses
            ? 'دورات القدرات والتحصيلي | منصة المئة'
            : 'منصة المئة | قدرات وتحصيلي';

    const description = isPrivate
      ? 'مساحة خاصة داخل منصة المئة للطالب أو الإدارة.'
      : isCategory
        ? 'استكشف مسارات القدرات والتحصيلي والتأسيس والتدريب والاختبارات داخل منصة المئة.'
        : isBlog
          ? 'مقالات وإرشادات تعليمية من منصة المئة لطلاب القدرات والتحصيلي.'
          : isCourses
            ? 'دورات تعليمية منظمة للقدرات والتحصيلي داخل منصة المئة.'
            : 'منصة تعليمية عربية للقدرات والتحصيلي، تجمع المسارات التعليمية والدروس والاختبارات والتحليل الذكي في مكان واحد.';

    const canonicalPath = isPrivate ? '/' : path;
    const canonicalUrl = `${SEO_BASE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;
    const robots = isPrivate ? 'noindex, nofollow' : 'index, follow';

    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[name="robots"]', 'name', 'robots', robots);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
  }, [location.pathname]);

  return null;
};

const LoadingFallback = () => {
  const path = getInitialRouterPath();
  const isDashboardRoute = path.includes('dashboard');

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900" dir="rtl">
      <div className="border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-100" />
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded-full bg-gray-100" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-gray-100" />
            </div>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <div className="h-4 w-20 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-24 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-24 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-gray-100" />
          </div>
          <div className="flex items-baseline font-black">
            <span className="text-blue-900">منصة</span>
            <span className="mx-1 text-amber-500">المئة</span>
          </div>
        </div>
      </div>

      <div className={`mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:px-8 ${isDashboardRoute ? 'md:grid-cols-[16rem_1fr]' : ''}`}>
        {isDashboardRoute ? (
          <aside className="hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:block">
            <div className="mb-6 h-12 animate-pulse rounded-2xl bg-gray-50" />
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={`loading-side-${index}`} className="mb-3 h-10 animate-pulse rounded-2xl bg-gray-50" />
            ))}
          </aside>
        ) : null}

        <main className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="h-4 w-36 animate-pulse rounded-full bg-amber-100" />
              <div className="h-8 w-64 max-w-full animate-pulse rounded-2xl bg-gray-100" />
            </div>
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`loading-card-${index}`} className="h-32 animate-pulse rounded-3xl bg-gray-50" />
            ))}
          </div>
          <div className="mt-5 h-56 animate-pulse rounded-3xl bg-gray-50" />
        </main>
      </div>
    </div>
  );
};

const LegacySubjectRouteRedirect: React.FC = () => {
  const { pathId = '', subjectId = '' } = useParams<{ pathId: string; subjectId: string }>();
  return <Navigate replace to={`/category/${normalizePathId(pathId)}?subject=${subjectId}&tab=skills`} />;
};

const LegacyPackagesRouteRedirect: React.FC = () => {
  const { pathId = '' } = useParams<{ pathId: string }>();
  return <Navigate replace to={`/category/${normalizePathId(pathId)}?tab=packages`} />;
};

const LegacyHashRouteCompat: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const rawHash = window.location.hash || '';
    if (!rawHash.startsWith('#/')) {
      return;
    }

    if (location.pathname !== '/' || location.search) {
      return;
    }

    const target = rawHash.slice(1);
    if (!target.startsWith('/')) {
      return;
    }

    navigate(target, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
};

const BootstrapRouteGate: React.FC<{ bootstrapReady: boolean; children: React.ReactNode }> = ({ bootstrapReady, children }) => {
  const location = useLocation();

  if (!bootstrapReady && isDataBootstrapBlockingPath(location.pathname || '/')) {
    return <LoadingFallback />;
  }

  return <>{children}</>;
};

const CategoryRouteShellGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const paths = useStore((state) => state.paths);
  const subjects = useStore((state) => state.subjects);
  const isCategoryRoute = location.pathname === '/category' || location.pathname.startsWith('/category/');

  if (isCategoryRoute && paths.length === 0 && subjects.length === 0) {
    return <LoadingFallback />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const hydrateCourses = useStore((state) => state.hydrateCourses);
  const hydrateQuestions = useStore((state) => state.hydrateQuestions);
  const hydrateQuizzes = useStore((state) => state.hydrateQuizzes);
  const hydrateTaxonomy = useStore((state) => state.hydrateTaxonomy);
  const hydrateContentBootstrap = useStore((state) => state.hydrateContentBootstrap);
  const hydrateSkillProgress = useStore((state) => state.hydrateSkillProgress);
  const user = useStore((state) => state.user);

  useEffect(() => {
    window.__ALMEAA_APP_VERSION__ = APP_VERSION;
    window.__ALMEAA_API_BASE_URL__ = api.baseUrl;
    window.__ALMEAA_PERF_DEBUG__ = new URLSearchParams(window.location.search).get('perf') === '1';
    window.__ALMEAA_APP_STARTED_AT__ = performance.now();
  }, []);

  useEffect(() => installGlobalClientTelemetry(), []);

  useEffect(() => {
    let mounted = true;

    const bootstrapAppData = async (
      options: {
        profile?: BootstrapProfile;
        deferQuestions?: boolean;
        deferSkillProgress?: boolean;
      } = {},
    ) => {
      try {
        const useRealApi = import.meta.env.PROD || import.meta.env.VITE_USE_REAL_API !== 'false';
        const profile = options.profile ?? FULL_BOOTSTRAP_PROFILE;
        if (useRealApi) {
          window.setTimeout(() => {
            void api.health().catch((error) => {
              console.warn('API health check failed; continuing data bootstrap.', error);
            });
          }, 2000);
        }

        const shouldLoadQuestions = profile.loadQuestions && !options.deferQuestions;
        const shouldLoadSkillProgress = profile.loadSkillProgress && !options.deferSkillProgress;
        const coursesPromise = profile.loadCourses ? adapter.getCourses() : null;
        const quizzesPromise = profile.loadQuizzes ? adapter.getQuizzes() : null;
        const taxonomyPromise = profile.loadTaxonomy ? adapter.getTaxonomyBootstrap() : null;
        const taxonomyLoadPromise =
          profile.loadTaxonomy && profile.contentScope === 'learning'
            ? adapter.getTaxonomyBootstrap('core')
            : taxonomyPromise;
        const contentPhase = profile.contentScope === 'learning' ? 'core' : 'full';
        const contentPromise = profile.loadContent ? adapter.getContentBootstrap(profile.contentScope, contentPhase) : null;
        const questionsPromise = shouldLoadQuestions ? adapter.getQuestions({ page: 1, limit: 100 }) : null;
        const skillProgressPromise = shouldLoadSkillProgress ? api.getSkillProgress() : null;

        coursesPromise?.then((courses) => {
          if (mounted && courses.length > 0) {
            hydrateCourses(courses);
          }
        }).catch((error) => console.warn('Course bootstrap unavailable:', error));

        quizzesPromise?.then((quizzes) => {
          if (mounted) {
            hydrateQuizzes(quizzes);
          }
        }).catch((error) => console.warn('Quiz bootstrap unavailable:', error));

        taxonomyLoadPromise?.then((taxonomyResult) => {
          if (!mounted) return;
          const hasItems = (value: unknown) => Array.isArray(value) && value.length > 0;
          if (
            [
              taxonomyResult.paths,
              taxonomyResult.levels,
              taxonomyResult.subjects,
              taxonomyResult.sections,
              taxonomyResult.skills,
            ].some(hasItems)
          ) {
            hydrateTaxonomy({
              paths: taxonomyResult.paths as any[],
              levels: taxonomyResult.levels as any[],
              subjects: taxonomyResult.subjects as any[],
              sections: taxonomyResult.sections as any[],
              skills: taxonomyResult.skills as any[],
            });
          }
        }).catch((error) => console.warn('Taxonomy bootstrap unavailable:', error));

        if (profile.loadTaxonomy && profile.contentScope === 'learning') {
          void adapter.getTaxonomyBootstrap('full')
            .then((fullTaxonomyResult) => {
              if (!mounted) return;
              const hasItems = (value: unknown) => Array.isArray(value) && value.length > 0;
              if (
                [
                  fullTaxonomyResult.paths,
                  fullTaxonomyResult.levels,
                  fullTaxonomyResult.subjects,
                  fullTaxonomyResult.sections,
                  fullTaxonomyResult.skills,
                ].some(hasItems)
              ) {
                hydrateTaxonomy({
                  paths: fullTaxonomyResult.paths as any[],
                  levels: fullTaxonomyResult.levels as any[],
                  subjects: fullTaxonomyResult.subjects as any[],
                  sections: fullTaxonomyResult.sections as any[],
                  skills: fullTaxonomyResult.skills as any[],
                });
              }
            })
            .catch((error) => console.warn('Deferred taxonomy bootstrap unavailable:', error));
        }

        contentPromise?.then((contentResult) => {
          if (!mounted) return;
          const hasItems = (value: unknown) => Array.isArray(value) && value.length > 0;
          if (
            [
              contentResult.topics,
              contentResult.lessons,
              contentResult.libraryItems,
              contentResult.groups,
              contentResult.b2bPackages,
              contentResult.accessCodes,
              contentResult.announcementAds,
              contentResult.studyPlans,
            ].some(hasItems)
          ) {
            hydrateContentBootstrap({
              topics: contentResult.topics as any[],
              lessons: contentResult.lessons as any[],
              libraryItems: contentResult.libraryItems as any[],
              groups: contentResult.groups as any[],
              b2bPackages: contentResult.b2bPackages as any[],
              accessCodes: contentResult.accessCodes as any[],
              announcementAds: contentResult.announcementAds as any[],
              studyPlans: contentResult.studyPlans as any[],
            });
          }
        }).catch((error) => console.warn('Content bootstrap unavailable:', error));

        if (profile.loadContent && profile.contentScope === 'learning') {
          void adapter.getContentBootstrap('learning', 'full')
            .then((extendedContent) => {
              if (!mounted) return;
              const hasItems = (value: unknown) => Array.isArray(value) && value.length > 0;
              if ([extendedContent.lessons, extendedContent.libraryItems, extendedContent.studyPlans].some(hasItems)) {
                hydrateContentBootstrap({
                  lessons: extendedContent.lessons as any[],
                  libraryItems: extendedContent.libraryItems as any[],
                  studyPlans: extendedContent.studyPlans as any[],
                });
              }
            })
            .catch((error) => console.warn('Deferred learning content bootstrap unavailable:', error));
        }

        const [questionsResult, skillProgressResult] = await Promise.allSettled([
          questionsPromise ?? Promise.resolve(null),
          skillProgressPromise ?? Promise.resolve(null),
        ]);

        if (!mounted) {
          return;
        }

        if (questionsResult.status === 'fulfilled' && Array.isArray(questionsResult.value)) {
          hydrateQuestions(questionsResult.value);
        }

        if (skillProgressResult.status === 'fulfilled') {
          hydrateSkillProgress(skillProgressResult.value as any[]);
        }

        if (profile.loadQuestions && options.deferQuestions) {
          void adapter.getQuestions({ page: 1, limit: 20, summary: true, noTotal: true })
            .then((questions) => {
              if (mounted) {
                const currentQuestions = useStore.getState().questions || [];
                const mergedById = new Map(currentQuestions.map((question) => [question.id, question]));
                questions.forEach((question) => {
                  if (!mergedById.has(question.id)) {
                    mergedById.set(question.id, question);
                  }
                });
                hydrateQuestions(Array.from(mergedById.values()));
              }
            })
            .catch((error) => {
              console.warn('Deferred question bootstrap unavailable:', error);
            });
        }

        if (profile.loadSkillProgress && options.deferSkillProgress) {
          void api.getSkillProgress()
            .then((skillProgress) => {
              if (mounted) {
                hydrateSkillProgress(skillProgress as any[]);
              }
            })
            .catch((error) => {
              console.warn('Deferred skill-progress bootstrap unavailable:', error);
            });
        }
      } catch (error) {
        console.warn('App bootstrap fallback active:', error);
      } finally {
        if (mounted) {
          setBootstrapReady(true);
        }
      }
    };

    const loadPublicAnnouncementAds = async () => {
      try {
        const response = await api.getPublicAnnouncementAds();

        if (mounted) {
          hydrateContentBootstrap({
            announcementAds: response.announcementAds as any[],
          });
        }
      } catch (error) {
        console.warn('Public announcement ads unavailable:', error);
      }
    };

    const loadPublicNavigationBootstrap = async () => {
      try {
        const taxonomyResult = await adapter.getTaxonomyBootstrap('core');

        if (mounted) {
          hydrateTaxonomy({
            paths: taxonomyResult.paths as any[],
            levels: taxonomyResult.levels as any[],
            subjects: taxonomyResult.subjects as any[],
            sections: taxonomyResult.sections as any[],
            skills: taxonomyResult.skills as any[],
          });
        }
      } catch (error) {
        console.warn('Public navigation bootstrap unavailable:', error);
      }
    };

    let bootstrapStarted = false;
    let publicAdsTimer: ReturnType<typeof setTimeout> | undefined;
    let publicAdsIdleHandle: number | undefined;

    const cancelDeferredBootstrap = () => {
      if (publicAdsTimer !== undefined) {
        window.clearTimeout(publicAdsTimer);
      }

      if (publicAdsIdleHandle !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(publicAdsIdleHandle);
      }
    };

    const startBootstrap = () => {
      if (bootstrapStarted) {
        return;
      }

      bootstrapStarted = true;
      const path = getInitialRouterPath();
      const profile = resolveBootstrapProfile(path);
      void bootstrapAppData({
        profile,
        deferQuestions: shouldDeferQuestionBootstrap(path),
        deferSkillProgress: shouldDeferSkillProgressBootstrap(path),
      });
    };

    const startIfRouteNeedsData = () => {
      const path = getInitialRouterPath();
      if (path === '/admin-dashboard' || path === '/instructor-dashboard' || path === '/supervisor-dashboard') {
        void loadAdminDashboardModule();
      }

      if (shouldStartBootstrapForPath(path)) {
        if (isDataBootstrapBlockingPath(path)) {
          cancelDeferredBootstrap();
        }
        startBootstrap();
      }
    };

    const requestIdle = window.requestIdleCallback?.bind(window);

    if (shouldStartInitialBootstrap()) {
      startIfRouteNeedsData();
    } else if (requestIdle) {
      publicAdsTimer = globalThis.setTimeout(() => {
        void loadPublicNavigationBootstrap();
      }, 50);
      publicAdsIdleHandle = requestIdle(() => {
        prefetchCommonRouteModules();
        void loadPublicAnnouncementAds();
      }, { timeout: 1000 });
    } else {
      void loadPublicNavigationBootstrap();
      prefetchCommonRouteModules();
      publicAdsTimer = globalThis.setTimeout(() => {
        void loadPublicAnnouncementAds();
      }, 350);
    }

    window.addEventListener('hashchange', startIfRouteNeedsData);
    window.addEventListener('popstate', startIfRouteNeedsData);

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((...args: Parameters<History['pushState']>) => {
      originalPushState(...args);
      startIfRouteNeedsData();
    }) as History['pushState'];

    window.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      originalReplaceState(...args);
      startIfRouteNeedsData();
    }) as History['replaceState'];

    return () => {
      mounted = false;
      cancelDeferredBootstrap();
      window.removeEventListener('hashchange', startIfRouteNeedsData);
      window.removeEventListener('popstate', startIfRouteNeedsData);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [hydrateContentBootstrap, hydrateCourses, hydrateQuestions, hydrateQuizzes, hydrateSkillProgress, hydrateTaxonomy]);

  useEffect(() => {
    if (user) {
      const requestIdle = window.requestIdleCallback?.bind(window);

      if (requestIdle) {
        const handle = requestIdle(() => {
          prefetchCommonRouteModules(user.role);
        }, { timeout: 1200 });
        return () => window.cancelIdleCallback?.(handle);
      }

      const timer = window.setTimeout(() => {
        prefetchCommonRouteModules(user.role);
      }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [user?.role]);

  const staffDashboard = (
    <RequireRole allowedRoles={['admin', 'teacher', 'supervisor']}>
      <Suspense fallback={<LoadingFallback />}>
        <AdminDashboard />
      </Suspense>
    </RequireRole>
  );

  return (
    <Router>
      <PlatformFontBootstrap />
      <Suspense fallback={<LoadingFallback />}>
        <AppErrorBoundary>
        <LegacyHashRouteCompat />
        <SeoRouteMeta />
        <BootstrapRouteGate bootstrapReady={bootstrapReady}>
        <CategoryRouteShellGate>
        <Routes>
          {/* Routes without Main Layout (Full Screen) */}
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/quiz/:quizId" element={<QuizPage />} />
          <Route path="/results" element={<Results />} />
          
          {/* Admin Routes */}
          <Route path="/admin-dashboard" element={staffDashboard} />
          <Route path="/instructor-dashboard" element={staffDashboard} />
          <Route path="/supervisor-dashboard" element={staffDashboard} />
          <Route
            path="/parent-dashboard"
            element={
              <RequireRole allowedRoles={['parent']}>
                <Dashboard />
              </RequireRole>
            }
          />

          {/* Routes with Main Layout */}
          <Route path="*" element={
            <Layout>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/courses" element={<Courses />} />
                  <Route path="/course/:courseId" element={<CourseView />} />
                  <Route path="/quizzes" element={<Quizzes />} />
                  <Route path="/mock-exams" element={<MockExams />} />
                  <Route path="/my-quizzes" element={<Quizzes view="attempts" />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/plan" element={<Plan />} />
                  <Route path="/qa" element={<QA />} />
                  <Route path="/book-session" element={<BookSession />} />
                  <Route path="/live-sessions" element={<LiveSessions />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/admin/quiz-gen" element={<QuizGenerator />} />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/certificate/:code" element={<CertificatePage />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/review-session/:resultId" element={<ReviewSession />} />
                  
                  {/* Old Hardcoded Routes mapped to generic or kept if needed. The new pattern replaces old Nafes */}
                  <Route path="/category/:pathId" element={<GenericPathPage />} />
                  <Route path="/category/:pathId/packages" element={<LegacyPackagesRouteRedirect />} />
                  <Route path="/category/:pathId/:subjectId" element={<LegacySubjectRouteRedirect />} />
                  
                  {/* Placeholder for other routes */}
                  <Route path="/section/:catId" element={<Navigate replace to="/dashboard" />} />
                </Routes>
              </Suspense>
            </Layout>
          } />
        </Routes>
        </CategoryRouteShellGate>
        </BootstrapRouteGate>
        </AppErrorBoundary>
        <AnnouncementAdsOverlay />
        {(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV ? <RoleSwitcher /> : null}
      </Suspense>
    </Router>
  );
};

export default App;
