"use client";
import { normalizePointCloudSettings, POINT_CLOUD_FIELDS, POINT_CLOUD_PRESETS } from "@/lib/post-demo/pointCloudSettings";

const number = (value, digits = 2) => value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
function displayValue(field, value) {
  if (field.percent) return `${number(value * 100)}%`;
  if (field.cyclePercent) return `${number(value * 100 / (Math.PI * 2), 1)}% do ciclo`;
  return `${number(value)}${field.unit === "s" ? " " : ""}${field.unit || ""}`;
}

export default function PostDemoPointCloudControls({ value, onChange, onFlush, onReplay, disabled = false, replayDisabled = false }) {
  const settings = normalizePointCloudSettings(value), unavailable = disabled || !value;
  const selected = POINT_CLOUD_PRESETS.find(preset => preset.id === settings.preset);
  const flush = () => { void onFlush?.(); };
  function change(patch) { onChange?.(patch); flush(); }

  return <section aria-label="Controles da nuvem 3D">
    <h3>NUVEM 3D</h3>
    <label htmlFor="post-demo-cloud-preset">Preset de movimento da nuvem</label>
    <select id="post-demo-cloud-preset" aria-label="Preset de movimento da nuvem" value={settings.preset} disabled={unavailable}
      onChange={event => change({ preset: event.target.value })}>
      {POINT_CLOUD_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
    </select>
    <p aria-live="polite">{selected.description}</p>
    <label htmlFor="post-demo-cloud-motion-enabled" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input id="post-demo-cloud-motion-enabled" type="checkbox" aria-label="Movimento automático da nuvem" checked={settings.motionEnabled} disabled={unavailable}
        onChange={event => change({ motionEnabled: event.target.checked })} />
      Movimento automático da nuvem
    </label>
    <label htmlFor="post-demo-cloud-shader-enabled" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input id="post-demo-cloud-shader-enabled" type="checkbox" aria-label="Respiração do shader" checked={settings.shaderEnabled} disabled={unavailable}
        onChange={event => change({ shaderEnabled: event.target.checked })} />
      Respiração do shader
    </label>
    {[["motion", "Câmera e passeio"], ["shader", "Shader e pontos"]].map(([group, label]) => <details key={group} open>
      <summary style={{ cursor: "pointer", marginTop: 18 }}>{label}</summary>
      {group === "motion" ? <p>Distâncias menores aproximam a câmera; tempos maiores deixam o movimento mais lento.</p> : null}
      {POINT_CLOUD_FIELDS.filter(field => field.group === group).map(field => <div key={field.id}>
        <label htmlFor={`post-demo-cloud-${field.id}`}>{field.label} <output htmlFor={`post-demo-cloud-${field.id}`}>{displayValue(field, settings[field.id])}</output></label>
        <input id={`post-demo-cloud-${field.id}`} type="range" aria-label={`${field.label} da nuvem`} aria-valuetext={displayValue(field, settings[field.id])}
          min={field.min} max={field.max} step={field.step} value={settings[field.id]} disabled={unavailable}
          onChange={event => onChange?.({ [field.id]: Number(event.target.value) })}
          onPointerUp={flush} onKeyUp={flush} onBlur={flush} />
      </div>)}
    </details>)}
    <p>Ajustes salvos automaticamente para a próxima sessão.</p>
    <button type="button" disabled={unavailable || replayDisabled} onClick={() => { void onReplay?.(); }}>Reiniciar passeio</button>
    <p>Reinicia apenas o passeio da nuvem. Mantém as cartas, a foto e os ajustes.</p>
  </section>;
}
