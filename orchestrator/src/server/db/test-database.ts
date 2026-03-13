import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  buildPoolConfig,
  getTestDatabaseAdminUrl,
  withDatabaseName,
} from "./config";

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function createTestDatabase(): Promise<{
  databaseName: string;
  databaseUrl: string;
  cleanup: () => Promise<void>;
}> {
  const adminUrl = getTestDatabaseAdminUrl();
  const adminClient = new Client(buildPoolConfig(adminUrl));
  const databaseName = `jobops_test_${randomUUID().replaceAll("-", "")}`;

  await adminClient.connect();
  try {
    await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  } finally {
    await adminClient.end();
  }

  const databaseUrl = withDatabaseName(adminUrl, databaseName);

  return {
    databaseName,
    databaseUrl,
    cleanup: async () => {
      const client = new Client(buildPoolConfig(adminUrl));
      await client.connect();
      try {
        await client.query(
          `
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1
              AND pid <> pg_backend_pid()
          `,
          [databaseName],
        );
        await client.query(
          `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`,
        );
      } finally {
        await client.end();
      }
    },
  };
}
