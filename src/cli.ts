import { Command } from "commander";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createInterface } from "readline";
import { APIError, CONFIG_DIR, CONFIG_ENV, HubSpotClient, loadConfig } from "./client.js";
import { readPackagedSkillMarkdown } from "./skill-path.js";
import {
  searchCompanies,
  searchDeals,
  searchTickets,
  searchContacts,
  getCompany,
  getDeal,
  getTicket,
  getContact,
} from "./hubspot.js";

const pkgPath = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version: string };
const VERSION = pkg.version;

const SKILL_INSTALL_NAME = "hubspot";

function sameRealPath(a: string, b: string): boolean {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return false;
  }
}

function throwIfLegacyFlatSkillEntry(entryPath: string, label: string): void {
  if (!fs.existsSync(entryPath)) return;
  const st = fs.statSync(entryPath);
  if (st.isFile()) {
    throw new Error(
      `Legacy install: ${label} is a file at ${entryPath}. Remove it, then run install-skill again. The skill now lives in ${SKILL_INSTALL_NAME}/SKILL.md.`,
    );
  }
}

function symlinkSkillDir(targetAbs: string, linkAbs: string): void {
  fs.symlinkSync(targetAbs, linkAbs, "dir");
}

function skillMdExists(skillMdPath: string): boolean {
  return fs.existsSync(skillMdPath) && fs.statSync(skillMdPath).isFile();
}

async function resolveClaudeSymlinkChoice(
  claudeFlag: boolean,
  claudeSkillDir: string,
): Promise<boolean> {
  if (claudeFlag) return true;
  const stdin = process.stdin as NodeJS.ReadStream & { isTTY?: boolean };
  if (!stdin.isTTY) {
    console.log("Not a TTY: skipping .claude symlink. Pass --claude to create it.");
    return false;
  }
  const answer = await promptInput(
    `Create a symlink at ${claudeSkillDir} so Claude Code can load this skill? [Y/n]: `,
  );
  const a = answer.trim().toLowerCase();
  return a === "" || a === "y" || a === "yes";
}

async function cmdInstallSkill(options: { global: boolean; claude: boolean }): Promise<void> {
  const content = readPackagedSkillMarkdown();
  const agentsSkillsDir = options.global
    ? path.join(os.homedir(), ".agents", "skills")
    : path.join(process.cwd(), ".agents", "skills");
  const claudeSkillsDir = options.global
    ? path.join(os.homedir(), ".claude", "skills")
    : path.join(process.cwd(), ".claude", "skills");

  const agentsDirAbs = path.resolve(agentsSkillsDir);
  const claudeDirAbs = path.resolve(claudeSkillsDir);
  const agentsSkillDir = path.join(agentsDirAbs, SKILL_INSTALL_NAME);
  const agentsSkillMd = path.join(agentsSkillDir, "SKILL.md");
  const claudeSkillDir = path.join(claudeDirAbs, SKILL_INSTALL_NAME);

  let skillsDirsAreSame = false;
  try {
    if (fs.existsSync(agentsDirAbs) && fs.existsSync(claudeDirAbs)) {
      skillsDirsAreSame = sameRealPath(agentsDirAbs, claudeDirAbs);
    }
  } catch {
    skillsDirsAreSame = false;
  }

  const agentsSkillMdPresent = skillMdExists(agentsSkillMd);

  if (skillsDirsAreSame) {
    throwIfLegacyFlatSkillEntry(agentsSkillDir, `"${SKILL_INSTALL_NAME}" under .agents/skills`);
    if (fs.existsSync(agentsSkillDir) && fs.statSync(agentsSkillDir).isDirectory()) {
      if (agentsSkillMdPresent) {
        console.log(
          `Skill already installed at ${agentsSkillMd} (.claude/skills and .agents/skills are the same directory).`,
        );
        return;
      }
      fs.writeFileSync(agentsSkillMd, content);
      console.log(`Skill written to ${agentsSkillMd}`);
      return;
    }
    fs.mkdirSync(agentsSkillDir, { recursive: true });
    fs.writeFileSync(agentsSkillMd, content);
    console.log(`Skill written to ${agentsSkillMd}`);
    return;
  }

  throwIfLegacyFlatSkillEntry(agentsSkillDir, `"${SKILL_INSTALL_NAME}" under .agents/skills`);
  throwIfLegacyFlatSkillEntry(claudeSkillDir, `"${SKILL_INSTALL_NAME}" under .claude/skills`);

  const agentsSkillDirExists =
    fs.existsSync(agentsSkillDir) && fs.statSync(agentsSkillDir).isDirectory();
  const claudeSkillDirExists =
    fs.existsSync(claudeSkillDir) && fs.statSync(claudeSkillDir).isDirectory();

  if (agentsSkillDirExists && claudeSkillDirExists) {
    if (sameRealPath(agentsSkillDir, claudeSkillDir)) {
      if (agentsSkillMdPresent) {
        console.log(`Skill already installed; ${claudeSkillDir} points to ${agentsSkillDir}.`);
        return;
      }
      fs.writeFileSync(agentsSkillMd, content);
      console.log(`Skill written to ${agentsSkillMd}`);
      return;
    }
    throw new Error(
      `Refusing to overwrite: both ${agentsSkillDir} and ${claudeSkillDir} exist and are not the same directory. Remove or rename one, then run install-skill again.`,
    );
  }

  if (!agentsSkillDirExists && claudeSkillDirExists) {
    throw new Error(
      `Refusing to overwrite: ${claudeSkillDir} already exists but ${agentsSkillDir} does not. Remove or rename the Claude path, then run install-skill again.`,
    );
  }

  const needsClaudeSymlink =
    (agentsSkillDirExists && !claudeSkillDirExists) ||
    (!agentsSkillDirExists && !claudeSkillDirExists);
  const linkClaude = needsClaudeSymlink
    ? await resolveClaudeSymlinkChoice(options.claude, claudeSkillDir)
    : false;

  if (agentsSkillDirExists && !claudeSkillDirExists) {
    if (!agentsSkillMdPresent) {
      fs.writeFileSync(agentsSkillMd, content);
      console.log(`Skill written to ${agentsSkillMd}`);
    }
    if (linkClaude) {
      fs.mkdirSync(path.dirname(claudeSkillDir), { recursive: true });
      symlinkSkillDir(agentsSkillDir, claudeSkillDir);
      console.log(`Linked ${claudeSkillDir} -> ${agentsSkillDir}`);
    } else {
      console.log("Skipped .claude symlink.");
    }
    return;
  }

  fs.mkdirSync(agentsSkillDir, { recursive: true });
  fs.writeFileSync(agentsSkillMd, content);
  console.log(`Skill written to ${agentsSkillMd}`);

  if (linkClaude) {
    fs.mkdirSync(path.dirname(claudeSkillDir), { recursive: true });
    symlinkSkillDir(agentsSkillDir, claudeSkillDir);
    console.log(`Linked ${claudeSkillDir} -> ${agentsSkillDir}`);
  } else {
    console.log("Skipped .claude symlink.");
  }
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

function promptInput(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin as NodeJS.ReadStream & {
      setRawMode?: (mode: boolean) => void;
      isTTY?: boolean;
    };

    if (!stdin.isTTY || !stdin.setRawMode) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    let input = "";
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (char: string) => {
      if (char === "\r" || char === "\n") {
        stdin.removeListener("data", onData);
        stdin.setRawMode!(false);
        stdin.pause();
        process.stdout.write("\n");
        resolve(input.trim());
      } else if (char === "\u0003") {
        process.exit(1);
      } else if (char === "\u007f" || char === "\b") {
        if (!hidden && input.length > 0) process.stdout.write("\b \b");
        input = input.slice(0, -1);
      } else if (char >= " ") {
        if (!hidden) process.stdout.write(char);
        input += char;
      }
    };

    stdin.on("data", onData);
  });
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function cmdInit(): Promise<void> {
  console.log("HubSpot CLI Setup");
  console.log("=".repeat(40));
  console.log();
  console.log("You need a HubSpot Private App access token.");
  console.log("Create one at: Settings > Integrations > Private Apps");
  console.log();

  const existing = process.env.HUBSPOT_ACCESS_TOKEN;
  if (existing) {
    const masked =
      existing.length > 12
        ? existing.slice(0, 8) + "..." + existing.slice(-4)
        : "***";
    console.log(`Current token: ${masked}`);
    const confirm = await promptInput("Replace existing token? [y/N]: ");
    if (confirm.toLowerCase() !== "y") {
      console.log("Keeping existing token.");
      return;
    }
  }

  const token = await promptInput(
    "Enter your HubSpot Private App access token: ",
    true,
  );
  if (!token) throw new Error("No token provided.");

  process.stdout.write("Validating token... ");
  try {
    const client = new HubSpotClient(token);
    await client.get("/crm/v3/properties/contacts");
    console.log("OK");
  } catch (err) {
    console.log("FAILED");
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    const saveAnyway = await promptInput("Save token anyway? [y/N]: ");
    if (saveAnyway.toLowerCase() !== "y") {
      console.log("Aborting.");
      return;
    }
  }

  const existingContent = fs.existsSync(CONFIG_ENV)
    ? fs.readFileSync(CONFIG_ENV, "utf8")
    : "";
  const filteredLines = existingContent
    .split("\n")
    .filter((line) => line.length > 0 && !line.startsWith("HUBSPOT_"));

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    CONFIG_ENV,
    [...filteredLines, `HUBSPOT_ACCESS_TOKEN=${token}`].join("\n") + "\n",
  );

  console.log();
  console.log(`Configuration saved to ${CONFIG_ENV}`);
  console.log("Override any value by setting it in a local .env file.");
  console.log("Run `hubspot search-contacts` to get started.");
}

async function cmdSearchCompanies(opts: {
  query?: string;
  limit: number;
  after?: string;
}): Promise<void> {
  loadConfig();
  const result = await searchCompanies({
    query: opts.query,
    limit: opts.limit,
    after: opts.after,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function cmdSearchDeals(opts: {
  query?: string;
  limit: number;
  after?: string;
}): Promise<void> {
  loadConfig();
  const result = await searchDeals({
    query: opts.query,
    limit: opts.limit,
    after: opts.after,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function cmdSearchTickets(opts: {
  query?: string;
  limit: number;
  after?: string;
}): Promise<void> {
  loadConfig();
  const result = await searchTickets({
    query: opts.query,
    limit: opts.limit,
    after: opts.after,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function cmdSearchContacts(opts: {
  query?: string;
  limit: number;
  after?: string;
}): Promise<void> {
  loadConfig();
  const result = await searchContacts({
    query: opts.query,
    limit: opts.limit,
    after: opts.after,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function cmdGetCompany(opts: { id: string }): Promise<void> {
  loadConfig();
  const result = await getCompany(opts.id);
  console.log(JSON.stringify(result, null, 2));
}

async function cmdGetDeal(opts: { id: string }): Promise<void> {
  loadConfig();
  const result = await getDeal(opts.id);
  console.log(JSON.stringify(result, null, 2));
}

async function cmdGetTicket(opts: { id: string }): Promise<void> {
  loadConfig();
  const result = await getTicket(opts.id);
  console.log(JSON.stringify(result, null, 2));
}

async function cmdGetContact(opts: { id: string }): Promise<void> {
  loadConfig();
  const result = await getContact(opts.id);
  console.log(JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// CLI setup
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("hubspot")
  .description("HubSpot CRM API CLI — search and read CRM objects")
  .version(VERSION);

program
  .command("init")
  .description("Configure HubSpot API credentials")
  .action(async () => {
    try {
      await cmdInit();
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("search-companies")
  .description("Search companies")
  .option("--query, -q <query>", "Search query")
  .option("--limit, -l <n>", "Max results (max 200)", parseInt, 100)
  .option("--after <cursor>", "Pagination cursor")
  .action(async (opts) => {
    try {
      await cmdSearchCompanies({ query: opts.query, limit: opts.limit, after: opts.after });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("search-deals")
  .description("Search deals")
  .option("--query, -q <query>", "Search query")
  .option("--limit, -l <n>", "Max results (max 200)", parseInt, 100)
  .option("--after <cursor>", "Pagination cursor")
  .action(async (opts) => {
    try {
      await cmdSearchDeals({ query: opts.query, limit: opts.limit, after: opts.after });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("search-tickets")
  .description("Search tickets")
  .option("--query, -q <query>", "Search query")
  .option("--limit, -l <n>", "Max results (max 200)", parseInt, 100)
  .option("--after <cursor>", "Pagination cursor")
  .action(async (opts) => {
    try {
      await cmdSearchTickets({ query: opts.query, limit: opts.limit, after: opts.after });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("search-contacts")
  .description("Search contacts")
  .option("--query, -q <query>", "Search query")
  .option("--limit, -l <n>", "Max results (max 200)", parseInt, 100)
  .option("--after <cursor>", "Pagination cursor")
  .action(async (opts) => {
    try {
      await cmdSearchContacts({ query: opts.query, limit: opts.limit, after: opts.after });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("get-company")
  .description("Get company by ID")
  .requiredOption("--id <id>", "Company ID")
  .action(async (opts) => {
    try {
      await cmdGetCompany({ id: opts.id });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("get-deal")
  .description("Get deal by ID")
  .requiredOption("--id <id>", "Deal ID")
  .action(async (opts) => {
    try {
      await cmdGetDeal({ id: opts.id });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("get-ticket")
  .description("Get ticket by ID")
  .requiredOption("--id <id>", "Ticket ID")
  .action(async (opts) => {
    try {
      await cmdGetTicket({ id: opts.id });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("get-contact")
  .description("Get contact by ID")
  .requiredOption("--id <id>", "Contact ID")
  .action(async (opts) => {
    try {
      await cmdGetContact({ id: opts.id });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("install-skill")
  .description(
    "Write .agents/skills/hubspot/SKILL.md; optionally symlink .claude/skills/hubspot (prompt or --claude)",
  )
  .option("--global", "Use ~/.agents/skills and ~/.claude/skills", false)
  .option("--claude", "Create the .claude skills symlink without prompting", false)
  .action(async (opts) => {
    try {
      await cmdInstallSkill({ global: opts.global, claude: opts.claude });
    } catch (err) {
      handleError(err);
    }
  });

function handleError(err: unknown): never {
  if (err instanceof APIError) {
    process.stderr.write(`API error ${err.statusCode}: ${err.message}\n`);
  } else if (err instanceof Error) {
    process.stderr.write(`${err.message}\n`);
  } else {
    process.stderr.write(String(err) + "\n");
  }
  process.exit(1);
}

program.parseAsync(process.argv);
