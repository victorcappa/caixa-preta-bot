const packageJson = require("../package.json");

const nextVersion = packageJson.dependencies?.next || "unknown";
const reactVersion = packageJson.dependencies?.react || "unknown";

console.log(`CAIXA PRETA PROJECT BRAIN

Start:
1. Read AGENTS.md
2. Identify the task domain
3. Read only the routed brain documents
4. Search for symbols before opening implementation files

Current project:
- Next.js ${nextVersion}; React ${reactVersion}; fixed local port 3000
- Public projection: / and registered scene routes
- Private operation: /operator and scene-specific controllers
- Shared in-memory showState; SSE plus revision reconciliation

Useful commands:
- npm run brain:sync
- npm run brain:check
- npm run lint / npm run build (when appropriate)

Source of truth: current implementation wins over brain/history.`);
