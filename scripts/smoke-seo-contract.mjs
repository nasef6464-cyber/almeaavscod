import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(path, needle) {
  const content = read(path);
  assert(content.includes(needle), `${path} must include: ${needle}`);
}

assertIncludes('App.tsx', 'const SeoRouteMeta: React.FC = () => {');
assertIncludes('App.tsx', "'noindex, nofollow'");
assertIncludes('App.tsx', "'index, follow'");
assertIncludes('App.tsx', "SEO_PRIVATE_PREFIXES");
assertIncludes('App.tsx', "link[rel=\"canonical\"]");
assertIncludes('App.tsx', "<SeoRouteMeta />");

assertIncludes('public/robots.txt', 'Sitemap: https://almeaavscod.vercel.app/sitemap.xml');
assertIncludes('public/robots.txt', 'Disallow: /admin-dashboard');
assertIncludes('public/robots.txt', 'Disallow: /quiz');
assertIncludes('public/robots.txt', 'Disallow: /results');
assertIncludes('public/sitemap.xml', '<loc>https://almeaavscod.vercel.app/</loc>');
assertIncludes('public/sitemap.xml', '<lastmod>2026-05-12</lastmod>');
assertIncludes('public/site.webmanifest', '"display": "standalone"');

const vercel = JSON.parse(read('vercel.json'));
const headers = Array.isArray(vercel.headers) ? vercel.headers : [];
const privateHeader = headers.find((entry) => String(entry.source || '').includes('admin-dashboard') && String(entry.source || '').includes('results'));
assert(privateHeader, 'vercel.json must include a private-route X-Robots-Tag header block');
const xRobots = (privateHeader.headers || []).find((header) => String(header.key || '').toLowerCase() === 'x-robots-tag');
assert(xRobots?.value === 'noindex, nofollow', 'private route header must be noindex, nofollow');

console.log('SEO contract passed: public metadata exists and private app routes are noindex protected.');
