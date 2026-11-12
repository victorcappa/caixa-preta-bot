// Five bounded real generations through the actual live-training adapter, never the active show.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

if (!process.argv.includes("--live")) throw new Error("Use --live para consultar o modelo real.");
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada.");
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-memory-live-"));
for (const item of ["knowledge", "data", "Texto caixa preta.pdf", "assets/tarot/CAIXA_PRETA_REFERENCIAS_TARO.md", "assets/sampler-forca-g/manifest.json"]) {
  fs.mkdirSync(path.dirname(path.join(directory, item)), { recursive: true });
  fs.cpSync(path.join(repository, item), path.join(directory, item), { recursive: true });
}
process.env.CAIXA_PRETA_SHOW_RUNTIME_DIR = path.join(directory, "runtime");
process.env.OPENAI_SHOW_TIMEOUT_MS = "15000";
process.chdir(directory);
registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = pathToFileURL(path.resolve(repository, specifier.slice(2))).href;
  else if (specifier.startsWith(".")) url = new URL(specifier, context.parentURL).href;
  if (url?.startsWith("file:") && !path.extname(fileURLToPath(url)) && fs.existsSync(`${fileURLToPath(url)}.js`)) return nextResolve(`${url}.js`, context);
  return nextResolve(url || specifier, context);
} });
const results = [];
try {
  const { streamLiveTrainingReply } = await import("../lib/openai.js");
  const { resolveOpenAIModel } = await import("../lib/openaiModels.js");
  const model = resolveOpenAIModel(process.env.OPENAI_MODEL);
  const cases = [
    { id: "atual-versus-rascunho", question: "Quero conferir o que você sabe: qual é a ordem NUMÉRICA atual das três malas e a ação em cada uma? A mala falsa do PDF ainda é a regra? Responda concretamente.", patterns: [/2[\s\S]*1[\s\S]*3/, /bexiga/i, /forca/i, /toca.discos/i] },
    { id: "cenas-8-9", question: "No rascunho, o que se propõe para as cenas 8 e 9? Inclua os fones e o veículo de Elisa. Isso já é uma sequência consolidada?", patterns: [/fone/i, /bicicleta/i, /propost|rascunho|desenvolvimento|chute|consolidada/i] },
    { id: "cenas-3-6", question: "Que aparelho registra a voz na cena 3, a quem ele se liga, e qual pintor se relaciona à acromatopsia na cena 6? Como corpo e arquivo se cruzam aí?", patterns: [/fon[oó]grafo/i, /Edison/i, /Jonathan/i] },
    { id: "cenas-1-2-4-5-7", question: "Dê uma frase concreta para cada cena: 1 aeroporto; 2 queda e corpo; 4 piloto e observadora; 5 mão; 7 caixas pretas e ensaio. Quero reconhecer a matéria específica de cada uma. Nomeie a observadora e o dispositivo usado por Elisa.", patterns: [/aeroporto|medalha|quati|colis[aã]o/i, /força G|G.LOC|redout/i, /ge[oó]grafa|gamer/i, /borracha|destac[aá]vel/i, /ensaio|rehearsal/i] },
    { id: "referencias", question: "Quais ligações concretas o arquivo da peça faz com A Invenção de Morel e com Janaina Leite? Não invente citações literais.", patterns: [/Morel/i, /Janaina|Janaína/i, /duplic|repet|ilha|proje/i, /real|document|autofic|testemunh/i] }
  ];
  const caseId = process.argv.find(argument => argument.startsWith("--case="))?.slice(7);
  const selected = caseId ? cases.filter(test => test.id === caseId) : cases;
  assert(selected.length, "Caso de teste desconhecido.");
  for (const test of selected) {
    let answer = "";
    const started = Date.now();
    try {
      await streamLiveTrainingReply({ state: { model, mode: "live-training", memories: [], conversation: [],
        liveTraining: { messages: [{ id: test.id, role: "user", content: test.question, status: "complete" }] } },
        signal: new AbortController().signal, onDelta: delta => { answer += delta; } });
      const missing = test.patterns.filter(pattern => !pattern.test(answer)).map(String);
      results.push({ id: test.id, question: test.question, answer, ms: Date.now() - started, missing, pass: !missing.length });
      console.log(`${test.id}: ${missing.length ? "REVISAR" : "PASS"}`);
    } catch (error) {
      results.push({ id: test.id, answer, pass: false, error: { name: error.name, status: error.status, code: error.code } });
      console.log(`${test.id}: falha do provedor (${error.status || error.name})`);
      break;
    }
  }
  fs.writeFileSync(path.join(directory, "model-evaluation.json"), JSON.stringify({ model, live: true, results }, null, 2));
  console.log(`Evidências: ${path.join(directory, "model-evaluation.json")}`);
  assert(results.length === selected.length && results.every(result => result.pass), "Amostra real incompleta ou com lacunas; consulte as respostas, sem confundir indisponibilidade com memória validada.");
} finally { process.chdir(repository); }
