import type { JobActionResponse, JobListItem } from "@shared/types";

const SKIPPABLE_STATUSES = new Set(["discovered", "ready"]);
const DELETABLE_STATUSES = new Set([
  "discovered",
  "processing",
  "skipped",
  "expired",
]);

export function canSkip(jobs: JobListItem[]): boolean {
  return (
    jobs.length > 0 && jobs.every((job) => SKIPPABLE_STATUSES.has(job.status))
  );
}

export function canMoveToReady(jobs: JobListItem[]): boolean {
  return jobs.length > 0 && jobs.every((job) => job.status === "discovered");
}

export function canRescore(jobs: JobListItem[]): boolean {
  return jobs.length > 0 && jobs.every((job) => job.status !== "processing");
}

export function canDelete(jobs: JobListItem[]): boolean {
  return (
    jobs.length > 0 && jobs.every((job) => DELETABLE_STATUSES.has(job.status))
  );
}

export function getFailedJobIds(response: JobActionResponse): Set<string> {
  const failedIds = response.results
    .filter((result) => !result.ok)
    .map((result) => result.jobId);
  return new Set(failedIds);
}
