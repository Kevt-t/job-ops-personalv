import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "jobops_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  };
}

export function setSessionCookie(res: Response, token: string, expiresAt: number) {
  const computed = expiresAt * 1000 - Date.now();
  const maxAge = computed > 0 ? computed : SESSION_MAX_AGE_MS;
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...getCookieOptions(),
    maxAge,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, getCookieOptions());
}

export function getSessionTokenFromRequest(req: Request): string | null {
  const rawCookie = req.header("cookie");
  if (!rawCookie) return null;

  const pairs = rawCookie.split(";");
  for (const pair of pairs) {
    const [rawName, ...rawValueParts] = pair.trim().split("=");
    if (rawName !== SESSION_COOKIE_NAME) continue;
    const rawValue = rawValueParts.join("=");
    if (!rawValue) return null;
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

export function getSessionMaxAgeMs(): number {
  return SESSION_MAX_AGE_MS;
}
