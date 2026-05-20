import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

const headers = Array.isArray(vercel.headers) ? vercel.headers : [];

function findHeader(source, key) {
  const entry = headers.find((item) => item.source === source);
  if (!entry) return '';
  const header = (entry.headers || []).find((item) => String(item.key || '').toLowerCase() === key.toLowerCase());
  return String(header?.value || '');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const assetCache = findHeader('/assets/(.*)', 'Cache-Control');
const hashedFileCache = findHeader('/(.*).(js|css|woff|woff2|ttf|png|jpg|jpeg|webp|svg|ico)', 'Cache-Control');
const shellCache = findHeader('/', 'Cache-Control');

assert(assetCache.includes('max-age=31536000'), 'Vercel assets must be cached for one year');
assert(assetCache.includes('immutable'), 'Vercel assets must be immutable');
assert(hashedFileCache.includes('max-age=31536000'), 'Hashed JS/CSS/font/image files must be cached');
assert(shellCache.includes('no-cache'), 'SPA shell should revalidate instead of being permanently cached');
assert(!shellCache.includes('no-store'), 'SPA shell must not force no-store for every production request');
assert(!findHeader('/(.*)', 'Cache-Control'), 'Do not add a catch-all Cache-Control header that overrides immutable assets');

console.log('Deployment cache contract passed: hashed assets are immutable and HTML shell revalidates.');
