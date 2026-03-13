/**
 * Database utility scripts.
 */

import { count, sql } from "drizzle-orm";
import { closeDb, db, schema } from "./index";

/**
 * Clear job and pipeline data from the database while preserving settings/auth.
 */
export async function clearDatabase(): Promise<{
  jobsDeleted: number;
  runsDeleted: number;
}> {
  const [[jobCount], [runCount]] = await Promise.all([
    db.select({ value: count(schema.jobs.id) }).from(schema.jobs),
    db.select({ value: count(schema.pipelineRuns.id) }).from(schema.pipelineRuns),
  ]);

  await db.execute(sql`DELETE FROM pipeline_runs`);
  await db.execute(sql`DELETE FROM jobs`);

  const jobsDeleted = jobCount?.value ?? 0;
  const runsDeleted = runCount?.value ?? 0;

  console.log(
    `Cleared database: ${jobsDeleted} jobs, ${runsDeleted} pipeline runs`,
  );

  return {
    jobsDeleted,
    runsDeleted,
  };
}

/**
 * Drop and recreate the public schema for the current database.
 */
export async function dropDatabase(): Promise<void> {
  await db.execute(sql.raw("DROP SCHEMA IF EXISTS public CASCADE"));
  await db.execute(sql.raw("CREATE SCHEMA public"));
  console.log("Database schema dropped");
}

if (process.argv[1]?.includes("clear.ts")) {
  const arg = process.argv[2];

  try {
    if (arg === "--drop") {
      await dropDatabase();
    } else {
      await clearDatabase();
    }
  } finally {
    await closeDb();
  }
}
