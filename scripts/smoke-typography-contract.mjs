import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assertIncludes(needle) {
  if (!indexHtml.includes(needle)) {
    throw new Error(`index.html must include: ${needle}`);
  }
}

assertIncludes("sans: ['var(--platform-font-body)', 'Tajawal', 'ui-sans-serif', 'system-ui']");
assertIncludes("tajawal: ['var(--platform-font-body)', 'Tajawal', 'ui-sans-serif', 'system-ui']");
assertIncludes('family=Tajawal:wght@300;400;500;700;800;900&display=swap');
assertIncludes("--platform-font-body: 'Tajawal';");
assertIncludes("--platform-font-heading: 'Tajawal';");
assertIncludes("font-family: var(--platform-font-body), 'Tajawal', sans-serif;");

console.log('Typography contract passed: Tajawal font and full hero weight range are preserved.');
