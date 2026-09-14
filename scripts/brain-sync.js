const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, "docs", "brain", "INVENTORY.md");
const START = "<!-- GENERATED:START -->";
const END = "<!-- GENERATED:END -->";
const SKIP_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".runtime",
  ".venv-pdf",
  "bot-old",
  "node_modules"
]);

function relative(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function walk(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return [];
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute, predicate));
    else if (predicate(absolute)) files.push(relative(absolute));
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function routeFromPage(file) {
  const route = file.replace(/^app/, "").replace(/\/page\.js$/, "");
  return route || "/";
}

function routeFromApi(file) {
  return file.replace(/^app/, "").replace(/\/route\.js$/, "");
}

function methodsFor(file) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  return [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)]
    .map((match) => match[1]);
}

function envNames() {
  const candidates = walk(ROOT, (file) => /\.(?:js|mjs|cjs)$/.test(file));
  const names = new Set();

  for (const file of candidates) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      names.add(match[1]);
    }
  }

  return [...names].sort();
}

function bullets(items, render = (item) => `\`${item}\``) {
  if (!items.length) return "- None found.";
  return items.map((item) => `- ${render(item)}`).join("\n");
}

function buildGeneratedInventory() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const pages = walk(path.join(ROOT, "app"), (file) => file.endsWith("/page.js") || file === "app/page.js");
  const apiRoutes = walk(path.join(ROOT, "app", "api"), (file) => file.endsWith("/route.js"));
  const components = walk(path.join(ROOT, "components"), (file) => file.endsWith(".js"));
  const controllers = [
    ...pages.filter((file) => file.includes("-controller/")),
    ...components.filter((file) => /Controller\.js$/.test(file)),
    "lib/controllerSurfaces.js"
  ].filter((file, index, list) => list.indexOf(file) === index && fs.existsSync(path.join(ROOT, file))).sort();
  const tests = walk(path.join(ROOT, "scripts"), (file) => /(?:^|-)test\.js$/.test(path.basename(file)));
  const configs = walk(ROOT, (file) => (
    /(?:^|\/)(?:[^/]+\.config\.(?:js|mjs|cjs)|jsconfig\.json)$/.test(file)
    || file.startsWith("config/")
  ));
  const workflows = walk(path.join(ROOT, ".github", "workflows"));
  const importantDirectories = [
    ["app/", "App Router pages and server API routes"],
    ["components/", "shared public and operator React UI"],
    ["lib/", "show state, synchronization, directors, and domain logic"],
    ["data/", "curated runtime configuration and persisted local JSON"],
    ["prompts/", "system prompt composition and dramaturgical modes"],
    ["knowledge/", "curated source material loaded into the model context"],
    ["assets/", "local audio, video, image, and sampler media"],
    ["scripts/", "cheap checks, simulations, browser checks, and utilities"],
    ["docs/", "detailed documentation and this operational brain"]
  ].filter(([directory]) => fs.existsSync(path.join(ROOT, directory)));

  return [
    START,
    "",
    "## Package scripts",
    "",
    bullets(Object.entries(packageJson.scripts || {}), ([name, command]) => `\`npm run ${name}\` -> \`${command}\``),
    "",
    "## App pages",
    "",
    bullets(pages, (file) => `\`${routeFromPage(file)}\` -> \`${file}\``),
    "",
    "## API routes",
    "",
    bullets(apiRoutes, (file) => {
      const methods = methodsFor(file);
      return `\`${methods.join(", ") || "unknown"} ${routeFromApi(file)}\` -> \`${file}\``;
    }),
    "",
    "## Components",
    "",
    bullets(components),
    "",
    "## Controllers and controller routes",
    "",
    bullets(controllers),
    "",
    "## Configuration files",
    "",
    bullets(configs),
    "",
    "## Environment variable names",
    "",
    "> Names only. Values are intentionally never collected.",
    "",
    bullets(envNames()),
    "",
    "## Workflows",
    "",
    bullets(workflows),
    "",
    "## Important directories",
    "",
    bullets(importantDirectories, ([directory, description]) => `\`${directory}\` - ${description}`),
    "",
    "## Test and browser-check scripts",
    "",
    bullets(tests),
    "",
    "> Excluded from inventory traversal: generated/build data, runtime browser profiles, dependencies, virtual environments, Git internals, and the archived \`bot-old/\` tree.",
    "",
    END
  ].join("\n");
}

function main() {
  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error("docs/brain/INVENTORY.md does not exist");
  }

  const current = fs.readFileSync(INVENTORY_PATH, "utf8");
  const startIndex = current.indexOf(START);
  const endIndex = current.indexOf(END);

  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    throw new Error("INVENTORY.md is missing generated-section markers");
  }

  const before = current.slice(0, startIndex);
  const after = current.slice(endIndex + END.length);
  const next = `${before}${buildGeneratedInventory()}${after}`;
  fs.writeFileSync(INVENTORY_PATH, next.endsWith("\n") ? next : `${next}\n`);
  console.log("BRAIN INVENTORY SYNCED");
}

main();
