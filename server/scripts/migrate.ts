#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..", "..");
const migrationsDir = join(rootDir, "server", "drizzle", "migrations");

const command = process.argv[2];

function runCommand(cmd: string, cwd: string) {
  console.log(`Running: ${cmd}`);
  try {
    const output = execSync(cmd, { cwd, stdio: "inherit" });
    return output;
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    process.exit(1);
  }
}

function ensureMigrationsDir() {
  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true });
    console.log(`Created migrations directory: ${migrationsDir}`);
  }
}

function getMigrationCount(): number {
  if (!existsSync(migrationsDir)) return 0;
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  return files.length;
}

switch (command) {
  case "generate":
    const name = process.argv[3] || `migration_${Date.now()}`;
    console.log(`Generating migration: ${name}`);
    ensureMigrationsDir();
    runCommand(`npx drizzle-kit generate --name=${name}`, rootDir);
    break;

  case "migrate":
    console.log("Applying migrations...");
    runCommand("npx drizzle-kit migrate", rootDir);
    break;

  case "push":
    console.log("Pushing schema changes to database...");
    runCommand("npx drizzle-kit push", rootDir);
    break;

  case "status":
    const count = getMigrationCount();
    console.log(`Migration status:`);
    console.log(`- Migrations directory: ${migrationsDir}`);
    console.log(`- Total migrations: ${count}`);
    if (count > 0) {
      const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
      console.log("\nMigration files:");
      files.forEach((f) => console.log(`  - ${f}`));
    }
    break;

  case "studio":
    console.log("Opening Drizzle Studio...");
    runCommand("npx drizzle-kit studio", rootDir);
    break;

  default:
    console.log(`
Database Migration Tool
======================

Usage: npm run db:migrate <command> [options]

Commands:
  generate [name]   Generate a new migration file
  migrate           Apply pending migrations to the database
  push              Push schema changes directly to the database
  status            Show migration status
  studio            Open Drizzle Studio for database inspection

Examples:
  npm run db:migrate generate add-users-table
  npm run db:migrate migrate
  npm run db:migrate push
  npm run db:migrate status
  npm run db:migrate studio
`);
    break;
}
