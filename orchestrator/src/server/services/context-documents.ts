import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@infra/logger";
import { getDataDir } from "../config/dataDir";

const MAX_FILE_CHARS = 6000;
const MAX_TOTAL_CHARS = 16000;

export async function loadContextDocuments(folder: string): Promise<string> {
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

    if (content.length > MAX_FILE_CHARS) {
      logger.warn("Context document truncated", {
        folder,
        file,
        originalChars: content.length,
        maxChars: MAX_FILE_CHARS,
      });
      content = content.slice(0, MAX_FILE_CHARS);
    }

    const section = `--- ${file} ---\n${content}`;

    if (totalChars + section.length > MAX_TOTAL_CHARS) {
      logger.warn("Context documents total size exceeded, skipping remaining", {
        folder,
        skippedFile: file,
        currentTotal: totalChars,
        maxTotal: MAX_TOTAL_CHARS,
      });
      break;
    }

    parts.push(section);
    totalChars += section.length;
  }

  return parts.join("\n\n");
}
