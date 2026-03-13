/**
 * Express app factory (useful for tests).
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiErrorHandler,
  legacyApiResponseShim,
  notFoundApiHandler,
  requestContextMiddleware,
} from "@infra/http";
import { logger } from "@infra/logger";
import cors from "cors";
import express from "express";
import { apiRouter } from "./api/index";
import { getDataDir } from "./config/dataDir";
import { isDemoMode } from "./config/demo";
import {
  requireAuth,
  requirePdfAuth,
  requireWriteAccess,
} from "./middleware/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(requestContextMiddleware());
  app.use(express.json({ limit: "5mb" }));
  app.use(legacyApiResponseShim());

  // Logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info("HTTP request completed", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
        userId: req.user?.id,
        role: req.user?.role,
      });
    });
    next();
  });

  // API routes
  app.use("/api", requireAuth, requireWriteAccess, apiRouter);
  app.use("/api", notFoundApiHandler());

  // Serve static files for generated PDFs
  const pdfDir = join(getDataDir(), "pdfs");
  app.use("/pdfs", requirePdfAuth);
  if (isDemoMode()) {
    const demoPdfPath = join(pdfDir, "demo.pdf");
    app.get("/pdfs/*", (_req, res) => {
      res.sendFile(demoPdfPath, (error) => {
        if (error) res.status(404).end();
      });
    });
  }
  app.use("/pdfs", express.static(pdfDir));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Serve client app in production
  if (process.env.NODE_ENV === "production") {
    const packagedDocsDir = join(__dirname, "../../dist/docs");
    const workspaceDocsDir = join(__dirname, "../../../docs-site/build");
    const docsDir = existsSync(packagedDocsDir)
      ? packagedDocsDir
      : workspaceDocsDir;
    const docsIndexPath = join(docsDir, "index.html");
    let cachedDocsIndexHtml: string | null = null;

    if (existsSync(docsIndexPath)) {
      app.use("/docs", express.static(docsDir));
      app.get("/docs/*", async (req, res, next) => {
        if (!req.accepts("html")) {
          next();
          return;
        }
        if (extname(req.path)) {
          next();
          return;
        }
        if (!cachedDocsIndexHtml) {
          cachedDocsIndexHtml = await readFile(docsIndexPath, "utf-8");
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(cachedDocsIndexHtml);
      });
    }

    const clientDir = join(__dirname, "../../dist/client");
    app.use(express.static(clientDir));

    // SPA fallback
    const indexPath = join(clientDir, "index.html");
    let cachedIndexHtml: string | null = null;
    app.get("*", async (req, res) => {
      if (!req.accepts("html")) {
        res.status(404).end();
        return;
      }
      if (!cachedIndexHtml) {
        cachedIndexHtml = await readFile(indexPath, "utf-8");
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(cachedIndexHtml);
    });
  }

  app.use(apiErrorHandler);

  return app;
}
