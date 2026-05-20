import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { Role } from '../types';
import { useStore } from '../store/useStore';
import { DEV_TOKEN_PREFIX } from '../utils/devSession';

type BackendRole = 'student' | 'teacher' | 'admin' | 'supervisor' | 'parent';

interface BackendAuthUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  avatar?: string;
  role: BackendRole;
  points?: number;
  badges?: string[];
  isActive?: boolean;
  schoolId?: string | null;
  groupIds?: string[];
  linkedStudentIds?: string[];
  managedPathIds?: string[];
  managedSubjectIds?: string[];
  favorites?: string[];
  reviewLater?: string[];
  enrolledCourses?: string[];
  enrolledPaths?: string[];
  completedLessons?: string[];
  subscription?: {
    plan?: 'free' | 'premium';
    expiresAt?: string;
    purchasedCourses?: string[] | string;
    purchasedPackages?: string[] | string;
  };
}

interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: BackendRole;
  token?: string;
}

interface AuthContextType {
  user: SessionUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<SessionUser>;
  signUpWithEmail: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  devSwitchRole?: (role: BackendRole) => void;
}

const SESSION_STORAGE_KEY = 'the-hundred-auth-profile';

const roleMap: Record<BackendRole, Role> = {
  admin: Role.ADMIN,
  teacher: Role.TEACHER,
  student: Role.STUDENT,
  supervisor: Role.SUPERVISOR,
  parent: Role.PARENT,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isAuthSessionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Authentication required|Invalid token|Token expired|jwt expired|jwt malformed|unauthorized/i.test(message);
};

const devRoleNames: Record<BackendRole, string> = {
  admin: 'مدير النظام',
  teacher: 'معلم تجريبي',
  student: 'طالب تجريبي',
  supervisor: 'مشرف تجريبي',
  parent: 'ولي أمر تجريبي',
};

const buildDevBackendUser = (role: BackendRole): BackendAuthUser => ({
  id: `dev-${role}`,
  name: devRoleNames[role],
  email: `dev-${role}@almeaa.local`,
  role,
  points: role === 'student' ? 120 : 0,
  badges: [],
  isActive: true,
  linkedStudentIds: role === 'parent' ? ['69f5eee03ca434d37422ab69'] : [],
  managedPathIds: role === 'teacher' || role === 'supervisor' ? ['p_1777779639431'] : [],
  managedSubjectIds: role === 'teacher' ? ['sub_1777779748206'] : [],
  favorites: [],
  reviewLater: [],
  enrolledCourses: [],
  enrolledPaths: role === 'student' ? ['p_1777779639431'] : [],
  completedLessons: [],
  subscription: {
    plan: role === 'student' ? 'premium' : 'free',
    purchasedPackages: role === 'student' ? ['pkg_seed_school_quant_full'] : [],
    purchasedCourses: [],
  },
});

const toArray = (value?: string[] | string): string[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

const buildSessionUser = (user: BackendAuthUser): SessionUser => ({
  id: String(user.id || user._id || user.email),
  email: user.email,
  displayName: user.name,
  photoURL: user.avatar || `https://i.pravatar.cc/150?u=${encodeURIComponent(user.email)}`,
  role: user.role,
});

const syncStoreUser = (sessionUser: SessionUser | null, backendUser?: BackendAuthUser | null) => {
  if (!sessionUser) {
    return;
  }

  const existing = useStore.getState().user;

  useStore.setState({
    user: {
      ...existing,
      id: sessionUser.id,
      name: sessionUser.displayName,
      email: sessionUser.email,
      avatar: sessionUser.photoURL,
      role: roleMap[sessionUser.role],
      points: backendUser?.points ?? existing.points,
      badges: backendUser?.badges ?? existing.badges,
      linkedStudentIds: backendUser?.linkedStudentIds ?? existing.linkedStudentIds,
      managedPathIds: backendUser?.managedPathIds ?? existing.managedPathIds,
      managedSubjectIds: backendUser?.managedSubjectIds ?? existing.managedSubjectIds,
      subscription: {
        ...existing.subscription,
        plan: backendUser?.subscription?.plan ?? existing.subscription.plan,
        expiresAt: backendUser?.subscription?.expiresAt ?? existing.subscription.expiresAt,
        purchasedCourses: toArray(backendUser?.subscription?.purchasedCourses),
        purchasedPackages: toArray(backendUser?.subscription?.purchasedPackages),
      },
    },
    favorites: backendUser?.favorites ?? useStore.getState().favorites,
    reviewLater: backendUser?.reviewLater ?? useStore.getState().reviewLater,
    enrolledCourses: backendUser?.enrolledCourses ?? useStore.getState().enrolledCourses,
    enrolledPaths: backendUser?.enrolledPaths ?? useStore.getState().enrolledPaths,
    completedLessons: backendUser?.completedLessons ?? useStore.getState().completedLessons,
  });
};

const resetStoreUser = () => {
  const existing = useStore.getState().user;

  useStore.setState({
    user: {
      ...existing,
      id: 'guest',
      name: 'Guest User',
      email: undefined,
      avatar: 'https://i.pravatar.cc/150?u=guest',
      role: Role.STUDENT,
      points: 0,
      badges: [],
      subscription: {
        plan: 'free',
        expiresAt: undefined,
        purchasedCourses: [],
        purchasedPackages: [],
      },
    },
    examResults: [],
    questionAttempts: [],
    favorites: [],
    reviewLater: [],
    recentActivity: [],
  });
};

const restoreInitialSession = (): SessionUser | null => {
  try {
    const hash = window.location.hash || '';
    const queryIndex = hash.indexOf('?');
    if (queryIndex >= 0) {
      const params = new URLSearchParams(hash.slice(queryIndex + 1));
      const oauthReturn = decodeURIComponent(params.get('oauth_return') || '/');
      if (params.get('oauth_provider') || params.get('oauth_error')) {
        window.location.hash = oauthReturn.startsWith('/') ? `#${oauthReturn}` : '#/';
      }
    }
  } catch (error) {
    console.warn('Failed to restore OAuth session from URL:', error);
  }

  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed?.email || !parsed?.role) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    if ('token' in parsed) {
      delete parsed.token;
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
    }

    syncStoreUser(parsed);
    return parsed;
  } catch (error) {
    console.warn('Failed to restore auth session:', error);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(() => restoreInitialSession());
  const loading = false;

  useEffect(() => {
    try {
      localStorage.removeItem('the-hundred-auth-session');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user) {
      return;
    }

    let cancelled = false;
    api.getCurrentUser()
      .then((response) => {
        if (cancelled) return;
        const backendUser = (response as { user?: BackendAuthUser })?.user;
        if (!backendUser?.email || !backendUser?.role) return;
        const sessionUser = buildSessionUser(backendUser);
        persistSession(sessionUser, backendUser);
      })
      .catch(() => {
        // No active cookie session; keep guest state.
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      syncStoreUser(null);
      useStore.getState().hydrateExamResults([]);
      useStore.getState().hydrateQuestionAttempts([]);
      return;
    }

    let cancelled = false;
    let idleHandle: number | undefined;
    let timer: number | undefined;

    const hydrateNonCriticalSessionData = () => {
      Promise.all([
        api.getMyQuizResultsPage({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }),
        api.getQuestionAttempts({ page: 1, limit: 100 }),
      ])
        .then(([resultsPage, questionAttempts]) => {
          if (cancelled) {
            return;
          }

          useStore.getState().hydrateExamResults((resultsPage as { data?: unknown[] })?.data as any[] || []);
          useStore.getState().hydrateQuestionAttempts(questionAttempts as any[]);
        })
        .catch((error) => {
          console.warn('Failed to hydrate non-critical session data:', error);
        });
    };

    api.getCurrentUser()
      .then((currentUserResponse) => {
        if (cancelled) {
          return;
        }

        syncStoreUser(user, (currentUserResponse as { user?: BackendAuthUser })?.user || null);

        const requestIdle = window.requestIdleCallback?.bind(window);
        if (requestIdle) {
          idleHandle = requestIdle(hydrateNonCriticalSessionData, { timeout: 2500 });
        } else {
          timer = window.setTimeout(hydrateNonCriticalSessionData, 900);
        }
      })
      .catch((error) => {
        console.warn('Failed to hydrate session data:', error);
        if (isAuthSessionError(error)) {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setUser(null);
          resetStoreUser();
        }
      });

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) {
        window.cancelIdleCallback?.(idleHandle);
      }
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [user]);

  function persistSession(sessionUser: SessionUser, backendUser: BackendAuthUser) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
    syncStoreUser(sessionUser, backendUser);
  }

  const signInWithEmail = async (email: string, password: string) => {
    const response = (await api.login(email, password)) as {
      token: string;
      user: BackendAuthUser;
    };

    const sessionUser = buildSessionUser(response.user);
    persistSession(sessionUser, response.user);
    return sessionUser;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const inferredName = email.split('@')[0] || 'Student';
    const response = (await api.register(inferredName, email, password)) as {
      token: string;
      user: BackendAuthUser;
    };

    const sessionUser = buildSessionUser(response.user);
    persistSession(sessionUser, response.user);
    return sessionUser;
  };

  const signInWithGoogle = async () => {
    const returnTo = window.location.hash.replace(/^#/, '') || '/';
    const startUrl = `${api.baseUrl}/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.assign(startUrl);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.warn('Failed to clear server session cookie:', error);
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
    resetStoreUser();
  };

  const devSwitchRole = (role: BackendRole) => {
    if (!import.meta.env.DEV) {
      return;
    }

    const backendUser = buildDevBackendUser(role);
    const sessionUser = buildSessionUser(backendUser);
    persistSession(sessionUser, backendUser);
  };

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, logout, devSwitchRole }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
