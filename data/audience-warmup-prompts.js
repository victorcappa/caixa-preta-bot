export const AUDIENCE_WARMUP_ACTIONS = [
  { id: "clap", icon: "👏", label: "Bater palmas", instruction: "bate palmas", progressValue: 4 },
  { id: "hand", icon: "✋", label: "Levantar a mão", instruction: "levanta a mão", progressValue: 3 },
  { id: "hands", icon: "🙌", label: "Levantar as duas mãos", instruction: "levanta as duas mãos", progressValue: 5 },
  { id: "feet", icon: "🦶", label: "Bater os pés", instruction: "bate o pé uma vez", progressValue: 6 },
  { id: "word", icon: "🗣", label: "Falar uma palavra", instruction: "fala uma palavra", progressValue: 6 },
  { id: "sound", icon: "🔊", label: "Fazer um som", instruction: "faz um som", progressValue: 7 },
  { id: "silence", icon: "🤫", label: "Ficar em silêncio", instruction: "fica em silêncio", progressValue: 4 },
  { id: "look", icon: "👀", label: "Olhar para alguém", instruction: "olha para alguém", progressValue: 2 },
  { id: "stand", icon: "↑", label: "Levantar", instruction: "levanta da cadeira", progressValue: 6 },
  { id: "sit", icon: "↓", label: "Sentar", instruction: "senta novamente", progressValue: 3 },
  { id: "point", icon: "→", label: "Apontar", instruction: "aponta para alguém", progressValue: 3 },
  { id: "snap", icon: "⋆", label: "Estalar os dedos", instruction: "estala os dedos", progressValue: 4 },
  { id: "lean", icon: "/", label: "Inclinar o corpo", instruction: "inclina o corpo", progressValue: 3 },
  { id: "turn", icon: "↶", label: "Olhar para trás", instruction: "olha para trás", progressValue: 3 },
  { id: "eyes", icon: "—", label: "Fechar os olhos", instruction: "fecha os olhos", progressValue: 5 },
  { id: "laugh", icon: ":)", label: "Rir", instruction: "ri", progressValue: 4 },
  { id: "gesture", icon: "◇", label: "Fazer um gesto", instruction: "faz um gesto corporal", progressValue: 4 },
  { id: "move", icon: "↔", label: "Mudar de lugar", instruction: "muda de lugar", progressValue: 7 },
  { id: "group", icon: "⫶", label: "Formar grupos", instruction: "forma grupos", progressValue: 8 },
  { id: "touch", icon: "◎", label: "Contato consentido", instruction: "faz contato físico consentido", progressValue: 7 }
];

export const AUDIENCE_WARMUP_INTENSITIES = [
  { id: "light", label: "LEVE" },
  { id: "medium", label: "MÉDIO" },
  { id: "strange", label: "ESTRANHO" }
];

const AUDIENCE_WARMUP_PROMPT_LIBRARY = [
  { id: "action-01", text: "Mostrem a língua.", action: "gesture", category: "ação", intensity: "light", tags: ["corpo", "ridículo"] },
  { id: "action-02", text: "Fechem um olho.", action: "eyes", category: "ação", intensity: "light", tags: ["corpo"] },
  { id: "action-03", text: "Batam três palmas.", action: "clap", category: "ação", intensity: "light", repeatableProgress: true, tags: ["som"] },
  { id: "action-04", text: "Troquem de posição na cadeira.", action: "lean", category: "ação", intensity: "light", tags: ["corpo"] },
  { id: "action-05", text: "Encostem os dois pés no chão.", action: "feet", category: "ação", intensity: "light", tags: ["corpo"] },
  { id: "action-06", text: "Olhem para a pessoa ao lado.", action: "look", category: "ação", intensity: "light", tags: ["olhar"] },
  { id: "action-07", text: "Segurem o olhar por dez segundos.", action: "look", category: "ação", intensity: "light", tags: ["olhar", "tempo"] },
  { id: "action-08", text: "Mostrem os dentes.", action: "gesture", category: "ação", intensity: "light", tags: ["corpo", "ridículo"] },
  { id: "action-09", text: "Estalem os dedos.", action: "snap", category: "ação", intensity: "light", tags: ["som"] },
  { id: "action-10", text: "Façam cara de sono.", action: "gesture", category: "ação", intensity: "light", tags: ["rosto"] },
  { id: "action-11", text: "Bocejem juntos. Três. Dois. Um.", action: "sound", category: "ação", intensity: "light", tags: ["som", "sincronia"] },
  { id: "action-12", text: "Dancem Macarena em silêncio.", action: "gesture", category: "ação", intensity: "light", tags: ["corpo", "ridículo"] },
  { id: "action-13", text: "Pisquem rápido por cinco segundos.", action: "eyes", category: "ação", intensity: "light", tags: ["corpo", "tempo"] },
  { id: "action-14", text: "Digam o próprio nome ao mesmo tempo.", action: "word", category: "ação", intensity: "light", tags: ["nome", "coro"] },
  { id: "action-15", text: "Digam a primeira parte do corpo que lavam no banho.", action: "word", category: "ação", intensity: "light", tags: ["corpo", "coro"] },
  { id: "action-16", text: "Sentem com a coluna reta.", action: "sit", category: "ação", intensity: "light", tags: ["corpo"] },
  { id: "action-17", text: "Riam sem mostrar os dentes.", action: "laugh", category: "ação", intensity: "light", tags: ["rosto", "ridículo"] },

  { id: "exposure-01", text: "Quem mentiu hoje levanta a mão.", action: "hand", category: "exposição", intensity: "medium", tags: ["mentira"] },
  { id: "exposure-02", text: "Quem stalkeou alguém hoje fica de pé.", action: "stand", category: "exposição", intensity: "medium", tags: ["internet"] },
  { id: "exposure-03", text: "Quem fingiu não ver alguém para evitar cumprimento bate uma palma.", action: "clap", category: "exposição", intensity: "medium", tags: ["comportamento"] },
  { id: "exposure-04", text: "Quem está com sono aponta para alguém mais cansado.", action: "point", category: "exposição", intensity: "medium", tags: ["cansaço", "julgamento"] },
  { id: "exposure-05", text: "Quem veio sozinho fica de pé.", action: "stand", category: "exposição", intensity: "medium", tags: ["companhia"] },
  { id: "exposure-06", text: "Quem está apaixonado levanta a mão.", action: "hand", category: "exposição", intensity: "medium", tags: ["afeto"] },
  { id: "exposure-07", text: "Quem apagou uma mensagem por arrependimento bate duas palmas.", action: "clap", category: "exposição", intensity: "medium", tags: ["mensagem"] },
  { id: "exposure-08", text: "Quem voltou com ex fica de pé.", action: "stand", category: "exposição", intensity: "medium", tags: ["relacionamento"] },
  { id: "exposure-09", text: "Quem fingiu entender alguma coisa levanta as duas mãos.", action: "hands", category: "exposição", intensity: "medium", tags: ["mentira"] },
  { id: "exposure-10", text: "Quem chorou escondido este mês fecha os olhos.", action: "eyes", category: "exposição", intensity: "medium", tags: ["intimidade"] },
  { id: "exposure-11", text: "Quem desejou que alguém se desse mal cruza os braços.", action: "gesture", category: "exposição", intensity: "medium", tags: ["conflito"] },
  { id: "exposure-12", text: "Quem mentiu numa resposta anterior bate uma palma.", action: "clap", category: "exposição", intensity: "medium", tags: ["mentira", "memória"] },
  { id: "sp-exposure-01", text: "Quem passou pela Linha Vermelha hoje levanta a mão.", action: "hand", category: "São Paulo", intensity: "medium", tags: ["São Paulo", "Metrô"] },
  { id: "sp-exposure-02", text: "Quem cruzou o Tietê ou o Pinheiros hoje bate o pé.", action: "feet", category: "São Paulo", intensity: "medium", tags: ["São Paulo", "rios"] },
  { id: "sp-exposure-03", text: "Quem mudou a rota por causa do trânsito estala os dedos.", action: "snap", category: "São Paulo", intensity: "medium", tags: ["São Paulo", "trânsito"] },
  { id: "sp-exposure-04", text: "Quem errou a roupa para o clima de São Paulo bate palma.", action: "clap", category: "São Paulo", intensity: "medium", tags: ["São Paulo", "clima"] },

  { id: "division-01", text: "Cachorro: de pé. Gato: apontem para alguém de pé.", action: "group", category: "divisão", intensity: "strange", surpriseLevel: 2, tags: ["grupo", "preferência"] },
  { id: "division-02", text: "Inteligência artificial todo dia: de pé. Os demais: escolham um culpado pelo futuro.", action: "group", category: "divisão", intensity: "strange", surpriseLevel: 2, tags: ["IA", "grupo"] },
  { id: "division-03", text: "Maconheiros: de pé. Os demais: identifiquem um.", action: "group", category: "divisão", intensity: "strange", surpriseLevel: 2, tags: ["droga", "grupo"] },
  { id: "division-04", text: "Transporte público: esquerda. Aplicativo: direita. Carona: centro.", action: "group", category: "divisão", intensity: "strange", surpriseLevel: 2, tags: ["São Paulo", "mobilidade"] },
  { id: "division-05", text: "Quem voltou com ex fica de pé. Os demais batem palmas para os sobreviventes.", action: "group", category: "divisão", intensity: "strange", surpriseLevel: 2, tags: ["relacionamento"] },
  { id: "division-06", text: "Quem leu notícias hoje levanta a mão. Os demais observam.", action: "group", category: "divisão", intensity: "strange", surpriseLevel: 2, tags: ["notícias", "atualidades"] },
  { id: "division-07", text: "Quem transou esta semana bate dez palmas. Os demais: paciência.", action: "clap", category: "divisão", intensity: "strange", surpriseLevel: 2, tags: ["sexo", "exposição"] },
  { id: "division-08", text: "Quem usou droga ilegal este mês fica de pé. Os demais permanecem sentados.", action: "group", category: "divisão", intensity: "strange", surpriseLevel: 2, tags: ["droga", "exposição"] },
  { id: "sp-division-01", text: "Zona Norte e Zona Leste: de pé. Zona Sul e Zona Oeste: apontem para eles. Centro: não se mexa.", action: "group", category: "São Paulo", intensity: "strange", surpriseLevel: 2, tags: ["São Paulo", "bairros", "divisão"] },

  { id: "judgment-01", text: "Aponte para quem parece mais mentiroso.", action: "point", category: "julgamento", intensity: "strange", surpriseLevel: 3, tags: ["acusação"] },
  { id: "judgment-02", text: "Aponte para quem parece mais confiável.", action: "point", category: "julgamento", intensity: "strange", surpriseLevel: 3, tags: ["confiança"] },
  { id: "judgment-03", text: "Aponte para quem você evitaria numa festa.", action: "point", category: "julgamento", intensity: "strange", surpriseLevel: 3, tags: ["rejeição"] },
  { id: "judgment-04", text: "Aponte para quem você acha que já traiu.", action: "point", category: "julgamento", intensity: "strange", surpriseLevel: 3, tags: ["relacionamento", "acusação"] },
  { id: "judgment-05", text: "Aponte para quem sobreviveria menos num apocalipse.", action: "point", category: "julgamento", intensity: "strange", surpriseLevel: 3, tags: ["sobrevivência"] },
  { id: "judgment-06", text: "Aponte para quem parece esconder alguma coisa.", action: "point", category: "julgamento", intensity: "strange", surpriseLevel: 3, tags: ["segredo"] },
  { id: "judgment-07", text: "Escolha alguém que você bloquearia.", action: "point", category: "julgamento", intensity: "strange", surpriseLevel: 3, tags: ["internet", "rejeição"] },
  { id: "judgment-08", text: "Escolha alguém que você seguiria no Instagram.", action: "point", category: "julgamento", intensity: "strange", surpriseLevel: 3, tags: ["Instagram"] },

  { id: "contact-01", text: "Levantem. Sentem. Levantem de novo.", action: "stand", category: "contato", intensity: "strange", surpriseLevel: 4, tags: ["corpo", "obediência"] },
  { id: "contact-02", text: "Troquem de cadeira.", action: "move", category: "contato", intensity: "strange", surpriseLevel: 4, tags: ["deslocamento"] },
  { id: "contact-03", text: "Fiquem de costas para o palco.", action: "turn", category: "contato", intensity: "strange", surpriseLevel: 4, tags: ["corpo"] },
  { id: "contact-04", text: "Com consentimento: encostem ombro com ombro.", action: "touch", category: "contato", intensity: "strange", surpriseLevel: 4, tags: ["contato", "consentimento"] },
  { id: "contact-05", text: "Com consentimento: segurem a mão de alguém por cinco segundos. Soltem.", action: "touch", category: "contato", intensity: "strange", surpriseLevel: 4, tags: ["contato", "consentimento"] },
  { id: "contact-06", text: "Aproximem-se. Agora se afastem.", action: "move", category: "contato", intensity: "strange", surpriseLevel: 4, tags: ["espaço"] },
  { id: "contact-07", text: "Fiquem atrás de alguém em quem confiariam.", action: "move", category: "contato", intensity: "strange", surpriseLevel: 4, tags: ["confiança"] },
  { id: "contact-08", text: "Troquem de lugar com alguém que vocês não conhecem.", action: "move", category: "contato", intensity: "strange", surpriseLevel: 4, tags: ["deslocamento", "encontro"] },

  { id: "confrontation-01", text: "Olhem para quem parece mais atraente. Agora olhem para outra pessoa.", action: "look", category: "confronto", intensity: "strange", surpriseLevel: 5, tags: ["atração", "tensão"] },
  { id: "confrontation-02", text: "Escolham alguém que vocês não levariam para casa.", action: "point", category: "confronto", intensity: "strange", surpriseLevel: 5, tags: ["rejeição"] },
  { id: "confrontation-03", text: "Escolham alguém que vocês apresentariam para a mãe.", action: "point", category: "confronto", intensity: "strange", surpriseLevel: 5, tags: ["aprovação"] },
  { id: "confrontation-04", text: "Fiquem perto de quem parece mais confiável.", action: "move", category: "confronto", intensity: "strange", surpriseLevel: 5, tags: ["confiança"] },
  { id: "confrontation-05", text: "Afastem-se de quem parece mais perigoso.", action: "move", category: "confronto", intensity: "strange", surpriseLevel: 5, tags: ["perigo", "rejeição"] },
  { id: "confrontation-06", text: "Escolham alguém para contratar. Escolham alguém para demitir.", action: "point", category: "confronto", intensity: "strange", surpriseLevel: 5, tags: ["trabalho", "julgamento"] },
  { id: "confrontation-07", text: "Olhem nos olhos de alguém. Não desviem. Mais cinco segundos.", action: "look", category: "confronto", intensity: "strange", surpriseLevel: 5, tags: ["olhar", "tensão"] },
  { id: "confrontation-08", text: "Façam silêncio. Quem quebrar primeiro perde.", action: "silence", category: "confronto", intensity: "strange", surpriseLevel: 5, progressValue: 0, tags: ["silêncio", "regra"] }
];

const ACTION_PROGRESS = Object.fromEntries(
  AUDIENCE_WARMUP_ACTIONS.map((action) => [action.id, action.progressValue])
);

// Every prompt receives an explicit runtime value. Override progressValue or
// repeatableProgress on an individual entry above when its dramaturgical weight differs.
export const AUDIENCE_WARMUP_PROMPTS = AUDIENCE_WARMUP_PROMPT_LIBRARY.map((prompt) => ({
  progressValue: ACTION_PROGRESS[prompt.action] ?? 0,
  repeatableProgress: false,
  ...prompt
}));
