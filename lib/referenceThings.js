// New interface props inspired by Cena 3, pp. 13–16 of the local play draft.
// These are editorial objects, never claimed as someone's actual belongings.
const mirrorSource = { title: 'Miguel Losada — entrevista com Adolfo Bioy Casares, Revista Turia', url: 'https://www.ieturolenses.org/revista_turia/index.php/actualidad_turia/adolfo-bioy-casares-la-invencion-de-lo-fatastico-cotidiano', accessedAt: '2026-11-13' };
const morelMirror = { type: 'triptychMirror', name: 'Espelho de três faces', ordinaryUse: 'Devolver a imagem em três faces.', strangeUse: 'Abre Morel através de uma presença multiplicada.',
  playLink: 'Bioy Casares relaciona a invenção de Morel ao espelho de três corpos do quarto de vestir de sua mãe. A ponte com a peça passa pelo quarto de espelhos e pelas presenças duplicadas.',
  basis: 'Associação documentada na entrevista; a forma tridimensional é uma interpretação curatorial.', sources: [mirrorSource], relatedIds: ['CP-05', 'dramaturgia-continuacao'] };
const objectAssociations = {
  'CP-05': morelMirror,
  'marcus-garcia-labirinto': { type: 'wrench', playLink: 'A chave inglesa aproxima a pesquisa sobre trabalho técnico das ferramentas, pessoas e manutenção que sustentam as aparições da peça.' },
  'dramaturgia-texto': { type: 'suitcase', playLink: 'As malas abertas e os objetos de As coisas, nas páginas 13–16 do PDF, fazem de um conjunto de materiais uma presença que pode ser imaginada.' },
  'cena-data-scene-zero-morel-js': { type: 'cassette', playLink: 'A fita aproxima voz, repetição e registro no material de Morel usado na abertura. A presença sonora volta sem que o corpo precise voltar junto.' }
};
export const cabinetTools = [
  { id: 'fonografo', type: 'gramophone', label: 'Fonógrafo', action: 'people', ordinaryUse: 'Tocar um registro sonoro.', strangeUse: 'Faz uma pessoa voltar em forma de biografia.', position: [-5.6, 3.8], size: 1.65 },
  { id: 'guarda-chuva', type: 'umbrella', label: 'Guarda-chuva', action: 'gaps', ordinaryUse: 'Proteger da chuva.', strangeUse: 'Abriga o que ainda não sabemos.', position: [5.7, 4], size: 1.85 },
  { id: 'tesoura', type: 'scissors', label: 'Tesoura', action: 'affinity', ordinaryUse: 'Cortar alguma coisa.', strangeUse: 'Recorta o acervo pela afinidade da ficha aberta.', position: [3.7, 5.5], size: 1.5 },
  { id: 'martelo', type: 'hammer', label: 'Martelo', action: 'cross', ordinaryUse: 'Pregar, bater, fixar.', strangeUse: 'Junta dois materiais que estavam longe demais.', position: [-.5, 5.8], size: 1.55 },
  { id: 'espelho', ...morelMirror, label: morelMirror.name, action: 'double', position: [6.4, .2], size: 2.2 },
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
  const association = objectAssociations[item.id];
  const type = association?.type || item.objectType || ({ pesquisa: 'book', dramaturgia: 'suitcase', universo: 'magnifier', dossie: 'cassette', cena: 'wrench', bibliografia: 'key', objetos: 'camera' }[item.group] || 'book');
  const [name, ordinaryUse, strangeUse] = profiles[type] || profiles.book;
  return { type, name, ordinaryUse, strangeUse, basis: 'Escolha curatorial para esta interface, não um pertence real nem uma característica pessoal.', ...association, playLink: item.objectReason || association?.playLink || '' };
}
export function cabinetPage(items, visibleIds) {
  const allowed = new Set(visibleIds), filtered = items.filter(item => allowed.has(item.id) && !item.modelId);
  return { items: filtered, page: 0, count: 1, total: filtered.length };
}

// Inspection is distinct from using a tool: opening this record has no filter action.
export function cabinetToolReference(id) {
  const tool = cabinetTools.find(tool => tool.id === id); if (!tool) return null;
  return { id: `ferramenta-${tool.id}`, toolId: tool.id, title: tool.label, author: 'Gabinete de coisas', group: 'ferramentas', kind: 'Ferramenta da ilha',
    status: 'tool', statusLabel: 'Coisa em foco', description: tool.strangeUse,
    excerpt: `Uso habitual: ${tool.ordinaryUse}\nNesta ilha: ${tool.strangeUse}`,
    evidence: 'Tocar nesta coisa apenas aproxima e abre seu conteúdo. A operação acontece ao escolher Usar esta ferramenta.',
    sourcePath: 'lib/referenceThings.js', sourceUrl: tool.sources?.[0]?.url || null, relatedIds: tool.relatedIds || [], affinities: [], tags: ['As coisas', 'uso fora do uso'], sources: tool.sources || [],
    thing: { type: tool.type, name: tool.label, ordinaryUse: tool.ordinaryUse, strangeUse: tool.strangeUse, playLink: tool.playLink || '', basis: tool.basis || 'Objeto criado para esta interface, inspirado na Cena 3.' } };
}
