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
  const [created] = await db
    .insert(users)
    .values({
      id,
      username: input.username,
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created ?? null;
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
