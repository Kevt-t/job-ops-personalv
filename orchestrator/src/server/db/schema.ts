/**
 * Database schema using Drizzle ORM with PostgreSQL.
 */

import {
  APPLICATION_OUTCOMES,
  APPLICATION_STAGES,
  APPLICATION_TASK_TYPES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_TYPES,
  JOB_CHAT_MESSAGE_ROLES,
  JOB_CHAT_MESSAGE_STATUSES,
  JOB_CHAT_RUN_STATUSES,
} from "@shared/types";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
} from "drizzle-orm/pg-core";

const nowText = sql`to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),

  // From crawler
  source: text("source").notNull().default("jobspy"),
  sourceJobId: text("source_job_id"),
  jobUrlDirect: text("job_url_direct"),
  datePosted: text("date_posted"),
  title: text("title").notNull(),
  employer: text("employer").notNull(),
  employerUrl: text("employer_url"),
  jobUrl: text("job_url").notNull().unique(),
  applicationLink: text("application_link"),
  disciplines: text("disciplines"),
  deadline: text("deadline"),
  salary: text("salary"),
  location: text("location"),
  degreeRequired: text("degree_required"),
  starting: text("starting"),
  jobDescription: text("job_description"),

  // JobSpy fields (nullable for other sources)
  jobType: text("job_type"),
  salarySource: text("salary_source"),
  salaryInterval: text("salary_interval"),
  salaryMinAmount: real("salary_min_amount"),
  salaryMaxAmount: real("salary_max_amount"),
  salaryCurrency: text("salary_currency"),
  isRemote: boolean("is_remote"),
  jobLevel: text("job_level"),
  jobFunction: text("job_function"),
  listingType: text("listing_type"),
  emails: text("emails"),
  companyIndustry: text("company_industry"),
  companyLogo: text("company_logo"),
  companyUrlDirect: text("company_url_direct"),
  companyAddresses: text("company_addresses"),
  companyNumEmployees: text("company_num_employees"),
  companyRevenue: text("company_revenue"),
  companyDescription: text("company_description"),
  skills: text("skills"),
  experienceRange: text("experience_range"),
  companyRating: real("company_rating"),
  companyReviewsCount: integer("company_reviews_count"),
  vacancyCount: integer("vacancy_count"),
  workFromHomeType: text("work_from_home_type"),

  // Orchestrator enrichments
  status: text("status", {
    enum: [
      "discovered",
      "processing",
      "ready",
      "applied",
      "in_progress",
      "skipped",
      "expired",
    ],
  })
    .notNull()
    .default("discovered"),
  outcome: text("outcome", { enum: APPLICATION_OUTCOMES }),
  closedAt: bigint("closed_at", { mode: "number" }),
  suitabilityScore: real("suitability_score"),
  suitabilityReason: text("suitability_reason"),
  tailoredSummary: text("tailored_summary"),
  tailoredHeadline: text("tailored_headline"),
  tailoredSkills: text("tailored_skills"),
  selectedProjectIds: text("selected_project_ids"),
  tailoredProjectBullets: text("tailored_project_bullets"),
  pdfPath: text("pdf_path"),
  tracerLinksEnabled: boolean("tracer_links_enabled")
    .notNull()
    .default(false),
  sponsorMatchScore: real("sponsor_match_score"),
  sponsorMatchNames: text("sponsor_match_names"),

  // Timestamps
  discoveredAt: text("discovered_at").notNull().default(nowText),
  processedAt: text("processed_at"),
  appliedAt: text("applied_at"),
  createdAt: text("created_at").notNull().default(nowText),
  updatedAt: text("updated_at").notNull().default(nowText),
});

export const stageEvents = pgTable("stage_events", {
  id: text("id").primaryKey(),
  applicationId: text("application_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  groupId: text("group_id"),
  fromStage: text("from_stage", { enum: APPLICATION_STAGES }),
  toStage: text("to_stage", { enum: APPLICATION_STAGES }).notNull(),
  occurredAt: bigint("occurred_at", { mode: "number" }).notNull(),
  metadata: jsonb("metadata"),
  outcome: text("outcome", { enum: APPLICATION_OUTCOMES }),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  applicationId: text("application_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  type: text("type", { enum: APPLICATION_TASK_TYPES }).notNull(),
  title: text("title").notNull(),
  dueDate: bigint("due_date", { mode: "number" }),
  isCompleted: boolean("is_completed").notNull().default(false),
  notes: text("notes"),
});

export const interviews = pgTable("interviews", {
  id: text("id").primaryKey(),
  applicationId: text("application_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  scheduledAt: bigint("scheduled_at", { mode: "number" }).notNull(),
  durationMins: integer("duration_mins"),
  type: text("type", { enum: INTERVIEW_TYPES }).notNull(),
  outcome: text("outcome", { enum: INTERVIEW_OUTCOMES }),
});

export const pipelineRuns = pgTable("pipeline_runs", {
  id: text("id").primaryKey(),
  startedAt: text("started_at").notNull().default(nowText),
  completedAt: text("completed_at"),
  status: text("status", {
    enum: ["running", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("running"),
  jobsDiscovered: integer("jobs_discovered").notNull().default(0),
  jobsProcessed: integer("jobs_processed").notNull().default(0),
  errorMessage: text("error_message"),
});

export const jobChatThreads = pgTable(
  "job_chat_threads",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: text("created_at").notNull().default(nowText),
    updatedAt: text("updated_at").notNull().default(nowText),
    lastMessageAt: text("last_message_at"),
  },
  (table) => ({
    jobUpdatedIndex: index("idx_job_chat_threads_job_updated").on(
      table.jobId,
      table.updatedAt,
    ),
  }),
);

export const jobChatMessages = pgTable(
  "job_chat_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => jobChatThreads.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    role: text("role", { enum: JOB_CHAT_MESSAGE_ROLES }).notNull(),
    content: text("content").notNull().default(""),
    status: text("status", { enum: JOB_CHAT_MESSAGE_STATUSES })
      .notNull()
      .default("partial"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    version: integer("version").notNull().default(1),
    replacesMessageId: text("replaces_message_id"),
    createdAt: text("created_at").notNull().default(nowText),
    updatedAt: text("updated_at").notNull().default(nowText),
  },
  (table) => ({
    threadCreatedIndex: index("idx_job_chat_messages_thread_created").on(
      table.threadId,
      table.createdAt,
    ),
  }),
);

export const jobChatRuns = pgTable(
  "job_chat_runs",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => jobChatThreads.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: text("status", { enum: JOB_CHAT_RUN_STATUSES })
      .notNull()
      .default("running"),
    model: text("model"),
    provider: text("provider"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: bigint("started_at", { mode: "number" }).notNull(),
    completedAt: bigint("completed_at", { mode: "number" }),
    requestId: text("request_id"),
    createdAt: text("created_at").notNull().default(nowText),
    updatedAt: text("updated_at").notNull().default(nowText),
  },
  (table) => ({
    threadStatusIndex: index("idx_job_chat_runs_thread_status").on(
      table.threadId,
      table.status,
    ),
  }),
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: text("created_at").notNull().default(nowText),
  updatedAt: text("updated_at").notNull().default(nowText),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["user", "coach"] }).notNull(),
    createdAt: text("created_at").notNull().default(nowText),
    updatedAt: text("updated_at").notNull().default(nowText),
  },
  (table) => ({
    roleIndex: index("idx_users_role").on(table.role),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    createdAt: text("created_at").notNull().default(nowText),
  },
  (table) => ({
    userIdIndex: index("idx_sessions_user_id").on(table.userId),
    expiresAtIndex: index("idx_sessions_expires_at").on(table.expiresAt),
  }),
);

export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;
export type StageEventRow = typeof stageEvents.$inferSelect;
export type NewStageEventRow = typeof stageEvents.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type InterviewRow = typeof interviews.$inferSelect;
export type NewInterviewRow = typeof interviews.$inferInsert;
export type PipelineRunRow = typeof pipelineRuns.$inferSelect;
export type NewPipelineRunRow = typeof pipelineRuns.$inferInsert;
export type JobChatThreadRow = typeof jobChatThreads.$inferSelect;
export type NewJobChatThreadRow = typeof jobChatThreads.$inferInsert;
export type JobChatMessageRow = typeof jobChatMessages.$inferSelect;
export type NewJobChatMessageRow = typeof jobChatMessages.$inferInsert;
export type JobChatRunRow = typeof jobChatRuns.$inferSelect;
export type NewJobChatRunRow = typeof jobChatRuns.$inferInsert;
export type SettingsRow = typeof settings.$inferSelect;
export type NewSettingsRow = typeof settings.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
