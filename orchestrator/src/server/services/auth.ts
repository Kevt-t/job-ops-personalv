import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { conflict, forbidden, notFound, unauthorized } from "@infra/errors";
import type { AuthRole, AuthSessionPayload, AuthUser, CoachAccountSummary } from "@shared/types";
import { db } from "@server/db/index";
import * as sessionsRepo from "@server/repositories/sessions";
import * as usersRepo from "@server/repositories/users";
import { getSessionMaxAgeMs } from "./auth-cookie";

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function toAuthUser(user: {
  id: string;
  username: string;
  role: AuthRole;
}): AuthUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

function toCoachSummary(user: {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}): CoachAccountSummary {
  return {
    id: user.id,
    username: user.username,
    role: "coach",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildSessionExpiry(now = Date.now()): number {
  return Math.floor((now + getSessionMaxAgeMs()) / 1000);
}

export async function isFirstUser(): Promise<boolean> {
  return (await usersRepo.countUsers()) === 0;
}

export async function register(input: {
  username: string;
  password: string;
}): Promise<AuthSessionPayload & { token: string }> {
  const username = normalizeUsername(input.username);
  const passwordHash = await bcrypt.hash(input.password, 10);

  // Wrap the first-user check and insert in a transaction to prevent
  // a TOCTOU race where two concurrent requests both pass isFirstUser().
  const created = db.transaction(() => {
    const userCount = usersRepo.countUsersSync();
    if (userCount > 0) {
      return null;
    }
    return usersRepo.createUserSync({
      username,
      passwordHash,
      role: "user",
    });
  });

  if (!created) {
    throw forbidden("Registration is closed");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = buildSessionExpiry();
  await sessionsRepo.create({
    userId: created.id,
    token,
    expiresAt,
  });

  return {
    user: toAuthUser(created),
    token,
    expiresAt,
  };
}

export async function login(input: {
  username: string;
  password: string;
}): Promise<AuthSessionPayload & { token: string }> {
  await sessionsRepo.deleteExpired(Math.floor(Date.now() / 1000));
  const username = normalizeUsername(input.username);
  const user = await usersRepo.findByUsername(username);
  if (!user) {
    throw unauthorized("Invalid username or password");
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw unauthorized("Invalid username or password");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = buildSessionExpiry();
  await sessionsRepo.create({
    userId: user.id,
    token,
    expiresAt,
  });

  return {
    user: toAuthUser(user),
    token,
    expiresAt,
  };
}

export async function createCoach(input: {
  actor: AuthUser;
  username: string;
  password: string;
}): Promise<CoachAccountSummary> {
  if (input.actor.role !== "user") {
    throw forbidden("Only the owner can manage coach accounts");
  }

  const username = normalizeUsername(input.username);
  const existing = await usersRepo.findByUsername(username);
  if (existing) {
    throw conflict("Username is already in use");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const created = await usersRepo.createUser({
    username,
    passwordHash,
    role: "coach",
  });

  if (!created) {
    throw new Error("Failed to create coach account");
  }

  return toCoachSummary(created);
}

export async function listCoaches(actor: AuthUser): Promise<CoachAccountSummary[]> {
  if (actor.role !== "user") {
    throw forbidden("Only the owner can manage coach accounts");
  }

  const coaches = await usersRepo.listByRole("coach");
  return coaches.map(toCoachSummary);
}

export async function deleteCoach(input: {
  actor: AuthUser;
  coachId: string;
}): Promise<void> {
  if (input.actor.role !== "user") {
    throw forbidden("Only the owner can manage coach accounts");
  }

  const coach = await usersRepo.findById(input.coachId);
  if (!coach || coach.role !== "coach") {
    throw notFound("Coach account not found");
  }

  await sessionsRepo.deleteByUserId(coach.id);
  await usersRepo.deleteUser(coach.id);
}

export async function logout(token: string | null): Promise<void> {
  if (!token) return;
  await sessionsRepo.deleteByToken(token);
}

export async function validateSession(token: string | null): Promise<{
  user: AuthUser;
  token: string;
  expiresAt: number;
} | null> {
  if (!token) return null;

  const session = await sessionsRepo.findByToken(token);
  if (!session) return null;

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  if (session.expiresAt <= nowEpochSeconds) {
    await sessionsRepo.deleteExpiredToken(token, nowEpochSeconds);
    return null;
  }

  const user = await usersRepo.findById(session.userId);
  if (!user) {
    await sessionsRepo.deleteByToken(token);
    return null;
  }

  return {
    user: toAuthUser(user),
    token,
    expiresAt: session.expiresAt,
  };
}
