const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const LIMITS = {
  "AGENTS.md": 12 * 1024,
  "docs/brain/CURRENT_STATE.md": 16 * 1024,
  "docs/brain/SYSTEM_MAP.md": 16 * 1024,
  "docs/brain/DECISIONS.md": 16 * 1024,
  "docs/brain/LEARNINGS.md": 16 * 1024,
  "docs/brain/OPERATIONS.md": 16 * 1024,
  "docs/brain/ARCHIVE.md": 16 * 1024,
  "docs/brain/INVENTORY.md": 32 * 1024
};
const REQUIRED_FILES = [
  "AGENTS.md",
  "docs/brain/README.md",
  "docs/brain/CURRENT_STATE.md",
  "docs/brain/SYSTEM_MAP.md",
  "docs/brain/DECISIONS.md",
  "docs/brain/LEARNINGS.md",
  "docs/brain/OPERATIONS.md",
  "docs/brain/INVENTORY.md",
  "docs/brain/ARCHIVE.md",
  "scripts/brain-sync.js",
  "scripts/brain-check.js",
  "scripts/brain-summary.js"
];
const PATH_PREFIXES = ["app/", "assets/", "components/", "config/", "data/", "docs/", "knowledge/", "lib/", "prompts/", "scripts/"];
const errors = [];

function fail(message) {
  errors.push(message);
}

for (const file of REQUIRED_FILES) {
  if (!fs.existsSync(path.join(ROOT, file))) fail(`missing required file: ${file}`);
}

for (const [file, limit] of Object.entries(LIMITS)) {
  const absolute = path.join(ROOT, file);
  if (!fs.existsSync(absolute)) continue;
  const size = fs.statSync(absolute).size;
  if (size > limit) fail(`${file} is ${size} bytes; limit is ${limit}`);
}

const agentsPath = path.join(ROOT, "AGENTS.md");
if (fs.existsSync(agentsPath)) {
  const lines = fs.readFileSync(agentsPath, "utf8").split(/\r?\n/).length;
  if (lines >= 200) fail(`AGENTS.md has ${lines} lines; it must stay below 200`);
}

const inventoryPath = path.join(ROOT, "docs", "brain", "INVENTORY.md");
if (fs.existsSync(inventoryPath)) {
  const inventory = fs.readFileSync(inventoryPath, "utf8");
  if (!inventory.includes("AUTO-GENERATED INVENTORY")) fail("INVENTORY.md lacks its generated-content warning");
  if ((inventory.match(/<!-- GENERATED:START -->/g) || []).length !== 1) fail("INVENTORY.md must contain one GENERATED:START marker");
  if ((inventory.match(/<!-- GENERATED:END -->/g) || []).length !== 1) fail("INVENTORY.md must contain one GENERATED:END marker");
}

for (const file of REQUIRED_FILES.filter((item) => item.endsWith(".md"))) {
  const absolute = path.join(ROOT, file);
  if (!fs.existsSync(absolute)) continue;
  const source = fs.readFileSync(absolute, "utf8");

  for (const match of source.matchAll(/`([^`\n]+)`/g)) {
    const reference = match[1].replace(/[#?].*$/, "").replace(/[.,:;]+$/, "");
    const looksLocal = PATH_PREFIXES.some((prefix) => reference.startsWith(prefix))
      || ["AGENTS.md", "README.md", "package.json", "next.config.js", "jsconfig.json", "eslint.config.mjs"].includes(reference);
    if (!looksLocal || /[ *{}<>|]/.test(reference)) continue;
    if (!fs.existsSync(path.join(ROOT, reference))) fail(`${file} references missing path: ${reference}`);
  }

  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9_-]{16,}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/
  ];
  if (secretPatterns.some((pattern) => pattern.test(source))) fail(`${file} contains an obvious credential pattern`);
}

const packagePath = path.join(ROOT, "package.json");
if (fs.existsSync(packagePath)) {
  const scripts = JSON.parse(fs.readFileSync(packagePath, "utf8")).scripts || {};
  for (const name of ["brain:sync", "brain:check", "brain:summary"]) {
    if (!scripts[name]) fail(`package.json is missing script ${name}`);
  }
}

if (errors.length) {
  console.error("BRAIN CHECK FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`BRAIN CHECK PASSED (${REQUIRED_FILES.length} required files, ${Object.keys(LIMITS).length} size limits)`);
