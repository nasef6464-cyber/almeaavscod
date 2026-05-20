import { readFile } from 'node:fs/promises';

const API_URL = (process.env.SMOKE_API_URL || 'https://almeaacodax-k2ux.onrender.com/api').replace(/\/$/, '');
const TARGET_PATH_ID = process.env.SMOKE_SAHER_PATH_ID || 'p_1777779639431';
const TARGET_SUBJECT_ID = process.env.SMOKE_SAHER_SUBJECT_ID || 'sub_1777779748206';
const REQUESTED_COUNT = Number(process.env.SMOKE_SAHER_QUESTION_COUNT || 6);
const quizSource = await readFile(new URL('../pages/Quiz.tsx', import.meta.url), 'utf8');
const resultsSource = await readFile(new URL('../pages/Results.tsx', import.meta.url), 'utf8');

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

const questions = await fetchJson('/quizzes/questions');
const targetQuestions = questions.filter((question) =>
  question?.pathId === TARGET_PATH_ID &&
  question?.subject === TARGET_SUBJECT_ID &&
  Array.isArray(question.skillIds) &&
  question.skillIds.length > 0
);

const skillsByCount = new Map();
for (const question of targetQuestions) {
  for (const skillId of question.skillIds) {
    skillsByCount.set(skillId, (skillsByCount.get(skillId) || 0) + 1);
  }
}

const selectedSkillIds = [...skillsByCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 2)
  .map(([skillId]) => skillId);

const pickSelfQuizQuestions = ({ selectedSkills, questionCount }) => {
  const byId = new Map();
  const addQuestions = (pool) => {
    for (const question of pool) {
      if (byId.size >= questionCount) return;
      byId.set(String(question.id || question._id), question);
    }
  };

  const strictPool = questions.filter((question) => {
    const pathMatches = question.pathId === TARGET_PATH_ID;
    const subjectMatches = question.subject === TARGET_SUBJECT_ID;
    const skillMatches = selectedSkills.length === 0 || (question.skillIds || []).some((skillId) => selectedSkills.includes(skillId));
    const typeMatches = !question.type || question.type === 'mcq';
    return pathMatches && subjectMatches && skillMatches && typeMatches;
  });

  const contextFillPool = questions.filter((question) => {
    const pathMatches = question.pathId === TARGET_PATH_ID;
    const subjectMatches = question.subject === TARGET_SUBJECT_ID;
    const typeMatches = !question.type || question.type === 'mcq';
    return pathMatches && subjectMatches && typeMatches;
  });

  addQuestions(strictPool);
  addQuestions(contextFillPool);
  return {
    picked: [...byId.values()],
    strictCount: strictPool.length,
    contextCount: contextFillPool.length,
  };
};

await check('saher has at least two selectable skills in target subject', async () => {
  if (selectedSkillIds.length < 2) {
    throw new Error(`expected at least 2 skills, found ${selectedSkillIds.length}`);
  }
  return selectedSkillIds.join(', ');
});

await check('saher UI supports all skills, main skill groups, and multiple sub-skills', async () => {
  const requiredFragments = [
    'كل المهارات',
    'المهارات الرئيسية',
    'المهارات الفرعية',
    'toggleSectionSkills',
    'toggleTargetSkill',
    'setSkillScope(next)',
    "const [targetSkillIds, setTargetSkillIds] = useState<string[]>([])",
  ];

  const missing = requiredFragments.filter((fragment) => !quizSource.includes(fragment));
  if (missing.length > 0) {
    throw new Error(`missing multi-skill UI fragments: ${missing.join(', ')}`);
  }

  return 'all skills + section groups + sub-skill chips';
});

await check('saher extra quiz links carry multiple weak skill ids from results', async () => {
  const requiredFragments = [
    "params.set('mode', 'self')",
    "params.set('autostart', '1')",
    "params.set('skillIds', skillIds.join(','))",
    '.slice(0, 3)',
    "return `/quiz?${params.toString()}`",
  ];

  const missing = requiredFragments.filter((fragment) => !resultsSource.includes(fragment));
  if (missing.length > 0) {
    throw new Error(`missing extra quiz link fragments: ${missing.join(', ')}`);
  }

  return 'result extra quiz keeps up to three weak skills';
});

await check('saher multi-skill scope can fill a student quiz', async () => {
  const { picked, strictCount, contextCount } = pickSelfQuizQuestions({
    selectedSkills: selectedSkillIds,
    questionCount: REQUESTED_COUNT,
  });

  if (strictCount < 2) throw new Error(`multi-skill strict pool too small: ${strictCount}`);
  if (picked.length < Math.min(REQUESTED_COUNT, contextCount)) {
    throw new Error(`picked ${picked.length} questions from ${contextCount} available`);
  }

  const unrelated = picked.filter((question) => question.pathId !== TARGET_PATH_ID || question.subject !== TARGET_SUBJECT_ID);
  if (unrelated.length) {
    throw new Error(`picked unrelated questions: ${unrelated.map((question) => question.id || question._id).join(', ')}`);
  }

  return `${picked.length} questions, selected skills=${selectedSkillIds.length}, strict=${strictCount}`;
});

for (const item of checks) {
  console.log(`${item.status} ${item.name} - ${item.details}`);
}

const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length > 0) {
  console.error(`\n${failed.length} saher skill scope smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} saher skill scope smoke checks passed.`);
