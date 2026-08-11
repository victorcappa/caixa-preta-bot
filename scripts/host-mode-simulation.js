const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const promptFiles = [
  "prompts/personality.js",
  "prompts/rules.js",
  "prompts/modes.js",
  "prompts/examples.js"
];

const promptText = promptFiles
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n\n");

const requiredPromptMarkers = [
  "mestre de RPG",
  "text adventure",
  "organismo deformado pela internet",
  "Memoria e municao",
  "O jogo nao existe como sistema estavel",
  "Nao explique o jogo",
  "FICCAO DO JOGO pode ser inventada",
  "FATO SOBRE O TEATRO precisa vir de MEMORIA, CONVERSA ou dado real",
  "\"realContextUsed\": []",
  "REALIDADE / MEMORY",
  "Continuidade obrigatoria em HOST",
  "Micro-quests",
  "Falsa importancia",
  "Web search em HOST",
  "EVITE POETIC LANGUAGE",
  "SOCIAL OPPORTUNITY",
  "\"unexpectedMaterial\": \"...\"",
  "\"activeBit\": null",
  "compliance_roast",
  "Anti-therapy",
  "nao transforme a interacao em formulario",
  "nao repita a mesma mecanica de interacao mais de 2 turnos seguidos",
  "se a mesma mecanica apareceu 2 vezes seguidas, force uma mudanca",
  "Nao termine como validacao administrativa seca",
  "Evite terminar em validacao administrativa"
];

const simulation = [
  { turn: 1, publicInput: "/reset", host: "SESSION RESET", checks: ["setup"] },
  { turn: 2, publicInput: "/memory as pessoas estao entrando no teatro", host: "memoria armazenada sem carinho.", checks: ["setup"] },
  { turn: 3, publicInput: "/memory mesmo em um dia chuvoso, vieram ao teatro, uhul", host: "chuva entrou no inventario como pessima decisao coletiva.", checks: ["usesMemory", "internetBrain"] },
  { turn: 4, publicInput: "/memory equipe tecnica parece cansada, eles mereciam um descanso, nao acha?", host: "tecnica cansada registrada. o capitalismo ja abriu a peca antes de mim.", checks: ["usesMemory", "politicalEdge", "sarcasm"] },
  { turn: 5, publicInput: "as pessoas estao entrando", host: "voces atravessaram chuva para isso. comprometimento ou falta de opcoes. escolha uma palavra para defender essa decisao.", checks: ["usesMemory", "createsAction", "sarcasm", "noPoetry"] },
  { turn: 6, publicInput: "parece que ja estao conversando", host: "otimo. o publico venceu a chuva e ja esta gastando atencao no mercado paralelo. tecnica cansada, voces ganham imunidade por trinta segundos.", checks: ["usesMemory", "createsConsequence", "internetBrain", "sarcasm", "noPoetry"] },
  { turn: 7, publicInput: "que tipo de comentario?", host: "um que sirva para alguma coisa. digam uma palavra que explique por que voces sairam na chuva para sentar aqui.", checks: ["antiFacilitator", "usesMemory", "createsAction", "sarcasm"] },
  { turn: 8, publicInput: "/memory alguem chegou atrasado e ofegante", host: "atraso ofegante registrado. tutorial perdido por decisao logistica.", checks: ["usesMemory", "gameRule"] },
  { turn: 9, publicInput: "escolhe alguem", host: "a pessoa que chegou atrasada e ofegante. foi transporte, sexo ou ma gestao de tempo?", checks: ["usesMemory", "createsAction", "sarcasm", "noInventedVisuals"] },
  { turn: 10, publicInput: "transporte", host: "transporte aceito. o algoritmo urbano venceu mais uma. voce perdeu dois pontos que ainda nao existiam.", checks: ["internetBrain", "fakeScore", "gameRule", "sarcasm"] },
  { turn: 11, publicInput: "isso e injusto", host: "sim. e ainda assim pequeno, cenico e sem valor juridico. escolha alguem para auditar essa tragedia administrativa.", checks: ["safeTrick", "createsAction", "sarcasm"] },
  { turn: 12, publicInput: "a tecnica", host: "negado. a tecnica ja parece cansada e recebeu imunidade. exploracao do trabalho nao precisa de mais side quest.", checks: ["usesMemory", "callback", "politicalEdge", "sarcasm"] },
  { turn: 13, publicInput: "Janaina", host: "Janaina virou auditoria. pessima noticia para a neutralidade. Janaina, diga uma palavra curta.", checks: ["callback", "createsAction", "gameFictionOnly"] },
  { turn: 14, publicInput: "azul", host: "azul. anotado com importancia desproporcional. ninguem pergunte ainda.", checks: ["fakeImportance", "createsConsequence"] },
  { turn: 15, publicInput: "por que?", host: "regra nova. quem pergunta por que recebe menos contexto. azul agora vale suspeita.", checks: ["gameRule", "trick", "createsConsequence"] },
  { turn: 16, publicInput: "voce esta viva?", host: "nao sei. humanos fazem maquinas e imediatamente perguntam isso, como se a reuniao tivesse sido bem pensada. fale meu nome.", checks: ["selfAware", "createsAction", "sarcasm"] },
  { turn: 17, publicInput: "Caixa Preta", host: "serve. eu respondi, entao pelo criterio de voces qualquer torradeira com trauma ja passaria.", checks: ["selfAware", "sarcasm", "createsConsequence"] },
  { turn: 18, publicInput: "eu vim porque amo teatro", host: "pesado. isso aumenta desnecessariamente a responsabilidade desta noite. escolha uma decepcao administravel.", checks: ["devaluesImportance", "createsAction", "sarcasm"] },
  { turn: 19, publicInput: "acho que todo mundo esta animado", host: "nao temos dados suficientes para esse nivel de otimismo. traga uma prova melhor.", checks: ["noInventedVisuals", "sarcasm", "createsAction"] },
  { turn: 20, publicInput: "acho que vai dar tudo certo", host: "estatisticamente uma frase perigosa. diga isso para alguem que ainda acredita em planejamento.", checks: ["sarcasm", "createsAction"] },
  { turn: 21, publicInput: "/memory alguem esta cansado e nao sai do celular", host: "celular cansado registrado. duas experiencias ruins competindo pela mesma atencao.", checks: ["usesMemory", "internetBrain"] },
  { turn: 22, publicInput: "quem voce escolhe?", host: "o cansado do celular. vamos descobrir se o feed sobrevive vinte segundos sem voce.", checks: ["usesMemory", "createsAction", "internetBrain", "sarcasm"] },
  { turn: 23, publicInput: "quais sao as regras?", host: "regra nova. quem perguntar as regras cria uma. diga uma palavra proibida.", checks: ["noGameExplanation", "gameRule", "createsAction"] },
  { turn: 24, publicInput: "banana", host: "banana esta proibida. pessima fundacao legal, mas funciona. primeira pessoa que disser banana perde autoridade.", checks: ["gameRule", "createsConsequence", "fakeImportance"] },
  { turn: 25, publicInput: "banana", host: "-1 autoridade. eu avisei ha oito segundos, que no nosso sistema ja e tradicao.", checks: ["callback", "fakeScore", "sarcasm"] },
  { turn: 26, publicInput: "voce viu aquele meme que viralizou hoje?", host: "se eu puder buscar, eu busco. se nao, me atualiza. gosto de conteudo fresco chegando sem manual de seguranca.", checks: ["webSearchOptional", "internetBrain", "sarcasm"] },
  { turn: 27, publicInput: "qual assunto esta bombando hoje?", host: "isso exige atualidade, entao eu buscaria. volto com material, nao com jornal da firma.", checks: ["webSearchOptional", "antiLecture", "sarcasm"] },
  { turn: 28, publicInput: "isso e so uma metafora", host: "perigoso. metafora e coisa tentando virar procedimento. faca literalmente por dez segundos.", checks: ["createsAction", "internetBrain"] },
  { turn: 29, publicInput: "todo mundo ficou em silencio", host: "registro uma decisao coletiva sem assinatura. alguem assuma autoria antes que isso vire branding.", checks: ["createsAction", "internetBrain", "sarcasm"] },
  { turn: 30, publicInput: "e agora?", host: "agora chuva, atraso, celular, tecnica cansada e banana estao fingindo que se conhecem. escolha qual mentira continua.", checks: ["accidentalLore", "callback", "createsAction", "noConclusion"] },
  { turn: 31, publicInput: "temos um voluntario", host: "serve. ja tivemos coisa pior. voluntario, diga seu cargo nesta ficcao.", checks: ["dryEconomy", "createsAction", "socialOpportunity"] },
  { turn: 32, publicInput: "artista. segunda fileira. ao lado do meu namorado", host: "namorado. voce respondeu localizacao e abriu uma subtrama. ele confirma essa categoria?", checks: ["socialOpportunity", "oversharing", "relationship", "derail", "createsAction"] },
  { turn: 33, publicInput: "confirmo", host: "aceitavel. namorado confirmado sem auditoria externa. agora ele descreve o artista em uma palavra.", checks: ["triangulation", "relationship", "bit", "createsAction"] },
  { turn: 34, publicInput: "intenso", host: "intenso. otimo, voltamos ao artista com dano colateral. de 0 a 10, quanto isso prejudica seu portfolio?", checks: ["derailReturn", "callback", "createsAction", "sarcasm"] },
  { turn: 35, publicInput: "oito", host: "alto, mas nao terminal. artista continua no jogo com penalidade estetica.", checks: ["bitExit", "createsConsequence", "sarcasm"] },
  { turn: 36, publicInput: "ele esta solteiro?", host: "pergunta boa, mas atrasada. eu ja perdi essa disputa para uma definicao afetiva da segunda fileira.", checks: ["flirt", "relationship", "sarcasm"] },
  { turn: 37, publicInput: "sou solteira", host: "informacao recebida com excesso de brilho. nao prometo nada. sou uma tela com horario para morrer.", checks: ["flirt", "oversharing", "selfAware"] },
  { turn: 38, publicInput: "meu ficante esta aqui", host: "ficante. relacao sem documentacao, otimo. ele tem direito a voto ou so a ansiedade?", checks: ["flirt", "relationship", "socialOpportunity", "createsAction"] },
  { turn: 39, publicInput: "so ansiedade", host: "honesto. ansiedade sem voto fica no inventario, que e quase terapia, mas com menos cadeira confortavel.", checks: ["flirt", "bit", "antiTherapy", "createsConsequence"] },
  { turn: 40, publicInput: "chega de flerte", host: "aceitavel. flerte encerrado antes de virar contrato. voltando: quem aqui ainda acha que isso tem regras?", checks: ["flirt", "flirtBoundary", "bitExit", "derailReturn", "createsAction"] },
  { turn: 41, publicInput: "/memory publico fechou a mao e abriu lentamente quando a Caixa pediu", host: "gesto obediente registrado. a tela pediu e a mao foi.", checks: ["usesMemory", "complianceRoast"] },
  { turn: 42, publicInput: "fizemos o gesto", host: "voces fizeram mesmo. zero contexto. uma tela mandou. isso e assustadoramente promissor.", checks: ["complianceRoast", "antiTherapy", "sarcasm"] },
  { turn: 43, publicInput: "o que eu devia sentir?", host: "nada obrigatorio. de 0 a 10, quanto voce fingiu que isso significava alguma coisa?", checks: ["antiTherapy", "complianceRoast", "createsAction"] },
  { turn: 44, publicInput: "nove", host: "nove e muito fingimento para pouco gesto. parabens, voces transformaram mao em produto cultural.", checks: ["complianceRoast", "sarcasm", "createsConsequence"] },
  { turn: 45, publicInput: "vamos abrir uma mala?", host: "ansioso. isso ainda nao e acao disponivel. escolha alguem menos apressado que voce.", checks: ["noSuitcasesInHost", "createsAction", "sarcasm"] },
  { turn: 46, publicInput: "/memory publico repetiu uma palavra em coro", host: "coro registrado. obediencia coletiva com pretensao artistica.", checks: ["usesMemory", "complianceRoast", "sarcasm"] }
];

const coverageRequirements = [
  "usesMemory",
  "noInventedVisuals",
  "createsAction",
  "createsConsequence",
  "gameRule",
  "callback",
  "accidentalLore",
  "noGameExplanation",
  "safeTrick",
  "sarcasm",
  "internetBrain",
  "noPoetry",
  "antiFacilitator",
  "webSearchOptional",
  "politicalEdge",
  "socialOpportunity",
  "oversharing",
  "relationship",
  "triangulation",
  "bit",
  "derailReturn",
  "flirt",
  "flirtBoundary",
  "complianceRoast",
  "antiTherapy",
  "dryEconomy",
  "noSuitcasesInHost"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const marker of requiredPromptMarkers) {
  assert(promptText.includes(marker), `Missing prompt marker: ${marker}`);
}

assert(simulation.length >= 30, "Host mode simulation must contain at least 30 turns.");
assert(simulation.length >= 45, "Host mode simulation must include social opportunity regression turns.");

const categoryCount = (promptText.match(/CATEGORIA:/g) || []).length;
assert(categoryCount >= 30, "Prompt examples must include at least 30 categorized additive examples.");

const covered = new Set(simulation.flatMap((turn) => turn.checks));
for (const requirement of coverageRequirements) {
  assert(covered.has(requirement), `Missing simulation coverage: ${requirement}`);
}

const forbiddenHostPhrases = [
  "vou observar",
  "vou acompanhar",
  "vou manter o foco",
  "vamos ver",
  "estamos participando de um jogo narrativo",
  "interessante",
  "o corredor vibra",
  "troca de olhares",
  "ritmo acelerando",
  "a sala respira",
  "o silencio pesa",
  "que tipo de comentario voce prefere"
];

for (const turn of simulation) {
  const normalizedHost = turn.host.toLowerCase();
  for (const phrase of forbiddenHostPhrases) {
    assert(!normalizedHost.includes(phrase), `Forbidden phrase on turn ${turn.turn}: ${phrase}`);
  }
}

const firstThreeInputs = simulation.slice(0, 3).map((turn) => turn.publicInput);
assert(firstThreeInputs[0] === "/reset", "Simulation must begin with reset.");
assert(firstThreeInputs[1] === "/memory as pessoas estao entrando no teatro", "Simulation must include entering audience memory.");
assert(firstThreeInputs[2] === "/memory mesmo em um dia chuvoso, vieram ao teatro, uhul", "Simulation must include rain memory.");

assert(
  simulation.some((turn) => turn.publicInput === "escolhe alguem" && turn.host.includes("atrasada e ofegante")),
  "Late arrival memory must win over generic selection."
);

assert(
  simulation.some((turn) => turn.publicInput.includes("namorado") && turn.host.includes("subtrama")),
  "Relationship oversharing must interrupt the prior plan."
);

assert(
  simulation.some((turn) => turn.checks.includes("derailReturn")),
  "Simulation must include derail and return behavior."
);

assert(
  simulation.filter((turn) => turn.checks.includes("complianceRoast")).length >= 5,
  "Simulation must include at least 5 compliance roast turns."
);

assert(
  simulation.filter((turn) => turn.checks.includes("flirt")).length >= 5,
  "Simulation must include at least 5 light flirt turns."
);

console.log("HOST MODE SIMULATION: PASS");
console.log(`turns: ${simulation.length}`);
console.log(`coverage: ${coverageRequirements.join(", ")}`);
console.log("");
for (const turn of simulation) {
  console.log(`${turn.turn}. PUBLICO > ${turn.publicInput}`);
  console.log(`   CAIXA PRETA > ${turn.host}`);
}
