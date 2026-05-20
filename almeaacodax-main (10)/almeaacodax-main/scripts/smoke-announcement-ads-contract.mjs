import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const checks = [
  ['types.ts', ['AnnouncementAd', 'AnnouncementAudience', 'AnnouncementDisplayMode', 'AnnouncementFrequency', 'ctaUrl', 'audience', 'delaySeconds']],
  ['server/src/models/AnnouncementAd.ts', ['AnnouncementAdModel', 'imageUrl', 'ctaLabel', 'priority', 'displayMode', 'frequency', 'delaySeconds']],
  [
    'server/src/routes/content.routes.ts',
    [
      'announcementAdSchema',
      'announcementAdUpdateSchema',
      'const payload = announcementAdUpdateSchema.parse(req.body)',
      'announcement-ads',
      'announcementAds',
    ],
  ],
  ['services/api.ts', ['createAnnouncementAd', 'updateAnnouncementAd', 'deleteAnnouncementAd', 'announcementAds']],
  ['services/adapter.ts', ['normalizeAnnouncementAd', 'announcementAds', 'displayMode', 'frequency', 'imageFit']],
  ['store/useStore.ts', ['announcementAds', 'createAnnouncementAd', 'updateAnnouncementAd', 'deleteAnnouncementAd', 'delaySeconds']],
  ['components/AnnouncementAdsOverlay.tsx', ['SESSION_DISMISSED_KEY', 'PERMANENT_DISMISSED_KEY', 'ANNOUNCEMENT_AD_PREVIEW_EVENT', 'previewAdId', 'goToTarget', 'visibleAds', 'matchesAudience', 'skipActiveAd', 'top-banner']],
  ['dashboards/admin/AnnouncementAdsManager.tsx', ['handleImageUpload', 'previewSelected', 'CustomEvent', 'audienceLabels', 'displayModeLabels', 'frequencyLabels', 'imageFitLabels', 'createAnnouncementAd', "boundary: 'start' | 'end' = 'start'", 'T23:59:59.999', 'MAX_AD_IMAGE_BYTES', '1200x675']],
  ['dashboards/admin/AdminDashboard.tsx', ['AnnouncementAdsManager', 'announcement-ads', 'Megaphone']],
  ['App.tsx', ['AnnouncementAdsOverlay', 'announcementAds: contentResult.announcementAds']],
  ['server/src/services/learningBackup.ts', ['announcementAds', 'AnnouncementAdModel']],
];

for (const [file, needles] of checks) {
  const source = read(file);
  for (const needle of needles) {
    assert(source.includes(needle), `${file} is missing ${needle}`);
  }
}

const videoPlayer = read('components/CustomVideoPlayer.tsx');
assert(videoPlayer.includes('questionBank.find'), 'Video player must resolve timed questions from the question bank');

const lessonManager = read('dashboards/admin/builders/UnifiedLessonBuilder.tsx');
assert(lessonManager.includes('availableVideoQuestions'), 'Lesson manager must list question-bank candidates');
assert(lessonManager.includes("addInteractiveQuestion('bank')"), 'Lesson manager must provide a direct pull-from-bank action');
assert(lessonManager.includes('questionId') && lessonManager.includes('interactiveQuestions'), 'Video questions must keep question-bank references');

const adsManager = read('dashboards/admin/AnnouncementAdsManager.tsx');
assert(adsManager.includes('إدارة الإعلانات'), 'Announcement manager labels must be readable Arabic');
assert(adsManager.includes('الصورة كبيرة'), 'Announcement manager must warn about oversized images');
assert(adsManager.includes('طريقة العرض'), 'Announcement manager must expose display mode settings');
assert(adsManager.includes('تكرار الظهور'), 'Announcement manager must expose frequency settings');
assert(
  adsManager.includes("startsAt: fromDateInput(event.target.value, 'start')"),
  'Announcement ad start date must use a start-of-day boundary',
);
assert(
  adsManager.includes("endsAt: fromDateInput(event.target.value, 'end')"),
  'Announcement ad end date must stay active through the selected day',
);

const header = read('components/Header.tsx');
assert(header.includes('/dashboard?tab=my-courses'), 'User menu courses shortcut must open the dashboard courses tab');
assert(header.includes('/my-quizzes'), 'User menu quizzes shortcut must open the simple quiz attempts page');

console.log('announcement ads, video question-bank, and dashboard shortcut contract ok');
