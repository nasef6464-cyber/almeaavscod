import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const files = {
  sanitizer: await read("utils/questionHtml.ts"),
  skillsTree: await read("dashboards/admin/SkillsTreeManager.tsx"),
  questionBank: await read("dashboards/admin/QuestionBankManager.tsx"),
  quizBuilder: await read("dashboards/admin/QuizBuilder.tsx"),
  quizPage: await read("pages/QuizPage.tsx"),
  quiz: await read("pages/Quiz.tsx"),
  results: await read("pages/Results.tsx"),
  favorites: await read("pages/Favorites.tsx"),
  videoPlayer: await read("components/CustomVideoPlayer.tsx"),
};

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", details: error instanceof Error ? error.message : String(error) });
  }
}

function assertIncludes(source, fragment, message) {
  if (!source.includes(fragment)) {
    throw new Error(message || `Missing fragment: ${fragment}`);
  }
}

function assertNotIncludes(source, fragment, message) {
  if (source.includes(fragment)) {
    throw new Error(message || `Unexpected fragment: ${fragment}`);
  }
}

check("question HTML sanitizer removes active script surfaces", () => {
  assertIncludes(files.sanitizer, "script|style|object|embed|link|meta|base");
  assertIncludes(files.sanitizer, "srcdoc");
  assertIncludes(files.sanitizer, "on[a-z]+");
  assertIncludes(files.sanitizer, "javascript:");
  assertIncludes(files.sanitizer, "data:text");
  assertIncludes(files.sanitizer, "vbscript:");
  assertIncludes(files.sanitizer, "expression");
});

check("admin question previews use normalized HTML", () => {
  assertIncludes(files.skillsTree, "normalizeQuestionHtml(question.text)");
  assertIncludes(files.questionBank, "normalizeQuestionHtml(question.text)");
  assertIncludes(files.questionBank, "normalizeQuestionHtml(previewQuestion.text)");
  assertIncludes(files.quizBuilder, "normalizeQuestionHtml(q.text)");
  assertNotIncludes(files.skillsTree, "__html: question.text");
  assertNotIncludes(files.questionBank, "__html: question.text");
  assertNotIncludes(files.questionBank, "__html: previewQuestion.text");
  assertNotIncludes(files.quizBuilder, "__html: q.text");
});

check("learner question rendering keeps normalized HTML contract", () => {
  for (const [name, source] of Object.entries({
    quizPage: files.quizPage,
    quiz: files.quiz,
    results: files.results,
    favorites: files.favorites,
    videoPlayer: files.videoPlayer,
  })) {
    if (source.includes("dangerouslySetInnerHTML") && !source.includes("normalizeQuestionHtml")) {
      throw new Error(`${name} renders question HTML without normalizeQuestionHtml`);
    }
  }
});

const failed = checks.filter((item) => item.status === "FAIL");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
