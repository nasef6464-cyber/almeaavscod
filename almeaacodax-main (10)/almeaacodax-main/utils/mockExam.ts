import { Quiz } from '../types';

export const isPathMockExam = (quiz: Quiz, pathId?: string) => {
  const enabled = quiz.mockExam?.enabled === true;
  const pathMatches = !pathId || quiz.mockExam?.pathId === pathId || quiz.pathId === pathId;
  return enabled && pathMatches;
};

export const isStandaloneMockExam = (quiz: Quiz) => quiz.mockExam?.enabled === true;

export const isMaterialQuizCandidate = (quiz: Quiz) => !isStandaloneMockExam(quiz);

export const getMockExamSections = (quiz: Quiz) =>
  [...(quiz.mockExam?.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export const flattenMockExamQuestionIds = (quiz: Quiz) => {
  const ids = getMockExamSections(quiz).flatMap((section) => section.questionIds || []);
  return Array.from(new Set(ids.length ? ids : quiz.questionIds || []));
};

export const getMockExamQuestionCount = (quiz: Quiz) => flattenMockExamQuestionIds(quiz).length;

export const getMockExamTimeLimit = (quiz: Quiz) => {
  const sectionTotal = getMockExamSections(quiz).reduce((sum, section) => sum + (Number(section.timeLimit) || 0), 0);
  return sectionTotal || quiz.settings?.timeLimit || 60;
};
