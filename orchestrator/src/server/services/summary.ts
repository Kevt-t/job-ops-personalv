/**
 * Service for generating tailored resume content (Skills).
 */

import { logger } from "@infra/logger";
import type { ResumeProfile } from "@shared/types";
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

export interface TailoredData {
  skills: Array<{ name: string; keywords: string[] }>;
}

export interface TailoringResult {
  success: boolean;
  data?: TailoredData;
  error?: string;
}

/** JSON schema for resume tailoring response */
const TAILORING_SCHEMA: JsonSchemaDefinition = {
  name: "resume_tailoring",
  schema: {
    type: "object",
    properties: {
      skills: {
        type: "array",
        description: "Skills sections with keywords tailored to the job",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Skill category name (e.g., Frontend, Backend)",
            },
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "List of skills/technologies in this category",
            },
          },
          required: ["name", "keywords"],
          additionalProperties: false,
        },
      },
    },
    required: ["skills"],
    additionalProperties: false,
  },
};

/**
 * Generate tailored resume content (summary, headline, skills) for a job.
 */
export async function generateTailoring(
  jobDescription: string,
  profile: ResumeProfile,
): Promise<TailoringResult> {
  const [overrideModel, overrideModelTailoring, writingStyle] =
    await Promise.all([
      getSetting("model"),
      getSetting("modelTailoring"),
      getWritingStyle(),
    ]);
  // Precedence: Tailoring-specific override > Global override > Env var > Default
  const model =
    overrideModelTailoring ||
    overrideModel ||
    process.env.MODEL ||
    "google/gemini-3-flash-preview";
  const prompt = buildTailoringPrompt(profile, jobDescription, writingStyle);

  const llm = new LlmService();
  const result = await llm.callJson<TailoredData>({
    model,
    messages: [{ role: "user", content: prompt }],
    jsonSchema: TAILORING_SCHEMA,
  });

  if (!result.success) {
    const context = `provider=${llm.getProvider()} baseUrl=${llm.getBaseUrl()}`;
    if (result.error.toLowerCase().includes("api key")) {
      const message = `LLM API key not set, cannot generate tailoring. (${context})`;
      logger.warn(message);
      return { success: false, error: message };
    }
    return {
      success: false,
      error: `${result.error} (${context})`,
    };
  }

  const { skills } = result.data;

  // Basic validation
  if (!Array.isArray(skills)) {
    logger.warn("AI response missing required tailoring fields", result.data);
  }

  return {
    success: true,
    data: {
      skills: skills || [],
    },
  };
}

function buildTailoringPrompt(
  profile: ResumeProfile,
  jd: string,
  writingStyle: Awaited<ReturnType<typeof getWritingStyle>>,
): string {
  const resolvedLanguage = resolveWritingOutputLanguage({
    style: writingStyle,
    profile,
  });
  const outputLanguage = getWritingLanguageLabel(resolvedLanguage.language);
  const effectiveConstraints = stripLanguageDirectivesFromConstraints(
    writingStyle.constraints,
  );

  // Extract only needed parts of profile to save tokens
  const relevantProfile = {
    basics: {
      name: profile.basics?.name,
      label: profile.basics?.label, // Original headline
      summary: profile.basics?.summary,
    },
    skills: profile.sections?.skills,
    projects: profile.sections?.projects?.items?.map((p) => ({
      name: p.name,
      description: p.description,
      keywords: p.keywords,
    })),
    experience: profile.sections?.experience?.items?.map((e) => ({
      company: e.company,
      position: e.position,
      summary: e.summary,
    })),
  };

  return `
You are an expert resume writer tailoring a profile for a specific job application.
You must return a JSON object with one field: "skills".

JOB DESCRIPTION (JD):
${jd}

MY PROFILE:
${JSON.stringify(relevantProfile, null, 2)}

INSTRUCTIONS:

1. "skills" (Array of Objects):
   - Review my existing skills section structure.
   - Keyword Stuffing: Swap synonyms to match the JD exactly (e.g. "TDD" -> "Unit Testing", "ReactJS" -> "React").
   - Keep my original skill levels and categories, just rename/reorder keywords to prioritize JD terms.
   - Return the full "items" array for the skills section, preserving the structure: { "name": "Frontend", "keywords": [...] }.
   - Write user-visible skill text in ${outputLanguage} when natural, but keep exact JD terms, acronyms, and technology names when that helps ATS matching.

WRITING STYLE PREFERENCES:
- Tone: ${writingStyle.tone}
- Formality: ${writingStyle.formality}
- Output language for skills: ${outputLanguage}
${effectiveConstraints ? `- Additional constraints: ${effectiveConstraints}` : ""}
${writingStyle.doNotUse ? `- Avoid these words or phrases: ${writingStyle.doNotUse}` : ""}

OUTPUT FORMAT (JSON):
{
  "skills": [ ... ]
}
`;
}

function sanitizeText(text: string): string {
  return text
    .replace(/\*\*[\s\S]*?\*\*/g, "") // remove markdown bold
    .trim();
}
