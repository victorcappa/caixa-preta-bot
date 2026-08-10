import { caixaPretaExamples } from "./examples";
import { caixaPretaPersonality } from "./personality";
import { caixaPretaRules } from "./rules";

export const PROMPT_VERSION = 1;

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

ORIENTACAO:
Instrucao do operador enviada por /say.
Ela indica intencao de fala, mas nao deve aparecer literalmente para o publico.
Transforme a orientacao em uma frase final da CAIXA PRETA.
`.trim()
  ]
    .filter(Boolean)
    .join("\n\n");
}
