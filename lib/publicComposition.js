// Percentages are relative to the owning public canvas, never the private controls.
export const PUBLIC_MODULES = {
  'main-status': { label: 'BIOS e carregamento', surface: 'main', x: 0, y: 0, width: 100, height: 100 },
  'main-scene': { label: 'Cena 0 / malas / contagens', surface: 'main', x: 0, y: 0, width: 100, height: 100 },
  'main-performance': { label: 'Elementos visuais e jogos', surface: 'main', x: 0, y: 0, width: 100, height: 100 },
  'main-speech': { label: 'Fala do bot', surface: 'main', x: 0, y: 0, width: 100, height: 100 },
  'main-context': { label: 'Instagram / conteúdo contextual', surface: 'main', x: 65, y: 0, width: 35, height: 100 },
  'operator-rail': { label: 'Operator público inteiro', surface: 'screen', x: 65, y: 0, width: 35, height: 100 },
  'operator-history': { label: 'Conversa pública', surface: 'operator', x: 3, y: 12, width: 94, height: 38 },
  'operator-personality': { label: 'Personalidade pública', surface: 'operator', x: 3, y: 51, width: 94, height: 30 },
  'operator-input': { label: 'Texto do operador', surface: 'operator', x: 3, y: 82, width: 94, height: 17 },
  'tarot-header': { label: 'Cabeçalho do tarot', surface: 'tarot', x: 1, y: 1, width: 98, height: 7 },
  'tarot-speech': { label: 'Nome da carta e interpretação', surface: 'tarot', x: 1, y: 9, width: 98, height: 36 },
  'tarot-vision': { label: 'Carta / câmera', surface: 'tarot', x: 1, y: 47, width: 68, height: 52 },
  'tarot-elements': { label: 'Elementos da carta', surface: 'tarot', x: 70, y: 47, width: 29, height: 52 }
};

export function normalizePublicComposition(input = {}) {
  const modules = {};
  for (const [id, defaults] of Object.entries(PUBLIC_MODULES)) {
    const value = input?.modules?.[id];
    if (!value || typeof value !== 'object') continue;
    const number = (key, min, max) => Number.isFinite(value[key]) ? Math.max(min, Math.min(max, value[key])) : defaults[key];
    const x = number('x', 0, 90), y = number('y', 0, 90);
    modules[id] = { x, y, width: Math.min(100 - x, number('width', 10, 100)), height: Math.min(100 - y, number('height', 10, 100)) };
  }
  return { textColor: /^#[0-9a-f]{6}$/i.test(input?.textColor || '') ? input.textColor : '#00ff66', modules };
}

export function patchPublicComposition(current, patch = {}) {
  const base = normalizePublicComposition(current);
  return normalizePublicComposition({ ...base, ...patch, modules: { ...base.modules, ...patch?.modules } });
}

export function publicModuleStyle(rect) {
  return rect ? { position: 'absolute', inset: 'auto', left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.width}%`, height: `${rect.height}%`, margin: 0, minWidth: 0, minHeight: 0, maxWidth: 'none', maxHeight: 'none', gridArea: 'auto', contain: 'layout paint' } : {};
}
