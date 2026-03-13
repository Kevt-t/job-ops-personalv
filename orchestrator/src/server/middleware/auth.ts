import { fail } from "@infra/http";
import { runWithRequestContext } from "@infra/request-context";
import { forbidden, unauthorized } from "@infra/errors";
import { isDemoMode } from "../config/demo";
import { getSessionTokenFromRequest } from "../services/auth-cookie";
import { validateSession } from "../services/auth";
import type { NextFunction, Request, Response } from "express";

function getMountedPath(req: Request): string {
  const path = `${req.baseUrl}${req.path}` || req.originalUrl || "/";
  return path.split("?")[0] || "/";
}

function isPublicApiRoute(req: Request): boolean {
  const fullPath = getMountedPath(req);
  if (!fullPath.startsWith("/api")) return false;

  const path = fullPath.slice("/api".length) || "/";

  return (
    path === "/demo/info" ||
    path === "/webhook/trigger" ||
    path === "/auth/login" ||
    path === "/auth/register" ||
    path === "/auth/status"
  );
}

function isWriteMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function isCoachAllowedWrite(req: Request): boolean {
  const fullPath = getMountedPath(req);
  if (!fullPath.startsWith("/api")) return false;
  const path = fullPath.slice("/api".length) || "/";
  return req.method.toUpperCase() === "POST" && path === "/auth/logout";
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isDemoMode() || isPublicApiRoute(req)) {
    next();
    return;
  }

  void validateSession(getSessionTokenFromRequest(req))
    .then((session) => {
      if (!session) {
        fail(res, unauthorized("Authentication required"));
        return;
      }

      req.user = session.user;
      runWithRequestContext(
        {
          userId: session.user.id,
          username: session.user.username,
          userRole: session.user.role,
        },
        () => next(),
      );
    })
    .catch(next);
}

export function requireWriteAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isDemoMode() || !isWriteMethod(req.method) || isCoachAllowedWrite(req)) {
    next();
    return;
  }

  if (!req.user) {
    fail(res, unauthorized("Authentication required"));
    return;
  }

  if (req.user.role === "coach") {
    fail(res, forbidden("Coach accounts are read-only"));
    return;
  }

  next();
}

export function requirePdfAuth(req: Request, res: Response, next: NextFunction): void {
  if (isDemoMode()) {
    next();
    return;
  }

  void validateSession(getSessionTokenFromRequest(req))
    .then((session) => {
      if (!session) {
        fail(res, unauthorized("Authentication required"));
        return;
      }

      req.user = session.user;
      runWithRequestContext(
        {
          userId: session.user.id,
          username: session.user.username,
          userRole: session.user.role,
        },
        () => next(),
      );
    })
    .catch(next);
}
