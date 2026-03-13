/**
 * Database backup service.
 *
 * Backups are stored as gzipped logical snapshots so they work with both
 * locally hosted Postgres and managed providers like Neon.
 */

import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { logger } from "@infra/logger";
import { sanitizeUnknown } from "@infra/sanitize";
import { getDataDir } from "@server/config/dataDir";
import { db, schema } from "@server/db/index";
import { createScheduler } from "@server/utils/scheduler";
import type { BackupInfo } from "@shared/types";
import { asc } from "drizzle-orm";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const BACKUP_DIRNAME = "backups";
const AUTO_BACKUP_PREFIX = "jobs_";
const MANUAL_BACKUP_PREFIX = "jobs_manual_";
const AUTO_BACKUP_PATTERN = /^jobs_\d{4}_\d{2}_\d{2}\.json\.gz$/;
const MANUAL_BACKUP_PATTERN =
  /^jobs_manual_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}(?:_\d+)?\.json\.gz$/;

const AUTO_BACKUP_REGEX = /^jobs_(\d{4})_(\d{2})_(\d{2})\.json\.gz$/;
const MANUAL_BACKUP_REGEX =
  /^jobs_manual_(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})(?:_\d+)?\.json\.gz$/;

interface BackupSettings {
  enabled: boolean;
  hour: number;
  maxCount: number;
}

type BackupSnapshot = {
  format: "job-ops-backup-v1";
  createdAt: string;
  tables: {
    users: typeof schema.users.$inferSelect[];
    sessions: typeof schema.sessions.$inferSelect[];
    settings: typeof schema.settings.$inferSelect[];
    pipelineRuns: typeof schema.pipelineRuns.$inferSelect[];
    jobs: typeof schema.jobs.$inferSelect[];
    stageEvents: typeof schema.stageEvents.$inferSelect[];
    tasks: typeof schema.tasks.$inferSelect[];
    interviews: typeof schema.interviews.$inferSelect[];
    jobChatThreads: typeof schema.jobChatThreads.$inferSelect[];
    jobChatMessages: typeof schema.jobChatMessages.$inferSelect[];
    jobChatRuns: typeof schema.jobChatRuns.$inferSelect[];
  };
};

let currentSettings: BackupSettings = {
  enabled: false,
  hour: 2,
  maxCount: 5,
};

const scheduler = createScheduler("backup", async () => {
  await createBackup("auto");
  await cleanupOldBackups();
});

function getBackupDir(): string {
  return path.join(getDataDir(), BACKUP_DIRNAME);
}

async function ensureBackupDir(): Promise<string> {
  const backupDir = getBackupDir();
  await fs.promises.mkdir(backupDir, { recursive: true });
  return backupDir;
}

function generateBackupFilename(type: "auto" | "manual"): string {
  const now = new Date();
  if (type === "auto") {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    return `${AUTO_BACKUP_PREFIX}${year}_${month}_${day}.json.gz`;
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${MANUAL_BACKUP_PREFIX}${year}_${month}_${day}_${hours}_${minutes}_${seconds}.json.gz`;
}

function buildUtcDate(
  yearRaw: string,
  monthRaw: string,
  dayRaw: string,
  hourRaw: string,
  minuteRaw: string,
  secondRaw: string,
): Date | null {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }

  return date;
}

function parseBackupDate(filename: string): Date | null {
  const autoMatch = filename.match(AUTO_BACKUP_REGEX);
  if (autoMatch) {
    const [, year, month, day] = autoMatch;
    return buildUtcDate(year, month, day, "0", "0", "0");
  }

  const manualMatch = filename.match(MANUAL_BACKUP_REGEX);
  if (manualMatch) {
    const [, year, month, day, hours, minutes, seconds] = manualMatch;
    return buildUtcDate(year, month, day, hours, minutes, seconds);
  }

  return null;
}

function getBackupType(filename: string): "auto" | "manual" | null {
  if (AUTO_BACKUP_PATTERN.test(filename)) return "auto";
  if (MANUAL_BACKUP_PATTERN.test(filename)) return "manual";
  return null;
}

async function createSnapshot(): Promise<BackupSnapshot> {
  const [
    users,
    sessions,
    settings,
    pipelineRuns,
    jobs,
    stageEvents,
    tasks,
    interviews,
    jobChatThreads,
    jobChatMessages,
    jobChatRuns,
  ] = await Promise.all([
    db.select().from(schema.users).orderBy(asc(schema.users.username), asc(schema.users.id)),
    db
      .select()
      .from(schema.sessions)
      .orderBy(asc(schema.sessions.createdAt), asc(schema.sessions.id)),
    db.select().from(schema.settings).orderBy(asc(schema.settings.key)),
    db
      .select()
      .from(schema.pipelineRuns)
      .orderBy(asc(schema.pipelineRuns.startedAt), asc(schema.pipelineRuns.id)),
    db.select().from(schema.jobs).orderBy(asc(schema.jobs.createdAt), asc(schema.jobs.id)),
    db
      .select()
      .from(schema.stageEvents)
      .orderBy(asc(schema.stageEvents.occurredAt), asc(schema.stageEvents.id)),
    db.select().from(schema.tasks).orderBy(asc(schema.tasks.id)),
    db
      .select()
      .from(schema.interviews)
      .orderBy(asc(schema.interviews.scheduledAt), asc(schema.interviews.id)),
    db
      .select()
      .from(schema.jobChatThreads)
      .orderBy(asc(schema.jobChatThreads.createdAt), asc(schema.jobChatThreads.id)),
    db
      .select()
      .from(schema.jobChatMessages)
      .orderBy(asc(schema.jobChatMessages.createdAt), asc(schema.jobChatMessages.id)),
    db
      .select()
      .from(schema.jobChatRuns)
      .orderBy(asc(schema.jobChatRuns.startedAt), asc(schema.jobChatRuns.id)),
  ]);

  return {
    format: "job-ops-backup-v1",
    createdAt: new Date().toISOString(),
    tables: {
      users,
      sessions,
      settings,
      pipelineRuns,
      jobs,
      stageEvents,
      tasks,
      interviews,
      jobChatThreads,
      jobChatMessages,
      jobChatRuns,
    },
  };
}

function parseSnapshot(raw: string): BackupSnapshot {
  const parsed = JSON.parse(raw) as Partial<BackupSnapshot>;
  if (parsed.format !== "job-ops-backup-v1" || !parsed.tables) {
    throw new Error("Invalid backup snapshot format");
  }
  return parsed as BackupSnapshot;
}

export async function createBackup(type: "auto" | "manual"): Promise<string> {
  const backupDir = await ensureBackupDir();
  const baseFilename = generateBackupFilename(type);
  let filename = baseFilename;
  let backupPath = path.join(backupDir, filename);

  const tryReserve = async (candidatePath: string): Promise<boolean> => {
    try {
      const handle = await fs.promises.open(candidatePath, "wx");
      await handle.close();
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  };

  if (type === "auto") {
    const reserved = await tryReserve(backupPath);
    if (!reserved) {
      logger.info("Auto backup already exists for current UTC day", {
        filename,
        route: "backup",
      });
      return filename;
    }
  } else {
    const baseName = baseFilename.replace(/\.json\.gz$/, "");
    let sequence = 0;

    while (sequence <= 100) {
      const candidate =
        sequence === 0 ? baseFilename : `${baseName}_${sequence}.json.gz`;
      const candidatePath = path.join(backupDir, candidate);
      const reserved = await tryReserve(candidatePath);
      if (reserved) {
        filename = candidate;
        backupPath = candidatePath;
        break;
      }
      sequence += 1;
    }

    if (!fs.existsSync(backupPath)) {
      throw new Error("Failed to create unique manual backup filename");
    }
  }

  try {
    const snapshot = await createSnapshot();
    const payload = await gzipAsync(JSON.stringify(snapshot, null, 2));
    await fs.promises.writeFile(backupPath, payload);
  } catch (error) {
    await fs.promises.unlink(backupPath).catch(() => undefined);
    throw error;
  }

  const stats = await fs.promises.stat(backupPath);
  logger.info("Created backup snapshot", {
    filename,
    type,
    size: stats.size,
    route: "backup",
  });

  return filename;
}

export async function listBackups(): Promise<BackupInfo[]> {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = await fs.promises.readdir(backupDir);
  const backupFiles = files.filter((file) => {
    return AUTO_BACKUP_PATTERN.test(file) || MANUAL_BACKUP_PATTERN.test(file);
  });

  const backups: BackupInfo[] = [];
  for (const filename of backupFiles) {
    const filePath = path.join(backupDir, filename);
    const type = getBackupType(filename);
    const createdAt = parseBackupDate(filename);

    if (type && createdAt) {
      const stats = await fs.promises.stat(filePath);
      backups.push({
        filename,
        type,
        size: stats.size,
        createdAt: createdAt.toISOString(),
      });
    }
  }

  backups.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return backups;
}

export async function deleteBackup(filename: string): Promise<void> {
  if (
    !AUTO_BACKUP_PATTERN.test(filename) &&
    !MANUAL_BACKUP_PATTERN.test(filename)
  ) {
    throw new Error("Invalid backup filename");
  }

  const filePath = path.join(getBackupDir(), filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup not found: ${filename}`);
  }

  await fs.promises.unlink(filePath);
  logger.info("Deleted backup snapshot", {
    filename,
    route: "backup",
  });
}

export async function restoreBackup(filename: string): Promise<void> {
  if (
    !AUTO_BACKUP_PATTERN.test(filename) &&
    !MANUAL_BACKUP_PATTERN.test(filename)
  ) {
    throw new Error("Invalid backup filename");
  }

  const filePath = path.join(getBackupDir(), filename);
  const compressed = await fs.promises.readFile(filePath);
  const snapshot = parseSnapshot(
    (await gunzipAsync(compressed)).toString("utf-8"),
  );

  await db.transaction(async (tx) => {
    await tx.delete(schema.jobChatRuns);
    await tx.delete(schema.jobChatMessages);
    await tx.delete(schema.jobChatThreads);
    await tx.delete(schema.interviews);
    await tx.delete(schema.tasks);
    await tx.delete(schema.stageEvents);
    await tx.delete(schema.sessions);
    await tx.delete(schema.users);
    await tx.delete(schema.jobs);
    await tx.delete(schema.pipelineRuns);
    await tx.delete(schema.settings);

    if (snapshot.tables.users.length > 0) {
      await tx.insert(schema.users).values(snapshot.tables.users);
    }
    if (snapshot.tables.sessions.length > 0) {
      await tx.insert(schema.sessions).values(snapshot.tables.sessions);
    }
    if (snapshot.tables.settings.length > 0) {
      await tx.insert(schema.settings).values(snapshot.tables.settings);
    }
    if (snapshot.tables.pipelineRuns.length > 0) {
      await tx.insert(schema.pipelineRuns).values(snapshot.tables.pipelineRuns);
    }
    if (snapshot.tables.jobs.length > 0) {
      await tx.insert(schema.jobs).values(snapshot.tables.jobs);
    }
    if (snapshot.tables.stageEvents.length > 0) {
      await tx.insert(schema.stageEvents).values(snapshot.tables.stageEvents);
    }
    if (snapshot.tables.tasks.length > 0) {
      await tx.insert(schema.tasks).values(snapshot.tables.tasks);
    }
    if (snapshot.tables.interviews.length > 0) {
      await tx.insert(schema.interviews).values(snapshot.tables.interviews);
    }
    if (snapshot.tables.jobChatThreads.length > 0) {
      await tx
        .insert(schema.jobChatThreads)
        .values(snapshot.tables.jobChatThreads);
    }
    if (snapshot.tables.jobChatMessages.length > 0) {
      await tx
        .insert(schema.jobChatMessages)
        .values(snapshot.tables.jobChatMessages);
    }
    if (snapshot.tables.jobChatRuns.length > 0) {
      await tx.insert(schema.jobChatRuns).values(snapshot.tables.jobChatRuns);
    }
  });

  logger.info("Restored backup snapshot", {
    filename,
    route: "backup",
  });
}

export async function cleanupOldBackups(): Promise<void> {
  const backups = await listBackups();
  const autoBackups = backups
    .filter((backup) => backup.type === "auto")
    .sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const maxCount = currentSettings.maxCount;
  if (autoBackups.length <= maxCount) {
    return;
  }

  const toDelete = autoBackups.slice(0, autoBackups.length - maxCount);
  for (const backup of toDelete) {
    try {
      await deleteBackup(backup.filename);
    } catch (error) {
      logger.warn("Failed to delete old backup snapshot", {
        filename: backup.filename,
        error: sanitizeUnknown(error),
      });
    }
  }

  logger.info("Cleaned up old automatic backups", {
    deleted: toDelete.length,
    maxCount,
    route: "backup",
  });
}

export function setBackupSettings(settings: Partial<BackupSettings>): void {
  const oldEnabled = currentSettings.enabled;
  const oldHour = currentSettings.hour;

  currentSettings = { ...currentSettings, ...settings };

  logger.info("Backup settings updated", {
    enabled: currentSettings.enabled,
    hour: currentSettings.hour,
    maxCount: currentSettings.maxCount,
    route: "backup",
  });

  if (currentSettings.enabled) {
    if (!oldEnabled || oldHour !== currentSettings.hour) {
      scheduler.start(currentSettings.hour);
    }
  } else if (oldEnabled && !currentSettings.enabled) {
    scheduler.stop();
  }
}

export function getBackupSettings(): BackupSettings {
  return { ...currentSettings };
}

export function getNextBackupTime(): string | null {
  return scheduler.getNextRun();
}

export function isBackupSchedulerRunning(): boolean {
  return scheduler.isRunning();
}

export function startBackupScheduler(): void {
  if (currentSettings.enabled) {
    scheduler.start(currentSettings.hour);
  }
}

export function stopBackupScheduler(): void {
  scheduler.stop();
}
