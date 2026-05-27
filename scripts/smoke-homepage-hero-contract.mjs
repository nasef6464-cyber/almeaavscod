import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertIncludes(file, needle) {
  const content = read(file);
  if (!content.includes(needle)) {
    throw new Error(`${file} must include: ${needle}`);
  }
}

function assertFileExists(file) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) {
    throw new Error(`${file} must exist`);
  }

  const size = fs.statSync(absolute).size;
  if (size <= 0 || size > 900 * 1024) {
    throw new Error(`${file} must be present and optimized below 900KB`);
  }
}

assertFileExists('public/images/homepage-hero-boy-platform.jpg');

assertIncludes('pages/Landing.tsx', "const DEFAULT_HERO_BOY_IMAGE =");
assertIncludes('pages/Landing.tsx', '/images/homepage-hero-boy-platform.jpg');
assertIncludes('pages/Landing.tsx', 'const LEGACY_HERO_IMAGE_HINTS = [');
assertIncludes('pages/Landing.tsx', 'saudi-arab-boy-student-wearing-thobe-holding-tablet_1258-122164');
assertIncludes('pages/Landing.tsx', 'resolveHomepageHeroImage');
assertIncludes('pages/Landing.tsx', 'homepageSettings.hero.imageAlt');

assertIncludes('dashboards/admin/HomepageManager.tsx', '/images/homepage-hero-boy-platform.jpg');
assertIncludes('dashboards/admin/HomepageManager.tsx', "import { useAuth } from '../../contexts/AuthContext';");
assertIncludes('dashboards/admin/HomepageManager.tsx', 'const { user, logout } = useAuth();');
assertIncludes('dashboards/admin/HomepageManager.tsx', 'api.updateHomepageSettings(payload, user.token)');
assertIncludes('dashboards/admin/HomepageManager.tsx', 'Authentication required');
assertIncludes('dashboards/admin/HomepageManager.tsx', 'انتهت جلسة الإدارة');
assertIncludes('dashboards/admin/HomepageManager.tsx', 'handleHeroImageUpload');
assertIncludes('dashboards/admin/HomepageManager.tsx', 'handleTestimonialImageUpload');
assertIncludes('dashboards/admin/HomepageManager.tsx', 'updateTypographyField');
assertIncludes('dashboards/admin/AdminDashboard.tsx', 'getRequestedAdminTab');
assertIncludes('dashboards/admin/AdminDashboard.tsx', "window.location.hash.includes('?')");
assertIncludes('dashboards/admin/HomepageManager.tsx', 'accept="image/png,image/jpeg,image/webp"');
assertIncludes('dashboards/admin/HomepageManager.tsx', '1200×800 أو 3:2');
assertIncludes('dashboards/admin/HomepageManager.tsx', 'أقل من 900KB');
assertIncludes('dashboards/admin/HomepageManager.tsx', 'صورة ولد افتراضية');

assertIncludes('types.ts', 'imageAlt?: string;');
assertIncludes('types.ts', 'export interface HomepageTypography');
assertIncludes('server/src/models/HomepageSettings.ts', 'imageAlt: { type: String, default: "" }');
assertIncludes('server/src/models/HomepageSettings.ts', 'homepageTypographySchema');
assertIncludes('server/src/routes/content.routes.ts', 'imageAlt: z.string().optional()');
assertIncludes('server/src/routes/content.routes.ts', 'typography: z');
assertIncludes('server/src/routes/content.routes.ts', 'imageUrl: "/images/homepage-hero-boy-platform.jpg');

assertIncludes('pages/Landing.tsx', 'const fontClassByChoice =');
assertIncludes('pages/Landing.tsx', 'homepageSettings.typography');
assertIncludes('contexts/AuthContext.tsx', 'isAuthSessionError');

assertIncludes('services/api.ts', 'cache?: RequestCache;');
assertIncludes('services/api.ts', 'cache: options.cache');
assertIncludes('services/api.ts', 'cache: "no-store"');

console.log('Homepage hero contract passed: default image, admin upload, alt text, and no-store settings are wired.');
