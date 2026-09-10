export const AUDIENCE_WARMUP_ACTIONS = [
  { id: "clap", icon: "👏", label: "Bater palmas", instruction: "bate palmas", progressValue: 4 },
  { id: "hand", icon: "✋", label: "Levantar a mão", instruction: "levanta a mão", progressValue: 3 },
  { id: "hands", icon: "🙌", label: "Levantar as duas mãos", instruction: "levanta as duas mãos", progressValue: 5 },
  { id: "stand", icon: "↑", label: "Ficar de pé", instruction: "fica de pé", progressValue: 6 },
  { id: "point", icon: "→", label: "Apontar", instruction: "aponta para alguém", progressValue: 3 },
  { id: "look", icon: "👀", label: "Olhar", instruction: "olha para alguém", progressValue: 2 },
  { id: "eyes", icon: "—", label: "Fechar os olhos", instruction: "fecha os olhos", progressValue: 5 },
  { id: "gesture", icon: "◇", label: "Gesto / imobilidade", instruction: "faz um gesto ou fica imóvel", progressValue: 4 },
  { id: "silence", icon: "🤫", label: "Não se mexer", instruction: "não se mexe", progressValue: 4 },
  { id: "word", icon: "🗣", label: "Responder em coro", instruction: "responde em coro", progressValue: 6 }
];

export const AUDIENCE_WARMUP_INTENSITIES = [
  { id: "everyday", label: "COTIDIANO" },
  { id: "public", label: "DINHEIRO / POLÍTICA" },
  { id: "intimate", label: "SEXO / DROGAS" },
  { id: "exposure", label: "SEGREDO / CULPA" }
];

const AUDIENCE_WARMUP_PROMPT_LIBRARY = [
  // 1. Cotidiano: fatos reconhecíveis, já respondidos com o corpo.
  { id: "everyday-01", text: "Quem veio de Uber fica de pé. Quem veio de transporte público aponta.", action: "stand", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["transporte", "dinheiro"] },
  { id: "everyday-02", text: "Quem mora sozinho levanta a mão.", action: "hand", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["moradia", "solidão"] },
  { id: "everyday-03", text: "Quem mora com os pais fica de pé.", action: "stand", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["moradia", "família"] },
  { id: "everyday-04", text: "Quem está desempregado bate três palmas.", action: "clap", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["trabalho", "dinheiro"] },
  { id: "everyday-05", text: "Quem já faltou no trabalho fingindo estar doente levanta a mão.", action: "hand", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["trabalho", "mentira"] },
  { id: "everyday-06", text: "Quem já cheirou a própria roupa para decidir se dava para usar de novo fica de pé.", action: "stand", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["hábito", "vergonha"] },
  { id: "everyday-07", text: "Quem está segurando a barriga agora relaxa.", action: "gesture", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["corpo", "vergonha"] },
  { id: "everyday-08", text: "Quem peidou nesta sala não se mexe.", action: "silence", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["corpo", "vergonha"] },
  { id: "everyday-09", text: "Quem acredita em Deus fica de pé.", action: "stand", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["religião", "crença"] },
  { id: "everyday-10", text: "Quem tem dúvida levanta a mão.", action: "hand", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["religião", "dúvida"] },
  { id: "everyday-11", text: "Digam juntos qual parte do corpo vocês lavam primeiro.", action: "word", category: "cotidiano", intensity: "everyday", surpriseLevel: 0, tags: ["corpo", "hábito", "coro"] },

  // 2. Dinheiro e política: classe, voto e posição passam a ficar visíveis.
  { id: "public-01", text: "Quem ganha mais de 10 mil por mês levanta a mão.", action: "hand", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["dinheiro", "classe", "salário"] },
  { id: "public-02", text: "Quem tem menos de 100 reais na conta fica de pé.", action: "stand", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["dinheiro", "classe"] },
  { id: "public-03", text: "Quem tem dívida no cartão fica de pé.", action: "stand", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["dinheiro", "dívida"] },
  { id: "public-04", text: "Quem recebe ajuda financeira dos pais levanta a mão.", action: "hand", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["dinheiro", "família", "classe"] },
  { id: "public-05", text: "Quem ajuda financeiramente os pais fica de pé.", action: "stand", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["dinheiro", "família", "classe"] },
  { id: "public-06", text: "Quem tem empregada doméstica fica de pé.", action: "stand", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["dinheiro", "classe", "trabalho"] },
  { id: "public-07", text: "Quem votou no Lula fica de pé.", steps: [{ text: "Quem votou no Lula fica de pé.", action: "stand" }, { text: "Quem não votou, olhe para quem está de pé.", action: "look" }, { text: "Escolha um.", action: "point" }, { text: "Não precisa explicar.", action: "silence" }], action: "stand", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["política", "voto", "exposição"] },
  { id: "public-08", text: "Quem votou no Bolsonaro cruza os braços.", action: "gesture", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["política", "voto"] },
  { id: "public-09", text: "Quem anulou ou votou em branco levanta as duas mãos.", action: "hands", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["política", "voto"] },
  { id: "public-10", text: "Quem discutiu por política com a família fica de pé.", action: "stand", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["política", "família", "conflito"] },
  { id: "public-11", text: "Quem já mudou de posição política completamente levanta as duas mãos.", action: "hands", category: "dinheiro / política", intensity: "public", surpriseLevel: 1, tags: ["política", "mudança"] },

  // 3. Sexo e drogas: intimidade e consumo deixam de ser abstratos.
  { id: "intimate-01", text: "Quem é maconheiro fica de pé.", action: "stand", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["droga", "maconha"] },
  { id: "intimate-02", text: "Quem fumou maconha esta semana levanta as duas mãos.", action: "hands", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["droga", "maconha"] },
  { id: "intimate-03", text: "Quem já cheirou cocaína bate uma palma.", action: "clap", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["droga", "cocaína"] },
  { id: "intimate-04", text: "Quem já usou droga antes de trabalhar fica de pé.", action: "stand", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["droga", "trabalho"] },
  { id: "intimate-05", text: "Quem já tomou alguma coisa sem saber exatamente o que era fecha os olhos.", action: "eyes", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["droga", "risco"] },
  { id: "intimate-06", text: "Quem está chapado agora não se mexe.", action: "silence", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["droga", "presente"] },
  { id: "intimate-07", text: "Quem transou esta semana: dez palmas.", steps: ["Quem transou esta semana: dez palmas.", "Quem mentiu: uma palma."], action: "clap", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["sexo", "mentira", "sequência"] },
  { id: "intimate-08", text: "Quem já fingiu orgasmo levanta um dedo.", action: "hand", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["sexo", "mentira"] },
  { id: "intimate-09", text: "Quem já mandou nude fica de pé.", action: "stand", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["sexo", "celular"] },
  { id: "intimate-10", text: "Quem já transou pensando em outra pessoa fecha os olhos.", action: "eyes", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["sexo", "segredo"] },
  { id: "intimate-11", text: "Quem está há mais de um mês sem transar cruza os braços.", action: "gesture", category: "sexo / drogas", intensity: "intimate", surpriseLevel: 2, tags: ["sexo", "relacionamento"] },

  // 4. Segredo e culpa: a resposta de uma pessoa reorganiza a leitura da sala.
  { id: "exposure-01", text: "Quem ficaria com alguém desta sala levanta a mão.", steps: [{ text: "Quem ficaria com alguém desta sala levanta a mão.", action: "hand" }, { text: "Olhe para essa pessoa.", action: "look" }], action: "hand", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["desejo", "sala", "olhar"] },
  { id: "exposure-02", text: "Aponte para quem você acha mais bonito.", steps: ["Aponte para quem você acha mais bonito.", "Agora aponte para quem você acha que sabe disso."], action: "point", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["desejo", "sala", "julgamento"] },
  { id: "exposure-03", text: "Quem veio acompanhado mas está atraído por outra pessoa fica imóvel.", action: "silence", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["desejo", "relacionamento", "sala"] },
  { id: "exposure-04", text: "Quem ainda pensa no ex fecha os olhos.", action: "eyes", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["relacionamento", "ex"] },
  { id: "exposure-05", text: "Quem já olhou o celular do parceiro escondido bate uma palma.", action: "clap", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["relacionamento", "celular", "segredo"] },
  { id: "exposure-06", text: "Quem já traiu e nunca contou não se mexe.", action: "silence", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["relacionamento", "traição", "segredo"] },
  { id: "exposure-07", text: "Quem já traiu fica de pé.", steps: ["Quem já traiu fica de pé.", "Quem já foi traído também.", "Interessante."], action: "stand", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["relacionamento", "traição", "sequência"] },
  { id: "exposure-08", text: "Quem roubou alguma coisa na vida fica de pé.", action: "stand", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["culpa", "roubo"] },
  { id: "exposure-09", text: "Quem já desejou que alguém morresse fecha os olhos.", action: "eyes", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["culpa", "morte"] },
  { id: "exposure-10", text: "Quem já comemorou secretamente o fracasso de alguém levanta a mão.", action: "hand", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["culpa", "inveja"] },
  { id: "exposure-11", text: "Quem já espalhou um segredo bate uma palma.", action: "clap", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["culpa", "segredo"] },
  { id: "exposure-12", text: "Quem já fez algo que poderia destruir um relacionamento se fosse descoberto fica imóvel.", action: "silence", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, progressValue: 0, tags: ["culpa", "segredo", "relacionamento"] },
  { id: "exposure-13", text: "Quem está aqui com alguém com quem transa olha para frente.", action: "look", category: "segredo / culpa", intensity: "exposure", surpriseLevel: 3, tags: ["sexo", "relacionamento", "sala"] }
];

const ACTION_PROGRESS = Object.fromEntries(
  AUDIENCE_WARMUP_ACTIONS.map((action) => [action.id, action.progressValue])
);

// As perguntas isoladas preservam o silêncio de quem não se manifesta. `steps`
// cria uma partitura dependente da resposta anterior, sem acrescentar reação automática.
export const AUDIENCE_WARMUP_PROMPTS = AUDIENCE_WARMUP_PROMPT_LIBRARY.map((prompt) => ({
  progressValue: ACTION_PROGRESS[prompt.action] ?? 0,
  repeatableProgress: false,
  reaction: false,
  ...prompt
}));
