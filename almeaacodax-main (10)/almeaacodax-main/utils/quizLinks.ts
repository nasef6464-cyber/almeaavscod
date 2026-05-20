export type QuizJourneySource = 'foundation' | 'training' | 'tests' | 'mock-exam' | 'course' | 'self' | string;

type QuizRouteContext = {
  returnTo?: string;
  source?: QuizJourneySource;
  returnOnFinish?: boolean;
};

export const isSafeInternalRoute = (target?: string) => {
  if (!target) return false;
  return target.startsWith('/') && !target.startsWith('//');
};

export const buildQuizRouteWithContext = (quizId: string, context: QuizRouteContext = {}) => {
  const params = new URLSearchParams();

  if (isSafeInternalRoute(context.returnTo)) {
    params.set('returnTo', context.returnTo as string);
  }

  if (context.source) {
    params.set('source', context.source);
  }

  if (context.returnOnFinish) {
    params.set('returnOnFinish', '1');
  }

  const query = params.toString();
  return `/quiz/${quizId}${query ? `?${query}` : ''}`;
};
