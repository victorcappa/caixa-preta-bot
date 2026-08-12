import fs from "node:fs";
import path from "node:path";

const PUBLICO_PATH = path.join(process.cwd(), "data", "publico.json");

function normalizeNameKey(name = "") {
  return `${name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readPublicoFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PUBLICO_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePublicoFile(groups) {
  fs.writeFileSync(PUBLICO_PATH, `${JSON.stringify(groups, null, 2)}\n`);
}

function namesFromGroup(groups, groupName) {
  const group = groups.find((item) => item?.name === groupName);
  return Array.isArray(group?.nomes) ? group.nomes : [];
}

function cleanParticipantName(name = "") {
  return `${name}`
    .replace(/[.,;:!?()[\]{}"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function canonicalKnownName(candidate, groups = readPublicoFile()) {
  const candidateKey = normalizeNameKey(candidate);

  for (const group of groups) {
    for (const name of namesFromGroup(groups, group?.name)) {
      if (normalizeNameKey(name) === candidateKey) {
        return name;
      }
    }
  }

  return cleanParticipantName(candidate);
}

export function inferSessionParticipantsFromMemory(content = "") {
  const text = `${content || ""}`;
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const patterns = [
    /\b(?:chamad[ao]s?|se chama|nome e|nome eh|participante se chama|espectador[ao] chamada?|uma espectadora chamada|um espectador chamado)\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2})/gu,
    /\b([A-Z][\p{L}'-]+(?:\s+[\p{L}'-]+){0,2})\s+(?:esta aqui|esta presente|esta no recinto|esta na sala|chegou|se ofereceu|topou|aceitou|participa|participou)\b/gu
  ];
  const groups = readPublicoFile();
  const knownNames = groups
    .flatMap((group) => namesFromGroup(groups, group?.name))
    .filter((name) => normalizeNameKey(name) && normalized.toLowerCase().includes(normalizeNameKey(name).replace(/\s+/g, " ")));

  const inferredNames = patterns
    .flatMap((pattern) => [...normalized.matchAll(pattern)].map((match) => cleanParticipantName(match[1])));

  return [...knownNames, ...inferredNames]
    .map((name) => canonicalKnownName(name, groups))
    .filter((name, index, names) => (
      name.length >= 2
      && !/^(Memory|Publico|Equipe|Caixa|Preta)$/i.test(name)
      && names.findIndex((other) => normalizeNameKey(other) === normalizeNameKey(name)) === index
    ));
}

export function presenceFromMemory(content = "") {
  const normalized = `${content || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\b(saiu|foi embora|nao esta|nao veio|ausente)\b/.test(normalized)) {
    return "false";
  }

  if (/\b(esta aqui|esta presente|esta no recinto|esta na sala|chegou|se ofereceu|topou|aceitou|presente|participa)\b/.test(normalized)) {
    return "true";
  }

  return "unknown";
}

export function addParticipantToSession(sessionParticipants = [], name, metadata = {}) {
  const cleanedName = cleanParticipantName(name);
  const key = normalizeNameKey(cleanedName);

  if (!key) {
    return sessionParticipants;
  }

  const existing = sessionParticipants.find((participant) => participant.key === key);
  if (existing) {
    return sessionParticipants.map((participant) => (
      participant.key === key
        ? {
          ...participant,
          present: metadata.present === "unknown" ? participant.present : metadata.present || participant.present,
          lastSeenAt: metadata.lastSeenAt || participant.lastSeenAt
        }
        : participant
    ));
  }

  return [
    ...sessionParticipants,
    {
      key,
      name: cleanedName,
      source: "session",
      present: metadata.present || "unknown",
      firstSeenAt: metadata.firstSeenAt || new Date().toISOString(),
      lastSeenAt: metadata.lastSeenAt || new Date().toISOString()
    }
  ];
}

export function saveAudienceParticipants(names = []) {
  const groups = readPublicoFile();
  const existingKeys = new Set(
    groups.flatMap((group) => namesFromGroup(groups, group?.name).map(normalizeNameKey))
  );
  let publicoGroup = groups.find((item) => item?.name === "publico");

  if (!publicoGroup) {
    publicoGroup = { name: "publico", nomes: [] };
    groups.push(publicoGroup);
  }

  if (!Array.isArray(publicoGroup.nomes)) {
    publicoGroup.nomes = [];
  }

  const added = [];

  for (const name of names) {
    const cleanedName = cleanParticipantName(name);
    const key = normalizeNameKey(cleanedName);

    if (!key || existingKeys.has(key)) {
      continue;
    }

    publicoGroup.nomes.push(cleanedName);
    existingKeys.add(key);
    added.push(cleanedName);
  }

  if (added.length) {
    writePublicoFile(groups);
  }

  return added;
}

export function getParticipantPool({ sessionParticipants = [], history = {} } = {}) {
  const groups = readPublicoFile();
  const teamNames = namesFromGroup(groups, "equipe");
  const audienceNames = namesFromGroup(groups, "publico");
  const hasAudience = audienceNames.length > 0 || sessionParticipants.length > 0;
  const records = [];
  const seen = new Set();

  function push(name, source, present = "unknown") {
    const cleanedName = cleanParticipantName(name);
    const key = normalizeNameKey(cleanedName);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    records.push({
      key,
      name: cleanedName,
      source,
      present,
      selectedCount: history[key]?.selectedCount || 0,
      lastSelectedAt: history[key]?.lastSelectedAt || null
    });
  }

  for (const name of teamNames) {
    push(name, "team");
  }

  if (hasAudience) {
    for (const name of audienceNames) {
      push(name, "audience");
    }
  }

  for (const participant of sessionParticipants) {
    push(participant.name, participant.source || "session", participant.present || "unknown");
  }

  return {
    participants: records,
    counts: {
      team: records.filter((participant) => participant.source === "team").length,
      audience: records.filter((participant) => participant.source === "audience").length,
      session: records.filter((participant) => participant.source === "session").length,
      available: records.length
    },
    audienceAvailable: hasAudience
  };
}

export function markParticipantsSelected(history = {}, participants = [], selectedAt = new Date().toISOString()) {
  const nextHistory = { ...history };

  for (const participant of participants) {
    const key = participant.key || normalizeNameKey(participant.name);
    if (!key) {
      continue;
    }

    nextHistory[key] = {
      name: participant.name,
      source: participant.source,
      selectedCount: (nextHistory[key]?.selectedCount || 0) + 1,
      lastSelectedAt: selectedAt
    };
  }

  return nextHistory;
}
