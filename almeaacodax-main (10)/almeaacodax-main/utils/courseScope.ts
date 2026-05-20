import { Course, CategorySubject } from '../types';

export const resolveCourseSubjectId = (course: Course, subjects: CategorySubject[]) => {
  const directSubjectId = String(course.subjectId || '').trim();
  if (directSubjectId) return directSubjectId;
  const legacySubjectRef = String(course.subject || '').trim();
  if (!legacySubjectRef) return '';
  const matchedById = subjects.find((item) => item.id === legacySubjectRef);
  if (matchedById) return matchedById.id;
  const matchedByName = subjects.find((item) => String(item.name || '').trim() === legacySubjectRef);
  return matchedByName?.id || '';
};

export const resolveCoursePathId = (course: Course, subjects: CategorySubject[]) => {
  const directPathId = String(course.pathId || '').trim();
  if (directPathId) return directPathId;
  const resolvedSubjectId = resolveCourseSubjectId(course, subjects);
  if (resolvedSubjectId) {
    const matchedSubject = subjects.find((item) => item.id === resolvedSubjectId);
    if (matchedSubject?.pathId) return String(matchedSubject.pathId);
  }
  return String(course.category || '').trim();
};
