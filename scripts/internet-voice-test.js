const assert = require("node:assert/strict");
const fs = require("node:fs");
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
      expect: { registers: "tiktok_reels", humor: "specific_observation", context: "audience_obedient" }
    },
    {
      name: "plateia não responde",
      message: "Silêncio. Ninguém respondeu à pergunta.",
      expect: { registers: "tiktok_reels", humor: "specific_observation", context: "audience_quiet" }
    },
    {
      name: "apenas uma pessoa responde",
      message: "Só uma pessoa bateu palma sozinha.",
      expect: { registers: "tiktok_reels", humor: "specific_observation" }
    },
    {
      name: "participante acerta",
      message: "Robinson acertou de primeira.",
      expect: { humor: "understatement" }
    },
    {
      name: "participante erra",
      message: "Isa errou. A resposta está incorreta.",
      expect: { humor: "understatement" }
    },
    {
      name: "operador muda de jogo",
      operatorInstruction: "O operador mudou de jogo e selecionou jogo das malas.",
      expect: { humor: "meta_show" }
    },
    {
      name: "informação constrangedora",
      message: "Uma pessoa admitiu uma informação constrangedora sobre quanto gastou no almoço.",
      expect: { humor: "social_exposure" }
    },
    {
      name: "maioria veio de metrô",
      message: "A maioria da sala veio de metrô em São Paulo.",
      expect: { context: "sao_paulo", humor: "social_exposure" }
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
    },
    {
      name: "comentário de notícia",
      message: "Leia estas notícias de política atual e comente as manchetes.",
      expect: { registers: "twitter_x", promptText: "MODO NOTICIA - COMENTARIO, NAO LEITURA" }
    }
  ];

  for (const scenario of cases) {
    const { systemContext, context, debug } = buildInternetVoiceContext({
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
    assert.ok(systemContext.includes("<internet_voice_system>"), `${scenario.name}: autoridade estilística ausente do system prompt`);
    assert.ok(context.includes("<internet_voice_style_context>"), `${scenario.name}: style context ausente`);
    if (scenario.expect.registers) assert.ok(debug.registers.includes(scenario.expect.registers), `${scenario.name}: registro ${scenario.expect.registers}`);
    if (scenario.expect.humor) assert.ok(debug.humor.includes(scenario.expect.humor), `${scenario.name}: humor ${scenario.expect.humor}`);
    if (scenario.expect.context) assert.ok(debug.contexts.includes(scenario.expect.context), `${scenario.name}: contexto ${scenario.expect.context}`);
    if (scenario.expect.callbacks) assert.ok(debug.callbacksAvailable >= scenario.expect.callbacks, `${scenario.name}: callback disponível`);
    if (scenario.expect.promptText) assert.ok(context.includes(scenario.expect.promptText), `${scenario.name}: instrução específica ausente`);
  }

  const ordinaryConversation = buildInternetVoiceContext({
    state: {
      mode: "host",
      conversation: [{ role: "user", content: "oi, tudo bem?" }],
      memories: [],
      game: {}
    },
    userMessage: "oi, tudo bem?"
  });
  assert.ok(ordinaryConversation.systemContext.includes("Anti-cringe nao significa portugues neutro"), "conversa comum: regra positiva deve ter autoridade de sistema");
  assert.ok(ordinaryConversation.systemContext.includes("REACAO > PIADA ESCRITA"), "conversa comum: reação deve ter prioridade sobre punchline escrita");
  assert.ok(ordinaryConversation.systemContext.includes("Se uma versao 50% menor funcionar"), "conversa comum: regra de compressão deve ter autoridade de sistema");
  assert.ok(ordinaryConversation.systemContext.includes("Nao use X e/ou Y como punchline"), "conversa comum: cacoete e/ou deve estar proibido");
  assert.ok(ordinaryConversation.debug.repertoireTokens.length > 0, "conversa comum: tokens reais dos registros devem ser enviados");
  assert.ok(ordinaryConversation.debug.repertoireExamples.length > 0, "conversa comum: exemplos reais dos registros devem ser enviados");
  assert.ok(ordinaryConversation.debug.repertoireMarkers.length > 0, "conversa comum: markers do JSON devem ser enviados");
  assert.equal(ordinaryConversation.debug.repertoireTerms.length, 0, "conversa comum: termos altamente marcados não devem entrar sem contexto");
  assert.ok(ordinaryConversation.context.includes("não. pera"), "conversa comum: uma construção concreta e reativa do JSON deve chegar ao prompt");
  assert.ok(ordinaryConversation.context.includes('"productiveVerbs":{}') || ordinaryConversation.context.includes('"productiveVerbs":[]'), "conversa comum: verbos de gíria não devem ser oferecidos automaticamente");

  const gameVocabulary = buildInternetVoiceContext({
    state: { mode: "host", conversation: [], memories: [], game: { active: true, id: "cards" } },
    userMessage: "Robinson errou a rodada do jogo."
  });
  assert.ok(gameVocabulary.debug.registers.includes("discord"), "jogo: repertório Discord deve estar disponível");
  assert.equal(gameVocabulary.debug.repertoireTerms.length, 0, "jogo: gíria marcada não deve ser oferecida automaticamente como menu");

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
  for (const expression of ["jurou", "lore", "aura", "skill_issue", "mano"]) {
    assert.ok(!cooldown.debug.repertoireTerms.includes(expression), `cooldown não deve reoferecer ${expression} nos termos ativos`);
    assert.ok(!cooldown.debug.repertoireMarkers.includes(expression), `cooldown não deve reoferecer ${expression} nos marcadores ativos`);
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
  assert.equal(fallback.systemContext, "", "fallback não deve alterar o system prompt atual");
  assert.equal(fallback.debug.reason, "guide_unavailable", "fallback deve ser diagnosticável");
  assert.equal(fallbackWarnings, 1, "fallback deve avisar uma única vez");

  const rules = fs.readFileSync(path.resolve(__dirname, "../prompts/rules.js"), "utf8");
  const collection = fs.readFileSync(path.resolve(__dirname, "../prompts/dataCollection.js"), "utf8");
  const examples = fs.readFileSync(path.resolve(__dirname, "../prompts/examples.js"), "utf8");
  for (const source of [rules, collection]) {
    assert.ok(source.includes("REACAO > PIADA ESCRITA") || source.includes("Reacao e mais importante que piada escrita"), "prompts públicos: princípio reativo ausente");
    assert.ok(source.includes("X e/ou Y"), "prompts públicos: proibição de punchline e/ou ausente");
    assert.ok(source.includes("50% menor"), "prompts públicos: teste de compressão ausente");
  }
  assert.ok(examples.includes("eu nem terminei e voce ja tava correndo"), "few-shot: especificidade concreta ausente");
  assert.ok(examples.includes("Remover a fala. Nao substituir automaticamente"), "few-shot: ação aleatória deve ser removida");

  console.log("INTERNET VOICE TESTS PASSED");
  console.log(formatInternetVoiceDebug(cooldown.debug));
  console.log(`SCENARIOS ${cases.length + 2}/${cases.length + 2}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
