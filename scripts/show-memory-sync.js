import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const local = path.resolve(".venv-pdf/bin/python");
const python = process.env.CAIXA_PRETA_PDF_PYTHON || (fs.existsSync(local) ? local : "python3");
const result = spawnSync(python, ["scripts/show-memory-sync.py"], { stdio: "inherit" });
if (result.error) console.error(result.error.message);
if (result.status !== 0) console.error("Use Python com PyMuPDF; indique-o em CAIXA_PRETA_PDF_PYTHON. O PDF original não é modificado.");
process.exitCode = result.status || (result.error ? 1 : 0);
