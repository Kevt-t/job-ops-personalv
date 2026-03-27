import * as api from "@client/api";
import { useProfile } from "@client/hooks/useProfile";
import { useRole } from "@client/hooks/useRole";
import type { Job } from "@shared/types.js";
import { ArrowLeft, Check, FileText, Loader2, Sparkles } from "lucide-react";
import type React from "react";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  fromEditableSkillGroups,
  getOriginalSkills,
  parseTailoredProjectBullets,
  parseTailoredSkills,
  serializeTailoredProjectBullets,
  serializeTailoredSkills,
  toEditableProjectBullets,
  toEditableSkillGroups,
} from "../tailoring-utils";
import { canFinalizeTailoring } from "./rules";
import { TailoringSections } from "./TailoringSections";
import { useTailoringDraft } from "./useTailoringDraft";

interface TailoringWorkspaceBaseProps {
  job: Job;
  onDirtyChange?: (isDirty: boolean) => void;
}

interface TailoringWorkspaceEditorProps extends TailoringWorkspaceBaseProps {
  mode: "editor";
  onUpdate: () => void | Promise<void>;
  onRegisterSave?: (save: () => Promise<void>) => void;
  onBeforeGenerate?: () => boolean | Promise<boolean>;
}

interface TailoringWorkspaceTailorProps extends TailoringWorkspaceBaseProps {
  mode: "tailor";
  onBack: () => void;
  onFinalize: () => void;
  isFinalizing: boolean;
  variant?: "discovered" | "ready";
}

type TailoringWorkspaceProps =
  | TailoringWorkspaceEditorProps
  | TailoringWorkspaceTailorProps;
type TailoringSectionsProps = ComponentProps<typeof TailoringSections>;

interface TailoringBaseline {
  skillsJson: string;
  bulletsJson: string;
}

const normalizeSkillsJson = (value: string | null | undefined) =>
  serializeTailoredSkills(parseTailoredSkills(value));

const normalizeBulletsJson = (value: string | null | undefined) =>
  serializeTailoredProjectBullets(parseTailoredProjectBullets(value));

const toBaselineFromJob = (job: Job): TailoringBaseline => ({
  skillsJson: normalizeSkillsJson(job.tailoredSkills),
  bulletsJson: normalizeBulletsJson(job.tailoredProjectBullets),
});

export const TailoringWorkspace: React.FC<TailoringWorkspaceProps> = (
  props,
) => {
  const editorProps = props.mode === "editor" ? props : null;
  const tailorProps = props.mode === "tailor" ? props : null;

  const {
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
  } = useTailoringDraft({
    job: props.job,
    onDirtyChange: props.onDirtyChange,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { profile, error: profileError } = useProfile();
  const { canMutate } = useRole();

  const originalValues = useMemo(() => {
    const skillsDraft = toEditableSkillGroups(getOriginalSkills(profile));
    return {
      skillsDraft,
      skillsJson: serializeTailoredSkills(fromEditableSkillGroups(skillsDraft)),
    };
  }, [profile]);
  const canUseOriginalValues = Boolean(profile) && !profileError;
  const [aiBaseline, setAiBaseline] = useState<TailoringBaseline>(() =>
    toBaselineFromJob(props.job),
  );

  useEffect(() => {
    setAiBaseline({
      skillsJson: normalizeSkillsJson(props.job.tailoredSkills),
      bulletsJson: normalizeBulletsJson(props.job.tailoredProjectBullets),
    });
  }, [props.job.tailoredSkills, props.job.tailoredProjectBullets]);

  const savePayload = useMemo(
    () => ({
      tailoredSkills: skillsJson,
      tailoredProjectBullets: bulletsJson,
      jobDescription,
      selectedProjectIds: selectedIdsCsv,
    }),
    [skillsJson, bulletsJson, jobDescription, selectedIdsCsv],
  );

  const persistCurrent = useCallback(async () => {
    const updatedJob = await api.updateJob(props.job.id, savePayload);
    applyIncomingDraft(updatedJob);
  }, [props.job.id, savePayload, applyIncomingDraft]);

  // Note: Auto-save removed.
  // Editor mode: user must explicitly save via the "Save Selection" button to persist changes.
  // Tailor mode: there is no explicit save action; changes only persist when the user finalizes
  // or otherwise completes the tailoring flow. This prevents race conditions and simplifies state.

  const saveChanges = useCallback(
    async ({ showToast = true }: { showToast?: boolean } = {}) => {
      if (!editorProps) return;

      try {
        setIsSaving(true);
        const updatedJob = await api.updateJob(props.job.id, savePayload);
        applyIncomingDraft(updatedJob);
        if (showToast) toast.success("Changes saved");
        await editorProps.onUpdate();
      } catch (error) {
        if (showToast) toast.error("Failed to save changes");
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [editorProps, props.job.id, savePayload, applyIncomingDraft],
  );

  useEffect(() => {
    if (!editorProps?.onRegisterSave) return;
    editorProps.onRegisterSave(() => saveChanges({ showToast: false }));
  }, [editorProps, saveChanges]);

  const handleSummarizeEditor = useCallback(async () => {
    if (!editorProps) return;

    try {
      setIsSummarizing(true);
      if (isDirty) {
        await saveChanges({ showToast: false });
      }

      const updatedJob = await api.summarizeJob(props.job.id, { force: true });
      applyIncomingDraft(updatedJob);
      setAiBaseline(toBaselineFromJob(updatedJob));
      toast.success("AI Summary & Projects generated");
      await editorProps.onUpdate();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI summarization failed";
      toast.error(message);
    } finally {
      setIsSummarizing(false);
    }
  }, [editorProps, isDirty, saveChanges, props.job.id, applyIncomingDraft]);

  const handleGenerateWithAi = useCallback(async () => {
    if (!tailorProps) return;

    try {
      setIsGenerating(true);

      if (isDirty) {
        await persistCurrent();
      }

      const updatedJob = await api.summarizeJob(props.job.id, { force: true });
      applyIncomingDraft(updatedJob);
      setAiBaseline(toBaselineFromJob(updatedJob));

      toast.success("Draft generated with AI", {
        description: "Review and edit before finalizing.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate AI draft";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [tailorProps, isDirty, persistCurrent, props.job.id, applyIncomingDraft]);

  const handleGeneratePdf = useCallback(async () => {
    if (!editorProps) return;

    try {
      const shouldProceed = editorProps.onBeforeGenerate
        ? await editorProps.onBeforeGenerate()
        : true;
      if (shouldProceed === false) return;

      setIsGeneratingPdf(true);
      await saveChanges({ showToast: false });
      await api.generateJobPdf(props.job.id);
      toast.success("Resume PDF generated");
      await editorProps.onUpdate();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "PDF generation failed";
      if (/tracer/i.test(message)) {
        toast.error("Tracer links are unavailable right now", {
          description: message,
        });
      } else {
        toast.error(message);
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [editorProps, saveChanges, props.job.id]);

  const handleFinalize = useCallback(async () => {
    if (!tailorProps) return;

    if (isDirty) {
      try {
        setIsSaving(true);
        await persistCurrent();
      } catch {
        toast.error("Failed to save draft before finalizing");
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    tailorProps.onFinalize();
  }, [tailorProps, isDirty, persistCurrent]);

  const handleUndoSkills = useCallback(() => {
    setSkillsDraft(originalValues.skillsDraft);
  }, [originalValues.skillsDraft, setSkillsDraft]);

  const handleRedoSkills = useCallback(() => {
    setSkillsDraft(
      toEditableSkillGroups(parseTailoredSkills(aiBaseline.skillsJson)),
    );
  }, [aiBaseline.skillsJson, setSkillsDraft]);

  const handleUndoBullets = useCallback(() => {
    setBulletsDraft((prev) =>
      prev.map((entry) => ({ ...entry, bulletsText: "" })),
    );
  }, [setBulletsDraft]);

  const handleRedoBullets = useCallback(() => {
    const parsed = parseTailoredProjectBullets(aiBaseline.bulletsJson);
    setBulletsDraft((prev) => {
      const catalogLike = prev.map((e) => ({
        id: e.projectId,
        name: e.projectName,
      }));
      return toEditableProjectBullets(parsed, catalogLike, selectedIds);
    });
  }, [aiBaseline.bulletsJson, setBulletsDraft, selectedIds]);

  const disableInputs = !canMutate
    ? true
    : editorProps
      ? isSummarizing || isGeneratingPdf || isSaving
      : isGenerating || Boolean(tailorProps?.isFinalizing) || isSaving;

  const canFinalize = canFinalizeTailoring();
  const tailoringSectionsProps = useMemo<TailoringSectionsProps>(
    () => ({
      catalog,
      isCatalogLoading,
      jobDescription,
      skillsDraft,
      selectedIds,
      openSkillGroupId,
      disableInputs,
      onUndoSkills: handleUndoSkills,
      onRedoSkills: handleRedoSkills,
      canUndoSkills:
        canUseOriginalValues && skillsJson !== originalValues.skillsJson,
      canRedoSkills: skillsJson !== aiBaseline.skillsJson,
      undoDisabledReason: canUseOriginalValues
        ? null
        : "Original base CV unavailable.",
      onDescriptionChange: setJobDescription,
      onSkillGroupOpenChange: setOpenSkillGroupId,
      onAddSkillGroup: handleAddSkillGroup,
      onUpdateSkillGroup: handleUpdateSkillGroup,
      onRemoveSkillGroup: handleRemoveSkillGroup,
      onToggleProject: handleToggleProject,
      bulletsDraft,
      onUpdateProjectBullet: handleUpdateProjectBullet,
      onUndoBullets: handleUndoBullets,
      onRedoBullets: handleRedoBullets,
      canUndoBullets: bulletsDraft.some((e) => e.bulletsText.trim().length > 0),
      canRedoBullets: bulletsJson !== aiBaseline.bulletsJson,
    }),
    [
      catalog,
      isCatalogLoading,
      jobDescription,
      skillsDraft,
      selectedIds,
      openSkillGroupId,
      disableInputs,
      handleUndoSkills,
      handleRedoSkills,
      canUseOriginalValues,
      originalValues,
      skillsJson,
      aiBaseline,
      setJobDescription,
      setOpenSkillGroupId,
      handleAddSkillGroup,
      handleUpdateSkillGroup,
      handleRemoveSkillGroup,
      handleToggleProject,
      bulletsDraft,
      bulletsJson,
      handleUpdateProjectBullet,
      handleUndoBullets,
      handleRedoBullets,
    ],
  );

  if (editorProps) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Editor
          </h3>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSummarizeEditor}
              disabled={
                !canMutate || isSummarizing || isGeneratingPdf || isSaving
              }
              className="w-full sm:w-auto"
            >
              {isSummarizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              AI Summarize
            </Button>
            <Button
              size="sm"
              onClick={handleGeneratePdf}
              disabled={
                !canMutate || isSummarizing || isGeneratingPdf || isSaving
              }
              className="w-full sm:w-auto"
            >
              {isGeneratingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Generate PDF
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
          <TailoringSections {...tailoringSectionsProps} />

          <div className="flex justify-end border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void saveChanges()}
              disabled={!canMutate || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Save Selection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!tailorProps) return null;

  const finalizeVariant = tailorProps.variant ?? "discovered";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={tailorProps.onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to overview
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-amber-300">
                Draft tailoring for this role
              </span>
            </div>
            <p className="ml-4 mt-1 text-[10px] text-muted-foreground">
              AI can draft skills and project selection.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateWithAi}
            disabled={
              !canMutate || isGenerating || tailorProps.isFinalizing || isSaving
            }
            className="h-8 w-full text-xs sm:w-auto"
          >
            {isGenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Generate draft
          </Button>
        </div>

        <TailoringSections {...tailoringSectionsProps} />
      </div>

      <Separator className="my-4 opacity-50" />

      <div className="space-y-2">
        <Button
          onClick={() => void handleFinalize()}
          disabled={
            !canMutate ||
            tailorProps.isFinalizing ||
            !canFinalize ||
            isGenerating
          }
          className="h-10 w-full bg-emerald-600 text-white hover:bg-emerald-500"
        >
          {tailorProps.isFinalizing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {finalizeVariant === "ready"
                ? "Regenerating PDF..."
                : "Finalizing & generating PDF..."}
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {finalizeVariant === "ready"
                ? "Regenerate PDF"
                : "Finalize & Move to Ready"}
            </>
          )}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground/70">
          {finalizeVariant === "ready"
            ? "This will save your changes and regenerate the tailored PDF."
            : "This will generate your tailored PDF and move the job to Ready."}
        </p>
      </div>
    </div>
  );
};
