import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [
  ['types.ts', ['PlatformFontSettings', 'PlatformFontFamily', 'navigationFont', 'buttonColor']],
  ['server/src/models/PlatformFontSettings.ts', ['PlatformFontSettingsModel', 'navigationFont', 'buttonFont', 'bodyColor']],
  ['server/src/routes/content.routes.ts', ['platform-font-settings', 'platformFontFamilySchema', 'navigationWeight', 'requireRole(["admin"])']],
  ['services/api.ts', ['getPlatformFontSettings', 'updatePlatformFontSettings']],
  ['utils/platformFonts.ts', ['DEFAULT_PLATFORM_FONT_SETTINGS', 'applyPlatformFontSettings', '--platform-font-body', '--platform-font-navigation', '--platform-font-button']],
  ['components/PlatformFontBootstrap.tsx', ['getPlatformFontSettings', 'PLATFORM_FONT_SETTINGS_UPDATED']],
  ['dashboards/admin/PlatformFontsManager.tsx', ['FONT_TARGETS', 'إعدادات الخطوط المتقدمة', 'مكتبة الخطوط الجاهزة', 'updatePlatformFontSettings(settings, user.token)', 'رفع خط مخصص', '500KB']],
  ['dashboards/admin/AdminDashboard.tsx', ['PlatformFontsManager', 'platform-fonts', 'Type size={20}']],
  ['index.html', ['--platform-font-body', '--platform-font-heading', 'var(--platform-font-body)', 'platform-heading-font']],
];

for (const [file, needles] of checks) {
  const content = read(file);
  for (const needle of needles) {
    if (!content.includes(needle)) {
      throw new Error(`${file} must include: ${needle}`);
    }
  }
}

console.log('Platform fonts contract passed: advanced admin-managed global fonts are wired end to end.');
