import * as api from "@client/api";
import type { Job, ResumeProjectCatalogItem } from "@shared/types.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTailoredSkillDraftId,
  type EditableProjectBullet,
  type EditableSkillGroup,
  fromEditableProjectBullets,
  fromEditableSkillGroups,
  parseTailoredProjectBullets,
  parseTailoredSkills,
  serializeTailoredProjectBullets,
  serializeTailoredSkills,
  toEditableProjectBullets,
  toEditableSkillGroups,
} from "../tailoring-utils";

const parseSelectedIds = (value: string | null | undefined) =>
  new Set(value?.split(",").filter(Boolean) ?? []);

const hasSelectionDiff = (current: Set<string>, saved: Set<string>) => {
  if (current.size !== saved.size) return true;
  for (const id of current) {
    if (!saved.has(id)) return true;
  }
  return false;
};

const parseIncomingDraft = (incomingJob: Job) => {
  const description = incomingJob.jobDescription || "";
  const selectedIds = parseSelectedIds(incomingJob.selectedProjectIds);
  const skillsDraft = toEditableSkillGroups(
    parseTailoredSkills(incomingJob.tailoredSkills),
  );
  const skillsJson = serializeTailoredSkills(
    fromEditableSkillGroups(skillsDraft),
  );
  const parsedBullets = parseTailoredProjectBullets(
    incomingJob.tailoredProjectBullets,
  );
  const bulletsJson = serializeTailoredProjectBullets(
    fromEditableProjectBullets(
      toEditableProjectBullets(parsedBullets, [], selectedIds),
    ),
  );

  return {
    description,
    selectedIds,
    skillsDraft,
    skillsJson,
    parsedBullets,
    bulletsJson,
  };
};

interface UseTailoringDraftParams {
  job: Job;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function useTailoringDraft({
  job,
  onDirtyChange,
}: UseTailoringDraftParams) {
  const [catalog, setCatalog] = useState<ResumeProjectCatalogItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [jobDescription, setJobDescription] = useState(
    job.jobDescription || "",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    parseSelectedIds(job.selectedProjectIds),
  );
  const [skillsDraft, setSkillsDraft] = useState<EditableSkillGroup[]>(() =>
    toEditableSkillGroups(parseTailoredSkills(job.tailoredSkills)),
  );
  const [openSkillGroupId, setOpenSkillGroupId] = useState<string>("");
  const [bulletsDraft, setBulletsDraft] = useState<EditableProjectBullet[]>(
    () => {
      const parsed = parseTailoredProjectBullets(job.tailoredProjectBullets);
      const ids = parseSelectedIds(job.selectedProjectIds);
      return toEditableProjectBullets(parsed, [], ids);
    },
  );

  const [savedDescription, setSavedDescription] = useState(
    job.jobDescription || "",
  );
  const [savedSelectedIds, setSavedSelectedIds] = useState<Set<string>>(() =>
    parseSelectedIds(job.selectedProjectIds),
  );
  const [savedSkillsJson, setSavedSkillsJson] = useState(() =>
    serializeTailoredSkills(parseTailoredSkills(job.tailoredSkills)),
  );
  const [savedBulletsJson, setSavedBulletsJson] = useState(() => {
    const parsed = parseTailoredProjectBullets(job.tailoredProjectBullets);
    const ids = parseSelectedIds(job.selectedProjectIds);
    return serializeTailoredProjectBullets(
      fromEditableProjectBullets(toEditableProjectBullets(parsed, [], ids)),
    );
  });

  const lastJobIdRef = useRef(job.id);
  const jobRef = useRef(job);

  const skillsJson = useMemo(
    () => serializeTailoredSkills(fromEditableSkillGroups(skillsDraft)),
    [skillsDraft],
  );

  const bulletsJson = useMemo(
    () =>
      serializeTailoredProjectBullets(fromEditableProjectBullets(bulletsDraft)),
    [bulletsDraft],
  );

  const selectedIdsCsv = useMemo(
    () => Array.from(selectedIds).join(","),
    [selectedIds],
  );

  const isDirty = useMemo(() => {
    if (jobDescription !== savedDescription) return true;
    if (skillsJson !== savedSkillsJson) return true;
    if (bulletsJson !== savedBulletsJson) return true;
    return hasSelectionDiff(selectedIds, savedSelectedIds);
  }, [
    jobDescription,
    savedDescription,
    skillsJson,
    savedSkillsJson,
    bulletsJson,
    savedBulletsJson,
    selectedIds,
    savedSelectedIds,
  ]);

  const applyIncomingDraft = useCallback(
    (incomingJob: Job) => {
      const next = parseIncomingDraft(incomingJob);
      setJobDescription(next.description);
      setSelectedIds(next.selectedIds);
      setSkillsDraft(next.skillsDraft);
      setBulletsDraft(
        toEditableProjectBullets(next.parsedBullets, catalog, next.selectedIds),
      );
      setSavedDescription(next.description);
      setSavedSelectedIds(next.selectedIds);
      setSavedSkillsJson(next.skillsJson);
      setSavedBulletsJson(next.bulletsJson);
    },
    [catalog],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  useEffect(() => {
    setIsCatalogLoading(true);
    api
      .getResumeProjectsCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setIsCatalogLoading(false));
  }, []);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  // Only sync when job ID changes (user switched to a different job)
  // User edits persist until explicitly saved - no auto-sync from server
  useEffect(() => {
    if (job.id !== lastJobIdRef.current) {
      lastJobIdRef.current = job.id;
      applyIncomingDraft(jobRef.current);
    }
  }, [job.id, applyIncomingDraft]);

  // Re-derive bulletsDraft when catalog or selectedIds change to ensure
  // all selected projects have entries with project names resolved.
  useEffect(() => {
    setBulletsDraft((prev) => {
      const existingMap = new Map<string, string>();
      for (const entry of prev) {
        existingMap.set(entry.projectId, entry.bulletsText);
      }
      const parsed = fromEditableProjectBullets(prev);
      return toEditableProjectBullets(parsed, catalog, selectedIds).map(
        (entry) => ({
          ...entry,
          bulletsText: existingMap.get(entry.projectId) ?? entry.bulletsText,
        }),
      );
    });
  }, [catalog, selectedIds]);

  useEffect(() => {
    if (
      openSkillGroupId.length > 0 &&
      !skillsDraft.some((group) => group.id === openSkillGroupId)
    ) {
      setOpenSkillGroupId("");
    }
  }, [skillsDraft, openSkillGroupId]);

  const handleToggleProject = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddSkillGroup = useCallback(() => {
    const nextId = createTailoredSkillDraftId();
    setSkillsDraft((prev) => [
      ...prev,
      { id: nextId, name: "", keywordsText: "" },
    ]);
    setOpenSkillGroupId(nextId);
  }, []);

  const handleUpdateSkillGroup = useCallback(
    (id: string, key: "name" | "keywordsText", value: string) => {
      setSkillsDraft((prev) =>
        prev.map((group) =>
          group.id === id ? { ...group, [key]: value } : group,
        ),
      );
    },
    [],
  );

  const handleRemoveSkillGroup = useCallback((id: string) => {
    setSkillsDraft((prev) => prev.filter((group) => group.id !== id));
  }, []);

  const handleUpdateProjectBullet = useCallback(
    (projectId: string, bulletsText: string) => {
      setBulletsDraft((prev) =>
        prev.map((entry) =>
          entry.projectId === projectId ? { ...entry, bulletsText } : entry,
        ),
      );
    },
    [],
  );

  return {
    catalog,
    isCatalogLoading,
    jobDescription,
    setJobDescription,
    selectedIds,
    selectedIdsCsv,
    skillsDraft,
    setSkillsDraft,
    openSkillGroupId,
    setOpenSkillGroupId,
    skillsJson,
    isDirty,
    applyIncomingDraft,
    handleToggleProject,
    handleAddSkillGroup,
    handleUpdateSkillGroup,
    handleRemoveSkillGroup,
    bulletsDraft,
    setBulletsDraft,
    bulletsJson,
    handleUpdateProjectBullet,
  };
}
