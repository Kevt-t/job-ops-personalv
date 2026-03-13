import { forbidden, unauthorized } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import { logger } from "@infra/logger";
import {
  clearSessionCookie,
  getSessionTokenFromRequest,
  setSessionCookie,
} from "@server/services/auth-cookie";
import {
  createCoach,
  deleteCoach,
  isFirstUser,
  listCoaches,
  login,
  logout,
  register,
} from "@server/services/auth";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { isDemoMode } from "../../config/demo";

export const authRouter = Router();

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(200),
});

const coachIdParamsSchema = z.object({
  id: z.string().uuid(),
});

function assertAuthEnabled(res: Response): boolean {
  if (!isDemoMode()) return true;
  fail(res, forbidden("Authentication is disabled in demo mode"));
  return false;
}

authRouter.get(
  "/status",
  asyncRoute(async (_req: Request, res: Response) => {
    ok(res, {
      needsSetup: isDemoMode() ? false : await isFirstUser(),
      authRequired: !isDemoMode(),
    });
  }),
);

authRouter.post(
  "/register",
  asyncRoute(async (req: Request, res: Response) => {
    if (!assertAuthEnabled(res)) return;

    const parsed = credentialsSchema.parse(req.body);
    const session = await register(parsed);
    setSessionCookie(res, session.token, session.expiresAt);
    logger.info("Owner account registered", {
      route: "POST /api/auth/register",
      userId: session.user.id,
      username: session.user.username,
    });
    ok(
      res,
      {
        user: session.user,
        expiresAt: session.expiresAt,
      },
      201,
    );
  }),
);

authRouter.post(
  "/login",
  asyncRoute(async (req: Request, res: Response) => {
    if (!assertAuthEnabled(res)) return;

    const parsed = credentialsSchema.parse(req.body);
    const session = await login(parsed);
    setSessionCookie(res, session.token, session.expiresAt);
    logger.info("User logged in", {
      route: "POST /api/auth/login",
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
    });
    ok(res, {
      user: session.user,
      expiresAt: session.expiresAt,
    });
  }),
);

authRouter.post(
  "/logout",
  asyncRoute(async (req: Request, res: Response) => {
    if (!assertAuthEnabled(res)) return;

    await logout(getSessionTokenFromRequest(req));
    clearSessionCookie(res);
    ok(res, { loggedOut: true });
  }),
);

authRouter.get(
  "/me",
  asyncRoute(async (req: Request, res: Response) => {
    if (!assertAuthEnabled(res)) return;

    if (!req.user) {
      fail(res, unauthorized("Authentication required"));
      return;
    }

    ok(res, { user: req.user });
  }),
);

authRouter.get(
  "/coaches",
  asyncRoute(async (req: Request, res: Response) => {
    if (!assertAuthEnabled(res)) return;

    if (!req.user) {
      fail(res, unauthorized("Authentication required"));
      return;
    }

    ok(res, { coaches: await listCoaches(req.user) });
  }),
);

authRouter.post(
  "/coaches",
  asyncRoute(async (req: Request, res: Response) => {
    if (!assertAuthEnabled(res)) return;

    if (!req.user) {
      fail(res, unauthorized("Authentication required"));
      return;
    }

    const parsed = credentialsSchema.parse(req.body);
    const coach = await createCoach({
      actor: req.user,
      username: parsed.username,
      password: parsed.password,
    });
    logger.info("Coach account created", {
      route: "POST /api/auth/coaches",
      actorUserId: req.user.id,
      coachId: coach.id,
      coachUsername: coach.username,
    });
    ok(res, { coach }, 201);
  }),
);

authRouter.delete(
  "/coaches/:id",
  asyncRoute(async (req: Request, res: Response) => {
    if (!assertAuthEnabled(res)) return;

    if (!req.user) {
      fail(res, unauthorized("Authentication required"));
      return;
    }

    const parsed = coachIdParamsSchema.parse(req.params);
    await deleteCoach({
      actor: req.user,
      coachId: parsed.id,
    });
    ok(res, { deleted: true });
  }),
);
