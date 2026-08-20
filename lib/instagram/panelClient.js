export async function setSharedInstagramPanelVisible(visible) {
  const response = await fetch("/api/instagram/panel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visible: Boolean(visible) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || "INSTAGRAM PANEL UPDATE FAILED");
  return data.visible;
}
