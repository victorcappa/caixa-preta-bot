// Banco editável da Mala 2. Durações são sempre limitadas a 60–120 segundos.
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
    description: "Localizar um objeto que pareça guardar uma história.",
    instruction: "Encontre no espaço um objeto que pareça ter uma história e traga-o até aqui.",
    durationMin: 60,
    durationMax: 90,
    difficulty: "fácil",
    notes: "Não retirar objetos de bolsas ou áreas privadas."
  },
  {
    id: "emprestimo_plateia",
    description: "Negociar um empréstimo simples com alguém da plateia.",
    instruction: "Consiga com alguém da plateia um objeto pequeno que essa pessoa aceite emprestar para a cena.",
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
    description: "Localizar um objeto cotidiano capaz de produzir um som simples.",
    instruction: "Encontre e traga um objeto que produza um som sem precisar quebrar, bater forte ou ligar na tomada.",
    durationMin: 60,
    durationMax: 90,
    difficulty: "média",
    notes: "Evitar volume alto, líquidos, vidro e equipamentos técnicos."
  },
  {
    id: "colecao_improvavel",
    description: "Montar uma pequena coleção por uma característica visível.",
    instruction: "Traga três objetos pequenos que tenham alguma característica visível em comum. Você decide qual.",
    durationMin: 90,
    durationMax: 120,
    difficulty: "média",
    notes: "A característica deve poder ser explicada rapidamente ao retornar."
  }
];
