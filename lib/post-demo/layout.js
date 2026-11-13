export const POST_DEMO_LAYOUT_MODULES = Object.freeze([
  Object.freeze({ id: "card", label: "carta" }),
  Object.freeze({ id: "text", label: "texto" }),
  Object.freeze({ id: "cloud", label: "modelo 3D" })
]);

export const DEFAULT_POST_DEMO_LAYOUT = Object.freeze({
  card: Object.freeze({ x: 0, y: 0, width: 28, height: 100 }),
  text: Object.freeze({ x: 30, y: 0, width: 40, height: 100 }),
  cloud: Object.freeze({ x: 72, y: 0, width: 28, height: 86 })
});

const RECTANGLE_FIELDS = ["x", "y", "width", "height"];
const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const emptyLayout = () => ({ card: null, text: null, cloud: null });
const finiteFields = value => isObject(value) ? Object.fromEntries(RECTANGLE_FIELDS.filter(field => Number.isFinite(value[field])).map(field => [field, value[field]])) : {};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function boundedRectangle(value) {
  // Preserve the requested dimensions, then constrain its position inside the canvas.
  // The drag/resize UI applies operation-specific bounds before saving a rectangle.
  const width = clamp(value.width, 8, 100), height = clamp(value.height, 8, 100);
  return { x: clamp(value.x, 0, 100 - width), y: clamp(value.y, 0, 100 - height), width, height };
}

export function normalizePostDemoLayout(value) {
  const result = emptyLayout();
  if (!isObject(value)) return result;
  for (const { id } of POST_DEMO_LAYOUT_MODULES) {
    const fields = finiteFields(value[id]);
    if (Object.keys(fields).length) result[id] = boundedRectangle({ ...DEFAULT_POST_DEMO_LAYOUT[id], ...fields });
  }
  return result;
}

export function resolvePostDemoLayout(value, { hasCloud = true } = {}) {
  const overrides = normalizePostDemoLayout(value);
  return Object.fromEntries(POST_DEMO_LAYOUT_MODULES.map(({ id }) => [id,
    overrides[id] || { ...DEFAULT_POST_DEMO_LAYOUT[id], ...(id === "text" && !hasCloud ? { x: 32, width: 68 } : {}) }
  ]));
}

export function patchPostDemoLayout(current, patch) {
  if (patch === null) return emptyLayout();
  const result = normalizePostDemoLayout(current);
  if (!isObject(patch)) return result;
  for (const { id } of POST_DEMO_LAYOUT_MODULES) {
    if (!Object.hasOwn(patch, id)) continue;
    if (patch[id] === null) { result[id] = null; continue; }
    const fields = finiteFields(patch[id]);
    if (Object.keys(fields).length) result[id] = boundedRectangle({ ...(result[id] || DEFAULT_POST_DEMO_LAYOUT[id]), ...fields });
  }
  return result;
}
