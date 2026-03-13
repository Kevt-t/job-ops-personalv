import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createTestDatabase } from "@server/db/test-database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/config/dataDir", () => ({
  getDataDir: vi.fn(),
}));

import { getDataDir } from "@server/config/dataDir";

const originalEnv = { ...process.env };

describe.sequential("Backup Service", () => {
  let tempDir: string;
  let backup: typeof import("./index");
  let db: typeof import("@server/db/index").db;
  let schema: typeof import("@server/db/index").schema;
  let closeDb: typeof import("@server/db/index").closeDb;
  let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    vi.resetModules();

    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "backup-test-"));
    testDatabase = await createTestDatabase();
    process.env = {
      ...originalEnv,
      DATA_DIR: tempDir,
      DATABASE_URL: testDatabase.databaseUrl,
      NODE_ENV: "test",
      MODEL: "test-model",
    };

    vi.mocked(getDataDir).mockReturnValue(tempDir);

    await import("@server/db/migrate");
    const dbModule = await import("@server/db/index");
    db = dbModule.db;
    schema = dbModule.schema;
    closeDb = dbModule.closeDb;
    backup = await import("./index");

    await db.insert(schema.jobs).values({
      id: "job-1",
      source: "manual",
      title: "Test Job",
      employer: "Example Corp",
      jobUrl: "https://example.com/jobs/1",
      status: "discovered",
    });

    backup.setBackupSettings({ enabled: false, hour: 2, maxCount: 5 });
    backup.stopBackupScheduler();
  });

  afterEach(async () => {
    await closeDb();
    await testDatabase.cleanup();
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  function readSnapshot(filename: string) {
    const filePath = path.join(tempDir, "backups", filename);
    const compressed = fs.readFileSync(filePath);
    return JSON.parse(gunzipSync(compressed).toString("utf-8")) as {
      format: string;
      tables: {
        jobs: Array<{ id: string; title: string }>;
      };
    };
  }

  describe("createBackup", () => {
    it("creates an automatic snapshot with the expected filename", async () => {
      const filename = await backup.createBackup("auto");

      expect(filename).toMatch(/^jobs_\d{4}_\d{2}_\d{2}\.json\.gz$/);
      expect(fs.existsSync(path.join(tempDir, "backups", filename))).toBe(true);

      const snapshot = readSnapshot(filename);
      expect(snapshot.format).toBe("job-ops-backup-v1");
      expect(snapshot.tables.jobs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "job-1",
            title: "Test Job",
          }),
        ]),
      );
    });

    it("creates a manual snapshot with the expected filename", async () => {
      const filename = await backup.createBackup("manual");

      expect(filename).toMatch(
        /^jobs_manual_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}\.json\.gz$/,
      );
      expect(fs.existsSync(path.join(tempDir, "backups", filename))).toBe(true);
    });

    it("adds a suffix when a manual filename collides", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        const frozen = new Date("2026-01-15T12:30:45Z");
        vi.setSystemTime(frozen);

        const first = await backup.createBackup("manual");
        const second = await backup.createBackup("manual");

        const year = frozen.getFullYear();
        const month = String(frozen.getMonth() + 1).padStart(2, "0");
        const day = String(frozen.getDate()).padStart(2, "0");
        const hours = String(frozen.getHours()).padStart(2, "0");
        const minutes = String(frozen.getMinutes()).padStart(2, "0");
        const seconds = String(frozen.getSeconds()).padStart(2, "0");
        const expectedBase =
          `jobs_manual_${year}_${month}_${day}_${hours}_${minutes}_${seconds}`;

        expect(first).toBe(`${expectedBase}.json.gz`);
        expect(second).toBe(`${expectedBase}_1.json.gz`);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("listBackups", () => {
    it("returns an empty list when no snapshots exist", async () => {
      const backups = await backup.listBackups();
      expect(backups).toEqual([]);
    });

    it("lists snapshots with metadata", async () => {
      await backup.createBackup("auto");
      await backup.createBackup("manual");

      const backups = await backup.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0]).toHaveProperty("filename");
      expect(backups[0]).toHaveProperty("type");
      expect(backups[0]).toHaveProperty("size");
      expect(backups[0]).toHaveProperty("createdAt");
    });

    it("sorts snapshots by date descending", async () => {
      await fs.promises.mkdir(path.join(tempDir, "backups"), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, "backups", "jobs_2026_01_01.json.gz"),
        "old",
      );
      await fs.promises.writeFile(
        path.join(tempDir, "backups", "jobs_2026_01_15.json.gz"),
        "new",
      );

      const backups = await backup.listBackups();

      expect(backups[0].filename).toBe("jobs_2026_01_15.json.gz");
      expect(backups[1].filename).toBe("jobs_2026_01_01.json.gz");
    });

    it("ignores non-backup files", async () => {
      await backup.createBackup("auto");
      await fs.promises.writeFile(path.join(tempDir, "backups", "random.txt"), "x");

      const backups = await backup.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].filename).toMatch(/^jobs_\d{4}_\d{2}_\d{2}\.json\.gz$/);
    });
  });

  describe("deleteBackup", () => {
    it("deletes a backup file", async () => {
      const filename = await backup.createBackup("auto");
      const filePath = path.join(tempDir, "backups", filename);

      expect(fs.existsSync(filePath)).toBe(true);

      await backup.deleteBackup(filename);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it("rejects invalid filenames", async () => {
      await expect(backup.deleteBackup("../../../etc/passwd")).rejects.toThrow(
        "Invalid backup filename",
      );
      await expect(backup.deleteBackup("random.txt")).rejects.toThrow(
        "Invalid backup filename",
      );
    });

    it("rejects missing backups", async () => {
      await expect(
        backup.deleteBackup("jobs_2026_01_01.json.gz"),
      ).rejects.toThrow("Backup not found");
    });
  });

  describe("cleanupOldBackups", () => {
    it("deletes oldest automatic snapshots when above retention", async () => {
      await fs.promises.mkdir(path.join(tempDir, "backups"), { recursive: true });
      for (let i = 1; i <= 7; i += 1) {
        const filename = `jobs_2026_01_${String(i).padStart(2, "0")}.json.gz`;
        await fs.promises.writeFile(path.join(tempDir, "backups", filename), "x");
      }

      backup.setBackupSettings({ maxCount: 5 });
      await backup.cleanupOldBackups();

      const remaining = await backup.listBackups();
      const filenames = remaining.map((entry) => entry.filename);
      expect(remaining).toHaveLength(5);
      expect(filenames).toContain("jobs_2026_01_03.json.gz");
      expect(filenames).toContain("jobs_2026_01_07.json.gz");
      expect(filenames).not.toContain("jobs_2026_01_01.json.gz");
      expect(filenames).not.toContain("jobs_2026_01_02.json.gz");
    });

    it("preserves manual snapshots during cleanup", async () => {
      await fs.promises.mkdir(path.join(tempDir, "backups"), { recursive: true });
      for (let i = 1; i <= 7; i += 1) {
        const filename = `jobs_2026_01_${String(i).padStart(2, "0")}.json.gz`;
        await fs.promises.writeFile(path.join(tempDir, "backups", filename), "x");
      }
      await fs.promises.writeFile(
        path.join(tempDir, "backups", "jobs_manual_2026_01_01_12_00_00.json.gz"),
        "manual",
      );

      backup.setBackupSettings({ maxCount: 5 });
      await backup.cleanupOldBackups();

      const remaining = await backup.listBackups();
      expect(remaining.filter((entry) => entry.type === "auto")).toHaveLength(5);
      expect(remaining.filter((entry) => entry.type === "manual")).toHaveLength(1);
    });
  });

  describe("scheduler integration", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("starts the scheduler when enabled", () => {
      vi.setSystemTime(new Date("2026-01-15T10:00:00Z"));

      expect(backup.isBackupSchedulerRunning()).toBe(false);
      backup.setBackupSettings({ enabled: true, hour: 14 });

      expect(backup.isBackupSchedulerRunning()).toBe(true);
      expect(backup.getNextBackupTime()).not.toBeNull();
    });

    it("stops the scheduler when disabled", () => {
      backup.setBackupSettings({ enabled: true, hour: 14 });
      expect(backup.isBackupSchedulerRunning()).toBe(true);

      backup.setBackupSettings({ enabled: false });
      expect(backup.isBackupSchedulerRunning()).toBe(false);
      expect(backup.getNextBackupTime()).toBeNull();
    });
  });
});
