import { randomUUID } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { db, schema } from "../db";

const { sessions } = schema;

export async function create(input: {
  userId: string;
  token: string;
  expiresAt: number;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.insert(sessions).values({
    id,
    userId: input.userId,
    token: input.token,
    expiresAt: input.expiresAt,
    createdAt: now,
  });
  return findByToken(input.token);
}

export async function findByToken(token: string) {
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token));
  return row ?? null;
}

export async function deleteByToken(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function deleteByUserId(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function deleteExpired(nowEpochSeconds: number) {
  await db.delete(sessions).where(lte(sessions.expiresAt, nowEpochSeconds));
}

export async function deleteExpiredToken(token: string, nowEpochSeconds: number) {
  await db
    .delete(sessions)
    .where(and(eq(sessions.token, token), lte(sessions.expiresAt, nowEpochSeconds)));
}
