export function encodeSse(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
