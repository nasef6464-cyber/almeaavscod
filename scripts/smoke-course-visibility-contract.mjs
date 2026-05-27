import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const courseRoutes = fs.readFileSync(path.join(root, "server/src/routes/course.routes.ts"), "utf8");
const contentRoutes = fs.readFileSync(path.join(root, "server/src/routes/content.routes.ts"), "utf8");
const subjectLearningPage = fs.readFileSync(path.join(root, "pages/SubjectLearningPage.tsx"), "utf8");

const checks = [];
const check = (name, fn) => checks.push({ name, fn });
const assertIncludes = (source, snippet, label = snippet) => {
  if (!source.includes(snippet)) {
    throw new Error(`Missing snippet: ${label}`);
  }
};

check("learner course API filter enforces publish/visibility/approval", () => {
  assertIncludes(courseRoutes, "isPublished: true", "course publish gate");
  assertIncludes(courseRoutes, "showOnPlatform: { $ne: false }", "course platform visibility gate");
  assertIncludes(courseRoutes, "approvalStatus: \"approved\"", "course approval gate");
});

check("bootstrap learner filters gate lesson and library visibility", () => {
  assertIncludes(contentRoutes, "const lessonFilter =", "lesson filter block");
  assertIncludes(contentRoutes, "const libraryFilter =", "library filter block");
  assertIncludes(contentRoutes, "showOnPlatform: { $ne: false }", "showOnPlatform gate");
  assertIncludes(contentRoutes, "approvalStatus: \"approved\"", "approval gate");
});

check("subject learning page uses the same learner visibility contract", () => {
  assertIncludes(subjectLearningPage, "const canSeeCourse", "course visibility helper");
  assertIncludes(subjectLearningPage, "course.showOnPlatform !== false", "course show gate");
  assertIncludes(subjectLearningPage, "course.isPublished !== false", "course publish gate");
  assertIncludes(subjectLearningPage, "course.approvalStatus === 'approved'", "course approval gate");

  assertIncludes(subjectLearningPage, "const canSeeQuiz", "quiz visibility helper");
  assertIncludes(subjectLearningPage, "quiz.showOnPlatform !== false", "quiz show gate");
  assertIncludes(subjectLearningPage, "quiz.isPublished !== false", "quiz publish gate");
  assertIncludes(subjectLearningPage, "quiz.approvalStatus === 'approved'", "quiz approval gate");

  assertIncludes(subjectLearningPage, "const canSeeLesson", "lesson visibility helper");
  assertIncludes(subjectLearningPage, "lesson.showOnPlatform !== false", "lesson show gate");
  assertIncludes(subjectLearningPage, "lesson.approvalStatus === 'approved'", "lesson approval gate");

  assertIncludes(subjectLearningPage, "const canSeeLibraryItem", "library visibility helper");
  assertIncludes(subjectLearningPage, "item.showOnPlatform !== false", "library show gate");
  assertIncludes(subjectLearningPage, "item.approvalStatus === 'approved'", "library approval gate");
});

let failed = 0;
for (const item of checks) {
  try {
    item.fn();
    console.log(`PASS ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${item.name}`);
    console.error(error.message);
  }
}

if (failed > 0) {
  console.error(`\\n${failed}/${checks.length} course visibility checks failed.`);
  process.exit(1);
}

console.log(`\\nAll ${checks.length} course visibility checks passed.`);
