import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const SKILL_PARTS = ["skills", "hubspot", "SKILL.md"] as const;

/**
 * Resolve packaged `skills/hubspot/SKILL.md` for the bundled CLI (`dist/hubspot.js`),
 * dev runs (`src/skill-path.ts`), or tests.
 */
export function readPackagedSkillMarkdown(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, ...SKILL_PARTS),
    path.join(here, "..", ...SKILL_PARTS),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf8");
    }
  }
  throw new Error(
    "Could not find packaged skill SKILL.md. Reinstall hubspot-cli or run from a full checkout with skills/hubspot/SKILL.md.",
  );
}
