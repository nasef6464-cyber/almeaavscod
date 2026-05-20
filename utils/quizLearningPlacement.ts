import { Quiz, QuizLearningPlacement } from '../types';

export type LearningPlacementSlot = QuizLearningPlacement['slot'];
export type LearningPlacementAccessType = NonNullable<QuizLearningPlacement['accessType']>;

type Scope = {
  pathId?: string;
  subjectId?: string;
  slot: LearningPlacementSlot;
};

const sameScope = (placement: QuizLearningPlacement, scope: Scope) => {
  const pathMatches = !scope.pathId || placement.pathId === scope.pathId;
  const subjectMatches = scope.subjectId
    ? placement.subjectId === scope.subjectId
    : !placement.subjectId;
  return pathMatches && subjectMatches;
};

const getPlacements = (quiz: Quiz) => (Array.isArray(quiz.learningPlacements) ? quiz.learningPlacements : []);

export const hasAnyLearningPlacementInScope = (quiz: Quiz, scope: Omit<Scope, 'slot'>) =>
  getPlacements(quiz).some((placement) => sameScope(placement, { ...scope, slot: placement.slot }));

export const getQuizLearningPlacement = (quiz: Quiz, scope: Scope) =>
  getPlacements(quiz).find((placement) => placement.slot === scope.slot && sameScope(placement, scope));

export const isQuizVisibleInLearningSlot = (quiz: Quiz, scope: Scope) => {
  const placement = getQuizLearningPlacement(quiz, scope);
  return placement ? placement.isVisible !== false : false;
};

export const getQuizLearningPlacementAccessType = (quiz: Quiz, scope: Scope): LearningPlacementAccessType =>
  getQuizLearningPlacement(quiz, scope)?.accessType || 'inherit';

export const resolveQuizLearningAccessType = (quiz: Quiz, scope?: Scope) => {
  if (scope) {
    const placementAccessType = getQuizLearningPlacementAccessType(quiz, scope);
    if (placementAccessType !== 'inherit') return placementAccessType;
  }

  return quiz.access?.type || 'free';
};

export const setQuizLearningSlotVisibility = (quiz: Quiz, scope: Scope, isVisible: boolean) => {
  const now = Date.now();
  const placements = getPlacements(quiz);
  const previous = getQuizLearningPlacement(quiz, scope);
  const nextPlacement: QuizLearningPlacement = {
    pathId: scope.pathId || quiz.pathId,
    subjectId: scope.subjectId || quiz.subjectId,
    slot: scope.slot,
    accessType: previous?.accessType || 'inherit',
    isVisible,
    order: previous?.order ?? placements.length,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  return [
    ...placements.filter((placement) => !(placement.slot === scope.slot && sameScope(placement, scope))),
    nextPlacement,
  ];
};

export const setQuizLearningSlotAccess = (quiz: Quiz, scope: Scope, accessType: LearningPlacementAccessType) => {
  const now = Date.now();
  const placements = getPlacements(quiz);
  const previous = getQuizLearningPlacement(quiz, scope);
  const nextPlacement: QuizLearningPlacement = {
    pathId: scope.pathId || quiz.pathId,
    subjectId: scope.subjectId || quiz.subjectId,
    slot: scope.slot,
    accessType,
    isVisible: previous?.isVisible ?? true,
    order: previous?.order ?? placements.length,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  return [
    ...placements.filter((placement) => !(placement.slot === scope.slot && sameScope(placement, scope))),
    nextPlacement,
  ];
};

export const getLearningSlotQuizzes = (
  quizzes: Quiz[],
  scope: Scope,
  canSeeQuiz: (quiz: Quiz) => boolean,
  legacyFallback: (quiz: Quiz) => boolean,
  requireExplicitPlacement = false,
) => {
  const scopedQuizzes = quizzes.filter((quiz) => {
    const pathMatches = !scope.pathId || quiz.pathId === scope.pathId;
    const subjectMatches = scope.subjectId ? quiz.subjectId === scope.subjectId : !quiz.subjectId;
    return pathMatches && subjectMatches && canSeeQuiz(quiz);
  });

  const hasExplicitPlacement = scopedQuizzes.some((quiz) =>
    hasAnyLearningPlacementInScope(quiz, { pathId: scope.pathId, subjectId: scope.subjectId }),
  );

  const visibleQuizzes = hasExplicitPlacement || requireExplicitPlacement
    ? scopedQuizzes.filter((quiz) => isQuizVisibleInLearningSlot(quiz, scope))
    : scopedQuizzes.filter(legacyFallback);

  return [...visibleQuizzes].sort((a, b) => {
    const aPlacement = getQuizLearningPlacement(a, scope);
    const bPlacement = getQuizLearningPlacement(b, scope);
    return (aPlacement?.order ?? 9999) - (bPlacement?.order ?? 9999) || (b.createdAt || 0) - (a.createdAt || 0);
  });
};

export const getLearningSlotQuizzesWithLegacyFallback = (
  quizzes: Quiz[],
  scope: Scope,
  canSeeQuiz: (quiz: Quiz) => boolean,
  legacyFallback: (quiz: Quiz) => boolean,
) => getLearningSlotQuizzes(quizzes, scope, canSeeQuiz, legacyFallback, false);
