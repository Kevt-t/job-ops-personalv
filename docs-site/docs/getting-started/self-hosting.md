---
id: self-hosting
title: Self-Hosting (Docker Compose)
description: Deploy JobOps with Docker Compose and configure onboarding integrations.
sidebar_position: 1
---

The easiest way to run JobOps is via Docker Compose. The default stack starts JobOps plus a local PostgreSQL service, and you can swap that database connection to Neon by setting `DATABASE_URL`.

## Prerequisites

- Docker Desktop or Docker Engine + Compose v2

## 1) Start the stack

No extra environment variables are required to boot the default local stack:

```bash
docker compose up -d
```

This pulls the pre-built image from GHCR and starts the API, UI, scrapers, and a local PostgreSQL container.

To build locally instead:

```bash
docker compose up -d --build
```

## 2) Access the app and onboard

Open:

- **Dashboard**: `http://localhost:3005`

The onboarding wizard helps you validate and save:

1. **LLM Provider**: OpenRouter by default (or OpenAI/Gemini/local URL).
2. **PDF Export**: RxResume credentials for PDF generation.
3. **Template Resume**: Choose a base resume from your RxResume account.

Settings are saved to PostgreSQL.

## Persistent data

Docker named volumes store:

- PostgreSQL data
- Generated PDFs and backup snapshots under `/app/data`

If you want to use Neon instead of the bundled local database, set:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

Then restart the stack. JobOps will connect to Neon using that URL.

## Public demo mode

Set `DEMO_MODE=true` for sandbox deployments.

Behavior in demo mode:

- Works locally: browsing/filtering/status/timeline edits
- Simulated: pipeline run/summarize/process/rescore/pdf/apply
- Blocked: settings writes, DB clear, backups
- Auto-reset: every 6 hours

## Updating

```bash
git pull
docker compose pull
docker compose up -d
```

## Self-hosted Reactive Resume

If you self-host Reactive Resume, set:

- `RXRESUME_URL=http://rxresume.local.net`
- `RXRESUME_MODE=auto` (recommended) or `v5`/`v4` to force a specific API version
- `RXRESUME_API_KEY=...` (or configure `rxresumeApiKey` in JobOps Settings)

`auto` mode is the default and prefers v5 when an API key is configured, then falls back to v4 credentials.
