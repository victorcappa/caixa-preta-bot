// Serializable settings only; safe to share with the private controller UI.
export const REFERENCE_THEMES = {
  dramaturgia: 'Dramaturgia', morel: 'Morel / imagem e presença', automatos: 'Autômatos',
  politica: 'Política e democracia', bets: 'Bets / fé e sorte', bigtech: 'Big Techs e tecnocracia',
  memes: 'Memes', morte: 'Morte e desintegração', filosofia: 'Referências filosóficas',
  percepcao: 'Alucinação e percepção', pessoas: 'Pessoas / entrevistas / documentos'
};
export function referenceSettings(input = {}, current = {}) {
  const result = { enabled: true, intensity: 65, freeAssociation: 50, maxChunks: 4, maxChars: 6500,
    themes: Object.fromEntries(Object.keys(REFERENCE_THEMES).map(k => [k, true])), documents: {}, ...current };
  for (const key of ['enabled']) if (typeof input[key] === 'boolean') result[key] = input[key];
  for (const [key, min, max] of [['intensity',0,100],['freeAssociation',0,100],['maxChunks',1,8],['maxChars',1500,12000]]) {
    if (Number.isFinite(input[key])) result[key] = Math.round(Math.max(min, Math.min(max, input[key])));
  }
  result.themes = { ...result.themes };
  for (const key of Object.keys(REFERENCE_THEMES)) if (typeof input.themes?.[key] === 'boolean') result.themes[key] = input.themes[key];
  result.documents = { ...result.documents };
  for (const [key, value] of Object.entries(input.documents || {}).slice(0,60)) if (typeof value === 'boolean' && key.length <= 180) result.documents[key] = value;
  return result;
}
export function normalizeContemporaryContext(contexts = []) {
  return contexts.slice(0,20).filter(c => typeof c.text === 'string' && /^https?:\/\//.test(c.url || '') && /^\d{4}-\d{2}-\d{2}$/.test(c.date || ''))
    .map(c => ({text:c.text.slice(0,1400), url:c.url.slice(0,500), date:c.date, enabled:c.enabled!==false,
      checkedAt: /^\d{4}-\d{2}-\d{2}$/.test(c.checkedAt || '') ? c.checkedAt : null,
      verification: c.verification==='verified'&&!/^\d{4}-\d{2}-\d{2}$/.test(c.checkedAt || '') ? 'unverified' : ['verified','uncertain','unverified'].includes(c.verification) ? c.verification : 'unverified'}));
}
