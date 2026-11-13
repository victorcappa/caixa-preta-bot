// New interface props inspired by Cena 3, pp. 13–16 of the local play draft.
// These are editorial objects, never claimed as someone's actual belongings.
export const cabinetTools = [
  { id: 'fonografo', type: 'gramophone', label: 'Fonógrafo', action: 'people', ordinaryUse: 'Tocar um registro sonoro.', strangeUse: 'Faz uma pessoa voltar em forma de biografia.', position: [-5.6, 3.8], size: 1.65 },
  { id: 'guarda-chuva', type: 'umbrella', label: 'Guarda-chuva', action: 'gaps', ordinaryUse: 'Proteger da chuva.', strangeUse: 'Abriga o que ainda não sabemos.', position: [5.7, 4], size: 1.85 },
  { id: 'tesoura', type: 'scissors', label: 'Tesoura', action: 'affinity', ordinaryUse: 'Cortar alguma coisa.', strangeUse: 'Recorta o acervo pela afinidade da ficha aberta.', position: [3.7, 5.5], size: 1.5 },
  { id: 'martelo', type: 'hammer', label: 'Martelo', action: 'cross', ordinaryUse: 'Pregar, bater, fixar.', strangeUse: 'Junta dois materiais que estavam longe demais.', position: [-.5, 5.8], size: 1.55 },
  { id: 'espelho', type: 'mirror', label: 'Espelho', action: 'double', ordinaryUse: 'Devolver a própria imagem.', strangeUse: 'Devolve uma outra referência no lugar de você.', position: [6.4, .2], size: 1.85 },
  { id: 'chave', type: 'key', label: 'Chave', action: 'reset', ordinaryUse: 'Abrir uma fechadura.', strangeUse: 'Abre de novo o acervo inteiro.', position: [-3.2, 5.5], size: 1.45 },
  { id: 'mala', type: 'suitcase', label: 'Mala', action: 'list', ordinaryUse: 'Transportar coisas.', strangeUse: 'Despeja a ilha em forma de inventário.', position: [-6.3, -.6], size: 1.65 },
  { id: 'lanterna', type: 'lamp', label: 'Lanterna', action: 'material', ordinaryUse: 'Iluminar o que está escuro.', strangeUse: 'Apaga o holograma e devolve a matéria dos modelos.', position: [4.8, -4.7], size: 1.55 }
];
const profiles = {
  book: ['Livro', 'Organizar um texto.', 'Abre este material; as páginas viraram uma passagem.'],
  camera: ['Câmera', 'Registrar uma imagem.', 'Abre uma presença do acervo; não tira fotografia.'],
  mirror: ['Espelho', 'Refletir um rosto.', 'Abre uma pessoa ou um texto no lugar de quem olha.'],
  telephone: ['Telefone', 'Chamar alguém.', 'Chama esta ficha, mesmo sem haver ninguém do outro lado.'],
  suitcase: ['Mala', 'Carregar pertences.', 'Transporta uma trajetória em vez de bagagem.'],
  wrench: ['Chave inglesa', 'Apertar uma porca.', 'Desmonta uma ficha e mostra o trabalho que ela guarda.'],
  scissors: ['Tesoura', 'Cortar material.', 'Recorta esta trajetória do conjunto e abre sua biografia.'],
  funnel: ['Funil', 'Transferir um líquido.', 'Concentra um pedaço da pesquisa numa ficha.'],
  magnifier: ['Lupa', 'Aumentar o que é pequeno.', 'Aproxima esta pesquisa, não o tamanho das letras.'],
  hammer: ['Martelo', 'Fixar ou quebrar.', 'Abre uma prática que prefere deslocar as coisas.'],
  controller: ['Controle', 'Comandar um jogo.', 'Abre uma ficha sobre quem também inventa as regras.'],
  gramophone: ['Fonógrafo', 'Reproduzir um som.', 'Guarda uma trajetória sem imitar a voz de ninguém.'],
  umbrella: ['Guarda-chuva', 'Impedir que a água passe.', 'Mantém esta história aberta, inclusive onde há lacunas.'],
  key: ['Chave', 'Destrancar uma porta.', 'Abre esta presença; não completa o que ainda não sabemos.'],
  lamp: ['Lanterna', 'Clarear o caminho.', 'Faz o trabalho desta ficha aparecer.'],
  cassette: ['Fita cassete', 'Guardar som em fita.', 'Abre um registro escrito que também insiste em repetir.']
};
export function referenceThing(item) {
  const type = item.objectType || ({ pesquisa: 'book', dramaturgia: 'suitcase', universo: 'magnifier', dossie: 'cassette', cena: 'wrench', bibliografia: 'key', objetos: 'camera' }[item.group] || 'book');
  const [name, ordinaryUse, strangeUse] = profiles[type] || profiles.book;
  return { type, name, ordinaryUse, strangeUse, basis: 'Escolha curatorial para esta interface, não um pertence real nem uma característica pessoal.' };
}
export const CABINET_PAGE_SIZE = 12;
export function cabinetPage(items, visibleIds, selectedId, page = 0, overview = false) {
  const allowed = new Set(visibleIds), filtered = items.filter(item => allowed.has(item.id) && !item.modelId);
  const count = Math.max(1, Math.ceil(filtered.length / CABINET_PAGE_SIZE)), current = Math.max(0, Math.min(page, count - 1));
  const selected = filtered.find(item => item.id === selectedId);
  const shown = overview ? [] : filtered.slice(current * CABINET_PAGE_SIZE, (current + 1) * CABINET_PAGE_SIZE);
  if (selected && !shown.some(item => item.id === selected.id)) shown.push(selected);
  return { items: shown, page: current, count, total: filtered.length };
}
