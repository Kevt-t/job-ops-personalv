/**
 * API routes for the orchestrator.
 */

import { Router } from "express";
import { backupRouter } from "./routes/backup";
import { databaseRouter } from "./routes/database";
import { demoRouter } from "./routes/demo";
import { ghostwriterRouter } from "./routes/ghostwriter";
import { jobsRouter } from "./routes/jobs";
import { manualJobsRouter } from "./routes/manual-jobs";
import { onboardingRouter } from "./routes/onboarding";
import { pipelineRouter } from "./routes/pipeline";
import { profileRouter } from "./routes/profile";
import { settingsRouter } from "./routes/settings";
import { tracerLinksRouter } from "./routes/tracer-links";
import { webhookRouter } from "./routes/webhook";

export const apiRouter = Router();

apiRouter.use("/jobs", jobsRouter);
apiRouter.use("/jobs/:id/chat", ghostwriterRouter);
apiRouter.use("/demo", demoRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/pipeline", pipelineRouter);
apiRouter.use("/manual-jobs", manualJobsRouter);
apiRouter.use("/webhook", webhookRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/database", databaseRouter);
apiRouter.use("/onboarding", onboardingRouter);
apiRouter.use("/backups", backupRouter);
apiRouter.use("/tracer-links", tracerLinksRouter);
