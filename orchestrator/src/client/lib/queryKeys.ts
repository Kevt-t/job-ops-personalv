import type { JobStatus } from "@shared/types";

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
    status: () => [...queryKeys.auth.all, "status"] as const,
    coaches: () => [...queryKeys.auth.all, "coaches"] as const,
  },
  settings: {
    all: ["settings"] as const,
    current: () => [...queryKeys.settings.all, "current"] as const,
  },
  profile: {
    all: ["profile"] as const,
    current: () => [...queryKeys.profile.all, "current"] as const,
  },
  tracer: {
    all: ["tracer"] as const,
    readiness: (force = false) =>
      [...queryKeys.tracer.all, "readiness", { force }] as const,
    analytics: (options?: {
      from?: number;
      to?: number;
      includeBots?: boolean;
      limit?: number;
    }) => [...queryKeys.tracer.all, "analytics", options ?? {}] as const,
    jobLinks: (
      jobId: string,
      options?: { from?: number; to?: number; includeBots?: boolean },
    ) => [...queryKeys.tracer.all, "job-links", jobId, options ?? {}] as const,
  },
  demo: {
    all: ["demo"] as const,
    info: () => [...queryKeys.demo.all, "info"] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    inProgressBoard: () =>
      [...queryKeys.jobs.all, "in-progress-board"] as const,
    list: (options?: { statuses?: JobStatus[]; view?: "list" | "full" }) =>
      [...queryKeys.jobs.all, "list", options ?? {}] as const,
    revision: (options?: { statuses?: JobStatus[] }) =>
      [...queryKeys.jobs.all, "revision", options ?? {}] as const,
    detail: (id: string) => [...queryKeys.jobs.all, "detail", id] as const,
    stageEvents: (id: string) =>
      [...queryKeys.jobs.all, "stage-events", id] as const,
    tasks: (id: string) => [...queryKeys.jobs.all, "tasks", id] as const,
  },
  pipeline: {
    all: ["pipeline"] as const,
    status: () => [...queryKeys.pipeline.all, "status"] as const,
  },
  backups: {
    all: ["backups"] as const,
    list: () => [...queryKeys.backups.all, "list"] as const,
  },
} as const;
