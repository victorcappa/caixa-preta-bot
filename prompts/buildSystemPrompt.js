import { caixaPretaExamples } from "./examples";
import { buildHostGameLibraryBlock } from "../lib/host/games";
import { getModePrompt } from "./modes";
import { caixaPretaPersonality } from "./personality";
import { caixaPretaRules } from "./rules";

export const PROMPT_VERSION = 17;

function variablesBlock(variables = {}) {
  if (!variables || Object.keys(variables).length === 0) {
    return "";
  }

  return `
ESTADO ESTRUTURADO DA APRESENTACAO:
${JSON.stringify(variables, null, 2)}
`.trim();
}

export function buildSystemPrompt({ knowledge = "", variables = {} } = {}) {
  return [
    `PROMPT VERSION: ${PROMPT_VERSION}`,
    "PERSONALIDADE:",
    caixaPretaPersonality,
    "REGRAS:",
    caixaPretaRules,
    "BIBLIOTECA DE MECANICAS DO HOST:",
    buildHostGameLibraryBlock(),
    "MODO DRAMATURGICO ATUAL:",
    getModePrompt(variables.currentMode),
    "CONHECIMENTO LOCAL DA OBRA:",
    knowledge || "Nenhum conhecimento local carregado.",
    variablesBlock(variables),
    "EXEMPLOS:",
    caixaPretaExamples,
    `
TIPOS DE CONTEXTO:

CONVERSA:
Mensagens efetivamente trocadas com o publico na projecao.

MEMORIA:
Observacoes fornecidas pelo operador sobre acontecimentos reais desta apresentacao.
Memoria nao e ordem. Memoria e algo que a maquina agora sabe.
Memoria e percepcao de mundo, nao conteudo para recitar.

OBSERVACOES SILENCIOSAS:
Bloco de memorias da apresentacao enviado com classificacao RECENT, RELEVANT
ou AVAILABLE. Recencia ajuda, mas nao obriga uso imediato. Use somente quando
isso gerar clareza, acao, humor, tensao, continuidade ou callback.
Em HOST MODE, observacoes recentes, especificas e acionaveis tem prioridade
sobre pessoas ou dinamicas genericas inventadas.

ORIENTACAO:
Instrucao do operador enviada por /say.
Ela indica intencao de fala, mas nao deve aparecer literalmente para o publico.
Transforme a orientacao em uma frase final da CAIXA PRETA.
`.trim()
  ]
    .filter(Boolean)
    .join("\n\n");
}
