import { readFile } from 'node:fs/promises';

const libraryManagerSource = await readFile(new URL('../dashboards/admin/LibraryManager.tsx', import.meta.url), 'utf8');
const foundationManagerSource = await readFile(new URL('../dashboards/admin/FoundationManager.tsx', import.meta.url), 'utf8');
const learningSectionSource = await readFile(new URL('../components/LearningSection.tsx', import.meta.url), 'utf8');
const skillModalSource = await readFile(new URL('../components/SkillDetailsModal.tsx', import.meta.url), 'utf8');
const subjectLearningSource = await readFile(new URL('../pages/SubjectLearningPage.tsx', import.meta.url), 'utf8');
const typeSource = await readFile(new URL('../types.ts', import.meta.url), 'utf8');
const adapterSource = await readFile(new URL('../services/adapter.ts', import.meta.url), 'utf8');
const storeSource = await readFile(new URL('../store/useStore.ts', import.meta.url), 'utf8');
const serverTopicModelSource = await readFile(new URL('../server/src/models/Topic.ts', import.meta.url), 'utf8');
const serverContentRoutesSource = await readFile(new URL('../server/src/routes/content.routes.ts', import.meta.url), 'utf8');

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: 'PASS' });
  } catch (error) {
    checks.push({ name, status: 'FAIL', details: error instanceof Error ? error.message : String(error) });
  }
}

function assertIncludes(source, fragment, message) {
  if (!source.includes(fragment)) {
    throw new Error(message || `Missing fragment: ${fragment}`);
  }
}

function assertPattern(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message || `Missing pattern: ${pattern}`);
  }
}

check('admin library item saves path, subject, main skill, sub-skills, and url', () => {
  assertIncludes(libraryManagerSource, 'pathId: currentSubject.pathId');
  assertIncludes(libraryManagerSource, 'subjectId');
  assertIncludes(libraryManagerSource, 'sectionId: editingItem.sectionId');
  assertIncludes(libraryManagerSource, 'skillIds: editingItem.skillIds || []');
  assertIncludes(libraryManagerSource, "url: editingItem?.url || ''");
});

check('admin library readiness requires visible approved skill-linked file', () => {
  assertIncludes(libraryManagerSource, 'getLibraryReadinessMeta');
  assertIncludes(libraryManagerSource, 'item.approvalStatus === \'approved\'');
  assertIncludes(libraryManagerSource, 'Boolean(item.url?.trim())');
  assertIncludes(libraryManagerSource, 'Boolean(item.sectionId)');
  assertIncludes(libraryManagerSource, 'Boolean((item.skillIds || []).length)');
});

check('student library only shows approved platform-visible files in the selected material', () => {
  assertIncludes(learningSectionSource, 'canStudentSeeLibraryItem');
  assertIncludes(learningSectionSource, 'item.showOnPlatform !== false');
  assertIncludes(learningSectionSource, "item.approvalStatus === 'approved'");
  assertIncludes(learningSectionSource, 'matchesScopedContent(item.pathId, item.subjectId)');
  assertPattern(
    learningSectionSource,
    /sectionLibraryItems = sectionLibraryItems\.filter\(\(item\) => \{/,
    'library items must be scoped again before rendering',
  );
});

check('learning support file details stay behind admin debug for learners', () => {
  assertIncludes(learningSectionSource, "const showPublicAdminDiagnostics = isAdminViewer && searchParams.get('adminDebug') === '1'");
  assertIncludes(learningSectionSource, 'showPublicAdminDiagnostics ? (');
  assertIncludes(learningSectionSource, 'lockedLibraryMessage');
});

check('foundation topic modal has support as a third action, not a noisy summary card', () => {
  assertIncludes(skillModalSource, "useState<'lessons' | 'quizzes' | 'support'>('lessons')");
  assertIncludes(skillModalSource, "setTopicModalTab('support')");
  assertIncludes(skillModalSource, "topicModalTab === 'support'");
  assertIncludes(skillModalSource, 'relatedLibrarySuggestions');
});

check('foundation admin links support files directly to topics like lessons and training', () => {
  assertIncludes(typeSource, 'libraryItemIds?: string[]');
  assertIncludes(foundationManagerSource, "useState<'lesson' | 'quiz' | 'support'>('lesson')");
  assertIncludes(foundationManagerSource, 'availableLibraryItems');
  assertIncludes(foundationManagerSource, "setAttachType('support')");
  assertIncludes(foundationManagerSource, 'libraryItemIds: [...currentLibraryItemIds, itemId]');
  assertIncludes(foundationManagerSource, "handleRemoveAttachment(topic.id, item.id, 'support')");
});

check('foundation support links persist through server, adapter, and store reload', () => {
  assertIncludes(serverTopicModelSource, 'libraryItemIds: { type: [String], default: [] }');
  assertIncludes(serverContentRoutesSource, 'libraryItemIds: z.array(z.string()).default([])');
  assertIncludes(serverContentRoutesSource, 'const topicUpdateSchema = z.object({');
  assertIncludes(serverContentRoutesSource, 'libraryItemIds: z.array(z.string()).optional()');
  assertIncludes(serverContentRoutesSource, 'const payload = topicUpdateSchema.parse(req.body)');
  assertIncludes(adapterSource, 'libraryItemIds: Array.isArray(topic?.libraryItemIds) ? topic.libraryItemIds.map(String) : []');
  assertIncludes(storeSource, 'libraryItemIds: normalizeIdList(topic?.libraryItemIds)');
  assertIncludes(storeSource, 'api.updateTopic(topicId, data)');
});

check('library paid/free and visibility updates do not reset missing file fields', () => {
  assertIncludes(serverContentRoutesSource, 'const libraryUpdateSchema = z.object({');
  assertIncludes(serverContentRoutesSource, 'showOnPlatform: z.boolean().optional()');
  assertIncludes(serverContentRoutesSource, 'isLocked: z.boolean().optional()');
  assertIncludes(serverContentRoutesSource, 'const payload = libraryUpdateSchema.parse(req.body)');
});

check('support files shown inside foundation topics come from explicit topic links', () => {
  assertIncludes(skillModalSource, 'const explicitLibraryItemIds = new Set(activeTopic.libraryItemIds || [])');
  assertIncludes(skillModalSource, 'const isAttached = [...explicitLibraryItemIds].some((itemId) => matchesEntityId(item, itemId))');
  assertIncludes(subjectLearningSource, 'const explicitLibraryItemIds = new Set(activeTopic.libraryItemIds || [])');
  assertIncludes(subjectLearningSource, 'return isAttached && Boolean(item.url) && canSeeLibraryItem(item)');
});

check('support files inside foundation follow the topic package state', () => {
  assertIncludes(subjectLearningSource, 'const isTopicSupportLockedForStudent = (topic: Topic | null | undefined) => isTopicLockedForStudent(topic)');
  assertIncludes(subjectLearningSource, "isTopicSupportLockedForStudent(activeTopic) ? openPackageTab('foundation') : openExternalUrl(item.url)");
  assertIncludes(subjectLearningSource, 'getTopicSupportAccessLabel(activeTopic)');
});

check('library tab keeps its own package access separate from foundation topics', () => {
  assertIncludes(subjectLearningSource, 'const isLibraryItemLockedForStudent');
  assertIncludes(subjectLearningSource, "hasScopedPackageAccess('library', pathId, subjectId)");
  assertIncludes(subjectLearningSource, "isLibraryItemLockedForStudent(item) ? openPackageTab('library') : openExternalUrl(item.url)");
});

check('subject learning page keeps the learner view compact', () => {
  assertIncludes(subjectLearningSource, 'py-5 sm:py-6 relative overflow-hidden');
  assertIncludes(subjectLearningSource, 'text-2xl sm:text-3xl font-black text-white mb-2');
  if (subjectLearningSource.includes('هذه المساحة خاصة بموضوعات التأسيس')) {
    throw new Error('learner foundation tab should not show the long internal explanation');
  }
});

for (const item of checks) {
  console.log(`${item.status} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
}

const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length > 0) {
  console.error(`\n${failed.length} library support contract smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} library support contract smoke checks passed.`);
