import { createWriteStream, createReadStream, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { db } from "../db/connection.js";
import {
  users, paths, levels, subjects, sections, skills,
  courses, lessons, topics,
  questions, quizzes, quizResults, questionAttempts, skillProgress,
  b2bPackages, accessCodes, paymentRequests, paymentSettings, studyPlans,
  groups, libraryItems, homepageSettings, activities,
  certificates, notificationTemplates, notificationDeliveries,
  adminAuditLogs, aiInteractions, clientEvents,
  discountCodes, accessGrants, announcementAds, platformIntegrationSettings,
  backupSnapshots, backupActivities,
} from "../db/schema/index.js";
import { eq } from "drizzle-orm";

const BACKUP_DIR = process.env.BACKUP_DIR || join(process.cwd(), "backups");

const TABLES = {
  users, paths, levels, subjects, sections, skills,
  courses, lessons, topics,
  questions, quizzes, quizResults, questionAttempts, skillProgress,
  b2bPackages, accessCodes, paymentRequests, paymentSettings, studyPlans,
  groups, libraryItems, homepageSettings, activities,
  certificates, notificationTemplates, notificationDeliveries,
  adminAuditLogs, aiInteractions, clientEvents,
  discountCodes, accessGrants, announcementAds, platformIntegrationSettings,
} as const;

type TableKey = keyof typeof TABLES;

async function exportTable(tableName: string) {
  const table = TABLES[tableName as TableKey];
  if (!table) return { tableName, count: 0, data: [] };

  const data = await db.select().from(table);
  return { tableName, count: data.length, data };
}

async function importTable(tableName: string, data: any[], truncateFirst = false) {
  const table = TABLES[tableName as TableKey];
  if (!table || !data.length) return { tableName, imported: 0 };

  if (truncateFirst) {
    await db.delete(table);
  }

  let imported = 0;
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await db.insert(table).values(batch as any).onConflictDoNothing();
    imported += batch.length;
  }

  return { tableName, imported };
}

export async function createBackup(options: {
  name: string;
  description?: string;
  tables?: string[];
  createdBy?: string;
}) {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const backupId = `backup_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const backupPath = join(BACKUP_DIR, `${backupId}.json`);
  const tablesToExport = options.tables && options.tables.length > 0
    ? options.tables.filter((t) => t in TABLES)
    : Object.keys(TABLES);

  console.log(`[backup] Starting backup ${backupId} with ${tablesToExport.length} tables`);

  const exportResults: Array<{ tableName: string; count: number; data?: any[]; error?: string }> = [];
  let totalRecords = 0;

  for (const tableName of tablesToExport) {
    try {
      const result = await exportTable(tableName);
      exportResults.push({ tableName, count: result.count });
      totalRecords += result.count;
      console.log(`[backup] Exported ${tableName}: ${result.count} records`);
    } catch (err) {
      console.error(`[backup] Failed to export ${tableName}:`, err);
      exportResults.push({ tableName, count: 0, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  const backupData = {
    backupId,
    name: options.name,
    description: options.description || "",
    createdAt: new Date().toISOString(),
    createdBy: options.createdBy || "",
    tables: exportResults,
    totalRecords,
    version: "1.0.0",
    data: tablesToExport.reduce((acc, tableName) => {
      const result = exportResults.find((r) => r.tableName === tableName);
      if (result && result.count > 0) {
        return { ...acc, [tableName]: result.data };
      }
      return acc;
    }, {}),
  };

  const stream = createWriteStream(backupPath);
  stream.write(JSON.stringify(backupData, null, 2));
  stream.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  const fileSize = (await import("node:fs/promises")).stat(backupPath).then((s) => s.size);
  const sizeStr = formatFileSize(await fileSize);

  return {
    backupId,
    name: options.name,
    description: options.description || "",
    status: "completed",
    size: sizeStr,
    tableCount: tablesToExport.length,
    recordCount: totalRecords,
    tables: exportResults,
    filePath: backupPath,
    createdAt: new Date(),
  };
}

export async function restoreBackup(backupIdOrPath: string, options: {
  tables?: string[];
  truncateFirst?: boolean;
  createdBy?: string;
} = {}) {
  const backupPath = backupIdOrPath.includes(".json")
    ? backupIdOrPath
    : join(BACKUP_DIR, `${backupIdOrPath}.json`);

  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const fileContent = await import("node:fs/promises").then((fs) => fs.readFile(backupPath, "utf-8"));
  const backupData = JSON.parse(fileContent);

  const tablesToImport = options.tables && options.tables.length > 0
    ? options.tables.filter((t) => t in TABLES)
    : Object.keys(backupData.data || {});

  console.log(`[restore] Starting restore from ${backupIdOrPath} with ${tablesToImport.length} tables`);

  const importResults = [];
  let totalImported = 0;

  for (const tableName of tablesToImport) {
    const tableData = backupData.data?.[tableName];
    if (!tableData || !Array.isArray(tableData)) {
      console.log(`[restore] No data for ${tableName}, skipping`);
      continue;
    }

    try {
      const result = await importTable(tableName, tableData, options.truncateFirst ?? false);
      importResults.push({ tableName, imported: result.imported, total: tableData.length });
      totalImported += result.imported;
      console.log(`[restore] Imported ${tableName}: ${result.imported}/${tableData.length} records`);
    } catch (err) {
      console.error(`[restore] Failed to import ${tableName}:`, err);
      importResults.push({ tableName, imported: 0, total: tableData.length, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  return {
    backupId: backupData.backupId || backupIdOrPath,
    name: backupData.name || "Unknown",
    status: "completed",
    tablesImported: importResults.length,
    totalImported,
    results: importResults,
    restoredAt: new Date(),
  };
}

export async function listBackups() {
  if (!existsSync(BACKUP_DIR)) {
    return [];
  }

  const fs = await import("node:fs/promises");
  const files = await fs.readdir(BACKUP_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const backups = [];
  for (const file of jsonFiles) {
    try {
      const content = await fs.readFile(join(BACKUP_DIR, file), "utf-8");
      const data = JSON.parse(content);
      const stat = await fs.stat(join(BACKUP_DIR, file));
      backups.push({
        id: data.backupId || file.replace(".json", ""),
        name: data.name || file,
        description: data.description || "",
        status: "completed",
        size: formatFileSize(stat.size),
        tableCount: data.tables?.length || 0,
        recordCount: data.totalRecords || 0,
        createdAt: data.createdAt || stat.mtime,
        filePath: join(BACKUP_DIR, file),
      });
    } catch {
      // skip invalid files
    }
  }

  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteBackup(backupIdOrPath: string) {
  const backupPath = backupIdOrPath.includes(".json")
    ? backupIdOrPath
    : join(BACKUP_DIR, `${backupIdOrPath}.json`);

  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  unlinkSync(backupPath);
  return { success: true, message: "Backup deleted" };
}

export async function getBackupDetails(backupIdOrPath: string) {
  const backupPath = backupIdOrPath.includes(".json")
    ? backupIdOrPath
    : join(BACKUP_DIR, `${backupIdOrPath}.json`);

  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const fs = await import("node:fs/promises");
  const content = await fs.readFile(backupPath, "utf-8");
  const data = JSON.parse(content);
  const stat = await fs.stat(backupPath);

  return {
    id: data.backupId || backupIdOrPath,
    name: data.name || backupIdOrPath,
    description: data.description || "",
    status: "completed",
    size: formatFileSize(stat.size),
    tableCount: data.tables?.length || 0,
    recordCount: data.totalRecords || 0,
    tables: data.tables || [],
    createdAt: data.createdAt || stat.mtime,
    createdBy: data.createdBy || "",
    version: data.version || "1.0.0",
    filePath: backupPath,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
