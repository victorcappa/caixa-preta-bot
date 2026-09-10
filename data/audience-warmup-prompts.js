export const AUDIENCE_WARMUP_ACTIONS = [
  { id: "sleep", icon: "Z", label: "Dormir / acordar", instruction: "dorme ou acorda", progressValue: 4 },
  { id: "stomp", icon: "↓", label: "Bater os pés", instruction: "bate os pés", progressValue: 6 },
  { id: "scream", icon: "!", label: "Gritar", instruction: "grita", progressValue: 6 },
  { id: "dance", icon: "♪", label: "Dançar", instruction: "dança", progressValue: 6 },
  { id: "mime", icon: "◇", label: "Fazer mímica", instruction: "faz mímica", progressValue: 4 },
  { id: "pose", icon: "◆", label: "Fazer pose", instruction: "faz uma pose", progressValue: 4 },
  { id: "sound", icon: ")))", label: "Fazer som", instruction: "faz um som", progressValue: 6 },
  { id: "chorus", icon: "AAA", label: "Responder em coro", instruction: "responde em coro", progressValue: 6 },
  { id: "count", icon: "123", label: "Contar", instruction: "conta", progressValue: 5 },
  { id: "wave", icon: "~", label: "Fazer onda", instruction: "faz uma onda", progressValue: 5 },
  { id: "shake", icon: "≈", label: "Balançar", instruction: "balança", progressValue: 5 },
  { id: "freeze", icon: "■", label: "Congelar", instruction: "fica imóvel", progressValue: 5 },
  { id: "swap", icon: "⇄", label: "Trocar de lugar", instruction: "troca de lugar", progressValue: 7 },
  { id: "imitate", icon: "=", label: "Imitar", instruction: "imita", progressValue: 5 },
  { id: "hide", icon: "×", label: "Esconder", instruction: "se esconde", progressValue: 4 },
  { id: "raise_object", icon: "▣", label: "Levantar objeto", instruction: "levanta um objeto", progressValue: 5 },
  { id: "touch_self", icon: "·", label: "Tocar o corpo", instruction: "toca o próprio corpo", progressValue: 4 },
  { id: "rhythm", icon: "••", label: "Criar ritmo", instruction: "cria um ritmo", progressValue: 7 },
  { id: "competition", icon: "VS", label: "Competir", instruction: "compete", progressValue: 7 },
  { id: "choice", icon: "A/B", label: "Escolher lado", instruction: "escolhe um lado", progressValue: 6 },
  { id: "move", icon: "↔", label: "Mover o corpo", instruction: "move o corpo", progressValue: 5 },
  { id: "look", icon: "OO", label: "Olhar", instruction: "olha", progressValue: 3 },
  { id: "point", icon: "→", label: "Apontar", instruction: "aponta", progressValue: 4 },
  { id: "stand", icon: "↑", label: "Ficar de pé", instruction: "fica de pé", progressValue: 5 },
  { id: "sit", icon: "↓", label: "Sentar", instruction: "senta", progressValue: 4 },
  { id: "clap", icon: "+", label: "Bater palmas", instruction: "bate palmas", progressValue: 6 },
  { id: "hand", icon: "I", label: "Levantar a mão", instruction: "levanta a mão", progressValue: 4 },
  { id: "eyes", icon: "—", label: "Fechar os olhos", instruction: "fecha os olhos", progressValue: 4 }
];

export const AUDIENCE_WARMUP_INTENSITIES = [
  { id: "play", label: "1 · PLAY" },
  { id: "personal", label: "2 · PERSONAL" },
  { id: "exposed", label: "3 · EXPOSED" },
  { id: "provocative", label: "4 · PROVOCATIVE" },
  { id: "social_pressure", label: "5 · SOCIAL PRESSURE" }
];

export const AUDIENCE_WARMUP_INTERACTION_TYPES = [
  "conditional", "collective", "rhythm", "mime", "chorus", "division",
  "competition", "confession", "object", "movement", "sequence"
];

const ACTION_PROGRESS = Object.fromEntries(AUDIENCE_WARMUP_ACTIONS.map((action) => [action.id, action.progressValue]));

function prompt(id, text, action, category, intensity, interactionType, tags, options = {}) {
  const surpriseLevel = Math.max(0, AUDIENCE_WARMUP_INTENSITIES.findIndex((level) => level.id === intensity));
  return {
    id, text, action, category, intensity, interactionType, tags,
    surpriseLevel,
    progressValue: ACTION_PROGRESS[action] ?? 0,
    repeatableProgress: false,
    reaction: false,
    ...options
  };
}

function step(text, action, options = {}) {
  return { text, action, ...options };
}

// O texto abaixo é a fonte de verdade. Nenhuma camada de modelo pode reconstruí-lo.
export const AUDIENCE_WARMUP_PROMPTS = [
  // 1 · PLAY — corpo, ritmo, absurdo e energia de auditório.
  prompt("transport-01", "BATAM O PÉ NO CHÃO POR 15 SEGUNDOS. NO MESMO RITMO.", "stomp", "ritmo / som", "play", "rhythm", ["ritmo", "pés"], { durationSeconds: 15 }),
  prompt("play-02", "DANCEM MACARENA EM SILÊNCIO.", "dance", "corpo / ridículo", "play", "movement", ["corpo", "dança"]),
  prompt("play-03", "MOSTREM A LÍNGUA POR 5 SEGUNDOS.", "touch_self", "corpo / absurdo", "play", "collective", ["corpo", "língua"], { durationSeconds: 5 }),
  prompt("play-04", "FAÇAM CARA DE FOTO 3X4.", "pose", "corpo / absurdo", "play", "collective", ["rosto", "pose"]),
  prompt("play-05", "TODO MUNDO DÁ UM GRITO EM 3, 2, 1.", "scream", "ritmo / som", "play", "chorus", ["grito", "coro"]),
  prompt("play-06", "FAÇAM O SOM DE UMA TURBINA.", "sound", "avião", "play", "chorus", ["avião", "som"]),
  prompt("play-07", "FIQUEM COMPLETAMENTE IMÓVEIS POR 7 SEGUNDOS.", "freeze", "corpo / absurdo", "play", "collective", ["corpo", "imobilidade"], { durationSeconds: 7 }),
  prompt("play-08", "FAÇAM UMA POSE DE FISICULTURISTA.", "pose", "corpo / absurdo", "play", "mime", ["corpo", "pose"]),
  prompt("play-09", "FECHEM OS OLHOS POR 5 SEGUNDOS.", "eyes", "corpo / atenção", "play", "sequence", ["olhos", "atenção"], { steps: [step("FECHEM OS OLHOS POR 5 SEGUNDOS.", "eyes", { durationSeconds: 5 }), step("ABRAM.", "eyes")] }),
  prompt("play-10", "PISQUEM O MAIS RÁPIDO POSSÍVEL POR 5 SEGUNDOS.", "eyes", "corpo / absurdo", "play", "competition", ["olhos", "velocidade"], { durationSeconds: 5 }),
  prompt("play-11", "DANCEM POR 7 SEGUNDOS. SEM MÚSICA.", "dance", "corpo / ridículo", "play", "movement", ["dança", "ritmo"], { durationSeconds: 7 }),
  prompt("play-12", "UMA PALMA. DUAS. TRÊS. AGORA O MAIS RÁPIDO POSSÍVEL.", "clap", "ritmo / som", "play", "sequence", ["palmas", "ritmo"], { steps: [step("UMA PALMA.", "clap"), step("DUAS PALMAS.", "clap"), step("TRÊS PALMAS.", "clap"), step("AGORA O MAIS RÁPIDO POSSÍVEL POR 5 SEGUNDOS.", "rhythm", { durationSeconds: 5 })] }),
  prompt("play-13", "FAÇAM UM CORO DE BOCEJOS.", "chorus", "ritmo / som", "play", "chorus", ["bocejo", "coro"]),
  prompt("play-14", "TODO MUNDO FAZ O SOM DE UMA NOTIFICAÇÃO.", "imitate", "ritmo / som", "play", "chorus", ["celular", "som"]),
  prompt("play-15", "LEVANTEM OS CELULARES.", "raise_object", "objetos", "play", "object", ["celular", "objeto"], { steps: [step("LEVANTEM OS CELULARES.", "raise_object"), step("AGORA ESCONDAM.", "hide")] }),
  prompt("play-16", "LADO ESQUERDO: PALMAS.", "rhythm", "programa de auditório", "play", "division", ["lado", "ritmo"], { steps: [step("LADO ESQUERDO: PALMAS.", "clap"), step("LADO DIREITO: PÉS.", "stomp"), step("AGORA JUNTOS.", "rhythm", { durationSeconds: 7 })] }),
  prompt("play-17", "FAÇAM UMA ONDA DA ESQUERDA PARA A DIREITA.", "wave", "programa de auditório", "play", "movement", ["onda", "lado"]),
  prompt("play-18", "OLHEM NOS OLHOS DA PESSOA AO LADO.", "look", "corpo / atenção", "play", "collective", ["olhar", "atenção"], { durationSeconds: 10 }),
  prompt("play-19", "INCLINEM PARA A ESQUERDA.", "move", "corpo / ritmo", "play", "sequence", ["corpo", "movimento"], { steps: [step("INCLINEM PARA A ESQUERDA.", "move"), step("AGORA PARA A DIREITA.", "move"), step("FIQUEM IMÓVEIS.", "freeze", { durationSeconds: 5 })] }),
  prompt("play-20", "TODO MUNDO DE PÉ.", "competition", "programa de auditório", "play", "competition", ["velocidade", "auditório"], { steps: [step("TODO MUNDO DE PÉ.", "stand"), step("SENTEM.", "sit"), step("DE PÉ DE NOVO. QUEM DEMORAR POR ÚLTIMO PERDEU.", "competition")] }),

  // 2 · PERSONAL — hábitos e fatos pessoais com ações inesperadas.
  prompt("personal-01", "SE VOCÊ DORME MENOS DE 8 HORAS POR DIA, TIRE UM COCHILO DE 5 SEGUNDOS.", "sleep", "hábitos", "personal", "conditional", ["sono", "hábito"], { durationSeconds: 5 }),
  prompt("personal-02", "QUEM VEIO DE LONGE FAZ BARULHO.", "sound", "programa de auditório", "personal", "conditional", ["distância", "som"]),
  prompt("personal-03", "QUEM VEIO SOZINHO LEVANTA E GIRA UMA VEZ.", "move", "relações", "personal", "conditional", ["sozinho", "movimento"]),
  prompt("personal-04", "SE VOCÊ MENTIU HOJE, COCE A CABEÇA.", "touch_self", "hábitos", "personal", "confession", ["mentira", "cabeça"]),
  prompt("personal-05", "QUEM ESTÁ COM FOME FAZ \"UH\".", "chorus", "hábitos", "personal", "conditional", ["fome", "som"]),
  prompt("personal-06", "QUEM ESTÁ DE PRETO LEVANTA.", "stand", "aparência", "personal", "conditional", ["roupa", "cor"]),
  prompt("personal-07", "QUEM ESTÁ DE TÊNIS MOSTRA O PÉ.", "pose", "aparência", "personal", "conditional", ["roupa", "pé"]),
  prompt("personal-08", "QUEM ESTÁ USANDO ÓCULOS TIRA OS ÓCULOS POR 3 SEGUNDOS.", "hide", "aparência", "personal", "object", ["óculos", "objeto"], { durationSeconds: 3 }),
  prompt("personal-09", "QUEM TEM CHAVE NA BOLSA OU NO BOLSO BALANÇA AS CHAVES.", "raise_object", "objetos", "personal", "object", ["chave", "som"]),
  prompt("personal-10", "QUEM CHEGOU ATRASADO FAZ CARA DE INOCENTE.", "pose", "hábitos", "personal", "confession", ["atraso", "rosto"]),
  prompt("personal-11", "QUEM MORA COM OS PAIS ACENA PARA A PLATEIA.", "wave", "moradia", "personal", "conditional", ["família", "moradia"]),
  prompt("personal-12", "QUEM ESTÁ DESEMPREGADO BATE O PÉ TRÊS VEZES.", "stomp", "trabalho", "personal", "conditional", ["trabalho", "pés"]),
  prompt("personal-13", "QUEM JÁ FALTOU AO TRABALHO FINGINDO DOENÇA TOSSE DUAS VEZES.", "imitate", "trabalho", "personal", "confession", ["trabalho", "mentira"]),
  prompt("personal-14", "QUEM REPETIU ROUPA ESTA SEMANA NÃO SE MEXE.", "freeze", "hábitos", "personal", "confession", ["roupa", "vergonha"], { durationSeconds: 5 }),
  prompt("personal-15", "QUEM PROGRAMOU MAIS DE TRÊS ALARMES HOJE LEVANTA TRÊS DEDOS.", "count", "hábitos", "personal", "conditional", ["sono", "contagem"]),
  prompt("personal-16", "QUEM TEM MEDO DE AVIÃO DÊ UM GRITO.", "scream", "avião", "personal", "conditional", ["avião", "medo"]),
  prompt("personal-17", "QUEM JÁ PASSOU POR TURBULÊNCIA LEVANTA OS BRAÇOS.", "hand", "avião", "personal", "conditional", ["avião", "turbulência"]),
  prompt("personal-18", "QUEM JÁ ACHOU QUE UM AVIÃO IA CAIR FECHA OS OLHOS.", "eyes", "avião", "personal", "confession", ["avião", "medo"]),
  prompt("personal-19", "QUEM TEM GUARDA-CHUVA LEVANTA.", "raise_object", "objetos", "personal", "object", ["guarda-chuva", "objeto"]),
  prompt("personal-20", "QUEM JÁ CHEIROU A PRÓPRIA ROUPA PARA DECIDIR SE DAVA PARA USAR FAZ UMA CARA MUITO FEIA.", "pose", "hábitos", "personal", "confession", ["roupa", "vergonha"]),

  // 3 · EXPOSED — dinheiro, relações, medo, crença e política.
  prompt("exposed-01", "SE VOCÊ TEM DÍVIDA NO CARTÃO, FECHE OS OLHOS E RESPIRE FUNDO.", "eyes", "dinheiro", "exposed", "confession", ["dinheiro", "dívida"], { durationSeconds: 5 }),
  prompt("exposed-02", "QUEM TEM MENOS DE 100 REAIS NA CONTA FAZ CARA DE PREOCUPADO.", "pose", "dinheiro", "exposed", "confession", ["dinheiro", "classe"]),
  prompt("exposed-03", "QUEM TEM MAIS DE 10 MIL DISPONÍVEIS AGORA ACENA.", "wave", "dinheiro", "exposed", "confession", ["dinheiro", "classe"]),
  prompt("exposed-04", "QUEM ESTÁ DEVENDO DINHEIRO PARA ALGUÉM OLHA PARA O CHÃO.", "look", "dinheiro", "exposed", "confession", ["dinheiro", "dívida"]),
  prompt("exposed-05", "QUEM RECEBE AJUDA FINANCEIRA DOS PAIS TOCA NO PRÓPRIO OMBRO.", "touch_self", "dinheiro", "exposed", "conditional", ["dinheiro", "família"]),
  prompt("exposed-06", "QUEM AJUDA FINANCEIRAMENTE OS PAIS BATE DUAS PALMAS.", "clap", "dinheiro", "exposed", "conditional", ["dinheiro", "família"]),
  prompt("public-07", "QUEM VOTOU NO LULA FICA DE PÉ.", "stand", "política", "exposed", "confession", ["política", "Lula", "voto"]),
  prompt("exposed-08", "QUEM VOTOU NO BOLSONARO CRUZA OS BRAÇOS.", "pose", "política", "exposed", "confession", ["política", "Bolsonaro", "voto"]),
  prompt("exposed-09", "QUEM VOTOU EM BRANCO LEVANTA AS DUAS MÃOS.", "hand", "política", "exposed", "confession", ["política", "branco", "voto"]),
  prompt("exposed-10", "QUEM JÁ BRIGOU COM PARENTE POR POLÍTICA BATE CINCO PALMAS.", "clap", "política", "exposed", "confession", ["política", "família"]),
  prompt("exposed-11", "QUEM ESTÁ SOLTEIRO MANDA UM BEIJO PARA A PLATEIA.", "mime", "relações", "exposed", "conditional", ["relacionamento", "solteiro"]),
  prompt("exposed-12", "QUEM VOLTOU COM EX ESTE ANO GIRA UMA VEZ.", "move", "relações", "exposed", "confession", ["relacionamento", "ex"]),
  prompt("exposed-13", "QUEM AINDA PENSA NO EX FECHA OS OLHOS.", "eyes", "relações", "exposed", "confession", ["relacionamento", "ex"]),
  prompt("exposed-14", "QUEM OLHOU O CELULAR DO PARCEIRO ESCONDIDO ESCONDE O PRÓPRIO ROSTO.", "hide", "relações", "exposed", "confession", ["relacionamento", "celular"]),
  prompt("exposed-15", "QUEM ACREDITA EM DEUS FICA DE PÉ.", "stand", "crença", "exposed", "confession", ["religião", "crença"]),
  prompt("exposed-16", "QUEM NÃO ACREDITA EM DEUS LEVANTA UM DEDO.", "hand", "crença", "exposed", "confession", ["religião", "crença"]),
  prompt("exposed-17", "QUEM TEM DÚVIDA SOBRE DEUS FICA COMPLETAMENTE IMÓVEL.", "freeze", "crença", "exposed", "confession", ["religião", "dúvida"], { durationSeconds: 5 }),
  prompt("exposed-18", "QUEM TEM REMÉDIO NA BOLSA LEVANTA A MÃO.", "hand", "objetos", "exposed", "object", ["remédio", "objeto"]),
  prompt("exposed-19", "QUEM TEM MAIS DE TRÊS CARTÕES NA CARTEIRA BATE TRÊS PALMAS.", "clap", "objetos", "exposed", "object", ["cartão", "dinheiro"]),
  prompt("exposed-20", "QUEM JÁ DESEJOU SECRETAMENTE O FRACASSO DE ALGUÉM MOSTRA OS DENTES.", "pose", "culpa", "exposed", "confession", ["culpa", "inveja"]),

  // 4 · PROVOCATIVE — sexo, drogas, culpa, voto e segredos, sem eufemismo.
  prompt("provocative-01", "QUEM É MACONHEIRO FAZ UMA ONDA COM AS MÃOS.", "wave", "drogas", "provocative", "confession", ["droga", "maconheiro"]),
  prompt("provocative-02", "QUEM FUMOU MACONHA ESTA SEMANA FAZ SINAL DE FUMAÇA COM AS MÃOS.", "mime", "drogas", "provocative", "mime", ["droga", "maconha"]),
  prompt("provocative-03", "QUEM FUMOU MACONHA HOJE NÃO SE MEXE.", "freeze", "drogas", "provocative", "conditional", ["droga", "maconha"], { durationSeconds: 5 }),
  prompt("provocative-04", "QUEM JÁ CHEIROU COCAÍNA TOCA NO NARIZ.", "touch_self", "drogas", "provocative", "confession", ["droga", "cocaína"]),
  prompt("provocative-05", "QUEM JÁ USOU DROGA ANTES DE TRABALHAR IMITA UM TECLADO.", "imitate", "drogas", "provocative", "mime", ["droga", "trabalho"]),
  prompt("provocative-06", "QUEM JÁ TOMOU ALGUMA COISA SEM SABER O QUE ERA BALANÇA A CABEÇA.", "shake", "drogas", "provocative", "movement", ["droga", "risco"]),
  prompt("provocative-07", "QUEM TRANSOU ESTA SEMANA BATE DEZ PALMAS.", "clap", "sexo", "provocative", "rhythm", ["sexo", "transou"]),
  prompt("provocative-08", "QUEM NÃO TRANSOU ESTA SEMANA BATE UMA PALMA SÓ.", "clap", "sexo", "provocative", "conditional", ["sexo", "não transou"]),
  prompt("provocative-09", "QUEM JÁ MANDOU NUDE ESCONDE O ROSTO POR 3 SEGUNDOS.", "hide", "sexo", "provocative", "conditional", ["sexo", "nude"], { durationSeconds: 3 }),
  prompt("provocative-10", "QUEM JÁ FINGIU ORGASMO FAZ UMA PALMA BEM DEVAGAR.", "clap", "sexo", "provocative", "rhythm", ["sexo", "orgasmo"]),
  prompt("provocative-11", "QUEM JÁ TRANSOU PENSANDO EM OUTRA PESSOA OLHA PARA O TETO.", "look", "sexo", "provocative", "confession", ["sexo", "segredo"]),
  prompt("provocative-12", "QUEM ESTÁ HÁ MAIS DE UM MÊS SEM TRANSAR CRUZA AS PERNAS.", "pose", "sexo", "provocative", "movement", ["sexo", "relacionamento"]),
  prompt("provocative-13", "QUEM TEM CAMISINHA NA BOLSA OU NO BOLSO LEVANTA UM DEDO.", "hand", "objetos", "provocative", "object", ["sexo", "camisinha"]),
  prompt("provocative-14", "QUEM JÁ TRAIU DESVIA O OLHAR.", "look", "relações", "provocative", "confession", ["relacionamento", "traição"]),
  prompt("provocative-15", "QUEM JÁ ROUBOU ALGUMA COISA FAZ UMA POSE DE LADRÃO DE DESENHO ANIMADO.", "mime", "culpa", "provocative", "mime", ["culpa", "roubo"]),
  prompt("provocative-16", "QUEM JÁ ESPALHOU UM SEGREDO SUSSURRA \"EU\".", "chorus", "culpa", "provocative", "chorus", ["culpa", "segredo"]),
  prompt("provocative-17", "QUEM JÁ COMEMOROU O FRACASSO DE ALGUÉM BATE O PÉ UMA VEZ.", "stomp", "culpa", "provocative", "rhythm", ["culpa", "inveja"]),
  prompt("provocative-18", "QUEM VOTOU NO LULA E SE ARREPENDEU SENTA.", "sit", "política", "provocative", "division", ["política", "Lula", "arrependimento"]),
  prompt("provocative-19", "QUEM VOTOU NO BOLSONARO E SE ARREPENDEU LEVANTA.", "stand", "política", "provocative", "division", ["política", "Bolsonaro", "arrependimento"]),
  prompt("provocative-20", "QUEM MENTIU EM ALGUMA AÇÃO DESTE AQUECIMENTO PISCA TRÊS VEZES.", "eyes", "culpa", "provocative", "conditional", ["mentira", "aquecimento"]),

  // 5 · SOCIAL PRESSURE — divisão da sala, escolha e microcompetição.
  prompt("social-01", "ESQUERDA CONTRA DIREITA. QUEM GRITA MAIS ALTO?", "competition", "programa de auditório", "social_pressure", "competition", ["lado", "grito"], { durationSeconds: 8 }),
  prompt("social-02", "PRIMEIRO LADO DA PLATEIA A BATER 20 PALMAS GANHA.", "competition", "ritmo / som", "social_pressure", "competition", ["lado", "palmas"], { durationSeconds: 10 }),
  prompt("social-03", "TODO MUNDO DE PÉ. ÚLTIMO A SENTAR PERDE.", "competition", "programa de auditório", "social_pressure", "competition", ["velocidade", "sentar"]),
  prompt("social-04", "QUEM CONSEGUE FICAR MAIS TEMPO SEM PISCAR? COMEÇOU.", "competition", "corpo / absurdo", "social_pressure", "competition", ["olhos", "resistência"], { durationSeconds: 15 }),
  prompt("social-05", "SEGUREM UM PÉ FORA DO CHÃO POR 5 SEGUNDOS.", "pose", "corpo / absurdo", "social_pressure", "competition", ["equilíbrio", "pé"], { durationSeconds: 5 }),
  prompt("social-06", "PRIMEIRA METADE DA PLATEIA: GRITEM.", "scream", "programa de auditório", "social_pressure", "division", ["lado", "grito"], { steps: [step("PRIMEIRA METADE DA PLATEIA: GRITEM.", "scream"), step("AGORA A OUTRA METADE.", "scream"), step("AS DUAS JUNTAS.", "chorus")] }),
  prompt("social-07", "QUEM VOTOU NO LULA FICA DE PÉ.", "choice", "política", "social_pressure", "sequence", ["política", "Lula", "voto"], { steps: [step("QUEM VOTOU NO LULA FICA DE PÉ.", "stand"), step("QUEM VOTOU NO BOLSONARO CRUZA OS BRAÇOS.", "pose"), step("QUEM VOTOU EM OUTRO CANDIDATO LEVANTA AS DUAS MÃOS.", "hand"), step("QUEM NÃO LEMBRA EM QUEM VOTOU CONTINUA ABSOLUTAMENTE IMÓVEL.", "freeze")] }),
  prompt("social-08", "QUEM TRANSOU ESTA SEMANA BATE DEZ PALMAS.", "rhythm", "sexo", "social_pressure", "sequence", ["sexo", "transou"], { steps: [step("QUEM TRANSOU ESTA SEMANA BATE DEZ PALMAS.", "clap"), step("QUEM NÃO TRANSOU: UMA PALMA SÓ.", "clap"), step("QUEM MENTIU NÃO SE MEXE.", "freeze")] }),
  prompt("social-09", "QUEM TEM MENOS DE 100 REAIS NA CONTA FICA DE PÉ.", "choice", "dinheiro", "social_pressure", "division", ["dinheiro", "classe"], { steps: [step("QUEM TEM MENOS DE 100 REAIS NA CONTA FICA DE PÉ.", "stand"), step("QUEM TEM MAIS DE 10 MIL DISPONÍVEIS ACENA.", "wave"), step("OBSERVEM A DISTRIBUIÇÃO.", "look")] }),
  prompt("social-10", "QUEM ACREDITA EM DEUS FICA DE PÉ.", "choice", "crença", "social_pressure", "division", ["religião", "crença"], { steps: [step("QUEM ACREDITA EM DEUS FICA DE PÉ.", "stand"), step("QUEM NÃO ACREDITA LEVANTA AS DUAS MÃOS.", "hand"), step("QUEM TEM DÚVIDA FECHA OS OLHOS.", "eyes")] }),
  prompt("social-11", "QUEM É MACONHEIRO FAZ UMA ONDA COM AS MÃOS.", "wave", "drogas", "social_pressure", "sequence", ["droga", "maconheiro"], { steps: [step("QUEM É MACONHEIRO FAZ UMA ONDA COM AS MÃOS.", "wave"), step("QUEM FUMOU HOJE NÃO SE MEXE.", "freeze"), step("OS OUTROS FAZEM O SOM DE UMA SIRENE.", "sound")] }),
  prompt("social-12", "TROQUEM DE LUGAR COM ALGUÉM QUE VOCÊS NÃO CONHECEM.", "swap", "programa de auditório", "social_pressure", "movement", ["troca", "desconhecido"], { durationSeconds: 15 }),
  prompt("social-13", "APONTE PARA QUEM VOCÊ ACHA QUE CHEGOU MAIS ATRASADO.", "point", "julgamento", "social_pressure", "division", ["atraso", "julgamento"]),
  prompt("social-14", "OLHE PARA ALGUÉM QUE VOCÊ ACHA QUE MENTIU AQUI.", "look", "julgamento", "social_pressure", "division", ["mentira", "julgamento"], { durationSeconds: 5 }),
  prompt("social-15", "QUEM VEIO ACOMPANHADO MAS ESTÁ ATRAÍDO POR OUTRA PESSOA FICA IMÓVEL.", "freeze", "relações", "social_pressure", "confession", ["relacionamento", "atração"], { durationSeconds: 7 }),
  prompt("social-16", "QUEM FICARIA COM ALGUÉM DESTA SALA LEVANTA A MÃO.", "hand", "relações", "social_pressure", "sequence", ["relacionamento", "atração"], { steps: [step("QUEM FICARIA COM ALGUÉM DESTA SALA LEVANTA A MÃO.", "hand"), step("OLHE PARA ESSA PESSOA.", "look", { durationSeconds: 5 })] }),
  prompt("social-17", "APONTE PARA QUEM VOCÊ ACHA MAIS BONITO.", "point", "relações", "social_pressure", "sequence", ["atração", "julgamento"], { steps: [step("APONTE PARA QUEM VOCÊ ACHA MAIS BONITO.", "point"), step("AGORA APONTE PARA QUEM VOCÊ ACHA QUE SABE DISSO.", "point")] }),
  prompt("social-18", "QUEM JÁ TRAIU FICA DE PÉ.", "choice", "relações", "social_pressure", "sequence", ["relacionamento", "traição"], { steps: [step("QUEM JÁ TRAIU FICA DE PÉ.", "stand"), step("QUEM JÁ FOI TRAÍDO LEVANTA A MÃO.", "hand"), step("QUEM ESTÁ NOS DOIS GRUPOS LEVANTA AS DUAS.", "hand")] }),
  prompt("social-19", "QUEM CHEGOU ATRASADO FICA DE PÉ.", "choice", "programa de auditório", "social_pressure", "sequence", ["atraso", "julgamento"], { steps: [step("QUEM CHEGOU ATRASADO FICA DE PÉ.", "stand"), step("QUEM ACHA QUE ALGUÉM MENTIU, APONTA.", "point")] }),
  prompt("social-20", "OLHEM PARA A PESSOA AO LADO.", "look", "corpo / atenção", "social_pressure", "sequence", ["olhar", "confronto"], { steps: [step("OLHEM PARA A PESSOA AO LADO.", "look"), step("NÃO DESVIEM.", "freeze", { durationSeconds: 10 })] })
];
