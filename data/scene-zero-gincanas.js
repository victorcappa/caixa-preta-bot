// Desafio fixo da primeira mala escolhida pelo robô (Mala 2).
export const SCENE_ZERO_EVIDENCIAS_CHALLENGE = {
  id: "evidencias_lanterna",
  description: "Descrever a lanterna e transformá-la em microfone para cantar Evidências.",
  instruction: "Primeiro, descreva o objeto à sua frente: a lanterna. Agora use a lanterna como microfone e cante Evidências, de Chitãozinho & Xororó. O público pode ajudar.",
  presentation: "Primeiro: descreva o objeto à sua frente — a lanterna. Agora use a lanterna como microfone e cante Evidências, de Chitãozinho & Xororó. O público pode ajudar. Para a música, você tem 20 segundos. Começar.",
  durationMin: 20,
  durationMax: 20,
  difficulty: "coragem vocal",
  notes: "A contagem de 20 segundos vale somente para a música. A lanterna é um microfone cênico; não deve ser acesa diretamente no rosto de ninguém."
};

// Desafio fixo da segunda mala escolhida pelo robô (Mala 3).
export const SCENE_ZERO_SMELL_CHALLENGE = {
  id: "objeto_pelo_cheiro",
  description: "Ajudar o público a adivinhar um objeto descrevendo somente o cheiro.",
  instruction: "Pegue o objeto, mas não revele para o público. Cheire o objeto. Ajude o público a adivinhar qual é o objeto descrevendo apenas o cheiro.",
  presentation: "Pegue o objeto, mas não revele para o público. Cheire o objeto. Você tem 20 segundos para ajudar o público a adivinhar qual é o objeto descrevendo apenas o cheiro. Começar.",
  durationMin: 20,
  durationMax: 20,
  difficulty: "descrição olfativa",
  notes: "Não mostrar nem nomear o objeto. Não cheirar substâncias desconhecidas, irritantes ou potencialmente perigosas."
};

// Banco editável legado da Mala 2, preservado para recuperação e ensaio.
export const SCENE_ZERO_GINCANAS = [
  {
    id: "tres_objetos_verdes",
    description: "Encontrar rapidamente três objetos da mesma cor no espaço.",
    instruction: "Busque três objetos verdes no teatro e traga os três até aqui.",
    durationMin: 75,
    durationMax: 100,
    difficulty: "fácil",
    notes: "Os objetos devem ser leves, seguros e poder ser devolvidos sem interromper a cena."
  },
  {
    id: "objeto_com_historia",
    description: "Localizar um papel impresso com uma data visível.",
    instruction: "Encontre e traga um papel impresso que mostre uma data visível.",
    durationMin: 60,
    durationMax: 90,
    difficulty: "fácil",
    notes: "Não retirar objetos de bolsas ou áreas privadas."
  },
  {
    id: "emprestimo_plateia",
    description: "Negociar o empréstimo de uma caneta com alguém da plateia.",
    instruction: "Consiga com alguém da plateia uma caneta emprestada para a cena e traga-a até aqui.",
    durationMin: 75,
    durationMax: 105,
    difficulty: "média",
    notes: "Consentimento explícito; nada frágil, caro, íntimo ou necessário para acessibilidade."
  },
  {
    id: "duas_texturas",
    description: "Encontrar objetos seguros com texturas contrastantes.",
    instruction: "Traga dois objetos seguros: um que pareça muito liso e outro que pareça muito áspero.",
    durationMin: 70,
    durationMax: 100,
    difficulty: "fácil",
    notes: "Não tocar em pessoas nem remover objetos fixos do cenário."
  },
  {
    id: "objeto_que_faz_som",
    description: "Localizar um molho de chaves capaz de produzir um som simples.",
    instruction: "Encontre e traga um molho de chaves que possa produzir um som ao ser sacudido suavemente.",
    durationMin: 60,
    durationMax: 90,
    difficulty: "média",
    notes: "Evitar volume alto, líquidos, vidro e equipamentos técnicos."
  },
  {
    id: "colecao_improvavel",
    description: "Montar uma pequena coleção de três objetos determinados.",
    instruction: "Traga exatamente uma chave, uma moeda e uma caneta. Os três objetos devem caber juntos em uma das suas mãos.",
    durationMin: 90,
    durationMax: 120,
    difficulty: "média",
    notes: "Não substituir os três itens por outros; podem ser emprestados com consentimento e devem ser devolvidos."
  }
];
