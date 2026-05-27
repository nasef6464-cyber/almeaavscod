import { readFileSync } from "node:fs";

const files = {
  types: "types.ts",
  lessonModel: "server/src/models/Lesson.ts",
  contentRoutes: "server/src/routes/content.routes.ts",
  lessonBuilder: "dashboards/admin/builders/UnifiedLessonBuilder.tsx",
  videoPlayer: "components/CustomVideoPlayer.tsx",
  videoModal: "components/VideoModal.tsx",
  subjectPage: "pages/SubjectLearningPage.tsx",
  coursePlayer: "components/CoursePlayer.tsx",
};

const read = (path) => readFileSync(path, "utf8");
const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]));

const checks = [
  [
    "lesson contract keeps timed interactive questions",
    source.types.includes("interactiveQuestions?: InteractiveQuestion[]") &&
      source.lessonModel.includes("interactiveQuestions") &&
      source.contentRoutes.includes("interactiveQuestions"),
  ],
  [
    "lesson builder can author timed video questions",
    source.lessonBuilder.includes("أسئلة داخل الفيديو") &&
      source.lessonBuilder.includes("اختيار من مركز الأسئلة") &&
      source.lessonBuilder.includes("saveVideoQuestionToBank") &&
      source.lessonBuilder.includes("timestamp") &&
      source.lessonBuilder.includes("correctOptionIndex"),
  ],
  [
    "video modal and foundation player pass lesson questions",
    source.videoModal.includes("interactiveQuestions={interactiveQuestions}") &&
      source.subjectPage.includes("interactiveQuestions={videoData.interactiveQuestions"),
  ],
  [
    "lesson builder pulls from the full question center with relevant questions first",
    source.lessonBuilder.includes("relevantVideoQuestions") &&
      source.lessonBuilder.includes("otherVideoQuestions") &&
      source.lessonBuilder.includes("availableVideoQuestions") &&
      source.lessonBuilder.includes("filteredRelevantVideoQuestions") &&
      source.lessonBuilder.includes("filteredOtherVideoQuestions") &&
      source.lessonBuilder.includes("placeholder=\"ابحث بالمادة أو المهارة أو نص السؤال...\"") &&
      source.lessonBuilder.includes("questionId: firstBankQuestion?.id") &&
      source.lessonBuilder.includes("disabled={questions.length === 0}"),
  ],
  [
    "lesson builder previews bank questions with taxonomy before linking",
    source.lessonBuilder.includes("cleanQuestionText") &&
      source.lessonBuilder.includes("questionMatchesVideoSearch") &&
      source.lessonBuilder.includes("renderBankQuestionPreview") &&
      source.lessonBuilder.includes("معاينة السؤال المرتبط الآن") &&
      source.lessonBuilder.includes("استعرض السؤال قبل السحب"),
  ],
  [
    "course player uses the same lesson video questions",
    source.coursePlayer.includes("interactiveQuestions={activeLesson.interactiveQuestions || []}"),
  ],
  [
    "custom player pauses for due video questions",
    source.videoPlayer.includes("VideoQuestionOverlay") &&
      source.videoPlayer.includes("getDueVideoQuestion") &&
      source.videoPlayer.includes("questionBank") &&
      source.videoPlayer.includes("setActiveQuestion(dueQuestion)"),
  ],
  [
    "video question overlay renders clean bank question content",
    source.videoPlayer.includes("normalizeQuestionHtml") &&
      source.videoPlayer.includes("bankQuestion?.imageUrl") &&
      source.videoPlayer.includes("dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(inlineQuestion.text) }}") &&
      source.videoPlayer.includes("dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(option) }}"),
  ],
];

let failed = false;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
  if (!passed) failed = true;
}

if (failed) process.exit(1);
console.log(`\nAll ${checks.length} video question contract smoke checks passed.`);
