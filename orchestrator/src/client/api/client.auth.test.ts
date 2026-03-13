import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUnauthorizedHandler } from "../lib/auth";
import * as api from "./client";

function createJsonResponse(status: number, payload: unknown): Response {
  return {
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe("API client session auth handling", () => {
  const unauthorizedHandler = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    api.__resetApiClientAuthForTests();
    unauthorizedHandler.mockReset();
    setUnauthorizedHandler(unauthorizedHandler);
  });

  afterEach(() => {
    api.__resetApiClientAuthForTests();
    setUnauthorizedHandler(null);
  });

  it("notifies the unauthorized handler for protected 401 responses", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(
      createJsonResponse(401, {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
        meta: { requestId: "req-1" },
      }),
    );

    await expect(api.runPipeline()).rejects.toThrow("Authentication required");
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/pipeline/run",
      expect.objectContaining({
        credentials: "same-origin",
        method: "POST",
      }),
    );
  });

  it("does not notify the unauthorized handler for login failures", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      createJsonResponse(401, {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
        meta: { requestId: "req-1" },
      }),
    );

    await expect(
      api.authLogin({ username: "owner", password: "wrong-password" }),
    ).rejects.toThrow("Authentication required");
    expect(unauthorizedHandler).not.toHaveBeenCalled();
  });
});
