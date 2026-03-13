import { randomUUID } from "node:crypto";
import type { AuthRole } from "@shared/types";
import { count, eq } from "drizzle-orm";
import { db, schema } from "../db";

const { users } = schema;

export async function findByUsername(username: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  return row ?? null;
}

export async function findById(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  role: AuthRole;
}) {
  const now = new Date().toISOString();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    username: input.username,
    passwordHash: input.passwordHash,
    role: input.role,
    createdAt: now,
    updatedAt: now,
  });
  return findById(id);
}

export async function countUsers() {
  const [row] = await db.select({ value: count(users.id) }).from(users);
  return row?.value ?? 0;
}

export async function listByRole(role: AuthRole) {
  return db.select().from(users).where(eq(users.role, role));
}

export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id));
}

/** Synchronous variant for use inside db.transaction() */
export function countUsersSync(): number {
  const row = db.select({ value: count(users.id) }).from(users).get();
  return row?.value ?? 0;
}

/** Synchronous variant for use inside db.transaction() */
export function createUserSync(input: {
  username: string;
  passwordHash: string;
  role: AuthRole;
}) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.insert(users).values({
    id,
    username: input.username,
    passwordHash: input.passwordHash,
    role: input.role,
    createdAt: now,
    updatedAt: now,
  });
  return db.select().from(users).where(eq(users.id, id)).get() ?? null;
}
