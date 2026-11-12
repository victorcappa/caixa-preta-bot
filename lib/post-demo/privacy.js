import { getRegisteredAudienceNames } from "../participants.js";
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function pattern(extra = []) {
  const names = [...getRegisteredAudienceNames(), ...extra].flatMap(name => typeof name === "string" ? [name.trim(), ...name.trim().split(/\s+/).filter(word => word.length >= 3)] : [])
    .filter(name => /\p{L}/u.test(name));
  return names.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...new Set(names)].sort((a,b) => b.length - a.length).map(escape).join("|")})(?![\\p{L}\\p{N}])`, "giu") : null;
}
export function redactAudienceNames(text = "", extra = []) { const match = pattern(extra); return match ? String(text).replace(match, "…") : String(text); }
export function hasAudienceName(text = "", extra = []) { return pattern(extra)?.test(String(text)) || false; }
