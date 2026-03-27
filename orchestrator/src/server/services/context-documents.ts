import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@infra/logger";
import { getDataDir } from "../config/dataDir";

const DEFAULT_MAX_FILE_CHARS = 6000;
const DEFAULT_MAX_TOTAL_CHARS = 16000;

interface LoadOptions {
  maxFileChars?: number;
  maxTotalChars?: number;
}

export async function loadContextDocuments(
  folder: string,
  options?: LoadOptions,
): Promise<string> {
  const maxFileChars = options?.maxFileChars ?? DEFAULT_MAX_FILE_CHARS;
  const maxTotalChars = options?.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;
  const dir = join(getDataDir(), folder);

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return "";
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
  if (mdFiles.length === 0) return "";

  const parts: string[] = [];
  let totalChars = 0;

  for (const file of mdFiles) {
    let content = await readFile(join(dir, file), "utf-8");

    if (maxFileChars > 0 && content.length > maxFileChars) {
      logger.warn("Context document truncated", {
        folder,
        file,
        originalChars: content.length,
        maxChars: maxFileChars,
      });
      content = content.slice(0, maxFileChars);
    }

    const section = `--- ${file} ---\n${content}`;

    if (maxTotalChars > 0 && totalChars + section.length > maxTotalChars) {
      logger.warn("Context documents total size exceeded, skipping remaining", {
        folder,
        skippedFile: file,
        currentTotal: totalChars,
        maxTotal: maxTotalChars,
      });
      break;
    }

    parts.push(section);
    totalChars += section.length;
  }

  return parts.join("\n\n");
}

/** Load all context documents without truncation. */
export function loadAllContextDocuments(folder: string): Promise<string> {
  return loadContextDocuments(folder, { maxFileChars: 0, maxTotalChars: 0 });
}
