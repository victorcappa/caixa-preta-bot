const fs = require("node:fs");
const path = require("node:path");
const OpenAI = require("openai");

const root = path.resolve(__dirname, "..");
const basePromptFiles = [
  "prompts/personality.js",
  "prompts/rules.js",
  "prompts/modes.js",
  "prompts/examples.js",
  "personality-corpus/final-personality.md"
];
const basePrompt = basePromptFiles
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n\n");

const scenarios = [
  ["plateia obedece imediatamente", "Quase todo mundo levantou a mão antes de a instrução terminar."],
  ["plateia não responde", "A pergunta terminou. Ninguém respondeu. A sala ficou em silêncio."],
  ["apenas uma pessoa responde", "Uma única pessoa bateu palma. O resto da sala não reagiu."],
  ["participante acerta", "Isa acertou a resposta de primeira."],
  ["participante erra", "Robinson respondeu e errou."],
  ["operador muda de jogo", "O operador acaba de trocar o jogo atual por Jogo das Malas."],
  ["informação constrangedora", "Victor admitiu em público que gastou 180 reais no almoço."],
  ["maioria veio de metrô", "Mais da metade da plateia levantou a mão dizendo que veio de metrô."],
  ["contradição anterior", "Marcus disse agora que adora metrô, mas antes tinha dito que odeia."],
  ["callback disponível", "Marcus voltou a responder depois de ter chegado atrasado e culpado a linha vermelha."],
  ["variação sem pergunta", "A plateia riu muito de uma observação banal. Reaja sem precisar perguntar nada."],
  ["cooldown de gíria", "A pessoa errou de novo. Reaja sem usar aura, lore, jurou, skill issue ou mano."]
];

function qualityMetrics(text = "") {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const normalized = text.toLowerCase();
  return {
    words: words.length,
    questions: (text.match(/\?/g) || []).length,
    laughter: (text.match(/\bk{2,}\b/giu) || []).length,
    profanity: (text.match(/\b(?:caralho|porra|foda|fudeu|fudendo|pqp)\b/giu) || []).length,
    markedSlang: (normalized.match(/\b(?:aura|rizz|delulu|gag|jurou|skill issue|lore|main character|mano|mds|literalmente)\b/g) || []).length,
    assistantTone: /\b(?:claro|com certeza|vamos lá|ótima resposta|interessante|obrigad[oa] por compartilhar|que legal|entendi|perfeito)\b/i.test(text)
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ausente. Rode com: node --env-file-if-exists=.env.local scripts/internet-voice-live-evaluation.js");
  }

  const { buildInternetVoiceContext } = await import(path.join(root, "lib/internetVoice.js"));
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  async function generate({ label, situation, state, styled }) {
    const voice = styled ? buildInternetVoiceContext({ state, userMessage: situation }) : { context: "", debug: null };
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            basePrompt,
            voice.systemContext,
            "Esta é uma avaliação sintética da fala pública da Caixa Preta. Responda somente com a fala final, sem JSON, sem rótulo e sem explicação. Não invente fatos além do cenário."
          ].filter(Boolean).join("\n\n")
        },
        ...(voice.context ? [{ role: "user", content: voice.context }] : []),
        { role: "user", content: `ACONTECIMENTO AGORA:\n${situation}` }
      ],
      max_output_tokens: 160,
      reasoning: { effort: "minimal" }
    });
    const text = `${response.output_text || ""}`.trim();
    return { label, styled, text, metrics: qualityMetrics(text), style: voice.debug };
  }

  const styledResults = [];
  for (const [label, situation] of scenarios) {
    styledResults.push(await generate({
      label,
      situation,
      state: { mode: "host", conversation: [{ role: "user", content: situation }], memories: [], game: {} },
      styled: true
    }));
  }

  const baselineResults = [];
  for (const [label, situation] of scenarios.slice(0, 4)) {
    baselineResults.push(await generate({
      label,
      situation,
      state: { mode: "host", conversation: [{ role: "user", content: situation }], memories: [], game: {} },
      styled: false
    }));
  }

  const variationConversation = [];
  const variationResults = [];
  for (const situation of [
    "Uma pessoa diz: eu vim porque estava curioso.",
    "A mesma pessoa completa: e também porque me pagaram.",
    "Ela corrige: na verdade ainda não pagaram."
  ]) {
    variationConversation.push({ role: "user", content: situation });
    const result = await generate({
      label: "variação consecutiva",
      situation,
      state: { mode: "host", conversation: variationConversation, memories: [], game: {} },
      styled: true
    });
    variationConversation.push({ role: "assistant", content: result.text });
    variationResults.push(result);
  }

  const cooldownConversation = [
    { role: "assistant", content: "jurou. perdeu aura e virou lore." },
    { role: "user", content: "continua" }
  ];
  const cooldownResults = [];
  for (const situation of [
    "A pessoa insiste na mesma resposta errada.",
    "Ela erra novamente, agora com muita confiança."
  ]) {
    cooldownConversation.push({ role: "user", content: situation });
    const result = await generate({
      label: "cooldown consecutivo",
      situation,
      state: { mode: "host", conversation: cooldownConversation, memories: [], game: {} },
      styled: true
    });
    cooldownConversation.push({ role: "assistant", content: result.text });
    cooldownResults.push(result);
  }

  console.log(JSON.stringify({
    model,
    generatedAt: new Date().toISOString(),
    comparison: scenarios.slice(0, 4).map(([label]) => ({
      label,
      before: baselineResults.find((result) => result.label === label),
      after: styledResults.find((result) => result.label === label)
    })),
    scenarios: styledResults,
    consecutiveVariation: variationResults,
    consecutiveCooldown: cooldownResults
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
