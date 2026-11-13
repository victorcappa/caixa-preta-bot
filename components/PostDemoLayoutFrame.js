"use client";
import { useEffect, useRef } from "react";
import styles from "./PostDemo.module.css";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export default function PostDemoLayoutFrame({ id, label, rect, editable, epoch, onChange, onCommit, children }) {
  const frame = useRef(null), drag = useRef(null);
  useEffect(() => { drag.current = null; }, [editable, epoch]);
  function start(event, resize) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const bounds = frame.current.parentElement.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, bounds, rect: { ...rect }, resize };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function transform(source, dx, dy, resize) {
    return resize ? { ...source, width: clamp(source.width + dx, 8, 100 - source.x), height: clamp(source.height + dy, 8, 100 - source.y) } :
      { ...source, x: clamp(source.x + dx, 0, 100 - source.width), y: clamp(source.y + dy, 0, 100 - source.height) };
  }
  function move(event) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!event.buttons) { drag.current = null; onCommit(); return; }
    event.preventDefault(); event.stopPropagation();
    onChange(id, transform(current.rect, (event.clientX - current.x) * 100 / Math.max(1, current.bounds.width),
      (event.clientY - current.y) * 100 / Math.max(1, current.bounds.height), current.resize));
  }
  function end(event) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit();
  }
  function keyboard(event, resize) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 5 : 1;
    onChange(id, transform(rect, event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
      event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0, resize));
    onCommit();
  }
  const events = resize => ({ onPointerDown: event => start(event, resize), onPointerMove: move, onPointerUp: end,
    onPointerCancel: end, onLostPointerCapture: end, onKeyDown: event => keyboard(event, resize) });
  return <div ref={frame} className={styles.layoutFrame} data-post-demo-module={id} data-editable={editable}
    style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.width}%`, height: `${rect.height}%` }}>
    {children}
    {editable ? <>
      <button type="button" className={styles.moveHandle} aria-label={`Mover ${label}`} title={`Mover ${label} · arraste ou use as setas`} {...events(false)}>↔ {label.toUpperCase()}</button>
      <button type="button" className={styles.resizeHandle} aria-label={`Redimensionar ${label}`} title={`Redimensionar ${label} · arraste ou use as setas`} {...events(true)}>↘</button>
    </> : null}
  </div>;
}
