export const AUDIENCE_WARMUP_ACTIONS = [
  { id: "clap", icon: "👏", label: "Bater palmas", instruction: "bate palmas", progressValue: 4 },
  { id: "hand", icon: "✋", label: "Levantar a mão", instruction: "levanta a mão", progressValue: 3 },
  { id: "hands", icon: "🙌", label: "Levantar as duas mãos", instruction: "levanta as duas mãos", progressValue: 5 },
  { id: "feet", icon: "🦶", label: "Bater os pés", instruction: "bate o pé uma vez", progressValue: 6 },
  { id: "word", icon: "🗣", label: "Falar uma palavra", instruction: "fala uma palavra", progressValue: 6 },
  { id: "sound", icon: "🔊", label: "Fazer um som", instruction: "faz um som", progressValue: 7 },
  { id: "silence", icon: "🤫", label: "Ficar em silêncio", instruction: "fica em silêncio", progressValue: 4 },
  { id: "look", icon: "👀", label: "Olhar para alguém", instruction: "olha para alguém", progressValue: 2 }
];

export const AUDIENCE_WARMUP_INTENSITIES = [
  { id: "light", label: "LEVE" },
  { id: "medium", label: "MÉDIO" },
  { id: "strange", label: "ESTRANHO" }
];

const AUDIENCE_WARMUP_PROMPT_LIBRARY = [
  { id: "transport-01", text: "Quem veio de transporte público bate palmas.", action: "clap", category: "transporte", intensity: "light", tags: ["deslocamento", "cidade"] },
  { id: "transport-02", text: "Quem demorou mais de quarenta minutos para chegar aqui bate palmas.", action: "clap", category: "transporte", intensity: "light", tags: ["tempo", "deslocamento"] },
  { id: "transport-03", text: "Quem veio a pé em algum trecho do caminho bate o pé uma vez.", action: "feet", category: "transporte", intensity: "light", tags: ["caminho"] },
  { id: "location-01", text: "Quem mora a menos de cinco quilômetros daqui levanta a mão.", action: "hand", category: "localização", intensity: "light", tags: ["distância"] },
  { id: "location-02", text: "Quando eu disser três, todo mundo fala ao mesmo tempo o bairro onde mora.", action: "word", category: "localização", intensity: "light", countdown: 3, tags: ["bairro", "coro"] },
  { id: "location-03", text: "Quem atravessou mais de um bairro para chegar aqui levanta as duas mãos.", action: "hands", category: "localização", intensity: "light", tags: ["distância"] },
  { id: "age-01", text: "Quem aprendeu a usar a internet antes dos dez anos levanta a mão.", action: "hand", category: "idade", intensity: "light", tags: ["geração", "tecnologia"] },
  { id: "age-02", text: "Quem ainda lembra do som de uma internet discada faz um som parecido.", action: "sound", category: "idade", intensity: "medium", tags: ["memória", "tecnologia"] },
  { id: "age-03", text: "Quem já mudou de ideia sobre a própria idade bate palmas.", action: "clap", category: "idade", intensity: "medium", tags: ["tempo"] },
  { id: "company-01", text: "Quem veio sozinho levanta as duas mãos.", action: "hands", category: "companhia", intensity: "light", tags: ["presença"] },
  { id: "company-02", text: "Quem conheceu hoje a pessoa ao lado olha para ela.", action: "look", category: "companhia", intensity: "light", tags: ["encontro"] },
  { id: "company-03", text: "Quem combinou de vir e quase desmarcou bate o pé uma vez.", action: "feet", category: "companhia", intensity: "medium", tags: ["decisão"] },
  { id: "work-01", text: "Quem trabalhou hoje levanta a mão.", action: "hand", category: "trabalho", intensity: "light", tags: ["rotina"] },
  { id: "work-02", text: "Quando eu disser três, diga uma palavra que descreve seu trabalho.", action: "word", category: "trabalho", intensity: "light", countdown: 3, tags: ["coro"] },
  { id: "work-03", text: "Quem já fingiu entender uma reunião bate palmas.", action: "clap", category: "trabalho", intensity: "medium", tags: ["humor"] },
  { id: "tech-01", text: "Quem usou inteligência artificial hoje levanta a mão.", action: "hand", category: "tecnologia", intensity: "light", tags: ["IA"] },
  { id: "tech-02", text: "Quem já agradeceu a uma máquina bate palmas.", action: "clap", category: "tecnologia", intensity: "medium", tags: ["máquina"] },
  { id: "tech-03", text: "Quem acha que máquinas entendem pessoas levanta as duas mãos.", action: "hands", category: "tecnologia", intensity: "medium", tags: ["IA", "opinião"] },
  { id: "behavior-01", text: "Quem quase desistiu de vir hoje bate o pé uma vez.", action: "feet", category: "comportamento", intensity: "medium", tags: ["decisão"] },
  { id: "behavior-02", text: "Quem já mentiu hoje bate palmas.", action: "clap", category: "comportamento", intensity: "medium", tags: ["provocação"] },
  { id: "behavior-03", text: "Quem olhou o celular nos últimos cinco minutos levanta a mão.", action: "hand", category: "comportamento", intensity: "light", tags: ["atenção"] },
  { id: "intimacy-01", text: "Quem está um pouco nervoso levanta a mão.", action: "hand", category: "intimidade leve", intensity: "medium", tags: ["estado"] },
  { id: "intimacy-02", text: "Quem gostaria de estar dormindo bate o pé uma vez.", action: "feet", category: "intimidade leve", intensity: "medium", tags: ["cansaço"] },
  { id: "intimacy-03", text: "Quem acredita em coincidência bate palmas.", action: "clap", category: "intimidade leve", intensity: "medium", tags: ["crença"] },
  { id: "absurd-01", text: "Quem já pediu desculpas para uma máquina levanta a mão.", action: "hand", category: "absurdo", intensity: "strange", tags: ["máquina"] },
  { id: "absurd-02", text: "Quem acha que alguma coisa aqui está observando a gente bate palmas.", action: "clap", category: "absurdo", intensity: "strange", tags: ["presença"] },
  { id: "absurd-03", text: "Quem tem certeza de que veio por vontade própria fica em silêncio.", action: "silence", category: "absurdo", intensity: "strange", tags: ["vontade"] },
  { id: "absurd-04", text: "Olhe para alguém como se essa pessoa tivesse acabado de chegar do futuro.", action: "look", category: "absurdo", intensity: "strange", tags: ["ficção"] },
  { id: "collective-01", text: "Quando eu disser três, todo mundo fala seu primeiro nome ao mesmo tempo.", action: "word", category: "coletividade", intensity: "light", countdown: 3, tags: ["nome", "coro"] },
  { id: "collective-02", text: "Vamos respirar juntos e, no fim, fazer um único som.", action: "sound", category: "coletividade", intensity: "medium", progressValue: 8, tags: ["respiração"] },
  { id: "collective-03", text: "Fiquem em silêncio até perceberem o menor som desta sala.", action: "silence", category: "coletividade", intensity: "medium", tags: ["escuta"] },
  { id: "collective-04", text: "Olhe para alguém que você ainda não tinha notado.", action: "look", category: "coletividade", intensity: "light", tags: ["atenção"] },
  { id: "collective-05", text: "Quem está pronto para responder a uma máquina levanta as duas mãos.", action: "hands", category: "coletividade", intensity: "strange", progressValue: 7, tags: ["máquina"] },
  { id: "absurd-05", text: "Se você suspeita que esta pergunta foi feita especialmente para você, faça um som.", action: "sound", category: "absurdo", intensity: "strange", tags: ["máquina", "presença"] }
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
