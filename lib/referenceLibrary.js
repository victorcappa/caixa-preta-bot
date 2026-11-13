import fs from "node:fs/promises";
import path from "node:path";
import { islandTopics, referenceAffinities } from "./referenceIsland.js";
import { knowledgeFiles } from "./knowledge.js";
import { showMemoryArchive } from "./showMemory.js";
import { getCollectiveResearch } from "./collectiveMemory.js";

const DOSSIER = "assets/tarot/CAIXA_PRETA_REFERENCIAS_TARO.md";
const groups = [
  { id: "objetos", label: "Objetos da ilha", description: "Modelos locais da peça; sua geometria visual não é conhecimento textual lido pelo bot." },
  { id: "pessoas", label: "Constelação humana", description: "Percursos públicos de criação que alimentam associações da personagem." },
  { id: "pesquisa", label: "Pesquisa", description: "Pesquisa acadêmica incorporada ao acervo textual." },
  { id: "dramaturgia", label: "Dramaturgia", description: "Documentos de trabalho da peça, preservados com suas versões." },
  { id: "universo", label: "Universo da peça", description: "Mapas permanentes enviados como conhecimento local ao modelo." },
  { id: "dossie", label: "Arquivo de relações", description: "Recortes, fatos datados e associações escritos para o bot." },
  { id: "cena", label: "Matéria de cena", description: "Falas e instruções autorais recuperáveis do projeto atual." },
  { id: "bibliografia", label: "Fontes citadas", description: "Obras e documentos citados pelo dossiê; seus textos integrais não estão incorporados." }
];

const sourceLabels = {
  "data/audience-warmup-prompts.js": ["Perguntas à plateia", "Perguntas e etapas autorais do aquecimento.", ["plateia", "perguntas"]],
  "data/audience-warmup-reactions.js": ["Reações à plateia", "Respostas autorais às ações e aos silêncios da plateia.", ["plateia", "reação"]],
  "data/audience-warmup-minigames.js": ["Jogos de aquecimento", "Regras e chamadas dos jogos em dupla.", ["jogo", "corpo"]],
  "data/scene-zero-unlock.js": ["Destravar a peça", "Falas da inicialização e da verificação humana.", ["máquina", "obediência"]],
  "data/scene-zero-morel.js": ["Morel no BIOS", "Montagem autoral de vozes, registro e repetição para o BIOS.", ["Morel", "registro"]],
  "data/scene-zero-emergence.js": ["Emergências da máquina", "Textos de passagem e aparecimento da máquina.", ["glitch", "presença"]],
  "data/scene-zero-participant-waiting.js": ["À espera de alguém", "Falas de espera pelo participante.", ["espera", "plateia"]],
  "data/scene-zero-physical-challenges.js": ["Desafios físicos", "Instruções autorais que convertem palavras em ações.", ["corpo", "instrução"]],
  "data/scene-zero-hangman-words.js": ["Palavras da forca", "Vocabulário autoral dos desafios de palavras.", ["palavra", "jogo"]],
  "lib/scene-zero/suitcaseGame.js": ["As três malas", "Ordem, regras e falas atuais do jogo das malas.", ["mala", "jogo"]],
  "lib/controllerSurfaces.js": ["Mapa das cenas", "Nomes e descrições das superfícies atuais do espetáculo.", ["cena", "operação"]],
  "data/controller-cues.json": ["Deixas editáveis", "Textos e rótulos autorais das deixas de cena.", ["deixa", "cena"]],
  "data/queda-aviao-default.json": ["A queda", "Texto e instruções atuais da cena de queda.", ["queda", "avião"]],
  "data/coleta-de-dados.json": ["A plateia como dado", "Concepção e repertório autoral da coleta de dados.", ["plateia", "dados"]],
  "assets/sampler-forca-g/manifest.json": ["Arquivo Força G", "Rótulos e descrições textuais do sampler; o índice não escuta seus áudios.", ["corpo", "som"]]
};

function plain(value = "") {
  return String(value).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function excerpt(text = "") {
  const value = plain(text);
  return value.length > 500 ? `${value.slice(0, 497).trimEnd()}…` : value;
}

function proseExcerpt(text = "") {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, "").split(/\n\s*\n/)
    .filter(part => part.trim() && !/^\s*#/.test(part) && !/^\*\*(?:Status|Tags|Arcanos|Fontes|Conexões|Verificação)/.test(part));
  return excerpt(body[0] || text);
}

function safeUrl(value) {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}

function readingStatus(work) {
  const value = work.coverage || work.materialRead || work.readStatus || work.contentStatus;
  const labels = {
    full_text_indexed: "Texto integral extraído e indexado; consulte a ficha própria do material.",
    metadata_and_original_summary: "Metadados públicos e resumo editorial; obra integral não incorporada.",
    "metadata-and-abstract": "Metadados e resumo institucional consultados; texto integral não incorporado.",
    "publisher-presentation": "Apresentação editorial consultada; livro integral não incorporado.",
    "publisher-description-and-metadata": "Descrição e metadados editoriais consultados; livro integral não incorporado.",
    "publisher-synopsis-and-metadata": "Sinopse e metadados editoriais consultados; livro integral não incorporado.",
    "artist-synopsis-and-credits": "Sinopse e créditos autorais consultados; espetáculo completo não observado.",
    "artist-project-description": "Descrição autoral de projeto consultada; realização completa não observada.",
    "author-article-abstract-and-bio": "Resumo de artigo e apresentação profissional do autor consultados.",
    "institutional-presentation": "Apresentação institucional consultada; obra integral não incorporada.",
    "institutional-programme-and-credits": "Programa e créditos institucionais consultados; montagem completa não observada.",
    "institutional-indexed-programme": "Trecho de programação institucional indexado; página antiga redireciona.",
    "institutional-project-description-and-credits": "Descrição e créditos institucionais consultados; projeto completo não observado.",
    "institutional-exhibition-description": "Descrição institucional da exposição consultada; visita não realizada.",
    "institutional-synopsis-and-credits": "Sinopse e créditos institucionais consultados; obra integral não incorporada.",
    "producer-synopsis-and-credits": "Sinopse e créditos publicados pelo produtor consultados; obra completa não observada.",
    "production-press-release-and-credits": "Divulgação da produção e créditos consultados; obra completa não observada.",
    "residency-project-description": "Descrição pública da residência consultada; publicação integral não incorporada.",
    "professional-organization-profile": "Perfil profissional público consultado; operação do projeto não verificada.",
    "public-interview": "Entrevista pública consultada; metodologia integral não observada."
  };
  return plain(labels[value] || value || "Consulta pública documentada; material integral não incorporado.");
}

function itemDefaults(item) {
  return { author: "Equipe Caixa Preta", year: null, sourceUrl: null, coverUrl: null, pageCount: null, chunkCount: 0,
    checkedAt: null, tags: [], relatedIds: [], sha256: null, ...item };
}

// This is a catalogue of the explicit static retrieval corpus. Do not crawl the
// repository, runtime state, training examples, private notes or uploaded files.
export async function getReferenceLibrary() {
  const archive = await showMemoryArchive();
  const items = [];
  const digestByPath = new Map(archive.coverage.sources.map(source => [source.path, source.sha256]));
  const chunksFor = source => archive.index.chunks.filter(chunk => chunk.origin === source);
  const knowledge = await Promise.all(knowledgeFiles.map(async file => {
    const sourcePath = `knowledge/${file}`;
    const text = await fs.readFile(path.join(process.cwd(), sourcePath), "utf8");
    return itemDefaults({ id: `knowledge-${file.replace(/\.md$/, "")}`, title: plain(text.match(/^#\s+(.+)$/m)?.[1] || file),
      group: "universo", kind: "Mapa de conhecimento", sourcePath, sha256: digestByPath.get(sourcePath),
      description: "Texto local incorporado ao contexto permanente de conhecimento da peça.",
      status: "canonical", statusLabel: "Contexto permanente", evidence: "O conteúdo deste arquivo é carregado por getKnowledgeContext().",
      excerpt: proseExcerpt(text), tags: ["peça", "conhecimento local"] });
  }));
  items.push(...knowledge);

  // Transcripts are discovered only among the already verified archive sources.
  // The archive verifies the original PDF hash, page sequence and extracted text.
  for (const source of archive.coverage.sources.filter(source => /^knowledge\/sources\/[^/]+\.json$/.test(source.path))) {
    const transcript = JSON.parse(await fs.readFile(path.join(process.cwd(), source.path), "utf8"));
    const chunks = chunksFor(transcript.source);
    if (!chunks.length) continue;
    const dissertation = /marcus|labirinto/i.test(`${transcript.source} ${transcript.title || ""}`);
    const continuation = transcript.source.includes("proximas-etapas");
    const title = dissertation ? "Labirinto de Labirintos" : continuation ? "Continuação da peça" : "A Caixa Preta — texto de trabalho";
    const usefulPage = dissertation ? transcript.pages.find(page => /RESUMO/.test(page.text) && /Esta dissertação/.test(page.text)) :
      transcript.pages.find(page => /CENA\s+[01]\b/i.test(page.text));
    items.push(itemDefaults({ id: dissertation ? "marcus-garcia-labirinto" : continuation ? "dramaturgia-continuacao" : "dramaturgia-texto",
      title, subtitle: dissertation ? "O trabalho técnico entre o aprisionamento e a possibilidade no teatro" : null,
      author: dissertation ? "Marcus Vinícius de Melo Garcia" : "Equipe Caixa Preta", year: dissertation ? 2025 : null,
      group: dissertation ? "pesquisa" : "dramaturgia", kind: dissertation ? "Dissertação · ECA/USP" : "PDF de trabalho",
      description: dissertation ? "Pesquisa do diretor técnico sobre pessoas, objetos e práticas da técnica teatral. Versão corrigida, orientada por Cibele Forjaz Simões." :
        continuation ? "Continuação atual da dramaturgia. Propostas futuras conservam seu caráter de desenvolvimento." : "Rascunho da dramaturgia. As regras atuais de operação prevalecem quando há diferenças entre versões.",
      status: "indexed", statusLabel: "Texto integral indexado", sourcePath: transcript.source,
      sourceUrl: safeUrl(transcript.sourceUrl || transcript.url || transcript.metadata?.sourceUrl),
      coverUrl: dissertation ? "/references/labirinto-de-labirintos.png" : null,
      sha256: transcript.sha256, pageCount: transcript.pageCount, chunkCount: chunks.length,
      evidence: `${transcript.pageCount} páginas de texto extraído; ${chunks.length} fragmentos no índice de recuperação. A extração textual não equivale à leitura visual das imagens.`,
      excerpt: excerpt(usefulPage?.text || transcript.pages[0]?.text),
      tags: dissertation ? ["técnica", "teatro", "trabalho", "objetos"] : ["dramaturgia", "arquivo", "versão de trabalho"] }));
  }

  const dossierText = await fs.readFile(path.join(process.cwd(), DOSSIER), "utf8");
  const sections = [...dossierText.matchAll(/^##\s+\[(CP-\d+)\]\s+(.+)$/gm)].map((match, i, matches) => ({
    id: match[1], title: match[2], text: dossierText.slice(match.index + match[0].length, matches[i + 1]?.index ?? dossierText.length)
  }));
  // Only the CP section body belongs to the last section, not the following
  // bibliography or appendices, which have their own records below.
  for (const section of sections) section.text = section.text.split(/^#{1,2}\s+(?!\[CP-)/m)[0];
  const bibliography = [...dossierText.matchAll(/^- \*\*\[(E\d+)\]\*\*\s+(.+)$/gm)].map(match => ({ id: match[1], text: match[2] }));
  const checkedAt = dossierText.match(/pesquisa_complementar_verificada_em:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1] || null;
  const dossierChunks = chunksFor(DOSSIER);
  items.push(itemDefaults({ id: "arquivo-taro", title: "Arquivo de referências do Tarô", group: "dossie", kind: "Dossiê autoral",
    description: "Arquivo de relações entre a peça, memória, corpo, imagens, máquinas e disputas do presente.",
    status: "dossier", statusLabel: "Dossiê local indexado", sourcePath: DOSSIER, sha256: digestByPath.get(DOSSIER),
    chunkCount: dossierChunks.length, checkedAt, excerpt: proseExcerpt(dossierText), tags: ["Tarô", "memória", "associação"],
    evidence: `${sections.length} recortes locais e ${bibliography.length} registros bibliográficos. Os links citados não equivalem a textos integrais incorporados.`,
    relatedIds: sections.map(section => section.id) }));
  for (const section of sections) {
    const chunks = dossierChunks.filter(chunk => chunk.sectionId === section.id);
    const tags = section.text.match(/^\*\*Tags:\*\*\s*(.+)$/m)?.[1]?.match(/`([^`]+)`/g)?.map(tag => tag.slice(1, -1)) || [];
    const recordCheckedAt = section.text.match(/^\*\*Verificação:\*\*\s*(\d{4}-\d{2}-\d{2})/m)?.[1] || null;
    const references = [...new Set([...section.text.matchAll(/\bE\d{2}\b/g)].map(match => match[0]))];
    items.push(itemDefaults({ id: section.id, title: plain(section.title), group: "dossie", kind: "Recorte de pesquisa",
      description: `Recorte ${section.id} do arquivo de referências. ${plain(section.text.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1] || "Associação e pesquisa local").replace(/\s+/g, " ")}.`,
      status: "dossier", statusLabel: "Recorte local indexado", sourcePath: DOSSIER, sha256: digestByPath.get(DOSSIER),
      chunkCount: chunks.length, checkedAt: recordCheckedAt, excerpt: proseExcerpt(section.text), tags,
      relatedIds: [...new Set(["arquivo-taro", ...references, ...[...section.text.matchAll(/\bCP-\d{2}\b/g)].map(match => match[0])])].filter(id => id !== section.id),
      evidence: `${chunks.length} fragmentos recuperáveis do dossiê local. Fatos datados mantêm a data da pesquisa; associações são propostas de leitura.` }));
  }
  for (const reference of bibliography) {
    const sourceUrl = safeUrl(reference.text.match(/https?:\/\/\S+/)?.[0]);
    const label = reference.text.replace(/:\s*https?:\/\/.*$/, "");
    const titleMatch = label.match(/\*([^*]+)\*/);
    const author = label.includes(" — ") ? label.split(" — ")[0] : null;
    const year = label.match(/\b((?:19|20)\d{2})\b/)?.[1];
    const relatedIds = sections.filter(section => new RegExp(`\\b${reference.id}\\b`).test(section.text)).map(section => section.id);
    items.push(itemDefaults({ id: reference.id, title: plain(titleMatch?.[1] || label), author: author ? plain(author) : "Autoria indicada na fonte",
      year: year ? Number(year) : null, group: "bibliografia", kind: "Referência bibliográfica", status: "cited", statusLabel: "Citada no dossiê",
      sourcePath: DOSSIER, sourceUrl, description: "Fonte externa citada no arquivo local. O bot recebe o recorte e a referência bibliográfica; o texto integral desta fonte não está incorporado por este registro.",
      excerpt: excerpt(label), relatedIds, tags: ["bibliografia"],
      evidence: `Registro ${reference.id} presente no dossiê${relatedIds.length ? ` e associado a ${relatedIds.join(", ")}` : ""}. Link original sem revalidação nesta aba.` }));
  }

  const authoredSources = [...new Set(archive.documents.filter(document => document.kind === "current").map(document => document.origin))];
  for (const sourcePath of authoredSources) {
    const [title, description, tags] = sourceLabels[sourcePath] || [path.basename(sourcePath), "Material autoral do projeto atual disponível à recuperação textual.", ["cena"]];
    const documents = archive.documents.filter(document => document.origin === sourcePath && document.kind === "current");
    const text = documents.map(document => document.text).join("\n\n");
    items.push(itemDefaults({ id: `cena-${sourcePath.replace(/[^a-z0-9]+/gi, "-").replace(/-$/, "")}`, title, description,
      group: "cena", kind: "Texto autoral de cena", status: "authored", statusLabel: "Texto do projeto indexado", sourcePath,
      sha256: digestByPath.get(sourcePath), chunkCount: chunksFor(sourcePath).length,
      excerpt: excerpt(text.replace(/^.*?: /m, "")), tags,
      evidence: "Somente os textos autorais extraídos desta fonte entram no índice. Código, parâmetros numéricos e conteúdo audiovisual não são tratados como leitura." }));
  }

  const collective = getCollectiveResearch();
  const researchDigests = new Map(collective.sources.map(source => [source.path, source.sha256]));
  for (const person of collective.people) {
    const works = [
      ...(person.academicWorks || []).map(work => ({ ...work, category: "Pesquisa acadêmica" })),
      ...(person.artisticWorks || []).map(work => ({ ...work, category: "Criação artística" })),
      ...(person.researchWorks || []).map(work => ({ ...work, category: "Pesquisa e prática" }))
    ].map(work => ({ title: plain(work.title), year: work.year ?? null, kind: plain(work.type || work.role || work.category),
      category: work.category, url: safeUrl(work.url), summary: excerpt(work.summary || ""), readStatus: readingStatus(work),
      sourceId: items.find(item => item.sourcePath === work.localSource)?.id || null }));
    const sources = (person.sources || []).map(source => ({ url: safeUrl(source.url), title: plain(source.title), accessedAt: source.accessedAt || null })).filter(source => source.url);
    const active = person.verifiedIdentity === true && person.motifs.length > 0;
    const motifs = person.motifs.filter(motif => typeof motif === "string").map(motif => excerpt(motif));
    items.push(itemDefaults({ id: `pessoa-${person.id}`, title: person.name, author: person.name, group: "pessoas", kind: person.creditRole || "Pessoa da rede criativa",
      description: works.length ? `${works.length} trabalhos ou práticas públicos documentados. ${person.creditRole || "Pesquisa de repertório do espetáculo"}.` :
        "Pesquisa pública com lacunas registradas; nenhum trabalho foi atribuído sem verificação.",
      status: active ? "influence" : "research", statusLabel: active ? "Pesquisa pública · influência silenciosa" : "Pesquisa parcial · sem influência atribuída",
      sourcePath: person.sourcePath, sourceUrl: sources[0]?.url || null, sha256: researchDigests.get(person.sourcePath),
      checkedAt: sources.map(source => source.accessedAt).find(Boolean) || null,
      excerpt: excerpt(motifs[0] || works[0]?.summary || person.identityEvidence || "Identidade e obras permanecem por verificar."),
      tags: [person.membership === "research-collaborator" ? "colaborador de pesquisa" : "elenco e equipe", ...new Set(works.map(work => work.category.toLocaleLowerCase("pt-BR")))],
      evidence: active ? "Motivos editoriais derivados de pesquisa pública entram como associações no contexto da personagem. Estes registros contêm resumos, exceto materiais com ficha integral própria no acervo." :
        "Registro de pesquisa com identidade ou obra insuficientemente verificada. Este catálogo conserva a lacuna e não atribui influência ao bot.",
      works, sources, motifs, limitations: person.limitations || [], identityStatus: person.identityStatus || (person.verifiedIdentity ? "confirmed" : "unknown"),
      membership: person.membership || "core-team", relatedIds: [...new Set(works.map(work => work.sourceId).filter(Boolean))] }));
  }

  const island = JSON.parse(await fs.readFile(path.join(process.cwd(), "public/references/island/manifest.json"), "utf8"));
  for (const model of island.models) {
    const topic = islandTopics.find(topic => topic.id === model.topic);
    items.push(itemDefaults({ id: `objeto-${model.id}`, title: model.label, author: "Acervo cênico da peça", group: "objetos", kind: "Modelo 3D local",
      description: `Objeto da ilha holográfica, importado do acervo local da peça. Aproximação curatorial com ${topic.label.toLowerCase()}.`,
      status: "scenic", statusLabel: "Objeto cênico · modelo local", sourcePath: model.storagePath || `public${model.url}`, sourceUrl: null, sha256: model.fileSha256 || model.sha256,
      excerpt: "A presença visual deste objeto não equivale à leitura de seu conteúdo pelo bot. As relações com textos e pessoas são propostas curatoriais.",
      evidence: `${model.provenance} Geometria e texturas visuais não são incluídas como texto no contexto do bot.`,
      tags: [topic.label.toLowerCase(), "modelo 3D", "objeto de cena"], modelId: model.id, relatedIds: [] }));
  }
  for (const item of items) item.affinities = referenceAffinities(item);
  const order = new Map(groups.map((group, index) => [group.id, index]));
  items.sort((a, b) => order.get(a.group) - order.get(b.group) || a.title.localeCompare(b.title, "pt-BR"));
  const itemIds = new Set(items.map(item => item.id));
  for (const item of items) item.relatedIds = item.relatedIds.filter(id => itemIds.has(id));
  return { items, island, groups: groups.map(group => ({ ...group, count: items.filter(item => item.group === group.id).length })),
    stats: { items: items.length, sources: new Set(items.filter(item => item.status !== "cited").map(item => item.sourcePath)).size,
      indexedPages: items.reduce((total, item) => total + (item.pageCount || 0), 0), chunks: archive.index.chunks.length,
      citations: bibliography.length, sections: sections.length, permanentMaps: knowledge.length,
      people: collective.people.length, influencedPeople: collective.people.filter(person => person.verifiedIdentity === true && person.motifs.length > 0).length },
    limits: ["Este acervo fornece contexto e recuperação textual; ele não representa treinamento dos pesos do modelo.",
      "Texto integral indexado se refere ao texto extraído. Imagens, áudio e vídeo sem transcrição não são conteúdo observado.",
      "Fontes citadas são registros bibliográficos; seus textos integrais não estão incorporados por esses registros.",
      "Fatos datados conservam as datas do arquivo e precisam de nova conferência para serem tratados como atuais.",
      "Conversas da apresentação, notas privadas e exemplos privados de treino não são publicados neste catálogo."] };
}

export async function getReferenceById(id) {
  const library = await getReferenceLibrary();
  return library.items.find(item => item.id === id) || null;
}
