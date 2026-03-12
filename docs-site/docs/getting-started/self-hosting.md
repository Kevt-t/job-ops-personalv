---
id: self-hosting
title: Self-Hosting (Docker Compose)
description: Deploy JobOps with Docker Compose and configure onboarding integrations.
sidebar_position: 1
---

The easiest way to run JobOps is via Docker Compose. The app is self-configuring and guides you through setup on first launch.

## Prerequisites

- Docker Desktop or Docker Engine + Compose v2

## 1) Start the stack

No environment variables are required to boot:

```bash
docker compose up -d
```

This pulls the pre-built image from GHCR and starts the API, UI, and scrapers in one container.

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

Settings are saved to the local database.

## Persistent data

`./data` bind-mount stores:

- SQLite DB: `data/jobs.db`
- Generated PDFs: `data/pdfs/`

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
