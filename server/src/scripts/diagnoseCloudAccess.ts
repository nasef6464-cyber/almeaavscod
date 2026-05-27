import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

type EnvMap = Record<string, string>;

const rootDir = path.resolve(process.cwd(), '..');
const envPath = path.join(rootDir, '.env.codex.local');

const parseEnvFile = (filePath: string): EnvMap => {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce<EnvMap>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return acc;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (key) acc[key] = value;
      return acc;
    }, {});
};

const env = {
  ...process.env,
  ...parseEnvFile(envPath),
} as EnvMap;

const mask = (value = '') => {
  if (!value) return 'missing';
  if (value.length <= 10) return 'set';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const print = (name: string, status: 'PASS' | 'WARN' | 'FAIL', details: string) => {
  console.log(`${status} ${name} - ${details}`);
};

const teamQuery = () => (env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}` : '');
const withTeamQuery = (url: string) => {
  if (!env.VERCEL_TEAM_ID) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`;
};

const fetchJson = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${typeof body === 'string' ? body.slice(0, 160) : JSON.stringify(body).slice(0, 160)}`);
  }

  return body as any;
};

async function diagnoseMongo() {
  const uri = env.MONGODB_URI;
  if (!uri) {
    print('MongoDB URI', 'WARN', 'MONGODB_URI غير موجود في .env.codex.local');
    return;
  }

  try {
    const connection = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 12000,
    }).asPromise();

    const db = connection.db;
    if (!db) throw new Error('database handle unavailable');

    const collections = await db.listCollections().toArray();
    const names = collections.map((collection) => collection.name).sort();
    const interesting = ['users', 'paths', 'levels', 'subjects', 'sections', 'skills', 'topics', 'lessons', 'courses', 'quizzes'];
    const counts = await Promise.all(
      interesting.map(async (collectionName) => {
        if (!names.includes(collectionName)) return `${collectionName}=missing`;
        const count = await db.collection(collectionName).countDocuments();
        return `${collectionName}=${count}`;
      }),
    );

    print('MongoDB connection', 'PASS', `database=${db.databaseName}, collections=${names.length}, ${counts.join(', ')}`);
    await connection.close();
  } catch (error) {
    print('MongoDB connection', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

async function diagnoseRender() {
  const apiKey = env.RENDER_API_KEY;
  const serviceId = env.RENDER_SERVICE_ID;

  if (!apiKey || !serviceId) {
    print('Render access', 'WARN', `RENDER_API_KEY=${mask(apiKey)}, RENDER_SERVICE_ID=${mask(serviceId)}`);
    return;
  }

  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };

  try {
    const service = await fetchJson(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}`, { headers });
    const deploys = await fetchJson(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys?limit=3`, { headers });
    const latestDeploy = Array.isArray(deploys) ? deploys[0]?.deploy : deploys?.[0]?.deploy;
    print('Render service', 'PASS', `name=${service?.service?.name || service?.name || 'unknown'}, latest=${latestDeploy?.status || latestDeploy?.id || 'unknown'}`);
  } catch (error) {
    print('Render service', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

async function diagnoseVercel() {
  const token = env.VERCEL_TOKEN;
  const projectId = env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    print('Vercel access', 'WARN', `VERCEL_TOKEN=${mask(token)}, VERCEL_PROJECT_ID=${mask(projectId)}, VERCEL_TEAM_ID=${mask(env.VERCEL_TEAM_ID)}`);
    return;
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  try {
    const project = await fetchJson(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}${teamQuery()}`, { headers });
    const deployments = await fetchJson(
      withTeamQuery(`https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=3`),
      { headers },
    );
    const latest = deployments?.deployments?.[0];
    print('Vercel project', 'PASS', `name=${project?.name || 'unknown'}, latest=${latest?.state || 'unknown'}, url=${latest?.url || 'unknown'}`);
  } catch (error) {
    print('Vercel project', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

console.log(`Using local credentials file: ${envPath}`);
console.log(`Secrets are masked and will not be printed.\n`);

await diagnoseMongo();
await diagnoseRender();
await diagnoseVercel();
