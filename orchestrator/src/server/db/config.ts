import type { PoolConfig } from "pg";

const DEFAULT_TEST_DATABASE_ADMIN_URL =
  "postgresql://jobops:jobops@127.0.0.1:5432/postgres";

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "DATABASE_URL is required. Use a local Postgres URL or a Neon connection string.",
    );
  }
  return value;
}

export function getTestDatabaseAdminUrl(): string {
  const configured = process.env.TEST_DATABASE_ADMIN_URL?.trim();
  if (configured) return configured;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    parsed.pathname = "/postgres";
    return parsed.toString();
  }

  return DEFAULT_TEST_DATABASE_ADMIN_URL;
}

function shouldEnableSsl(connectionString: string): boolean {
  const override = parseBooleanEnv(process.env.DATABASE_SSL);
  if (override !== null) return override;

  const parsed = new URL(connectionString);
  const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
  if (sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full") {
    return true;
  }

  return parsed.hostname.includes("neon.tech");
}

export function buildPoolConfig(
  connectionString: string = getDatabaseUrl(),
): PoolConfig {
  return {
    connectionString,
    ...(shouldEnableSsl(connectionString)
      ? {
          ssl: {
            rejectUnauthorized: false,
          },
        }
      : {}),
  };
}

export function withDatabaseName(
  connectionString: string,
  databaseName: string,
): string {
  const parsed = new URL(connectionString);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}
