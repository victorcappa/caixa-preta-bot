const assert = require("node:assert/strict");
const path = require("node:path");

async function main() {
  const {
    buildInternetVoiceContext,
    formatInternetVoiceDebug,
    resetInternetVoiceGuideCache
  } = await import(path.resolve(__dirname, "../lib/internetVoice.js"));

  const cases = [
    {
      name: "plateia obedece imediatamente",
      message: "Quase toda a plateia levantou a mão imediatamente, sem hesitar.",
      expect: { registers: "tiktok_reels", humor: "micro_observation", context: "audience_obedient" }
    },
    {
      name: "plateia não responde",
      message: "Silêncio. Ninguém respondeu à pergunta.",
      expect: { registers: "tiktok_reels", humor: "micro_observation", context: "audience_quiet" }
    },
    {
      name: "apenas uma pessoa responde",
      message: "Só uma pessoa bateu palma sozinha.",
      expect: { registers: "tiktok_reels", humor: "micro_observation" }
    },
    {
      name: "participante acerta",
      message: "Robinson acertou de primeira.",
      expect: { humor: "deadpan_absurdity" }
    },
    {
      name: "participante erra",
      message: "Isa errou. A resposta está incorreta.",
      expect: { humor: "status_game" }
    },
    {
      name: "operador muda de jogo",
      operatorInstruction: "O operador mudou de jogo e selecionou jogo das malas.",
      expect: { humor: "meta_show" }
    },
    {
      name: "informação constrangedora",
      message: "Uma pessoa admitiu uma informação constrangedora sobre quanto gastou no almoço.",
      expect: { humor: "false_bureaucracy" }
    },
    {
      name: "maioria veio de metrô",
      message: "A maioria da sala veio de metrô em São Paulo.",
      expect: { context: "sao_paulo", humor: "false_bureaucracy" }
    },
    {
      name: "contradição anterior",
      message: "Victor contradisse o que disse antes sobre o metrô.",
      expect: { humor: "callback" }
    },
    {
      name: "callback disponível",
      message: "Victor voltou a falar.",
      memories: [{ content: "Victor chegou atrasado e culpou a linha vermelha." }],
      expect: { humor: "callback", callbacks: 1 }
    }
  ];

  for (const scenario of cases) {
    const { context, debug } = buildInternetVoiceContext({
      state: {
        mode: "host",
        conversation: [{ role: "user", content: scenario.message || "mudança do operador" }],
        memories: scenario.memories || [],
        game: {}
      },
      userMessage: scenario.message,
      operatorInstruction: scenario.operatorInstruction
    });

    assert.equal(debug.loaded, true, `${scenario.name}: guia deveria carregar`);
    assert.ok(context.includes("<internet_voice_style_context>"), `${scenario.name}: style context ausente`);
    if (scenario.expect.registers) assert.ok(debug.registers.includes(scenario.expect.registers), `${scenario.name}: registro ${scenario.expect.registers}`);
    if (scenario.expect.humor) assert.ok(debug.humor.includes(scenario.expect.humor), `${scenario.name}: humor ${scenario.expect.humor}`);
    if (scenario.expect.context) assert.ok(debug.contexts.includes(scenario.expect.context), `${scenario.name}: contexto ${scenario.expect.context}`);
    if (scenario.expect.callbacks) assert.ok(debug.callbacksAvailable >= scenario.expect.callbacks, `${scenario.name}: callback disponível`);
  }

  const varyingConversation = [
    { role: "assistant", content: "não." },
    { role: "user", content: "como assim?" },
    { role: "assistant", content: "isso aqui" },
    { role: "user", content: "continua" },
    { role: "assistant", content: "a mão subiu antes da pergunta terminar." },
    { role: "user", content: "e agora?" }
  ];
  const variation = buildInternetVoiceContext({
    state: { mode: "host", conversation: varyingConversation, memories: [], game: {} },
    userMessage: "e agora?"
  });
  assert.ok(!variation.debug.recentPatterns.includes(variation.debug.targetArchitecture), "três respostas: deve escolher forma ainda não usada recentemente");
  assert.deepEqual(variation.debug.recentLengthsWords, [1, 2, 7], "três respostas: comprimentos recentes devem entrar no contexto");
  assert.equal(variation.debug.recentQuestionCount, 0, "três respostas: perguntas do público não entram na métrica da Caixa");

  const cooldownConversation = [
    { role: "assistant", content: "jurou." },
    { role: "user", content: "sim" },
    { role: "assistant", content: "isso virou lore rápido demais" },
    { role: "user", content: "e daí?" },
    { role: "assistant", content: "perdeu aura. skill issue." },
    { role: "user", content: "continua" },
    { role: "assistant", content: "não mano pera kkkkk porra" }
  ];
  const cooldown = buildInternetVoiceContext({
    state: { mode: "host", conversation: cooldownConversation, memories: [], game: {} },
    userMessage: "continua"
  });
  for (const expression of ["jurou", "lore", "aura", "skill issue", "mano"]) {
    assert.ok(cooldown.debug.slangCooldown.includes(expression), `cooldown deveria conter ${expression}`);
  }
  assert.equal(cooldown.debug.recentLaughterCount, 1, "cooldown: deve contar risada recente");
  assert.equal(cooldown.debug.recentProfanityCount, 1, "cooldown: deve contar palavrão recente");
  assert.ok(cooldown.context.includes("Use outra construcao"), "cooldown deve produzir instrução explícita de desvio");

  const originalGuidePath = process.env.CAIXA_PRETA_VOICE_GUIDE_PATH;
  const originalWarn = console.warn;
  let fallbackWarnings = 0;
  process.env.CAIXA_PRETA_VOICE_GUIDE_PATH = path.resolve(__dirname, "missing-voice-guide.json");
  console.warn = () => { fallbackWarnings += 1; };
  resetInternetVoiceGuideCache();
  const fallback = buildInternetVoiceContext({ state: { conversation: [], memories: [] } });
  buildInternetVoiceContext({ state: { conversation: [], memories: [] } });
  console.warn = originalWarn;
  if (originalGuidePath === undefined) delete process.env.CAIXA_PRETA_VOICE_GUIDE_PATH;
  else process.env.CAIXA_PRETA_VOICE_GUIDE_PATH = originalGuidePath;
  resetInternetVoiceGuideCache();

  assert.equal(fallback.context, "", "fallback não deve injetar contexto parcial");
  assert.equal(fallback.debug.reason, "guide_unavailable", "fallback deve ser diagnosticável");
  assert.equal(fallbackWarnings, 1, "fallback deve avisar uma única vez");

  console.log("INTERNET VOICE TESTS PASSED");
  console.log(formatInternetVoiceDebug(cooldown.debug));
  console.log(`SCENARIOS ${cases.length + 2}/12`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
