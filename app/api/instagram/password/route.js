import { spawn } from "node:child_process";
import { getInstagramConfig, loadInstagramCredentials } from "@/lib/instagram/InstagramController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache"
};

function copyToSystemClipboard(value) {
  return new Promise((resolve, reject) => {
    const clipboard = spawn("pbcopy", [], { stdio: ["pipe", "ignore", "ignore"] });
    clipboard.once("error", reject);
    clipboard.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("PBCOPY_FAILED"));
    });
    clipboard.stdin.end(value);
  });
}

export async function POST(request) {
  if (request.headers.get("x-caixa-preta-operator") !== "scene-zero") {
    return Response.json({ error: "CONTROLE DO OPERADOR NECESSÁRIO" }, {
      status: 403,
      headers: PRIVATE_HEADERS
    });
  }

  try {
    const credentials = await loadInstagramCredentials(getInstagramConfig().credentialsPath);
    if (!credentials?.password) {
      return Response.json({ error: "SENHA DO INSTAGRAM NÃO CONFIGURADA" }, {
        status: 404,
        headers: PRIVATE_HEADERS
      });
    }

    await copyToSystemClipboard(credentials.password);
    return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
  } catch {
    return Response.json({ error: "NÃO FOI POSSÍVEL LER A SENHA DO INSTAGRAM" }, {
      status: 500,
      headers: PRIVATE_HEADERS
    });
  }
}
