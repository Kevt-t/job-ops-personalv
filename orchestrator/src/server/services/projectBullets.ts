/**
 * Service for generating tailored project bullet points via LLM.
 */

import { logger } from "@infra/logger";
import { getSetting } from "../repositories/settings";
import { LlmService } from "./llm/service";
import type { JsonSchemaDefinition } from "./llm/types";
import {
  getWritingLanguageLabel,
  resolveWritingOutputLanguage,
} from "./output-language";
import {
  getWritingStyle,
  stripLanguageDirectivesFromConstraints,
} from "./writing-style";

export interface ProjectBulletsInput {
  id: string;
  name: string;
  summaryText: string;
}

// Minimal profile shape for language detection
const EMPTY_PROFILE = { basics: {}, sections: {} };

export interface ProjectBulletsOutput {
  projectId: string;
  bullets: string[];
}

export interface ProjectBulletsResult {
  success: boolean;
  data?: ProjectBulletsOutput[];
  error?: string;
}

interface LlmProjectBulletsResponse {
  projects: Array<{ projectId: string; bullets: string[] }>;
}

const PROJECT_BULLETS_SCHEMA: JsonSchemaDefinition = {
  name: "project_bullets",
  schema: {
    type: "object",
    properties: {
      projects: {
        type: "array",
        description: "Tailored bullet points per selected project",
        items: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The project ID from the input",
            },
            bullets: {
              type: "array",
              items: { type: "string" },
              description: "2-4 concise bullet points for this project",
            },
          },
          required: ["projectId", "bullets"],
          additionalProperties: false,
        },
      },
    },
    required: ["projects"],
    additionalProperties: false,
  },
};

export async function generateProjectBullets(args: {
  jobDescription: string;
  selectedProjects: ProjectBulletsInput[];
  projectsContext: string;
}): Promise<ProjectBulletsResult> {
  if (args.selectedProjects.length === 0) {
    return { success: true, data: [] };
  }

  const [overrideModel, overrideModelTailoring, writingStyle] =
    await Promise.all([
      getSetting("model"),
      getSetting("modelTailoring"),
      getWritingStyle(),
    ]);

  const model =
    overrideModelTailoring ||
    overrideModel ||
    process.env.MODEL ||
    "google/gemini-3-flash-preview";

  const resolvedLanguage = resolveWritingOutputLanguage({
    style: writingStyle,
    profile: EMPTY_PROFILE as Parameters<
      typeof resolveWritingOutputLanguage
    >[0]["profile"],
  });
  const outputLanguage = getWritingLanguageLabel(resolvedLanguage.language);
  const effectiveConstraints = stripLanguageDirectivesFromConstraints(
    writingStyle.constraints,
  );

  const projectsForPrompt = args.selectedProjects.map((p) => ({
    projectId: p.id,
    name: p.name,
    currentDescription: p.summaryText,
  }));

  const prompt = `
You are an expert resume writer. Generate tailored bullet points for each selected project, emphasizing aspects most relevant to the job description.

JOB DESCRIPTION:
${args.jobDescription}

SELECTED PROJECTS:
${JSON.stringify(projectsForPrompt, null, 2)}

${args.projectsContext ? `DETAILED PROJECT WRITE-UPS (use for specific, concrete details):\n${args.projectsContext}\n` : ""}
INSTRUCTIONS:
- Write 2-4 concise bullet points per project
- Emphasize aspects relevant to the job description
- Use specific, concrete details from the project write-ups when available
- Do not invent capabilities, metrics, or technologies not mentioned in the project data
- Each bullet should start with a strong action verb
- Keep bullets concise (one line each)

WRITING STYLE PREFERENCES:
- Tone: ${writingStyle.tone}
- Formality: ${writingStyle.formality}
- Output language: ${outputLanguage}
${effectiveConstraints ? `- Additional constraints: ${effectiveConstraints}` : ""}
${writingStyle.doNotUse ? `- Avoid these words or phrases: ${writingStyle.doNotUse}` : ""}

OUTPUT FORMAT (JSON):
{
  "projects": [
    { "projectId": "...", "bullets": ["...", "..."] }
  ]
}
`;

  const llm = new LlmService();
  const result = await llm.callJson<LlmProjectBulletsResponse>({
    model,
    messages: [{ role: "user", content: prompt }],
    jsonSchema: PROJECT_BULLETS_SCHEMA,
  });

  if (!result.success) {
    const context = `provider=${llm.getProvider()} baseUrl=${llm.getBaseUrl()}`;
    if (result.error.toLowerCase().includes("api key")) {
      const message = `LLM API key not set, cannot generate project bullets. (${context})`;
      logger.warn(message);
      return { success: false, error: message };
    }
    return { success: false, error: `${result.error} (${context})` };
  }

  const { projects } = result.data;
  if (!Array.isArray(projects)) {
    logger.warn("AI response missing required projects field", result.data);
    return { success: true, data: [] };
  }

  // Filter to only valid project IDs from our input
  const validIds = new Set(args.selectedProjects.map((p) => p.id));
  const filtered = projects
    .filter((p) => validIds.has(p.projectId) && Array.isArray(p.bullets))
    .map((p) => ({
      projectId: p.projectId,
      bullets: p.bullets.filter(
        (b) => typeof b === "string" && b.trim().length > 0,
      ),
    }));

  return { success: true, data: filtered };
}
