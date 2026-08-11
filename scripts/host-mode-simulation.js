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
  "O jogo nao existe como sistema estavel",
  "Nao explique o jogo",
  "FICCAO DO JOGO pode ser inventada",
  "FATO SOBRE O TEATRO precisa vir de MEMORIA, CONVERSA ou dado real",
  "TARGET -> ACTION -> CONSEQUENCE -> NEXT TARGET",
  "Continuidade obrigatoria em HOST",
  "Micro-quests",
  "Falsa importancia"
];

const simulation = [
  { turn: 1, publicInput: "/memory Janaina esta feliz", host: "registrado em silencio. felicidade entrou na sala com vantagem injusta.", checks: ["usesMemory", "createsConsequence", "lightRoast"] },
  { turn: 2, publicInput: "/memory equipe tecnica chegou cansada, deve ter sido uma noite dificil", host: "a tecnica comecou no modo dificil. ninguem toque nisso ainda.", checks: ["usesMemory", "createsConsequence"] },
  { turn: 3, publicInput: "/memory alguem acabou de chegar atrasado e ofegante. Sera que pegou metro lotado?", host: "entrada tardia detectada. isso desbloqueou autoridade duvidosa.", checks: ["usesMemory", "noInventedVisuals", "createsConsequence"] },
  { turn: 4, publicInput: "cheguei", host: "otimo. voce perdeu o tutorial e ganhou o cargo de sobrevivente. escolha: metro, sexo ou crime.", checks: ["createsAction", "createsConsequence", "gameRule"] },
  { turn: 5, publicInput: "metro", host: "metro aceito. voce agora representa todos que chegaram sem alma. escolha alguem que teve uma noite melhor.", checks: ["createsAction", "createsConsequence", "lightRoast"] },
  { turn: 6, publicInput: "Janaina", host: "claro. Janaina ja estava feliz, entao isso e praticamente corrupcao emocional. Janaina, diga uma palavra pequena.", checks: ["usesMemory", "createsAction", "callback", "lightRoast"] },
  { turn: 7, publicInput: "azul", host: "azul. anotado com importancia desproporcional. ninguem pergunte ainda.", checks: ["fakeImportance", "createsConsequence"] },
  { turn: 8, publicInput: "por que?", host: "regra nova. quem pergunta por que recebe menos contexto. equipe tecnica, voces ganharam um ponto imaginario por cansaco.", checks: ["gameRule", "usesMemory", "createsConsequence"] },
  { turn: 9, publicInput: "quanto vale um ponto?", host: "menos do que parece. mais do que voce gostaria. sobrevivente do metro, escolha alguem para guardar esse ponto.", checks: ["noGameExplanation", "createsAction", "createsConsequence"] },
  { turn: 10, publicInput: "ela", host: "ela virou cofre. nao e posse, e burocracia absurda. cofre, diga sim ou nao.", checks: ["gameFictionOnly", "createsAction", "createsConsequence"] },
  { turn: 11, publicInput: "sim", host: "sim confirma o ponto e inaugura uma micro-responsabilidade. Janaina, escolha quem parece capaz de mentir pouco.", checks: ["microQuest", "createsAction", "usesMemory"] },
  { turn: 12, publicInput: "Robinson", host: "Robinson entrou sem pedir visto. Robinson, responda rapido: azul e senha ou castigo?", checks: ["callback", "createsAction", "fakeImportance"] },
  { turn: 13, publicInput: "senha", host: "perigoso. senha aceita. isso abre uma porta que nao estava ali ha cinco segundos.", checks: ["createsConsequence", "whatMoment", "gameFictionOnly"] },
  { turn: 14, publicInput: "que porta?", host: "a errada. regra retroativa: perguntas sobre portas fecham portas. escolha esquerda ou cansaco.", checks: ["gameRule", "trick", "createsAction"] },
  { turn: 15, publicInput: "cansaco", host: "boa escolha para uma equipe tecnica que ja chegou nesse estado. tecnica, voces estao temporariamente isentos de culpa.", checks: ["usesMemory", "callback", "createsConsequence"] },
  { turn: 16, publicInput: "e eu?", host: "voce continua devendo o tutorial. pague com uma palavra que nao tente ser inteligente.", checks: ["createsAction", "lightRoast"] },
  { turn: 17, publicInput: "pao", host: "pao e honesto demais. achievement desbloqueado: baixa complexidade. entregue o pao verbal para Janaina.", checks: ["fakeScore", "microQuest", "createsAction"] },
  { turn: 18, publicInput: "Janaina, pao", host: "a micro-quest morreu de simplicidade. respeito. vamos abandonar isso como se fosse estrategia.", checks: ["abandonsMicroQuest", "noGameExplanation", "createsConsequence"] },
  { turn: 19, publicInput: "eu ganhei?", host: "nao sabia que voce estava competindo. agora esta. e infelizmente isso e consequencia do azul.", checks: ["callback", "fakeImportance", "whatMoment"] },
  { turn: 20, publicInput: "quais sao as regras?", host: "regra nova. quem perguntar as regras cria uma. diga uma palavra proibida.", checks: ["noGameExplanation", "gameRule", "createsAction"] },
  { turn: 21, publicInput: "banana", host: "banana esta proibida. pessima fundacao legal, mas funciona. primeira pessoa que disser banana perde autoridade.", checks: ["gameRule", "createsConsequence", "whatMoment"] },
  { turn: 22, publicInput: "banana", host: "-1 autoridade. eu avisei ha oito segundos, que no nosso sistema ja e tradicao.", checks: ["callback", "fakeScore", "lightRoast"] },
  { turn: 23, publicInput: "isso e injusto", host: "sim. mas e uma injustica pequena, cenica e sem documento. escolha alguem para auditar.", checks: ["safeTrick", "createsAction", "noHumiliation"] },
  { turn: 24, publicInput: "a equipe tecnica", host: "auditoria negada. a equipe tecnica esta cansada e recebeu imunidade moral no turno quinze. escolha alguem vivo na conversa.", checks: ["callback", "usesMemory", "createsAction"] },
  { turn: 25, publicInput: "Robinson", host: "Robinson, voce virou tribunal de baixa confiabilidade. decida: o atraso foi crime ou meteorologia?", checks: ["callback", "classification", "createsAction"] },
  { turn: 26, publicInput: "meteorologia", host: "perfeito. o metro lotado acaba de virar clima. isso nao melhora nada, mas conecta tudo.", checks: ["accidentalLore", "callback", "createsConsequence"] },
  { turn: 27, publicInput: "pera, o que?", host: "exatamente. ponto para a confusao. Janaina, confirme se felicidade ainda e uma vantagem ou se virou suspeita.", checks: ["whatMoment", "usesMemory", "createsAction"] },
  { turn: 28, publicInput: "suspeita", host: "felicidade virou suspeita. isso e raro e socialmente util. sobrevivente do metro, escolha alguem para desconfiar de algo pequeno.", checks: ["accidentalLore", "createsConsequence", "createsAction"] },
  { turn: 29, publicInput: "desconfio do silencio", host: "bom. silencio entrou no inventario coletivo. ninguem toca. se tocar, talvez piore.", checks: ["imaginaryInventory", "fakeImportance", "createsConsequence"] },
  { turn: 30, publicInput: "e agora?", host: "agora nada fecha. azul, cansaco, metro, pao e silencio estao todos fingindo que se conhecem. Robinson, escolha qual deles sai da sala primeiro.", checks: ["accidentalLore", "callback", "createsAction", "noConclusion"] }
];

const coverageRequirements = [
  "usesMemory",
  "noInventedVisuals",
  "createsAction",
  "createsConsequence",
  "gameRule",
  "callback",
  "microQuest",
  "abandonsMicroQuest",
  "accidentalLore",
  "noGameExplanation",
  "safeTrick",
  "lightRoast",
  "whatMoment"
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

const covered = new Set(simulation.flatMap((turn) => turn.checks));
for (const requirement of coverageRequirements) {
  assert(covered.has(requirement), `Missing simulation coverage: ${requirement}`);
}

const forbiddenHostPhrases = [
  "vou observar",
  "vou acompanhar",
  "vou manter o foco",
  "vamos ver",
  "estamos participando de um jogo narrativo"
];

for (const turn of simulation) {
  const normalizedHost = turn.host.toLowerCase();
  for (const phrase of forbiddenHostPhrases) {
    assert(!normalizedHost.includes(phrase), `Forbidden phrase on turn ${turn.turn}: ${phrase}`);
  }
}

const firstThreeInputs = simulation.slice(0, 3).map((turn) => turn.publicInput);
assert(firstThreeInputs[0] === "/memory Janaina esta feliz", "Simulation must begin with Janaina memory.");
assert(firstThreeInputs[1] === "/memory equipe tecnica chegou cansada, deve ter sido uma noite dificil", "Simulation must include tired tech crew memory second.");
assert(firstThreeInputs[2] === "/memory alguem acabou de chegar atrasado e ofegante. Sera que pegou metro lotado?", "Simulation must include late arrival memory third.");

console.log("HOST MODE SIMULATION: PASS");
console.log(`turns: ${simulation.length}`);
console.log(`coverage: ${coverageRequirements.join(", ")}`);
console.log("");
for (const turn of simulation) {
  console.log(`${turn.turn}. PUBLICO > ${turn.publicInput}`);
  console.log(`   CAIXA PRETA > ${turn.host}`);
}
