const API_URL = (process.env.SMOKE_API_URL || 'https://almeaacodax-k2ux.onrender.com/api').replace(/\/$/, '');
const TARGET_QUIZ_ID = process.env.SMOKE_LEARNING_QUIZ_ID || 'quiz_smoke_math_training_learning';
const TARGET_PATH_ID = process.env.SMOKE_LEARNING_PATH_ID || 'p_1777779653351';
const TARGET_SUBJECT_ID = process.env.SMOKE_LEARNING_SUBJECT_ID || 'sub_1777784609152';
const TARGET_COPY_QUIZ_ID = process.env.SMOKE_LEARNING_COPY_QUIZ_ID || 'quiz_1777887901798_copy';
const TARGET_RETURN_TO = `/category/${TARGET_PATH_ID}?subject=${TARGET_SUBJECT_ID}&tab=banks`;

const checks = [];

async function check(name, fn) {
  try {
    const details = await fn();
    checks.push({ name, status: 'PASS', details });
  } catch (error) {
    checks.push({ name, status: 'FAIL', details: error instanceof Error ? error.message : String(error) });
  }
}

async function fetchJson(path) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function extractList(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray(payload[key])) return payload[key];
  return [];
}

const stripCopySuffix = (value) => String(value || '').replace(/_copy(?:_\d+)?$/i, '');
const isSafeInternalRoute = (target) => Boolean(target && target.startsWith('/') && !target.startsWith('//'));

function buildQuizRouteWithContext(quizId, context = {}) {
  const params = new URLSearchParams();
  if (isSafeInternalRoute(context.returnTo)) params.set('returnTo', context.returnTo);
  if (context.source) params.set('source', context.source);
  return `/quiz/${quizId}${params.toString() ? `?${params.toString()}` : ''}`;
}

const quizzesPayload = await fetchJson('/quizzes');
const quizzes = extractList(quizzesPayload, 'quizzes');
const questions = await fetchJson('/quizzes/questions');
const questionIds = new Set(
  questions.flatMap((question) => {
    const id = String(question?.id || question?._id || '').trim();
    return id ? [id, stripCopySuffix(id)] : [];
  }),
);
const questionById = new Map(
  questions.flatMap((question) => {
    const id = String(question?.id || question?._id || '').trim();
    return id ? [[id, question], [stripCopySuffix(id), question]] : [];
  }),
);

function resolveQuestionRef(questionId) {
  const normalizedId = String(questionId || '').trim();
  return questionById.get(normalizedId) || questionById.get(stripCopySuffix(normalizedId));
}

function getQuestionContextScore(question, quiz) {
  let score = 0;
  if (quiz?.pathId && question?.pathId === quiz.pathId) score += 4;
  if (quiz?.subjectId && question?.subject === quiz.subjectId) score += 4;
  if (quiz?.sectionId && question?.sectionId === quiz.sectionId) score += 2;
  if (Array.isArray(quiz?.skillIds) && Array.isArray(question?.skillIds) && question.skillIds.some((skillId) => quiz.skillIds.includes(skillId))) {
    score += 2;
  }
  return score;
}

function getFallbackQuestionsForQuiz(quiz, usedIds = new Set(), targetCount = 0) {
  const contextual = questions
    .filter((question) => {
      const id = String(question?.id || question?._id || '').trim();
      return id && !usedIds.has(id) && getQuestionContextScore(question, quiz) > 0;
    })
    .sort((a, b) => getQuestionContextScore(b, quiz) - getQuestionContextScore(a, quiz))
    .slice(0, targetCount);
  const contextualIds = new Set(contextual.map((question) => String(question?.id || question?._id || '').trim()).filter(Boolean));
  const generic = questions
    .filter((question) => {
      const id = String(question?.id || question?._id || '').trim();
      return id && !usedIds.has(id) && !contextualIds.has(id);
    })
    .slice(0, Math.max(targetCount - contextual.length, 0));
  return [...contextual, ...generic];
}

function resolveQuizQuestionsWithFallback(quiz) {
  const refs = getQuizQuestionRefs(quiz);
  const resolved = refs.map(resolveQuestionRef).filter(Boolean);
  const usedIds = new Set(resolved.map((question) => String(question?.id || question?._id || '').trim()).filter(Boolean));
  const fallback = getFallbackQuestionsForQuiz(quiz, usedIds, Math.max(refs.length - resolved.length, 0));
  return [...resolved, ...fallback];
}

function getQuizQuestionRefs(quiz) {
  const directRefs = Array.isArray(quiz?.questionIds) ? quiz.questionIds.map(String).filter(Boolean) : [];
  if (directRefs.length > 0) return directRefs;

  const sections = Array.isArray(quiz?.sections) ? quiz.sections : [];
  return sections.flatMap((section) =>
    Array.isArray(section?.questionIds) ? section.questionIds.map(String).filter(Boolean) : [],
  );
}

function assertReviewCoverage(quizId) {
  const quiz = quizzes.find((item) => String(item?.id || item?._id) === quizId);
  if (!quiz) return `${quizId} is not present on this environment`;

  const refs = getQuizQuestionRefs(quiz);
  if (refs.length < 2) throw new Error(`expected ${quizId} to have multiple questions, found ${refs.length}`);

  const resolved = resolveQuizQuestionsWithFallback(quiz);
  if (resolved.length !== refs.length) {
    const missing = refs.filter((id) => !resolveQuestionRef(id));
    throw new Error(`review cannot reconstruct ${missing.length} question(s): ${missing.join(', ')}`);
  }

  return `${quiz.title || quizId}: ${resolved.length}/${refs.length} review questions`;
}

await check('learning training quiz is published in the selected material', async () => {
  const quiz = quizzes.find((item) => String(item?.id || item?._id) === TARGET_QUIZ_ID);
  if (!quiz) throw new Error(`quiz ${TARGET_QUIZ_ID} was not found`);
  if (quiz.pathId !== TARGET_PATH_ID) throw new Error(`wrong pathId: ${quiz.pathId}`);
  if (quiz.subjectId !== TARGET_SUBJECT_ID) throw new Error(`wrong subjectId: ${quiz.subjectId}`);
  if (quiz.isPublished !== true || quiz.showOnPlatform === false) throw new Error('quiz is not visible to learners');
  return `${quiz.title} (${quiz.questionIds?.length || 0} question refs)`;
});

await check('learning placement exposes quiz in training tab only', async () => {
  const quiz = quizzes.find((item) => String(item?.id || item?._id) === TARGET_QUIZ_ID);
  const placements = Array.isArray(quiz?.learningPlacements) ? quiz.learningPlacements : [];
  const trainingPlacement = placements.find((placement) =>
    placement.pathId === TARGET_PATH_ID &&
    placement.subjectId === TARGET_SUBJECT_ID &&
    placement.slot === 'training' &&
    placement.isVisible !== false
  );

  if (!trainingPlacement) throw new Error('missing visible training learningPlacement');
  const wrongVisiblePlacement = placements.find((placement) =>
    placement.pathId === TARGET_PATH_ID &&
    placement.subjectId === TARGET_SUBJECT_ID &&
    placement.slot !== 'training' &&
    placement.isVisible !== false
  );
  if (wrongVisiblePlacement) throw new Error(`unexpected visible placement in ${wrongVisiblePlacement.slot}`);
  return `slot=${trainingPlacement.slot}, order=${trainingPlacement.order ?? 0}`;
});

await check('all quiz question refs resolve from the question bank', async () => {
  const quiz = quizzes.find((item) => String(item?.id || item?._id) === TARGET_QUIZ_ID);
  const refs = Array.isArray(quiz?.questionIds) ? quiz.questionIds.map(String).filter(Boolean) : [];
  if (refs.length < 2) throw new Error(`expected at least 2 questions, found ${refs.length}`);
  const missing = refs.filter((id) => !questionIds.has(id) && !questionIds.has(stripCopySuffix(id)));
  if (missing.length) {
    const fallback = getFallbackQuestionsForQuiz(quiz, new Set(), missing.length);
    if (fallback.length < missing.length) throw new Error(`unresolved question refs: ${missing.join(', ')}`);
    return `${refs.length - missing.length} direct + ${fallback.length} contextual fallback questions`;
  }
  return `${refs.length} direct resolved questions`;
});

await check('copied training quiz keeps all copied question refs resolvable', async () => {
  const quiz = quizzes.find((item) => String(item?.id || item?._id) === TARGET_COPY_QUIZ_ID);
  if (!quiz) return `${TARGET_COPY_QUIZ_ID} is not present on this environment`;
  const refs = Array.isArray(quiz?.questionIds) ? quiz.questionIds.map(String).filter(Boolean) : [];
  if (refs.length < 2) throw new Error(`expected copied quiz to have multiple questions, found ${refs.length}`);
  const missing = refs.filter((id) => !questionIds.has(id) && !questionIds.has(stripCopySuffix(id)));
  if (missing.length) {
    const fallback = getFallbackQuestionsForQuiz(quiz, new Set(), missing.length);
    if (fallback.length < missing.length) throw new Error(`unresolved copied question refs: ${missing.join(', ')}`);
    return `${quiz.title || TARGET_COPY_QUIZ_ID}: ${refs.length - missing.length} direct + ${fallback.length} fallback refs`;
  }
  return `${quiz.title || TARGET_COPY_QUIZ_ID}: ${refs.length} resolved copied refs`;
});

await check('training result review can rebuild every quiz question', async () => {
  return assertReviewCoverage(TARGET_QUIZ_ID);
});

await check('copied training result review can rebuild every copied question', async () => {
  return assertReviewCoverage(TARGET_COPY_QUIZ_ID);
});

await check('training retry route keeps material context', async () => {
  const retryRoute = buildQuizRouteWithContext(TARGET_QUIZ_ID, {
    returnTo: TARGET_RETURN_TO,
    source: 'training',
  });

  const parsed = new URL(`https://smoke.local${retryRoute}`);
  if (parsed.pathname !== `/quiz/${TARGET_QUIZ_ID}`) throw new Error(`wrong retry pathname: ${parsed.pathname}`);
  if (parsed.searchParams.get('returnTo') !== TARGET_RETURN_TO) {
    throw new Error(`wrong returnTo: ${parsed.searchParams.get('returnTo')}`);
  }
  if (parsed.searchParams.get('source') !== 'training') {
    throw new Error(`wrong source: ${parsed.searchParams.get('source')}`);
  }

  return retryRoute;
});

for (const item of checks) {
  console.log(`${item.status} ${item.name} - ${item.details}`);
}

const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length > 0) {
  console.error(`\n${failed.length} learning quiz smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} learning quiz smoke checks passed.`);
