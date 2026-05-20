import { Quiz } from '../types';

type QuizPlacementSource = Pick<Quiz, 'type' | 'placement' | 'showInTraining' | 'showInMock'>;

export const getQuizPlacementDefaults = (type: Quiz['type'] = 'quiz') => {
  const isTraining = type === 'bank';

  return {
    type,
    placement: isTraining ? 'training' : 'mock',
    showInTraining: isTraining,
    showInMock: !isTraining,
  } satisfies Pick<Quiz, 'type' | 'placement' | 'showInTraining' | 'showInMock'>;
};

export const isTrainingQuiz = (quiz: QuizPlacementSource) => {
  if (typeof quiz.showInTraining === 'boolean') return quiz.showInTraining;
  if (quiz.placement) return quiz.placement === 'training' || quiz.placement === 'both';
  return quiz.type === 'bank';
};

export const isMockQuiz = (quiz: QuizPlacementSource) => {
  if (typeof quiz.showInMock === 'boolean') return quiz.showInMock;
  if (quiz.placement) return quiz.placement === 'mock' || quiz.placement === 'both';
  return (quiz.type || 'quiz') === 'quiz';
};

export const getQuizPlacementLabel = (quiz: QuizPlacementSource) => {
  const training = isTrainingQuiz(quiz);
  const mock = isMockQuiz(quiz);

  if (training && mock) return 'تدريب واختبار';
  if (training) return 'تدريب';
  if (mock) return 'اختبار';
  return 'مخزن فقط';
};

export const getPlacementFromFlags = (quiz: QuizPlacementSource): Quiz['placement'] => {
  const training = isTrainingQuiz(quiz);
  const mock = isMockQuiz(quiz);

  if (training && mock) return 'both';
  if (training) return 'training';
  return 'mock';
};

export const normalizeQuizPlacement = <T extends Partial<Quiz>>(quiz: T, fallbackType: Quiz['type'] = 'quiz'): T => {
  const inferredType = quiz.type || fallbackType;
  const showInTraining =
    typeof quiz.showInTraining === 'boolean'
      ? quiz.showInTraining
      : quiz.placement
        ? quiz.placement === 'training' || quiz.placement === 'both'
        : inferredType === 'bank';
  const showInMock =
    typeof quiz.showInMock === 'boolean'
      ? quiz.showInMock
      : quiz.placement
        ? quiz.placement === 'mock' || quiz.placement === 'both'
        : inferredType !== 'bank';
  const placement = showInTraining && showInMock ? 'both' : showInTraining ? 'training' : 'mock';

  return {
    ...quiz,
    type: showInTraining && !showInMock ? 'bank' : 'quiz',
    placement,
    showInTraining,
    showInMock,
  };
};
