import { Router } from "express";
import { env } from "../config/env.js";
import { eq } from "drizzle-orm";
import { USE_PG } from "../utils/usePg.js";
import { db } from "../db/connection.js";
import { paths as pgPaths, subjects as pgSubjects } from "../db/schema/index.js";
import { PathModel } from "../models/Path.js";
import { SubjectModel } from "../models/Subject.js";

export const seoRouter = Router();

type SeoEntry = {
  loc: string;
  priority: string;
  changefreq: "daily" | "weekly" | "monthly";
  lastmod?: string;
  title: string;
};

const cleanBaseUrl = () => (env.CLIENT_URL || "https://almeaavscod.vercel.app").replace(/\/+$/, "");

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const isoDate = (value?: Date | string | null) => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const routeUrl = (baseUrl: string, routePath: string) => `${baseUrl}${routePath}`;

async function buildSeoEntries(): Promise<SeoEntry[]> {
  const baseUrl = cleanBaseUrl();
  let paths, subjects;

  if (USE_PG()) {
    [paths, subjects] = await Promise.all([
      db.select().from(pgPaths).where(eq(pgPaths.isActive, true)).orderBy(pgPaths.createdAt),
      db.select().from(pgSubjects).orderBy(pgSubjects.createdAt),
    ]);
  } else {
    [paths, subjects] = await Promise.all([
      PathModel.find({ isActive: { $ne: false } }).sort({ createdAt: 1 }).lean(),
      SubjectModel.find({}).sort({ createdAt: 1 }).lean(),
    ]);
  }

  const entries: SeoEntry[] = [
    {
      loc: `${baseUrl}/`,
      priority: "1.0",
      changefreq: "daily",
      lastmod: new Date().toISOString(),
      title: "الصفحة الرئيسية",
    },
    {
      loc: routeUrl(baseUrl, "/blog"),
      priority: "0.5",
      changefreq: "weekly",
      lastmod: new Date().toISOString(),
      title: "المدونة",
    },
    {
      loc: routeUrl(baseUrl, "/quizzes"),
      priority: "0.6",
      changefreq: "weekly",
      lastmod: new Date().toISOString(),
      title: "الاختبارات",
    },
  ];

  for (const path of paths) {
    const pathId = String(path.id || path._id || "").trim();
    if (!pathId) continue;
    entries.push({
      loc: routeUrl(baseUrl, `/category/${encodeURIComponent(pathId)}`),
      priority: path.showInHome === false ? "0.6" : "0.9",
      changefreq: "weekly",
      lastmod: isoDate(path.updatedAt),
      title: String(path.name || pathId),
    });

    const pathSubjects = subjects.filter((subject) => {
      const spId = String(subject.pathId || "").trim();
      return spId === pathId;
    });
    for (const subject of pathSubjects) {
      const subjectId = String(subject.id || subject._id || "").trim();
      if (!subjectId) continue;
      entries.push({
        loc: routeUrl(baseUrl, `/category/${encodeURIComponent(pathId)}?subject=${encodeURIComponent(subjectId)}`),
        priority: "0.8",
        changefreq: "weekly",
        lastmod: isoDate(subject.updatedAt),
        title: `${String(path.name || pathId)} - ${String(subject.name || subjectId)}`,
      });
    }
  }

  return entries;
}

seoRouter.get("/status", async (_req, res, next) => {
  try {
    const entries = await buildSeoEntries();
    const baseUrl = cleanBaseUrl();
    const pathEntries = entries.filter((entry) => entry.loc.includes("/category/") && !entry.loc.includes("?subject="));
    const subjectEntries = entries.filter((entry) => entry.loc.includes("?subject="));

    res.json({
      checkedAt: new Date().toISOString(),
      siteUrl: baseUrl,
      sitemapUrl: `${baseUrl}/sitemap.xml`,
      robotsUrl: `${baseUrl}/robots.txt`,
      manifestUrl: `${baseUrl}/site.webmanifest`,
      indexableRoutes: entries.length,
      paths: pathEntries.length,
      subjects: subjectEntries.length,
      warnings: [
        "روابط SEO تعمل بصيغة نظيفة بدون hash، مع الاستمرار في حماية مسارات التطبيق الخاصة من الفهرسة.",
      ],
      sampleRoutes: entries.slice(0, 8).map((entry) => ({ title: entry.title, loc: entry.loc })),
    });
  } catch (error) {
    next(error);
  }
});

seoRouter.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const entries = await buildSeoEntries();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    <lastmod>${xmlEscape(entry.lastmod || new Date().toISOString())}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(xml);
  } catch (error) {
    next(error);
  }
});

seoRouter.get("/robots.txt", async (_req, res) => {
  const baseUrl = cleanBaseUrl();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin-dashboard
Disallow: /login

Sitemap: ${baseUrl}/sitemap.xml
`);
});

seoRouter.get("/manifest.json", async (_req, res) => {
  const baseUrl = cleanBaseUrl();
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    name: "منصة المئة",
    short_name: "المئة",
    description: "منصة تعليمية للقدرات والتحصيلي والتدريب الذكي.",
    start_url: `${baseUrl}/`,
    scope: `${baseUrl}/`,
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [],
  });
});
