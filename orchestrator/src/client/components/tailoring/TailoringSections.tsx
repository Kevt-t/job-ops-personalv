import type { ResumeProjectCatalogItem } from "@shared/types.js";
import { Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import type React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProjectSelector } from "../discovered-panel/ProjectSelector";
import type {
  EditableProjectBullet,
  EditableSkillGroup,
} from "../tailoring-utils";

interface TailoringSectionsProps {
  catalog: ResumeProjectCatalogItem[];
  isCatalogLoading: boolean;
  jobDescription: string;
  skillsDraft: EditableSkillGroup[];
  selectedIds: Set<string>;
  openSkillGroupId: string;
  disableInputs: boolean;
  onUndoSkills: () => void;
  onRedoSkills: () => void;
  canUndoSkills: boolean;
  canRedoSkills: boolean;
  undoDisabledReason?: string | null;
  onDescriptionChange: (value: string) => void;
  onSkillGroupOpenChange: (value: string) => void;
  onAddSkillGroup: () => void;
  onUpdateSkillGroup: (
    id: string,
    key: "name" | "keywordsText",
    value: string,
  ) => void;
  onRemoveSkillGroup: (id: string) => void;
  onToggleProject: (id: string) => void;
  bulletsDraft: EditableProjectBullet[];
  onUpdateProjectBullet: (projectId: string, bulletsText: string) => void;
  onUndoBullets: () => void;
  onRedoBullets: () => void;
  canUndoBullets: boolean;
  canRedoBullets: boolean;
}

const sectionClass = "rounded-lg border border-border/60 bg-muted/20 px-0";
const triggerClass =
  "px-3 py-2 text-xs font-medium text-muted-foreground hover:no-underline";
const inputClass =
  "w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const TailoringSections: React.FC<TailoringSectionsProps> = ({
  catalog,
  isCatalogLoading,
  jobDescription,
  skillsDraft,
  selectedIds,
  openSkillGroupId,
  disableInputs,
  onUndoSkills,
  onRedoSkills,
  canUndoSkills,
  canRedoSkills,
  undoDisabledReason = null,
  onDescriptionChange,
  onSkillGroupOpenChange,
  onAddSkillGroup,
  onUpdateSkillGroup,
  onRemoveSkillGroup,
  onToggleProject,
  bulletsDraft,
  onUpdateProjectBullet,
  onUndoBullets,
  onRedoBullets,
  canUndoBullets,
  canRedoBullets,
}) => {
  const undoTooltip = "Undo to template";
  const redoTooltip = "Redo to AI draft";

  return (
    <TooltipProvider>
      <Accordion type="multiple" className="space-y-3">
        <AccordionItem value="job-description" className={sectionClass}>
          <AccordionTrigger className={triggerClass}>
            Job Description
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3 pt-1">
            <label htmlFor="tailor-jd-edit" className="sr-only">
              Job Description
            </label>
            <textarea
              id="tailor-jd-edit"
              className={`${inputClass} min-h-[120px] max-h-[250px]`}
              value={jobDescription}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="The raw job description..."
              disabled={disableInputs}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="skills" className={sectionClass}>
          <AccordionTrigger className={triggerClass}>
            Tailored Skills
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3 pt-1">
            <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={onUndoSkills}
                    disabled={disableInputs || !canUndoSkills}
                    aria-label={undoTooltip}
                    title={
                      !canUndoSkills
                        ? (undoDisabledReason ?? undefined)
                        : undefined
                    }
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{undoTooltip}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={onRedoSkills}
                    disabled={disableInputs || !canRedoSkills}
                    aria-label={redoTooltip}
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{redoTooltip}</TooltipContent>
              </Tooltip>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={onAddSkillGroup}
                disabled={disableInputs}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Skill Group
              </Button>
            </div>

            {skillsDraft.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
                No skill groups yet. Add one to tailor keywords for this role.
              </div>
            ) : (
              <Accordion
                type="single"
                collapsible
                value={openSkillGroupId}
                onValueChange={onSkillGroupOpenChange}
                className="space-y-2"
              >
                {skillsDraft.map((group, index) => (
                  <AccordionItem
                    key={group.id}
                    value={group.id}
                    className="rounded-lg border border-border/60 bg-background/40 px-0"
                  >
                    <AccordionTrigger className="px-3 py-2 text-[11px] font-medium hover:no-underline">
                      {group.name.trim() || `Skill Group ${index + 1}`}
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 pt-1">
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label
                            htmlFor={`tailor-skill-group-name-${group.id}`}
                            className="text-[11px] font-medium text-muted-foreground"
                          >
                            Category
                          </label>
                          <input
                            id={`tailor-skill-group-name-${group.id}`}
                            type="text"
                            className={inputClass}
                            value={group.name}
                            onChange={(event) =>
                              onUpdateSkillGroup(
                                group.id,
                                "name",
                                event.target.value,
                              )
                            }
                            placeholder="Backend, Frontend, Infrastructure..."
                            disabled={disableInputs}
                          />
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor={`tailor-skill-group-keywords-${group.id}`}
                            className="text-[11px] font-medium text-muted-foreground"
                          >
                            Keywords (comma-separated)
                          </label>
                          <textarea
                            id={`tailor-skill-group-keywords-${group.id}`}
                            className={`${inputClass} min-h-[88px]`}
                            value={group.keywordsText}
                            onChange={(event) =>
                              onUpdateSkillGroup(
                                group.id,
                                "keywordsText",
                                event.target.value,
                              )
                            }
                            placeholder="TypeScript, Node.js, REST APIs..."
                            disabled={disableInputs}
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => onRemoveSkillGroup(group.id)}
                            disabled={disableInputs}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </AccordionContent>
        </AccordionItem>

        {!isCatalogLoading && catalog.length > 0 && (
          <AccordionItem value="projects" className={sectionClass}>
            <AccordionTrigger className={triggerClass}>
              Selected Projects
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1">
              <ProjectSelector
                catalog={catalog}
                selectedIds={selectedIds}
                onToggle={onToggleProject}
                maxProjects={3}
                disabled={disableInputs}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        {bulletsDraft.length > 0 && (
          <AccordionItem value="project-bullets" className={sectionClass}>
            <AccordionTrigger className={triggerClass}>
              Project Bullets
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1">
              <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={onUndoBullets}
                      disabled={disableInputs || !canUndoBullets}
                      aria-label="Clear all bullets"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear all bullets</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={onRedoBullets}
                      disabled={disableInputs || !canRedoBullets}
                      aria-label="Redo to AI draft"
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Redo to AI draft</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-3">
                {bulletsDraft.map((entry) => (
                  <div key={entry.projectId} className="space-y-1">
                    <label
                      htmlFor={`tailor-bullets-${entry.projectId}`}
                      className="text-[11px] font-medium text-muted-foreground"
                    >
                      {entry.projectName}
                    </label>
                    <textarea
                      id={`tailor-bullets-${entry.projectId}`}
                      className={`${inputClass} min-h-[88px]`}
                      value={entry.bulletsText}
                      onChange={(event) =>
                        onUpdateProjectBullet(
                          entry.projectId,
                          event.target.value,
                        )
                      }
                      placeholder="One bullet point per line..."
                      disabled={disableInputs}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </TooltipProvider>
  );
};
