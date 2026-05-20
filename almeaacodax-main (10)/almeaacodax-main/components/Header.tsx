import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  ChevronDown,
  Menu,
  X,
  User,
  LayoutGrid,
  BookOpen,
  FileText,
  Award,
  LogOut,
  Home,
  Grid,
  Book,
  LogIn,
  Shield,
  Gift,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { isPathMockExam } from '../utils/mockExam';

const NavIcons: Record<string, React.ReactNode> = {
  home: <Home size={18} />,
  grid: <Grid size={18} />,
  'book-open': <BookOpen size={18} />,
  'file-text': <FileText size={18} />,
  book: <Book size={18} />,
  'layout-grid': <LayoutGrid size={18} />,
  gift: <Gift size={18} />,
  award: <Award size={18} />,
};

const text = {
  account: '\u062d\u0633\u0627\u0628\u064a',
  guest: '\u0645\u0633\u062a\u062e\u062f\u0645',
  dashboard: '\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645',
  courses: '\u062f\u0648\u0631\u0627\u062a\u064a',
  quizzes: '\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a\u064a',
  achievements: '\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0648\u0627\u0644\u0625\u0646\u062c\u0627\u0632\u0627\u062a',
  profile: '\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a',
  adminPanel: '\u0644\u0648\u062d\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629',
  logout: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c',
  login: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
  createAccount: '\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f',
  email: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
  password: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631',
  signUp: '\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628',
  signIn: '\u062f\u062e\u0648\u0644',
  or: '\u0623\u0648',
  continueWithGoogle: '\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0628\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u062c\u0648\u062c\u0644',
  forgotPassword: '\u0646\u0633\u064a\u062a \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631\u061f',
  hasAccount: '\u0644\u062f\u064a \u062d\u0633\u0627\u0628 \u0628\u0627\u0644\u0641\u0639\u0644\u061f \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
  noAccount: '\u0644\u064a\u0633 \u0644\u062f\u064a\u0643 \u062d\u0633\u0627\u0628\u061f \u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f',
  main: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
  quizzesNav: '\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a',
  blog: '\u0627\u0644\u0645\u062f\u0648\u0646\u0629',
  offersPrefix: '\u0639\u0631\u0648\u0636 \u0648\u0628\u0627\u0642\u0627\u062a',
  platform: '\u0645\u0646\u0635\u0629',
  hundred: '\u0627\u0644\u0645\u0626\u0629',
  subtitle: '\u0642\u062f\u0631\u0627\u062a & \u062a\u062d\u0635\u064a\u0644\u064a',
  authFallbackError: '\u062d\u062f\u062b \u062e\u0637\u0623 \u0623\u062b\u0646\u0627\u0621 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
};

export const Header: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [navigationLoadingExpired, setNavigationLoadingExpired] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { paths, subjects, levels, quizzes } = useStore();
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, logout } = useAuth();

  const getDashboardPathForRole = (role?: string | null) => {
    switch (role) {
      case 'admin':
        return '/admin-dashboard';
      case 'teacher':
        return '/instructor-dashboard';
      case 'supervisor':
        return '/supervisor-dashboard';
      case 'parent':
        return '/parent-dashboard';
      default:
        return '/dashboard';
    }
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    setActiveDropdown(null);
  }, [location]);

  const navigationMenu = useMemo(() => {
    const menu: Array<Record<string, any>> = [
      { id: '1', label: text.main, link: '/', iconName: 'home' },
    ];

    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(user?.role || '');
    const activePaths = paths.filter(
      (path) =>
        (canSeeHiddenPaths || path.isActive !== false) &&
        path.showInNavbar !== false &&
        typeof path.id === 'string' &&
        path.id.trim().length > 0 &&
        typeof path.name === 'string' &&
        path.name.trim().length > 0
    );
    const topLevelPaths = activePaths.filter((path) => !path.parentPathId);
    const childPaths = activePaths.filter((path) => path.parentPathId);

    topLevelPaths.forEach((path) => {
      const menuNode: Record<string, any> = {
        id: path.id,
        label: path.name,
        link: `/category/${path.id}`,
        iconName: 'book',
        children: [],
      };

      const pathLevels = levels.filter((level) => level.pathId === path.id);
      const pathSubjects = subjects.filter((subject) => subject.pathId === path.id);

      if (pathLevels.length > 0) {
        pathLevels.forEach((level) => {
          menuNode.children.push({
            id: level.id,
            label: level.name,
            link: `/category/${path.id}?level=${level.id}`,
            isGroup: true,
          });

          const levelSubjects = pathSubjects.filter((subject) => subject.levelId === level.id);
          levelSubjects.forEach((subject) => {
            menuNode.children.push({
              id: subject.id,
              label: subject.name,
              link: `/category/${path.id}?subject=${subject.id}`,
              isChild: true,
            });
          });
        });
      } else {
        pathSubjects.forEach((subject) => {
          menuNode.children.push({
            id: subject.id,
            label: subject.name,
            link: `/category/${path.id}?subject=${subject.id}`,
          });
        });
      }

      const subPaths = childPaths.filter((childPath) => childPath.parentPathId === path.id);
      if (subPaths.length > 0 && menuNode.children.length > 0) {
        menuNode.children.push({ isDivider: true });
      }

      subPaths.forEach((subPath) => {
        menuNode.children.push({
          id: subPath.id,
          label: subPath.name,
          link: `/category/${subPath.id}`,
        });
      });

      if (pathSubjects.length > 0 || subPaths.length > 0 || pathLevels.length > 0) {
        if (menuNode.children.length > 0) {
          menuNode.children.push({ isDivider: true });
        }

        menuNode.children.push({
          id: `${path.id}_mock_exams`,
          label: `اختبارات محاكية ${path.name}`,
          link: `/category/${path.id}?tab=mock-exams`,
          iconName: 'award',
        });

        menuNode.children.push({
          id: `${path.id}_packages`,
          label: `${text.offersPrefix} ${path.name}`,
          link: `/category/${path.id}?tab=packages`,
          iconName: 'gift',
        });
      } else {
        delete menuNode.children;
      }

      menu.push(menuNode);
    });

    const mockExamPaths = topLevelPaths.filter((path) => {
      const name = path.name || '';
      const hasVisibleMockExam = quizzes.some(
        (quiz) =>
          isPathMockExam(quiz, path.id) &&
          quiz.isPublished !== false &&
          quiz.showOnPlatform !== false &&
          (!quiz.approvalStatus || quiz.approvalStatus === 'approved'),
      );
      return hasVisibleMockExam || name.includes('قدرات') || name.includes('القدرات') || name.includes('تحصيلي') || name.includes('التحصيلي');
    });

    if (mockExamPaths.length > 0) {
      menu.push({
        id: 'mock-exams',
        label: 'اختبارات محاكية',
        link: '/mock-exams',
        iconName: 'award',
        children: mockExamPaths.map((path) => ({
          id: `mock-${path.id}`,
          label: path.name,
          link: `/category/${path.id}?tab=mock-exams`,
        })),
      });
    }

    menu.push({ id: 'blog', label: text.blog, link: '/blog', iconName: 'layout-grid' });

    return menu;
  }, [levels, paths, quizzes, subjects, user?.role]);

  const isPrivilegedUser = user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'supervisor';
  const showNavigationLoading = Boolean(user) && paths.length === 0 && navigationMenu.length <= 2 && !navigationLoadingExpired;
  const isStrongPassword = (value: string) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

  useEffect(() => {
    if (!user || paths.length > 0) {
      setNavigationLoadingExpired(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setNavigationLoadingExpired(true);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [paths.length, user]);

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');

    if (isSignUp && !isStrongPassword(password)) {
      setAuthError('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم.');
      return;
    }

    try {
      const sessionUser = isSignUp
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);

      const nextPath = getDashboardPathForRole(sessionUser.role);

      setIsUserMenuOpen(false);
      setActiveDropdown(null);
      setIsMobileMenuOpen(false);
      setIsLoginModalOpen(false);
      setEmail('');
      setPassword('');

      navigate(nextPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : text.authFallbackError;
      setAuthError(message);
    }
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20 gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen((value) => !value)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <Link to="/" className="flex items-center gap-2 min-w-0">
              <div className="text-lg sm:text-2xl font-black text-amber-500 flex items-baseline min-w-0">
                <span className="text-blue-900">{text.platform}</span>
                <span className="mx-1">{text.hundred}</span>
                <span className="hidden sm:block text-xs font-normal text-gray-400 -mt-2">{text.subtitle}</span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {showNavigationLoading ? (
              <div className="flex items-center gap-3 px-3 py-2" aria-label="جارٍ تجهيز قائمة المنصة">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span
                    key={`nav-loading-${index}`}
                    className={`h-4 animate-pulse rounded-full bg-gray-100 ${index === 0 ? 'w-16' : index === 1 ? 'w-24' : 'w-20'}`}
                  />
                ))}
              </div>
            ) : navigationMenu.map((item, index) => {
              const icon = item.iconName ? NavIcons[item.iconName] : null;

              return (
                <div
                  key={`nav-${item.id}-${index}`}
                  className="relative group px-3 py-2"
                  onMouseEnter={() => setActiveDropdown(item.id)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    to={item.link || '#'}
                    className="flex items-center gap-2 text-gray-700 font-bold hover:text-amber-500 transition-colors text-sm"
                  >
                    {icon ? (
                      <span className="text-gray-400 group-hover:text-amber-500 transition-colors">{icon}</span>
                    ) : null}
                    {item.label}
                    {item.children ? <ChevronDown size={14} /> : null}
                  </Link>

                  {item.children && activeDropdown === item.id ? (
                    <div className="absolute top-full right-0 w-56 bg-white shadow-xl rounded-b-xl border-t-2 border-amber-500 py-2 animate-fade-in z-50">
                      {item.children.map((child: Record<string, any>, childIndex: number) => {
                        if (child.isDivider) {
                          return <div key={`divider-${childIndex}`} className="h-px bg-gray-100 my-1 mx-2" />;
                        }

                        return (
                          <Link
                            key={`child-${child.id}-${childIndex}`}
                            to={child.link || '#'}
                            className={`block px-4 py-2 text-sm transition-colors ${
                              child.isGroup
                                ? 'bg-gray-50 text-gray-800 font-bold border-b border-gray-100'
                                : child.isChild
                                  ? 'text-gray-600 hover:bg-blue-50 hover:text-blue-700 pr-8'
                                  : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700 font-medium'
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button className="text-gray-500 hover:text-amber-500 transition-colors">
              <Search size={20} />
            </button>

            <Link to="/cart" className="relative text-gray-500 hover:text-amber-500 transition-colors">
              <ShoppingCart size={20} />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                0
              </span>
            </Link>

            <div className="relative">
              {user ? (
                <>
                  <button
                    onClick={() => setIsUserMenuOpen((value) => !value)}
                    className="flex items-center gap-2 hover:bg-gray-50 p-1 sm:pr-3 rounded-full border border-transparent hover:border-gray-100 transition-all"
                  >
                    <div className="hidden lg:block text-left">
                      <span className="block text-xs text-gray-500 font-normal">{text.account}</span>
                      <span className="block text-sm font-bold text-gray-800 leading-none">
                        {user.displayName || text.guest}
                      </span>
                    </div>
                    <img
                      src={user.photoURL}
                      alt="User"
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                  </button>

                  {isUserMenuOpen ? (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white shadow-xl rounded-xl border border-gray-100 py-2 animate-fade-in z-50">
                      <div className="px-4 py-3 border-b border-gray-100 mb-2">
                        <p className="font-bold text-gray-800">{user.displayName || text.guest}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>

                      <UserMenuItem to={getDashboardPathForRole(user.role)} icon={<LayoutGrid size={18} />} label={text.dashboard} />
                      <UserMenuItem to="/dashboard?tab=my-courses" icon={<BookOpen size={18} />} label={text.courses} />
                      <UserMenuItem to="/my-quizzes" icon={<FileText size={18} />} label={text.quizzes} />
                      <UserMenuItem to="/achievements" icon={<Award size={18} />} label={text.achievements} />
                      <UserMenuItem to="/profile" icon={<User size={18} />} label={text.profile} />

                      {isPrivilegedUser ? (
                        <UserMenuItem
                          to={getDashboardPathForRole(user.role)}
                          icon={<Shield size={18} />}
                          label={user.role === 'admin' ? text.adminPanel : text.dashboard}
                        />
                      ) : null}

                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button
                          onClick={async () => {
                            await logout();
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
                        >
                          <LogOut size={18} />
                          {text.logout}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  <LogIn size={18} />
                  <span className="hidden sm:inline">{text.login}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="md:hidden fixed inset-0 z-40 bg-white overflow-y-auto pb-20 animate-fade-in">
          <div className="p-4 pt-20">
            {navigationMenu.map((item, index) => {
              const icon = item.iconName ? NavIcons[item.iconName] : null;

              return (
                <div key={`mobile-nav-${item.id}-${index}`} className="mb-4">
                  <Link
                    to={item.link || '#'}
                    className="flex items-center gap-3 font-bold text-lg text-gray-800 mb-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {icon ? <span className="text-amber-500">{icon}</span> : null}
                    {item.label}
                  </Link>

                  {item.children ? (
                    <div className="pr-9 space-y-2 border-r-2 border-gray-100 mr-1">
                      {item.children
                        .filter((child: Record<string, any>) => !child.isDivider)
                        .map((child: Record<string, any>, childIndex: number) => (
                          <Link
                            key={`mobile-child-${child.id}-${childIndex}`}
                            to={child.link || '#'}
                            className={`block py-1 ${child.isGroup ? 'font-bold text-gray-800' : 'text-gray-600'}`}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            {child.label}
                          </Link>
                        ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isLoginModalOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-fade-in shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  {isSignUp ? text.createAccount : text.login}
                </h2>
                <button onClick={() => setIsLoginModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              {authError ? (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                  {authError}
                </div>
              ) : null}

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{text.email}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                    dir="ltr"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-sm font-bold text-gray-700">{text.password}</label>
                    {!isSignUp ? (
                      <Link
                        to="/forgot-password"
                        onClick={() => setIsLoginModalOpen(false)}
                        className="text-xs font-bold text-emerald-600 hover:underline"
                      >
                        {text.forgotPassword}
                      </Link>
                    ) : null}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={isSignUp ? 8 : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                    dir="ltr"
                    placeholder="********"
                  />
                  {isSignUp ? (
                    <p className="mt-1 text-xs text-gray-400">8 أحرف على الأقل، مع حرف ورقم.</p>
                  ) : null}
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  {isSignUp ? text.signUp : text.signIn}
                </button>
              </form>

              <div className="mt-6 flex items-center gap-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-sm text-gray-400">{text.or}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <button
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                    setIsLoginModalOpen(false);
                  } catch (error) {
                    const message = error instanceof Error ? error.message : text.authFallbackError;
                    setAuthError(message);
                  }
                }}
                className="mt-6 w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-xl transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {text.continueWithGoogle}
              </button>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setIsSignUp((value) => !value);
                    setAuthError('');
                  }}
                  className="text-sm text-emerald-600 hover:underline font-bold"
                >
                  {isSignUp ? text.hasAccount : text.noAccount}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};

const UserMenuItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <Link
    to={to}
    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium"
  >
    {icon}
    {label}
  </Link>
);
