import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { QuizModel } from "../models/Quiz.js";

type EnvMap = Record<string, string>;
type Slot = "training" | "tests";

const envFiles = [
  ".env.codex.local",
  "../.env.codex.local",
  ".env",
  "server/.env",
  ".env.development",
];

const parseEnvFile = (filePath: string): EnvMap => {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce<EnvMap>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key) acc[key] = value;
      return acc;
    }, {});
};

const loadEnv = (): EnvMap => {
  const loaded = envFiles.reduce<EnvMap>((acc, fileName) => {
    const fromCwd = path.resolve(process.cwd(), fileName);
    return { ...acc, ...parseEnvFile(fromCwd) };
  }, {});

  return { ...loaded, ...process.env } as EnvMap;
};

const atlasDirectUriFromSrv = (uri: string) => {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "mongodb+srv:" || parsed.hostname !== "almeaa.5y2fzx5.mongodb.net") {
      return null;
    }

    const dbName = parsed.pathname.replace(/^\/+/, "") || "almeaa";
    const params = new URLSearchParams(parsed.searchParams);
    params.set("authSource", params.get("authSource") || "admin");
    params.set("tls", params.get("tls") || "true");

    const hosts = [
      "ac-5fh0moi-shard-00-00.5y2fzx5.mongodb.net:27017",
      "ac-5fh0moi-shard-00-01.5y2fzx5.mongodb.net:27017",
      "ac-5fh0moi-shard-00-02.5y2fzx5.mongodb.net:27017",
    ].join(",");

    return `mongodb://${parsed.username}:${parsed.password}@${hosts}/${dbName}?${params.toString()}`;
  } catch {
    return null;
  }
};

const connect = async (uri: string) => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });
  } catch (error) {
    const fallbackUri = atlasDirectUriFromSrv(uri);
    if (!fallbackUri) throw error;

    console.warn("SRV lookup failed locally; retrying with direct Atlas hosts.");
    await mongoose.connect(fallbackUri, { serverSelectionTimeoutMS: 12000 });
  }
};

const getLegacySlots = (quiz: any): Slot[] => {
  const slots = new Set<Slot>();

  if (quiz.showInTraining === true || quiz.placement === "training" || quiz.placement === "both" || quiz.type === "bank") {
    slots.add("training");
  }

  if (quiz.showInMock === true || quiz.placement === "mock" || quiz.placement === "both") {
    slots.add("tests");
  }

  return [...slots];
};

const isApplyMode = process.argv.includes("--apply");

async function run() {
  const env = loadEnv();
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment or env files.");
  }

  await connect(env.MONGODB_URI);

  try {
    const quizzes = await QuizModel.find({
      pathId: { $exists: true, $ne: "" },
      subjectId: { $exists: true, $ne: "" },
      isPublished: { $ne: false },
      showOnPlatform: { $ne: false },
      $and: [
        {
          $or: [
            { learningPlacements: { $exists: false } },
            { learningPlacements: { $size: 0 } },
          ],
        },
        {
          $or: [
            { approvalStatus: { $exists: false } },
            { approvalStatus: "approved" },
          ],
        },
        {
          $or: [
            { showInTraining: true },
            { showInMock: true },
            { placement: { $in: ["training", "mock", "both"] } },
            { type: "bank" },
          ],
        },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const candidates = quizzes
      .map((quiz: any) => ({
        id: String(quiz.id || quiz._id),
        title: String(quiz.title || ""),
        pathId: String(quiz.pathId || ""),
        subjectId: String(quiz.subjectId || ""),
        type: String(quiz.type || ""),
        placement: String(quiz.placement || ""),
        slots: getLegacySlots(quiz),
      }))
      .filter((quiz) => quiz.slots.length > 0);

    console.log(
      JSON.stringify(
        {
          mode: isApplyMode ? "apply" : "dry-run",
          candidates: candidates.length,
          items: candidates,
        },
        null,
        2,
      ),
    );

    if (!isApplyMode) {
      console.log("Dry run only. Re-run with --apply to write learningPlacements.");
      return;
    }

    for (const quiz of candidates) {
      const timestamp = Date.now();
      await QuizModel.updateOne(
        { id: quiz.id },
        {
          $set: {
            learningPlacements: quiz.slots.map((slot, index) => ({
              pathId: quiz.pathId,
              subjectId: quiz.subjectId,
              slot,
              isVisible: true,
              order: index,
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
          },
        },
      );
      console.log(`updated ${quiz.id}: ${quiz.slots.join(",")}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (error) => {
  console.error("Learning placements backfill failed");
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
