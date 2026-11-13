import { AUDIENCE_WARMUP_ACTIONS } from "../data/audience-warmup-prompts.js";

export const AUDIENCE_WARMUP_CURRENT_AFFAIRS_SLOT = 3;
export const CURRENT_AFFAIRS_REGIONS = ["sao_paulo", "brasil", "mundo"];
export const CURRENT_AFFAIRS_THEMES = [
  "memoria_arquivo", "ia_duplicacao", "corpo_percepcao", "acidente_protocolo",
  "clima_sobrevivencia", "poder_desigualdade", "trabalho_tecnologia", "morte_permanencia"
];

export function saoPauloDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// A semana editorial vira à meia-noite de segunda-feira em São Paulo.
export function currentAffairsWeek(now = new Date()) {
  const date = new Date(`${saoPauloDate(now)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

export const CURRENT_AFFAIRS_FALLBACK_PROMPT = {
  id: "atualidades-sem-edicao", category: "atualidades", intensity: "provocative",
  text: "QUEM JÁ COMPARTILHOU UMA NOTÍCIA SEM LER ATÉ O FIM LEVANTA A MÃO.",
  action: "hand", interactionType: "confession", tags: ["notícia", "registro", "memória"],
  surpriseLevel: 3, progressValue: 5, repeatableProgress: false, reaction: false,
  currentAffairsFallback: true
};

export const CURRENT_AFFAIRS_CONTEXT_PROMPTS = [
  {
    id: "atualidades-pandemia-cibernetica",
    text: "SE UMA PANDEMIA CIBERNÉTICA DERRUBASSE A INTERNET, QUEM SABERIA VOLTAR PARA CASA SEM GPS LEVANTA A MÃO.",
    action: "hand", interactionType: "conditional", tags: ["ataque cibernético", "dependência digital", "sobrevivência"]
  },
  {
    id: "atualidades-alerta-defesa-civil",
    text: "QUEM JÁ LEVOU UM SUSTO COM UM ALERTA DA DEFESA CIVIL NO CELULAR COLOCA AS MÃOS SOBRE A CABEÇA.",
    action: "pose", interactionType: "confession", tags: ["Defesa Civil", "alerta", "corpo"]
  },
  {
    id: "atualidades-conta-invadida",
    text: "QUEM JÁ PERDEU O ACESSO A UMA CONTA DEPOIS DE UM ATAQUE CRUZA OS BRAÇOS.",
    action: "pose", interactionType: "confession", tags: ["ataque cibernético", "acesso", "identidade"]
  },
  {
    id: "atualidades-telefone-de-memoria",
    text: "SE A INTERNET CAÍSSE AGORA, QUEM TEM UM TELEFONE IMPORTANTE NA MEMÓRIA TOCA A PRÓPRIA CABEÇA.",
    action: "touch_self", interactionType: "conditional", tags: ["queda de internet", "memória", "dependência digital"]
  },
  {
    id: "atualidades-pix-fora-do-ar",
    text: "SE UM ATAQUE TIRASSE O PIX DO AR, QUEM CONSEGUIRIA PAGAR A VOLTA PARA CASA LEVANTA A MÃO.",
    action: "hand", interactionType: "conditional", tags: ["ataque cibernético", "Pix", "dependência digital"]
  },
  {
    id: "atualidades-ajuda-sem-celular",
    text: "SE A REDE CAÍSSE, QUEM PEDIRIA AJUDA SEM CELULAR FAZ UMA MÍMICA DESSE PEDIDO.",
    action: "mime", interactionType: "conditional", tags: ["queda de internet", "emergência", "corpo"]
  },
  {
    id: "atualidades-alerta-ignorado",
    text: "QUEM JÁ IGNOROU UM ALERTA DA DEFESA CIVIL POR ACHAR QUE ERA PARA OUTRO LUGAR CRUZA OS BRAÇOS.",
    action: "pose", interactionType: "confession", tags: ["Defesa Civil", "alerta", "percepção"]
  },
  {
    id: "atualidades-lanterna-apagao",
    text: "SE FALTASSE LUZ EM CASA, QUEM SABERIA ENCONTRAR A LANTERNA DE OLHOS FECHADOS LEVANTA A MÃO.",
    action: "hand", interactionType: "conditional", tags: ["apagão", "emergência", "preparação"]
  },
  {
    id: "atualidades-caminho-alagado",
    text: "QUEM JÁ MUDOU O CAMINHO PARA CASA POR CAUSA DE ALAGAMENTO APONTA PARA TRÁS.",
    action: "point", interactionType: "confession", tags: ["temporal", "alagamento", "trajeto"]
  },
  {
    id: "atualidades-temporal-sem-luz",
    text: "QUEM JÁ FICOU SEM LUZ DURANTE UM TEMPORAL FAZ COM A BOCA O SOM DE UM APARELHO DESLIGANDO.",
    action: "sound", interactionType: "confession", tags: ["temporal", "apagão", "tecnologia"]
  },
  {
    id: "atualidades-onda-de-calor",
    text: "QUEM JÁ ENCAROU UMA ONDA DE CALOR SEM VENTILADOR NEM AR-CONDICIONADO SE ABANA COM A MÃO.",
    action: "move", interactionType: "confession", tags: ["calor", "corpo", "sobrevivência"]
  },
  {
    id: "atualidades-documentos-na-nuvem",
    text: "QUEM GUARDA DOCUMENTOS IMPORTANTES SÓ NA NUVEM FICA IMÓVEL.",
    action: "freeze", interactionType: "confession", tags: ["nuvem", "arquivo", "dependência digital"]
  },
  {
    id: "atualidades-fotos-fora-da-rede",
    text: "SE UM ATAQUE APAGASSE SUAS FOTOS DA NUVEM, QUEM AINDA TERIA UMA CÓPIA FORA DA INTERNET LEVANTA A MÃO.",
    action: "hand", interactionType: "conditional", tags: ["ataque cibernético", "arquivo", "memória"]
  },
  {
    id: "atualidades-gps-caminho-errado",
    text: "QUEM JÁ SEGUIU O GPS MESMO ACHANDO O CAMINHO ERRADO VIRA A CABEÇA PARA A ESQUERDA.",
    action: "move", interactionType: "confession", tags: ["GPS", "percepção", "dependência digital"]
  }
].map((prompt) => ({
  ...prompt, category: "atualidades", intensity: "provocative",
  surpriseLevel: 3, progressValue: 5, repeatableProgress: false, reaction: false,
  currentAffairsContext: true
}));

function boundedText(value, max = 500) {
  return typeof value === "string" && value.trim().length >= 3 && value.length <= max;
}

export function validateCurrentAffairsEdition(edition, { sourceUrls = null, requireDirectAction = false } = {}) {
  if (!edition || !Number.isFinite(Date.parse(edition.updatedAt))) throw new Error("ATUALIDADES_DATA_INVALIDA");
  const date = saoPauloDate(new Date(edition.updatedAt));
  if (edition.week !== currentAffairsWeek(new Date(edition.updatedAt))) throw new Error("ATUALIDADES_SEMANA_INVALIDA");
  if (!Array.isArray(edition.items) || edition.items.length < 3 || edition.items.length > 6) throw new Error("ATUALIDADES_REPERTORIO_INVALIDO");
  const ids = new Set();
  const earliest = new Date(`${date}T12:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - 7);
  const earliestDate = earliest.toISOString().slice(0, 10);
  for (const item of edition.items) {
    if (!/^[a-z0-9-]{3,80}$/u.test(item.id) || ids.has(item.id)) throw new Error("ATUALIDADES_ID_INVALIDO");
    ids.add(item.id);
    if (!CURRENT_AFFAIRS_REGIONS.includes(item.region) || !CURRENT_AFFAIRS_THEMES.includes(item.theme)
      || !boundedText(item.relevance) || !boundedText(item.fact) || !boundedText(item.title, 180)
      || !Number.isInteger(item.importance) || item.importance < 4 || item.importance > 5) throw new Error("ATUALIDADES_RELEVANCIA_INVALIDA");
    for (const value of [item.eventDate, item.source?.publishedAt]) {
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(value || "") || !Number.isFinite(Date.parse(value))
        || value < earliestDate || value > date) throw new Error("ATUALIDADES_EVENTO_FORA_DA_SEMANA");
    }
    let url;
    try { url = new URL(item.source?.url); } catch { throw new Error("ATUALIDADES_FONTE_INVALIDA"); }
    if (url.protocol !== "https:" || url.username || url.password || !boundedText(item.source?.title, 180)
      || (sourceUrls && !sourceUrls.has(url.href))) throw new Error("ATUALIDADES_FONTE_NAO_PESQUISADA");
    if (!boundedText(item.text, requireDirectAction ? 180 : 380)
      || (requireDirectAction && !/^(?:QUEM|SE VOCÊ|TODOS|TODO MUNDO)(?=\s|$)/u.test(item.text))
      || !AUDIENCE_WARMUP_ACTIONS.some((action) => action.id === item.action)
      || !["conditional", "confession", "collective"].includes(item.interactionType)
      || !Array.isArray(item.tags) || !item.tags.length || item.tags.length > 6
      || !item.tags.every((tag) => typeof tag === "string" && tag.trim().length > 0 && tag.length <= 60)
      || !/\b(?:QUEM|SE VOCÊ|TODOS|TODO MUNDO)(?=\s|$)/u.test(item.text)
      || /https?:|\b(?:por favor|que tal|imaginem|finjam|hoje|ontem|amanhã)\b/iu.test(item.text)) throw new Error("ATUALIDADES_ACAO_INVALIDA");
  }
  if (!CURRENT_AFFAIRS_REGIONS.every((region) => edition.items.some((item) => item.region === region))) throw new Error("ATUALIDADES_COBERTURA_INCOMPLETA");
  return edition;
}

export function currentAffairsPrompts(edition) {
  return edition.items.map((item) => {
    const text = /^(?:QUEM|SE|TODOS|TODO MUNDO)\b/u.test(item.text)
      ? item.text
      : item.text.match(/\b(?:QUEM|SE VOCÊ|TODOS|TODO MUNDO)(?=\s|$).*$/u)?.[0] || item.text;
    return {
      id: `atualidades-${edition.week}-${item.id}`, text, action: item.action,
      category: "atualidades", intensity: "provocative", interactionType: item.interactionType,
      tags: item.tags, surpriseLevel: 3, progressValue: 5, repeatableProgress: false, reaction: false
    };
  });
}

export function publishedWarmupPromptIds(warmup = {}, library = []) {
  if (Array.isArray(warmup.publishedPromptIds)) return warmup.publishedPromptIds;
  // Migração de snapshots anteriores: prévias não entram na contagem.
  return [...new Set((warmup.history || []).filter((entry) => entry.step === 0 && !entry.repeated)
    .map((entry) => entry.promptId || library.find((prompt) => prompt.text === entry.text)?.id).filter(Boolean))];
}
