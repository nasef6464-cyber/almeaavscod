import { Quiz, QuizSettings } from '../types';

type QuizSettingsOptions = {
  type?: Quiz['type'];
  mode?: Quiz['mode'];
  learningSlot?: 'training' | 'tests' | 'foundation' | 'course' | null;
  mockExam?: boolean;
};

export const getDefaultQuizSettings = ({
  type = 'quiz',
  mode = 'regular',
  learningSlot = null,
  mockExam = false,
}: QuizSettingsOptions = {}): QuizSettings => {
  const isShortTraining = type === 'bank' && learningSlot !== 'tests';
  const isDirectedOrMock = mode === 'central' || mockExam;

  return {
    showExplanations: true,
    showAnswers: true,
    showResultsReport: !isShortTraining,
    returnToSourceOnFinish: isShortTraining,
    maxAttempts: 3,
    passingScore: isDirectedOrMock ? 60 : 60,
    timeLimit: mockExam ? 60 : type === 'bank' ? 30 : 60,
    randomizeQuestions: !mockExam,
    showProgressBar: true,
    requireAnswerBeforeNext: type === 'bank' && !mockExam,
    allowQuestionReview: true,
    optionLayout: isDirectedOrMock ? 'horizontal' : 'auto',
  };
};
