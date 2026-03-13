import {
  DEMO_DEFAULT_JOBS,
  DEMO_DEFAULT_PIPELINE_RUNS,
  DEMO_DEFAULT_SETTINGS,
  DEMO_DEFAULT_STAGE_EVENTS,
  type DemoDefaultSettings,
} from "@server/config/demo-defaults";
import { db, schema } from "@server/db/index";

type BuiltDemoBaseline = {
  resetAt: string;
  settings: DemoDefaultSettings;
  pipelineRuns: Array<typeof schema.pipelineRuns.$inferInsert>;
  jobs: Array<typeof schema.jobs.$inferInsert>;
  stageEvents: Array<typeof schema.stageEvents.$inferInsert>;
};

const { interviews, jobs, pipelineRuns, settings, stageEvents, tasks } = schema;

function toIsoFromOffset(now: Date, offsetMinutes: number): string {
  return new Date(now.getTime() - offsetMinutes * 60 * 1000).toISOString();
}

function makeDemoLink(
  baseUrl: string,
  jobId: string,
  kind: "job" | "apply",
): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/${kind}/${jobId}`;
}

export function buildDemoBaseline(now: Date): BuiltDemoBaseline {
  const resetAt = now.toISOString();

  return {
    resetAt,
    settings: DEMO_DEFAULT_SETTINGS,
    pipelineRuns: DEMO_DEFAULT_PIPELINE_RUNS.map((run) => ({
      id: run.id,
      status: run.status,
      startedAt: toIsoFromOffset(now, run.startedOffsetMinutes),
      completedAt: toIsoFromOffset(now, run.completedOffsetMinutes),
      jobsDiscovered: run.jobsDiscovered,
      jobsProcessed: run.jobsProcessed,
      errorMessage: run.errorMessage ?? null,
    })),
    jobs: DEMO_DEFAULT_JOBS.map((job) => ({
      id: job.id,
      source: job.source,
      title: job.title,
      employer: job.employer,
      jobUrl: makeDemoLink(job.jobUrl, job.id, "job"),
      applicationLink: makeDemoLink(job.applicationLink, job.id, "apply"),
      location: job.location,
      salary: job.salary,
      deadline: job.deadline,
      jobDescription: job.jobDescription,
      status: job.status,
      suitabilityScore: job.suitabilityScore,
      suitabilityReason: job.suitabilityReason,
      tailoredSummary: job.tailoredSummary ?? null,
      tailoredHeadline: job.tailoredHeadline ?? null,
      tailoredSkills: job.tailoredSkills
        ? JSON.stringify(job.tailoredSkills)
        : null,
      selectedProjectIds: job.selectedProjectIds ?? null,
      pdfPath: job.pdfPath ?? null,
      discoveredAt: toIsoFromOffset(now, job.discoveredOffsetMinutes),
      appliedAt:
        job.status === "applied" && typeof job.appliedOffsetMinutes === "number"
          ? toIsoFromOffset(now, job.appliedOffsetMinutes)
          : null,
      createdAt: toIsoFromOffset(now, job.discoveredOffsetMinutes),
      updatedAt: resetAt,
    })),
    stageEvents: DEMO_DEFAULT_STAGE_EVENTS.map((event) => ({
      id: event.id,
      applicationId: event.applicationId,
      title: event.title,
      fromStage: event.fromStage,
      toStage: event.toStage,
      occurredAt: Math.floor(
        (now.getTime() - event.occurredOffsetMinutes * 60 * 1000) / 1000,
      ),
      metadata: event.metadata,
      outcome: null,
      groupId: null,
    })),
  };
}

export async function applyDemoBaseline(
  baseline: BuiltDemoBaseline,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(stageEvents);
    await tx.delete(tasks);
    await tx.delete(interviews);
    await tx.delete(jobs);
    await tx.delete(pipelineRuns);
    await tx.delete(settings);

    const settingRows = Object.entries(baseline.settings).map(
      ([key, value]) => ({
        key,
        value,
        createdAt: baseline.resetAt,
        updatedAt: baseline.resetAt,
      }),
    );
    if (settingRows.length > 0) {
      await tx.insert(settings).values(settingRows);
    }

    if (baseline.pipelineRuns.length > 0) {
      await tx.insert(pipelineRuns).values(baseline.pipelineRuns);
    }
    if (baseline.jobs.length > 0) {
      await tx.insert(jobs).values(baseline.jobs);
    }
    if (baseline.stageEvents.length > 0) {
      await tx.insert(stageEvents).values(baseline.stageEvents);
    }
  });
}
