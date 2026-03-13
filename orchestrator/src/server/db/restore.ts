/**
 * Restore a logical backup snapshot into the configured PostgreSQL database.
 */

import "../config/env";
import { closeDb } from "./index";
import "./migrate";
import { restoreBackup } from "../services/backup/index";

const filename = process.argv[2];

if (!filename) {
  console.error("Usage: npm --workspace orchestrator run db:restore -- <backup-filename>");
  process.exit(1);
}

try {
  await restoreBackup(filename);
  console.log(`Restored backup: ${filename}`);
} catch (error) {
  console.error("Backup restore failed:", error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
