// Editorial geography. A shared theme is a proposed reading, not authorship or
// evidence that one artist influenced another. No repository/runtime access here.
export const islandTopics = [
  { id: 'memoria', label: 'Memória', color: '#78f3db', center: [0, -2.3], words: ['memoria', 'arquivo', 'morel', 'registro', 'repeticao', 'vestigio', 'fonografo'] },
  { id: 'corpo', label: 'Corpo', color: '#d4a9ff', center: [4.2, 2.5], words: ['corpo', 'presenca', 'carne', 'performance', 'voz', 'gesto', 'autobiog', 'atuacao'] },
  { id: 'falha', label: 'Falha', color: '#ffa570', center: [-4, 2.6], words: ['falha', 'queda', 'acidente', 'erro', 'desastre', 'aviao', 'voo', 'catastrofe'] },
  { id: 'duplo', label: 'Duplo', color: '#8bbdff', center: [4.5, -2.8], words: ['imagem', 'duplo', 'copia', 'espelho', 'virtual', 'holog', 'avatar', 'reproducao'] },
  { id: 'trabalho', label: 'Trabalho', color: '#e8d49b', center: [1.8, -.2], words: ['tecnica', 'trabalho', 'luz', 'producao', 'cenog', 'manutencao', 'iluminacao', 'colaboracao'] },
  { id: 'jogo', label: 'Jogo', color: '#e4fa87', center: [-1.8, -5.1], words: ['jogo', 'game', 'algoritmo', 'comando', 'acaso', 'taro', 'aposta', 'interacao'] },
  { id: 'travessia', label: 'Travessia', color: '#8ccba8', center: [-4.4, -2.5], words: ['ilha', 'floresta', 'terra', 'territorio', 'sonho', 'limiar', 'viagem', 'atravess', 'paisagem'] }
];
export const islandTrails = [
  { id: 'queda', label: 'Depois da queda', description: 'Dos escombros ao vestígio: o que uma máquina consegue guardar?', steps: [
    { object: 'aviao-quebrado', topic: 'falha', text: 'Comece pelo que quebrou. Um resto pode ser a entrada para uma história.' },
    { object: 'piloto', topic: 'corpo', text: 'Um corpo atravessa o acidente. Sua presença e seu registro já não coincidem.' },
    { object: 'caixa-preta', topic: 'memoria', text: 'O arquivo preserva sinais. A vida que falta precisa ser imaginada.' }
  ] },
  { id: 'maquina', label: 'Mãos da máquina', description: 'Objetos, trabalho e comando: quem sustenta a aparição?', steps: [
    { object: 'cadeira', topic: 'trabalho', text: 'Uma cadeira também guarda as mãos que a fizeram aparecer.' },
    { object: 'caixa-preta', topic: 'memoria', text: 'Cada registro depende de trabalho, reparação e escolhas.' },
    { object: 'ra', topic: 'jogo', text: 'Obedecer, jogar, falhar: uma regra só existe enquanto alguém a sustenta.' }
  ] },
  { id: 'ilha', label: 'Habitantes e duplos', description: 'Uma travessia pela presença, pelos animais e pela imagem que sobrevive.', steps: [
    { object: 'quati', topic: 'travessia', text: 'A ilha tem habitantes que não precisam explicar sua presença.' },
    { object: 'borboleta', topic: 'duplo', text: 'Uma imagem atravessa o espaço. É presença, rastro ou repetição?' },
    { object: 'piloto', topic: 'corpo', text: 'Voltamos ao corpo. A travessia mudou a maneira de olhar para ele.' }
  ] }
];
export const foldIslandText = value => `${value || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function referenceAffinities(item) {
  const text = foldIslandText([item.title, item.description, item.excerpt, ...(item.tags || []), ...(item.motifs || []), ...(item.works || []).map(work => work.summary)].join(' '));
  const scored = islandTopics.map(topic => ({ id: topic.id, score: topic.words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0) }));
  return scored.filter(topic => topic.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(topic => topic.id);
}
export function referenceRelations(item, items) {
  const direct = new Set(item.relatedIds || []), affinities = referenceAffinities(item);
  return items.filter(other => other.id !== item.id).map(other => {
    const documented = direct.has(other.id) || other.relatedIds?.includes(item.id);
    const shared = referenceAffinities(other).filter(topic => affinities.includes(topic));
    return { id: other.id, title: other.title, type: documented ? 'documented' : 'curatorial', shared,
      score: (documented ? 100 : 0) + shared.length, reason: documented ? 'Ligação registrada no acervo' : `Leitura curatorial: ${shared.map(id => islandTopics.find(topic => topic.id === id).label.toLowerCase()).join(', ')}` };
  }).filter(relation => relation.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'pt-BR')).slice(0, 6);
}
export function islandReferencePosition(item, index) {
  const affinity = referenceAffinities(item)[0] || 'memoria';
  const center = islandTopics.find(topic => topic.id === affinity).center;
  const seed = [...item.id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const angle = (seed % 6283) / 1000, radius = .45 + (seed % 180) / 100;
  return [center[0] + Math.cos(angle) * radius, .65 + (index % 4) * .14, center[1] + Math.sin(angle) * radius];
}
export function islandHeight(x, z) {
  const r = Math.sqrt((x / 9) ** 2 + (z / 7.3) ** 2);
  const ridge = Math.exp(-((x + 1.2) ** 2 / 14 + (z + 3.8) ** 2 / 5)) * 2.15;
  const hill = Math.exp(-((x - 4.5) ** 2 / 5 + (z + 1.8) ** 2 / 9)) * .8;
  return .1 + Math.max(0, 1 - r) * .8 + ridge + hill + Math.sin(x * 1.2 + z * .7) * .14 + Math.cos(z * 1.4 - x * .4) * .1;
}

export function referencePeoplePosition(index, count) {
  const columns = Math.ceil(Math.sqrt(Math.max(1, count) * 1.4)), rows = Math.ceil(count / columns);
  const row = Math.floor(index / columns), across = (index % columns - (columns - 1) / 2) * 1.9, depth = (row - (rows - 1) / 2) * 2.2;
  const bearing = Math.atan2(14.8, 17.3);
  const x = across * Math.cos(bearing) + depth * Math.sin(bearing), z = -across * Math.sin(bearing) + depth * Math.cos(bearing);
  return [x, Math.max(1.65 + (rows - 1 - row) * .26, islandHeight(x, z) + .35) + Math.sin(index * .7) * .04, z];
}
