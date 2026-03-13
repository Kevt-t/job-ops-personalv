import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "./test-utils";

function getSetCookie(response: Response): string {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const values =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(
          (value): value is string => typeof value === "string",
        );
  const [cookie] = values;
  if (!cookie) {
    throw new Error("Missing session cookie");
  }
  return cookie;
}

describe.sequential("Auth API routes", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => Promise<void>;
  let tempDir: string;

  beforeEach(() => {
    server = undefined as unknown as Server;
    baseUrl = "";
    closeDb = async () => {};
    tempDir = "";
  });

  afterEach(async () => {
    if (server) {
      await stopServer({ server, closeDb, tempDir });
    }
  });

  it("reports first-run setup when no users exist", async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer({ auth: false }));

    const response = await fetch(`${baseUrl}/api/auth/status`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      needsSetup: true,
      authRequired: true,
    });
  });

  it("registers the first owner and returns the active session", async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer({ auth: false }));

    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Owner",
        password: "password123",
      }),
    });
    const registerBody = await registerResponse.json();
    const cookie = getSetCookie(registerResponse);

    expect(registerResponse.status).toBe(201);
    expect(registerBody.ok).toBe(true);
    expect(registerBody.data.user.username).toBe("owner");
    expect(registerBody.data.user.role).toBe("user");

    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie },
    });
    const meBody = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(meBody.ok).toBe(true);
    expect(meBody.data.user.username).toBe("owner");
  });

  it("allows the owner to create a coach and blocks coach writes", async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer({ auth: false }));

    const ownerRegister = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "owner",
        password: "password123",
      }),
    });
    const ownerCookie = getSetCookie(ownerRegister);

    const createCoachResponse = await fetch(`${baseUrl}/api/auth/coaches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: ownerCookie,
      },
      body: JSON.stringify({
        username: "coach",
        password: "password123",
      }),
    });
    const createCoachBody = await createCoachResponse.json();

    expect(createCoachResponse.status).toBe(201);
    expect(createCoachBody.ok).toBe(true);
    expect(createCoachBody.data.coach.username).toBe("coach");

    const coachLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "coach",
        password: "password123",
      }),
    });
    const coachCookie = getSetCookie(coachLoginResponse);

    const readResponse = await fetch(`${baseUrl}/api/settings`, {
      headers: { cookie: coachCookie },
    });
    expect(readResponse.status).toBe(200);

    const writeResponse = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: coachCookie,
      },
      body: JSON.stringify({ model: "gpt-4.1-mini" }),
    });
    const writeBody = await writeResponse.json();

    expect(writeResponse.status).toBe(403);
    expect(writeBody.ok).toBe(false);
    expect(writeBody.error.code).toBe("FORBIDDEN");
  });

  it("disables auth endpoints in demo mode", async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer({
      auth: false,
      env: { DEMO_MODE: "true" },
    }));

    const statusResponse = await fetch(`${baseUrl}/api/auth/status`);
    const statusBody = await statusResponse.json();

    expect(statusResponse.status).toBe(200);
    expect(statusBody.ok).toBe(true);
    expect(statusBody.data).toEqual({
      needsSetup: false,
      authRequired: false,
    });

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "coach",
        password: "password123",
      }),
    });
    const loginBody = await loginResponse.json();

    expect(loginResponse.status).toBe(403);
    expect(loginBody.ok).toBe(false);
    expect(loginBody.error.code).toBe("FORBIDDEN");
  });
});
