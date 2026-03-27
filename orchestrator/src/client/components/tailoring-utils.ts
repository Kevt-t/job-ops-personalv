import type { ResumeProfile } from "@shared/types";

export interface TailoredSkillGroup {
  name: string;
  keywords: string[];
}

export interface EditableSkillGroup {
  id: string;
  name: string;
  keywordsText: string;
}

let skillDraftCounter = 0;

export function createTailoredSkillDraftId(): string {
  skillDraftCounter += 1;
  return `skill-group-${skillDraftCounter}`;
}

export function parseTailoredSkills(
  raw: string | null | undefined,
): TailoredSkillGroup[] {
  if (!raw || raw.trim().length === 0) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const groups: TailoredSkillGroup[] = [];
    const legacyKeywords: string[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        const keyword = item.trim();
        if (keyword.length > 0) legacyKeywords.push(keyword);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const keywordsRaw = Array.isArray(record.keywords)
        ? record.keywords
        : typeof record.keywords === "string"
          ? record.keywords.split(",")
          : [];
      const keywords = keywordsRaw
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);

      if (!name && keywords.length === 0) continue;
      groups.push({ name, keywords });
    }

    if (legacyKeywords.length > 0) {
      groups.push({ name: "Skills", keywords: legacyKeywords });
    }

    return groups;
  } catch {
    return [];
  }
}

export function serializeTailoredSkills(groups: TailoredSkillGroup[]): string {
  if (groups.length === 0) return "";
  return JSON.stringify(groups);
}

export function toEditableSkillGroups(
  groups: TailoredSkillGroup[],
): EditableSkillGroup[] {
  return groups.map((group) => ({
    id: createTailoredSkillDraftId(),
    name: group.name,
    keywordsText: group.keywords.join(", "),
  }));
}

export function fromEditableSkillGroups(
  groups: EditableSkillGroup[],
): TailoredSkillGroup[] {
  const normalized: TailoredSkillGroup[] = [];

  for (const group of groups) {
    const name = group.name.trim();
    const keywords = group.keywordsText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!name && keywords.length === 0) continue;
    normalized.push({ name, keywords });
  }

  return normalized;
}

// --- Project Bullets ---

export interface TailoredProjectBullet {
  projectId: string;
  bullets: string[];
}

export interface EditableProjectBullet {
  projectId: string;
  projectName: string;
  bulletsText: string;
}

export function parseTailoredProjectBullets(
  raw: string | null | undefined,
): TailoredProjectBullet[] {
  if (!raw || raw.trim().length === 0) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const result: TailoredProjectBullet[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const projectId =
        typeof record.projectId === "string" ? record.projectId : "";
      if (!projectId) continue;
      const bulletsRaw = Array.isArray(record.bullets) ? record.bullets : [];
      const bullets = bulletsRaw
        .filter((b): b is string => typeof b === "string")
        .map((b) => b.trim())
        .filter(Boolean);
      result.push({ projectId, bullets });
    }
    return result;
  } catch {
    return [];
  }
}

export function serializeTailoredProjectBullets(
  items: TailoredProjectBullet[],
): string {
  if (items.length === 0) return "";
  return JSON.stringify(items);
}

export function toEditableProjectBullets(
  items: TailoredProjectBullet[],
  catalog: Array<{ id: string; name: string }>,
  selectedIds: Set<string>,
): EditableProjectBullet[] {
  const bulletMap = new Map<string, string[]>();
  for (const item of items) {
    bulletMap.set(item.projectId, item.bullets);
  }

  const nameMap = new Map<string, string>();
  for (const entry of catalog) {
    nameMap.set(entry.id, entry.name);
  }

  const result: EditableProjectBullet[] = [];
  for (const id of selectedIds) {
    const bullets = bulletMap.get(id) ?? [];
    result.push({
      projectId: id,
      projectName: nameMap.get(id) ?? id,
      bulletsText: bullets.join("\n"),
    });
  }
  return result;
}

export function fromEditableProjectBullets(
  items: EditableProjectBullet[],
): TailoredProjectBullet[] {
  const result: TailoredProjectBullet[] = [];
  for (const item of items) {
    const bullets = item.bulletsText
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    if (bullets.length > 0) {
      result.push({ projectId: item.projectId, bullets });
    }
  }
  return result;
}

// --- Original profile helpers ---

export function getOriginalSummary(profile: ResumeProfile | null): string {
  if (!profile) return "";
  return profile.basics?.summary?.trim() ?? "";
}

export function getOriginalHeadline(profile: ResumeProfile | null): string {
  if (!profile) return "";
  return profile.basics?.label?.trim() ?? "";
}

export function getOriginalSkills(
  profile: ResumeProfile | null,
): TailoredSkillGroup[] {
  if (!profile) return [];

  const items = profile.sections?.skills?.items;
  if (!Array.isArray(items)) return [];

  const groups: TailoredSkillGroup[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const name =
      typeof item.name === "string"
        ? item.name.trim()
        : typeof item.description === "string"
          ? item.description.trim()
          : "";
    const keywordsRaw = Array.isArray(item.keywords) ? item.keywords : [];
    const keywords = keywordsRaw
      .filter((value: unknown): value is string => typeof value === "string")
      .map((value: string) => value.trim())
      .filter(Boolean);
    if (!name && keywords.length === 0) continue;
    groups.push({ name, keywords });
  }

  return groups;
}
