const assert = require("node:assert/strict");

const highInterest = {
  novelty: 0.8,
  personal_relevance: 0.7,
  comedic_potential: 0.6,
  research_value: 0.9,
  callback_potential: 0.8,
  dramaturgical_relevance: 0.5
};

async function main() {
  const director = await import("../lib/research/ResearchDirector.js");
  const initial = director.createInitialResearchState();
  assert.equal(initial.researchEnabled, true);
  assert.equal(initial.budgetMode, "normal");
  assert.equal(initial.config.maxResearchCallsPerTurn, 3);
  assert.equal(initial.autonomousInstagramEnabled, false);

  const baseState = {
    mode: "host",
    research: initial,
    suitcase: { active: false },
    sceneZero: { active: false, stage: "idle" }
  };
  const baseTools = director.getResearchTools(baseState).map((tool) => tool.name);
  assert(baseTools.includes("web_search"));
  assert(baseTools.includes("web_search_news"));
  assert(baseTools.includes("web_search_local"));
  assert(baseTools.includes("save_discovery"));
  assert(!baseTools.includes("instagram_open_profile"));
  const noWebTools = director.getResearchTools(baseState, { allowWebSearch: false }).map((tool) => tool.name);
  assert(!noWebTools.includes("web_search"));
  assert(noWebTools.includes("create_open_loop"));

  const scriptedInstagramState = {
    ...baseState,
    research: director.updateResearchSettings(initial, { autonomousInstagramEnabled: true }),
    suitcase: { active: true, activeExperience: "instagram" }
  };
  assert.equal(scriptedInstagramState.research.autonomousInstagramEnabled, false);
  assert.equal(director.canUseInstagramTools(scriptedInstagramState), false);
  assert(!director.getResearchTools(scriptedInstagramState).some((tool) => tool.name.startsWith("instagram_")));
  const lowInstagramState = {
    ...scriptedInstagramState,
    research: director.updateResearchSettings(scriptedInstagramState.research, { budgetMode: "low" })
  };
  assert(!director.getResearchTools(lowInstagramState).some((tool) => tool.name.startsWith("instagram_")));

  const activities = [];
  let webCalls = 0;
  const execute = (options) => director.executeResearchTool({
    state: baseState,
    searchWeb: async ({ query, mode }) => {
      webCalls += 1;
      return { summary: `${mode}:${query}`, sources: [{ title: "Fonte", url: "https://example.com/fato" }] };
    },
    executeInstagram: async () => ({ ok: true }),
    saveDiscovery: (discovery) => ({ id: "memory-1", ...discovery }),
    createOpenLoop: (openLoop) => ({ id: "loop-1", ...openLoop }),
    recordActivity: (activity) => activities.push(activity),
    ...options
  });

  const firstTurn = director.createResearchTurnContext(baseState);
  const firstSearch = JSON.parse(await execute({
    name: "web_search_local",
    args: {
      query: "linha vermelha metrô",
      location: "São Paulo",
      reason: "trajeto citado pelo participante",
      interest: highInterest
    },
    turnContext: firstTurn
  }));
  assert.equal(firstSearch.ok, true);
  assert.equal(firstSearch.code, "SEARCH_COMPLETE");
  assert.equal(webCalls, 1);
  assert.equal(firstTurn.researchCalls, 1);

  const duplicateSearch = JSON.parse(await execute({
    name: "web_search_local",
    args: {
      query: "linha vermelha metrô",
      location: "São Paulo",
      reason: "repetição acidental",
      interest: highInterest
    },
    turnContext: firstTurn
  }));
  assert.equal(duplicateSearch.code, "QUERY_ALREADY_USED_THIS_TURN");
  assert.equal(webCalls, 1);

  const nextTurn = director.createResearchTurnContext(baseState);
  const cachedSearch = JSON.parse(await execute({
    name: "web_search_local",
    args: {
      query: "linha vermelha metrô",
      location: "São Paulo",
      reason: "mesmo assunto voltou",
      interest: highInterest
    },
    turnContext: nextTurn
  }));
  assert.equal(cachedSearch.code, "CACHE_HIT");
  assert.equal(webCalls, 1);
  assert.equal(nextTurn.researchCalls, 0);

  const savedDiscovery = JSON.parse(await execute({
    name: "save_discovery",
    args: {
      query: "linha vermelha",
      source: "https://example.com/fato",
      summary: "O trajeto citado exige duas baldeações.",
      interesting_facts: ["duas baldeações"],
      related_participants: ["Marcus"],
      confidence: 0.8,
      stable: false,
      interest: highInterest
    },
    turnContext: nextTurn
  }));
  assert.equal(savedDiscovery.code, "DISCOVERY_SAVED");
  assert(savedDiscovery.data.expiresAt);

  const rejectedLoop = JSON.parse(await execute({
    name: "create_open_loop",
    args: {
      subject: "plateia",
      fact: "alguém disse oi",
      interesting_because: "talvez volte",
      related_participants: [],
      interest: Object.fromEntries(Object.keys(highInterest).map((key) => [key, 0.1]))
    },
    turnContext: nextTurn
  }));
  assert.equal(rejectedLoop.code, "LOW_CALLBACK_VALUE");
  assert(activities.some((activity) => activity.status === "success"));
  assert(activities.some((activity) => activity.status === "cached"));

  const context = director.researchContextBlock({
    ...baseState,
    research: {
      ...initial,
      openLoops: [{ subject: "Marcus", fact: "nunca usa Uber", status: "open" }]
    }
  });
  assert.match(context, /Pesquisa é ferramenta, não ritual/);
  assert.match(context, /Marcus/);
  assert.match(context, /não diga que vai pesquisar/);

  console.log("research-director-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
