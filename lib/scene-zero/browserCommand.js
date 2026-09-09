function cleanText(value = "", maxLength = 1000) {
  return `${value || ""}`
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

export function extractExplicitInstagramHandle(command = "") {
  const match = cleanText(command).match(/(?:^|[\s(])@([a-zA-Z0-9._]{1,30})(?=$|[\s),;:!?])/u);
  return match ? `@${match[1].toLowerCase()}` : "";
}

export function preserveExplicitNewsIntent(parsedPlan = {}, originalCommand = "") {
  const explicitNews = /\b(?:not[ií]cias?|notici[aá]rio|jornal|reportagens?|mat[eé]rias?)\b/iu.test(originalCommand);
  const preferNews = Boolean(parsedPlan.preferNews || explicitNews);
  return {
    ...parsedPlan,
    preferNews,
    resultCount: parsedPlan.openResult && preferNews
      ? Math.max(2, Number(parsedPlan.resultCount) || 0)
      : parsedPlan.resultCount
  };
}

export function fallbackSceneZeroBrowserPlan(command = "") {
  const normalized = cleanText(command);
  const explicitHandle = extractExplicitInstagramHandle(normalized);
  const mentionsInstagram = /\binstagram\b/iu.test(normalized) || Boolean(explicitHandle && /\bperfil\b/iu.test(normalized));
  const mentionsGoogle = /\b(?:google|internet|not[ií]cia|pesquis|busc)\w*/iu.test(normalized);
  const newGoogleWindow = /\b(?:nova|outra)\s+(?:aba|janela)\s+(?:do\s+)?google\b|\bgoogle\b[^.!?]{0,40}\b(?:nova|outra)\s+(?:aba|janela)\b/iu.test(normalized);
  const personMatch = normalized.match(/\b(?:perfil|instagram)\s+(?:do|da|de)\s+(.+?)(?=\s+(?:ao\s+mesmo\s+tempo|e\s+(?:no|na|abra|busque|pesquise)|depois)\b|[.;]|$)/iu);
  const instagramPerson = explicitHandle || cleanText(personMatch?.[1] || "", 100);

  return {
    command: normalized,
    google: {
      enabled: mentionsGoogle && (!mentionsInstagram || !instagramPerson || /\bgoogle\b/iu.test(normalized)),
      guidance: mentionsGoogle ? normalized : "",
      newWindow: newGoogleWindow
    },
    instagram: {
      enabled: mentionsInstagram,
      person: instagramPerson
    }
  };
}

export function normalizeSceneZeroBrowserPlan(rawPlan = {}, command = "") {
  const fallback = fallbackSceneZeroBrowserPlan(command);
  const explicitHandle = extractExplicitInstagramHandle(command);
  const google = rawPlan?.google && typeof rawPlan.google === "object" ? rawPlan.google : {};
  const instagram = rawPlan?.instagram && typeof rawPlan.instagram === "object" ? rawPlan.instagram : {};
  const normalized = {
    command: cleanText(command || rawPlan.command),
    google: {
      enabled: google.enabled === undefined ? fallback.google.enabled : Boolean(google.enabled),
      guidance: cleanText(google.guidance || (google.enabled ? command : fallback.google.guidance), 700),
      newWindow: google.newWindow === undefined ? fallback.google.newWindow : Boolean(google.newWindow)
    },
    instagram: {
      enabled: instagram.enabled === undefined ? fallback.instagram.enabled : Boolean(instagram.enabled),
      person: cleanText(instagram.person || fallback.instagram.person, 100)
    }
  };

  if (!normalized.google.guidance) normalized.google.enabled = false;
  if (!normalized.instagram.person) normalized.instagram.enabled = false;
  if (explicitHandle) {
    normalized.instagram = { enabled: true, person: explicitHandle };
    if (!fallback.google.enabled) {
      normalized.google = { enabled: false, guidance: "", newWindow: false };
    }
  }
  return normalized;
}
