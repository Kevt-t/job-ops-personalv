---
id: documentation-style-guide
title: Documentation Style Guide
description: Standards for writing user-facing docs in this repository.
sidebar_position: 2
---

Use this structure for feature pages:

1. **What it is**
2. **Why it exists**
3. **How to use it**
4. **Common problems**
5. **Related pages**

## Frontmatter requirements

Every doc should include:

- `id`
- `title`
- `description`
- `sidebar_position`

## Writing rules

- Prefer concrete steps over abstract prose.
- Provide copy-pasteable examples.
- State defaults and constraints explicitly.
- Use root-relative paths (e.g. `/features/settings`) for internal doc links.
- Do not use `/docs/next/...` prefixes — these break production builds.

## PR expectations

Any user-visible behavior change should include matching docs updates.
