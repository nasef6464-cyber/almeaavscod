import { execSync } from 'node:child_process';

const FRONTEND_URL = (process.env.SMOKE_FRONTEND_URL || 'https://almeaacodax.vercel.app').replace(/\/$/, '');
const API_URL = (process.env.SMOKE_API_URL || 'https://almeaacodax-k2ux.onrender.com/api').replace(/\/$/, '');
const EXPECTED_VERSION = process.env.SMOKE_EXPECT_VERSION || (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
})();
const STRICT_VERSION = process.env.SMOKE_STRICT_VERSION === '1';

const baseRoutes = [
  '/',
  '/#/quizzes',
  '/#/my-quizzes',
  '/#/mock-exams',
  '/#/reports',
  '/#/login',
];
const legacyLearningRoutes = [
  '/#/category/p_qudrat',
  '/#/category/p_qudrat?subject=sub_quant',
  '/#/category/p_qudrat?subject=sub_verbal',
  '/#/category/p_tahsili',
  '/#/category/p_tahsili?subject=sub_math',
];
const routes = [...baseRoutes];

const checks = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function check(name, fn) {
  try {
    const result = await fn();
    if (result && typeof result === 'object') {
      checks.push({
        name,
        status: result.status || 'pass',
        details: result.details || '',
      });
      return;
    }
    checks.push({ name, status: 'pass', details: result });
  } catch (error) {
    checks.push({ name, status: 'fail', details: error instanceof Error ? error.message : String(error) });
  }
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(750 * (index + 1));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'fetch failed'));
}

async function fetchText(url) {
  const response = await fetchWithRetry(url, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return {
    text: await response.text(),
    headers: response.headers,
  };
}

await check('api health is live', async () => {
  const response = await fetchWithRetry(`${API_URL}/health`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const health = await response.json();
  if (health.status !== 'ok' && health.database !== 'connected') {
    throw new Error(`unexpected health payload: ${JSON.stringify(health)}`);
  }
  return `status=${health.status || 'unknown'}, database=${health.database || 'unknown'}`;
});

await check('learning taxonomy exposes current student routes', async () => {
  const response = await fetchWithRetry(`${API_URL}/taxonomy/bootstrap`, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const taxonomy = await response.json();
  const paths = Array.isArray(taxonomy?.paths) ? taxonomy.paths : [];
  const subjects = Array.isArray(taxonomy?.subjects) ? taxonomy.subjects : [];
  const activePaths = paths.filter((path) => path?.isActive !== false);
  if (activePaths.length === 0) throw new Error('no active learning paths returned');

  const pathIdOf = (path) => String(path?.id || path?._id || '').trim();
  const subjectIdOf = (subject) => String(subject?.id || subject?._id || '').trim();
  const pathIds = new Set(activePaths.map(pathIdOf).filter(Boolean));
  const currentSubjectRoutes = [];

  for (const path of activePaths.slice(0, 5)) {
    const pathId = pathIdOf(path);
    if (!pathId) continue;
    routes.push(`/#/category/${pathId}`);
    routes.push(`/#/category/${pathId}?tab=mock-exams`);
    routes.push(`/#/category/${pathId}?subject=__missing_subject_smoke__`);
    const pathSubjects = subjects.filter((subject) => pathIds.has(String(subject?.pathId || '')) && String(subject?.pathId || '') === pathId);
    for (const subject of pathSubjects.slice(0, 3)) {
      const subjectId = subjectIdOf(subject);
      if (!subjectId) continue;
      const route = `/#/category/${pathId}?subject=${subjectId}`;
      currentSubjectRoutes.push(route);
      routes.push(route);
    }
  }

  routes.push(...legacyLearningRoutes);
  return `paths=${activePaths.length}, subjectRoutes=${currentSubjectRoutes.length}, legacyRoutes=${legacyLearningRoutes.length}`;
});

await check('frontend api proxy exposes taxonomy', async () => {
  const response = await fetchWithRetry(`${FRONTEND_URL}/api/taxonomy/bootstrap`, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const taxonomy = await response.json();
  const paths = Array.isArray(taxonomy?.paths) ? taxonomy.paths : [];
  if (paths.length === 0) {
    throw new Error('frontend /api proxy returned no paths');
  }
  return `proxiedPaths=${paths.length}`;
});

let shellHtml = '';
let entryAssetText = '';
await check('frontend shell loads', async () => {
  const result = await fetchText(`${FRONTEND_URL}/?smoke=${Date.now()}`);
  shellHtml = result.text;
  if (!shellHtml.includes('<div id="root"')) throw new Error('root element missing');
  if (!shellHtml.includes('/assets/')) throw new Error('asset links missing');
  return `cache=${result.headers.get('x-vercel-cache') || 'unknown'}, bytes=${shellHtml.length}`;
});

await check('entry asset loads', async () => {
  const match = shellHtml.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
  if (!match) throw new Error('entry asset not found');
  const assetUrl = new URL(match[1], FRONTEND_URL).toString();
  const response = await fetchWithRetry(assetUrl, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  entryAssetText = await response.text();
  if (entryAssetText.length < 1000) throw new Error(`asset too small: ${entryAssetText.length}`);
  return `${assetUrl} (${Math.round(entryAssetText.length / 1024)} KB)`;
});

if (EXPECTED_VERSION) {
  await check(`deployed app version matches ${EXPECTED_VERSION}`, async () => {
    const matches = entryAssetText.includes(EXPECTED_VERSION);
    if (!matches && STRICT_VERSION) {
      throw new Error('production entry asset does not include expected version');
    }
    if (!matches) {
      return {
        status: 'warn',
        details: 'STALE: Vercel is reachable, but the entry asset does not include the expected Git commit yet. Redeploy the main branch or wait for Vercel to finish.',
      };
    }
    return 'production is serving the expected commit/version';
  });
}

for (const route of routes) {
  await check(`route shell: ${route}`, async () => {
    const result = await fetchText(`${FRONTEND_URL}${route}${route.includes('?') ? '&' : '?'}smoke=${Date.now()}`);
    if (!result.text.includes('<div id="root"')) throw new Error('root element missing');
    return `bytes=${result.text.length}`;
  });
}

const failed = checks.filter((item) => item.status === 'fail');
const warnings = checks.filter((item) => item.status === 'warn');
for (const item of checks) {
  const mark = item.status === 'pass' ? 'PASS' : item.status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${mark} ${item.name} - ${item.details}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} frontend smoke check(s) failed.`);
  process.exit(1);
}

const passCount = checks.filter((item) => item.status === 'pass').length;
const warningText = warnings.length ? ` ${warnings.length} warning(s) need attention.` : '';
console.log(`\nAll ${passCount} blocking frontend smoke checks passed.${warningText}`);
