import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestDatabase } from "@server/db/test-database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe.sequential("envSettings overrides", () => {
  let tempDir: string;
  let closeDb: (() => Promise<void>) | null = null;
  let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-env-migration-test-"));
    testDatabase = await createTestDatabase();
    process.env = {
      ...originalEnv,
      DATA_DIR: tempDir,
      DATABASE_URL: testDatabase.databaseUrl,
      NODE_ENV: "test",
      MODEL: "test-model",
      LLM_API_KEY: "sk-env-default",
    };

    await import("../db/migrate");
    const dbMod = await import("../db/index");
    closeDb = dbMod.closeDb;
  });

  afterEach(async () => {
    if (closeDb) await closeDb();
    await testDatabase.cleanup();
    await rm(tempDir, { recursive: true, force: true });
    process.env = { ...originalEnv };
  });

  it("applies stored llmApiKey override to process env", async () => {
    const settingsRepo = await import("../repositories/settings");
    const { applyStoredEnvOverrides } = await import("./envSettings");

    await settingsRepo.setSetting("llmApiKey", "sk-db-override");

    await applyStoredEnvOverrides();

    expect(await settingsRepo.getSetting("llmApiKey")).toBe("sk-db-override");
    expect(process.env.LLM_API_KEY).toBe("sk-db-override");
  });

  it("restores default env value when override is explicitly cleared", async () => {
    const settingsRepo = await import("../repositories/settings");
    const { applyStoredEnvOverrides } = await import("./envSettings");

    await settingsRepo.setSetting("llmApiKey", "");

    await applyStoredEnvOverrides();

    expect(process.env.LLM_API_KEY).toBe("sk-env-default");
  });
});
