/**
 * Database connection and initialization.
 */

import { logger } from "@infra/logger";
import { sanitizeUnknown } from "@infra/sanitize";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { buildPoolConfig } from "./config";
import * as schema from "./schema";

export const pool = new Pool(buildPoolConfig());

pool.on("error", (error) => {
  logger.error("Unexpected Postgres pool error", {
    error: sanitizeUnknown(error),
  });
});

export const db = drizzle(pool, { schema });

export { schema };

export async function closeDb() {
  await pool.end();
}
