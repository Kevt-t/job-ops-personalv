import { randomUUID } from "node:crypto";
import type {
  ApplicationStage,
  ApplicationTask,
  ApplicationTaskType,
  JobOutcome,
  JobStatus,
  StageEvent,
  StageEventMetadata,
} from "@shared/types";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "../db/index";

const { jobs, stageEvents, tasks } = schema;

const STAGE_TO_STATUS: Record<ApplicationStage, JobStatus> = {
  applied: "applied",
  recruiter_screen: "in_progress",
  assessment: "in_progress",
  hiring_manager_screen: "in_progress",
  technical_interview: "in_progress",
  onsite: "in_progress",
  offer: "in_progress",
  closed: "in_progress",
};

export const stageEventMetadataSchema = z
  .object({
    note: z.string().nullable().optional(),
    actor: z.enum(["system", "user"]).optional(),
    groupId: z.string().nullable().optional(),
    groupLabel: z.string().nullable().optional(),
    eventLabel: z.string().nullable().optional(),
    externalUrl: z.string().nullable().optional(),
    reasonCode: z.string().nullable().optional(),
    eventType: z
      .enum(["interview_log", "status_update", "note"])
      .nullable()
      .optional(),
  })
  .strict();

export async function getStageEvents(
  applicationId: string,
): Promise<StageEvent[]> {
  const rows = await db
    .select()
    .from(stageEvents)
    .where(eq(stageEvents.applicationId, applicationId))
    .orderBy(asc(stageEvents.occurredAt), asc(stageEvents.id));

  return rows.map((row) => ({
    id: row.id,
    applicationId: row.applicationId,
    title: row.title,
    groupId: row.groupId ?? null,
    fromStage: row.fromStage as ApplicationStage | null,
    toStage: row.toStage as ApplicationStage,
    occurredAt: row.occurredAt,
    metadata: parseMetadata(row.metadata),
    outcome: (row.outcome as JobOutcome | null) ?? null,
  }));
}

export async function getTasks(
  applicationId: string,
  includeCompleted = false,
): Promise<ApplicationTask[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(
      includeCompleted
        ? eq(tasks.applicationId, applicationId)
        : and(
            eq(tasks.applicationId, applicationId),
            eq(tasks.isCompleted, false),
          ),
    )
    .orderBy(asc(tasks.dueDate), asc(tasks.id));

  return rows.map((row) => ({
    id: row.id,
    applicationId: row.applicationId,
    type: row.type as ApplicationTaskType,
    title: row.title,
    dueDate: row.dueDate,
    isCompleted: row.isCompleted ?? false,
    notes: row.notes ?? null,
  }));
}

export async function transitionStage(
  applicationId: string,
  toStage: ApplicationStage | "no_change",
  occurredAt?: number,
  metadata?: StageEventMetadata | null,
  outcome?: JobOutcome | null,
): Promise<StageEvent> {
  const parsedMetadata = metadata
    ? stageEventMetadataSchema.parse(metadata)
    : null;

  const now = Math.floor(Date.now() / 1000);

  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, applicationId))
      .limit(1);

    if (!job) {
      throw new Error("Job not found");
    }

    const [lastEvent] = await tx
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.applicationId, applicationId))
      .orderBy(desc(stageEvents.occurredAt), desc(stageEvents.id))
      .limit(1);

    const timestamp =
      occurredAt ?? Math.max(now, (lastEvent?.occurredAt ?? 0) + 1);

    const fromStage =
      (lastEvent?.toStage as ApplicationStage | undefined) ?? null;
    const finalToStage =
      toStage === "no_change" ? (fromStage ?? "applied") : toStage;
    const eventId = randomUUID();
    const isNoteEvent = parsedMetadata?.eventType === "note";

    await tx.insert(stageEvents).values({
      id: eventId,
      applicationId,
      title: parsedMetadata?.eventLabel ?? finalToStage,
      groupId: parsedMetadata?.groupId ?? null,
      fromStage,
      toStage: finalToStage,
      occurredAt: timestamp,
      metadata: parsedMetadata,
      outcome,
    });

    const updates: Partial<typeof jobs.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (toStage !== "no_change" && !isNoteEvent) {
      updates.status = STAGE_TO_STATUS[finalToStage];

      if (finalToStage === "applied" && !job.appliedAt) {
        updates.appliedAt = new Date().toISOString();
      }

      if (finalToStage === "closed") {
        updates.closedAt = timestamp;
      }
    }

    if (outcome) {
      updates.outcome = outcome;
      updates.closedAt = timestamp;
    }

    await tx.update(jobs).set(updates).where(eq(jobs.id, applicationId));

    return {
      id: eventId,
      applicationId,
      title: parsedMetadata?.eventLabel ?? finalToStage,
      groupId: parsedMetadata?.groupId ?? null,
      fromStage,
      toStage: finalToStage,
      occurredAt: timestamp,
      metadata: parsedMetadata,
      outcome: outcome ?? null,
    };
  });
}

export async function updateStageEvent(
  eventId: string,
  payload: {
    toStage?: ApplicationStage;
    occurredAt?: number;
    metadata?: StageEventMetadata | null;
    outcome?: JobOutcome | null;
  },
): Promise<void> {
  const { toStage, occurredAt, metadata, outcome } = payload;
  const parsedMetadata = metadata
    ? stageEventMetadataSchema.parse(metadata)
    : metadata;
  const hasOutcome = Object.hasOwn(payload, "outcome");

  await db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.id, eventId))
      .limit(1);

    if (!event) throw new Error("Event not found");

    const updates: Partial<typeof stageEvents.$inferInsert> = {};
    if (toStage) updates.toStage = toStage;
    if (occurredAt !== undefined) updates.occurredAt = occurredAt;
    if (parsedMetadata !== undefined) {
      updates.metadata = parsedMetadata;
      if (parsedMetadata?.eventLabel) updates.title = parsedMetadata.eventLabel;
      if (parsedMetadata?.groupId !== undefined) {
        updates.groupId = parsedMetadata.groupId;
      }
    }
    if (hasOutcome) updates.outcome = outcome ?? null;
    if (toStage && !hasOutcome && !isClosingStage(toStage)) {
      updates.outcome = null;
    }

    await tx.update(stageEvents).set(updates).where(eq(stageEvents.id, eventId));

    const [lastEvent] = await tx
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.applicationId, event.applicationId))
      .orderBy(desc(stageEvents.occurredAt), desc(stageEvents.id))
      .limit(1);

    if (lastEvent && lastEvent.id === eventId) {
      const [job] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.id, event.applicationId))
        .limit(1);

      if (!job) throw new Error("Job not found");

      const latestMetadata = parseMetadata(lastEvent.metadata);
      const lastStage = lastEvent.toStage as ApplicationStage;
      const resolved = resolveOutcomeAndClosedAt({
        lastStage,
        lastEventOccurredAt: lastEvent.occurredAt,
        metadata: latestMetadata,
        lastEventOutcome: (lastEvent.outcome as JobOutcome | null) ?? null,
        jobOutcome: (job.outcome as JobOutcome | null) ?? null,
        jobClosedAt: job.closedAt ?? null,
      });

      await tx
        .update(jobs)
        .set({
          status: STAGE_TO_STATUS[lastStage],
          outcome: resolved.outcome,
          closedAt: resolved.closedAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, event.applicationId));
    }
  });
}

export async function deleteStageEvent(eventId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.id, eventId))
      .limit(1);

    if (!event) return;

    await tx.delete(stageEvents).where(eq(stageEvents.id, eventId));

    const [lastEvent] = await tx
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.applicationId, event.applicationId))
      .orderBy(desc(stageEvents.occurredAt), desc(stageEvents.id))
      .limit(1);

    if (lastEvent) {
      const [job] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.id, event.applicationId))
        .limit(1);

      if (!job) throw new Error("Job not found");

      const metadata = parseMetadata(lastEvent.metadata);
      const lastStage = lastEvent.toStage as ApplicationStage;
      const resolved = resolveOutcomeAndClosedAt({
        lastStage,
        lastEventOccurredAt: lastEvent.occurredAt,
        metadata,
        lastEventOutcome: (lastEvent.outcome as JobOutcome | null) ?? null,
        jobOutcome: (job.outcome as JobOutcome | null) ?? null,
        jobClosedAt: job.closedAt ?? null,
      });

      await tx
        .update(jobs)
        .set({
          status: STAGE_TO_STATUS[lastStage],
          outcome: resolved.outcome,
          closedAt: resolved.closedAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, event.applicationId));
      return;
    }

    await tx
      .update(jobs)
      .set({
        status: "discovered",
        appliedAt: null,
        outcome: null,
        closedAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, event.applicationId));
  });
}

function parseMetadata(raw: unknown): StageEventMetadata | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as StageEventMetadata;
    } catch {
      return null;
    }
  }
  return raw as StageEventMetadata;
}

function inferOutcome(
  toStage: ApplicationStage,
  metadata: StageEventMetadata | null,
): JobOutcome | null {
  if (toStage === "offer") return "offer_accepted";
  if (toStage === "closed" && metadata?.reasonCode) return "rejected";
  return null;
}

function isClosingStage(toStage: ApplicationStage): boolean {
  return toStage === "closed" || toStage === "offer";
}

function resolveOutcomeAndClosedAt(input: {
  lastStage: ApplicationStage;
  lastEventOccurredAt: number;
  metadata: StageEventMetadata | null;
  lastEventOutcome: JobOutcome | null;
  jobOutcome: JobOutcome | null;
  jobClosedAt: number | null;
}): { outcome: JobOutcome | null; closedAt: number | null } {
  const inferredOutcome = inferOutcome(input.lastStage, input.metadata);
  const closingStage = isClosingStage(input.lastStage);
  const outcome =
    input.lastEventOutcome ??
    inferredOutcome ??
    (closingStage ? input.jobOutcome : null);

  if (input.lastStage === "closed") {
    return { outcome, closedAt: input.lastEventOccurredAt };
  }
  if (!outcome) {
    return { outcome, closedAt: null };
  }
  if (input.lastEventOutcome || inferredOutcome) {
    return { outcome, closedAt: input.lastEventOccurredAt };
  }
  return { outcome, closedAt: input.jobClosedAt };
}
