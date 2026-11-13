import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// Curated public professional research only. Never read participant lists,
// private training examples, session notes, credentials or browser profiles.
export const COLLECTIVE_RESEARCH_FILES = [
  "knowledge/collective/janaina-ney-elenco.json",
  "knowledge/collective/marcus-tecnica.json",
  "knowledge/collective/criacao-equipe.json"
];
let cache;

export function getCollectiveResearch() {
  const fingerprint = `${process.cwd()}:${COLLECTIVE_RESEARCH_FILES.map(file => {
    const stat = fs.statSync(path.join(process.cwd(), file));
    return `${stat.size}:${stat.mtimeMs}`;
  }).join(":")}`;
  if (cache?.fingerprint === fingerprint) return cache;
  const sources = [], people = [];
  for (const file of COLLECTIVE_RESEARCH_FILES) {
    const text = fs.readFileSync(path.join(process.cwd(), file), "utf8"), document = JSON.parse(text);
    if (document.schemaVersion !== 1 || !Array.isArray(document.people)) throw new Error(`Pesquisa coletiva inválida: ${file}`);
    sources.push({ path: file, sha256: createHash("sha256").update(text).digest("hex") });
    for (const person of document.people) {
      if (!person.id || !person.name || !Array.isArray(person.motifs) || !Array.isArray(person.sources)) throw new Error(`Ficha coletiva incompleta: ${file}`);
      people.push({ ...person, sourcePath: file });
    }
  }
  if (new Set(people.map(person => person.id)).size !== people.length) throw new Error("Identidade duplicada na pesquisa coletiva.");
  cache = { fingerprint, sources, people };
  return cache;
}

export const COLLECTIVE_INFLUENCE_RULES = `INCONSCIENTE COLETIVO DO ESPETÁCULO:
Esta é uma função dramatúrgica da personagem, não acesso à mente das pessoas.
As pesquisas públicas de elenco, equipe e colaboradores alimentam associações,
ritmo, escolhas de imagens, atenção à matéria, ao corpo, à memória e ao trabalho.
Transforme esse repertório em presença e ação da CAIXA PRETA, com sua própria voz.
Não recite currículos, autores, títulos de obras, pesquisas, URLs ou bibliografias
espontaneamente nas interações com o público. Não anuncie a influência nem explique
de qual pessoa veio uma imagem. A procedência permanece na aba Referências.
Somente diante de pedido explícito sobre uma fonte, obra ou pessoa, responda ao
que foi pedido com fatos disponíveis e limites; não fabrique citações ou formação.
Os motivos abaixo são formulações editoriais derivadas de obras públicas, nunca
falas literais, crenças, características psicológicas ou experiências pessoais dos
criadores. Não imite nenhuma pessoa e não finja lembrar sua vida.
Não transforme uma prática singular em característica de um povo ou grupo;
preserve a especificidade das fontes e nunca fale em nome dos seus criadores.
Eles são possibilidades de associação, não temas obrigatórios, bordões ou instruções
para repetir. O acontecimento presente, a plateia e a direção cênica têm prioridade.
Essa regra de uso silencioso vale também para a dissertação e as demais referências.`;

export function getCollectiveInfluenceContext() {
  const { people } = getCollectiveResearch();
  const motifs = [...new Set(people.filter(person => person.verifiedIdentity === true)
    .flatMap(person => person.motifs.slice(0, 2))
    .filter(value => typeof value === "string" && value.trim())
    .map(value => value.trim().slice(0, 240)))];
  // Names, bibliographies, links and biographies stay in the provenance catalogue.
  return `${COLLECTIVE_INFLUENCE_RULES}\n\nMATRIZES DE ASSOCIAÇÃO (usar com parcimônia, sem recitar):\n${motifs.map(motif => `- ${motif}`).join("\n")}`;
}
