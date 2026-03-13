import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

vi.mock("@server/pipeline/index", () => {
  const progress = {
    step: "idle",
    message: "Ready",
    crawlingSource: null,
    crawlingSourcesCompleted: 0,
    crawlingSourcesTotal: 0,
    crawlingTermsProcessed: 0,
    crawlingTermsTotal: 0,
    crawlingListPagesProcessed: 0,
    crawlingListPagesTotal: 0,
    crawlingJobCardsFound: 0,
    crawlingJobPagesEnqueued: 0,
    crawlingJobPagesSkipped: 0,
    crawlingJobPagesProcessed: 0,
    jobsDiscovered: 0,
    jobsScored: 0,
    jobsProcessed: 0,
    totalToProcess: 0,
  };

  return {
    runPipeline: vi.fn().mockResolvedValue({
      success: true,
      jobsDiscovered: 0,
      jobsProcessed: 0,
    }),
    processJob: vi.fn().mockResolvedValue({ success: true }),
    summarizeJob: vi.fn().mockResolvedValue({ success: true }),
    generateFinalPdf: vi.fn().mockResolvedValue({ success: true }),
    getPipelineStatus: vi.fn(() => ({ isRunning: false })),
    requestPipelineCancel: vi.fn(() => ({
      accepted: false,
      pipelineRunId: null,
      alreadyRequested: false,
    })),
    isPipelineCancelRequested: vi.fn(() => false),
    subscribeToProgress: vi.fn((listener: (data: unknown) => void) => {
      listener(progress);
      return () => {};
    }),
    progressHelpers: {
      complete: vi.fn(),
    },
  };
});

vi.mock("@server/services/manualJob", () => ({
  inferManualJobDetails: vi.fn(),
}));

vi.mock("@server/services/scorer", () => ({
  scoreJobSuitability: vi.fn(),
}));

vi.mock("@server/services/profile", () => ({
  getProfile: vi.fn().mockResolvedValue({}),
}));

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch.bind(globalThis);
const authCookiesByBaseUrl = new Map<string, string>();

function extractSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

function installAuthenticatedFetchWrapper() {
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const match = Array.from(authCookiesByBaseUrl.entries()).find(([baseUrl]) =>
      requestUrl.startsWith(baseUrl),
    );

    const nextInit: RequestInit = init ? { ...init } : {};
    if (match) {
      const [baseUrl, cookie] = match;
      const headers = new Headers(init?.headers);
      if (!headers.has("cookie")) {
        headers.set("cookie", cookie);
      }
      nextInit.headers = headers;
      const response = await originalFetch(input, nextInit);
      const setCookies = extractSetCookieHeaders(response);
      if (setCookies.length > 0) {
        authCookiesByBaseUrl.set(baseUrl, setCookies[0]);
      }
      return response;
    }

    return originalFetch(input, nextInit);
  }) as typeof globalThis.fetch;
}

function maybeRestoreFetch() {
  if (authCookiesByBaseUrl.size === 0) {
    globalThis.fetch = originalFetch;
  }
}

export async function startServer(options?: {
  env?: Record<string, string | undefined>;
  auth?: boolean;
}): Promise<{
  server: Server;
  baseUrl: string;
  closeDb: () => void;
  tempDir: string;
}> {
  vi.resetModules();
  const tempDir = await mkdtemp(join(tmpdir(), "job-ops-api-test-"));
  const envOverrides = options?.env ?? {};
  process.env = {
    ...originalEnv,
    DATA_DIR: tempDir,
    NODE_ENV: "test",
    MODEL: "test-model",
    JOBSPY_SEARCH_TERMS: "alpha|beta",
    ...envOverrides,
  };

  await import("@server/db/migrate");
  const { applyStoredEnvOverrides } = await import(
    "@server/services/envSettings"
  );
  const { createApp } = await import("../../app");
  const { closeDb } = await import("@server/db/index");
  const { getPipelineStatus } = await import("@server/pipeline/index");
  vi.mocked(getPipelineStatus).mockReturnValue({ isRunning: false });

  await applyStoredEnvOverrides();

  const app = createApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) =>
    server.once("listening", () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve server address");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const shouldBootstrapAuth =
    options?.auth ??
    !["1", "true", "yes"].includes(
      String(envOverrides.DEMO_MODE ?? "").toLowerCase(),
    );
  if (shouldBootstrapAuth) {
    const response = await originalFetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "owner",
        password: "password123",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to bootstrap auth for tests (${response.status})`);
    }

    const [setCookie] = extractSetCookieHeaders(response);
    if (!setCookie) {
      throw new Error("Missing auth session cookie during test bootstrap");
    }

    authCookiesByBaseUrl.set(baseUrl, setCookie);
    installAuthenticatedFetchWrapper();
  }

  return {
    server,
    baseUrl,
    closeDb,
    tempDir,
  };
}

export async function stopServer(args: {
  server: Server;
  closeDb: () => void;
  tempDir?: string;
}) {
  const address = args.server?.address();
  // Defensive: if startServer throws, callers may still run cleanup.
  if (args.server) {
    await new Promise<void>((resolve) => args.server.close(() => resolve()));
  }
  if (args.closeDb) {
    args.closeDb();
  }
  if (args.tempDir) {
    await rm(args.tempDir, { recursive: true, force: true });
  }
  if (address && typeof address !== "string") {
    authCookiesByBaseUrl.delete(`http://127.0.0.1:${address.port}`);
  }
  maybeRestoreFetch();
  process.env = { ...originalEnv };
  vi.clearAllMocks();
}
