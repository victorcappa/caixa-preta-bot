"use client";

import { useMemo, useState } from "react";
import styles from "./PreparedSceneController.module.css";

function buttonLabel(cue) {
  return cue.shortcut ? `${cue.shortcut} · ${cue.label}` : cue.label;
}

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR");
}

export default function PreparedSceneController({
  eyebrow = "CONTROLLER PRIVADO",
  title,
  description,
  status = "ARQUITETURA PREPARADA",
  sections = [],
  meters = [],
  notes = []
}) {
  const [log, setLog] = useState([]);
  const [values, setValues] = useState(() => {
    const initial = {};
    meters.forEach((meter) => {
      initial[meter.id] = meter.defaultValue ?? meter.min ?? 0;
    });
    return initial;
  });

  const sectionCount = useMemo(
    () => sections.reduce((count, section) => count + (section.cues?.length || 0), 0),
    [sections]
  );

  function registerCue(cue, sectionTitle) {
    setLog((current) => [
      {
        id: crypto.randomUUID(),
        line: `${nowLabel()} > PREPARADO: ${sectionTitle} / ${cue.label}`
      },
      ...current
    ].slice(0, 8));
  }

  return (
    <main className={styles.screen}>
      <section className={styles.stage}>
        <header className={styles.header}>
          <div>
            <span>{eyebrow}</span>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          <strong>{status}</strong>
        </header>

        <section className={styles.statusGrid} aria-label="Estado do controller">
          <article>
            <span>ROTA</span>
            <strong>PRONTA</strong>
          </article>
          <article>
            <span>CUES</span>
            <strong>{sectionCount}</strong>
          </article>
          <article>
            <span>BACKEND</span>
            <strong>PENDENTE</strong>
          </article>
        </section>

        <div className={styles.grid}>
          {sections.map((section) => (
            <section className={styles.panel} key={section.title}>
              <div className={styles.panelHeader}>
                <span>{section.kind}</span>
                <h2>{section.title}</h2>
              </div>
              <div className={styles.cueGrid}>
                {section.cues.map((cue) => (
                  <button
                    className={cue.variant === "danger" ? styles.dangerCue : styles.cue}
                    key={cue.label}
                    onClick={() => registerCue(cue, section.title)}
                    type="button"
                  >
                    {buttonLabel(cue)}
                  </button>
                ))}
              </div>
            </section>
          ))}

          {meters.length ? (
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <span>PARÂMETROS</span>
                <h2>Controles Preparados</h2>
              </div>
              <div className={styles.meters}>
                {meters.map((meter) => (
                  <label className={styles.meter} key={meter.id}>
                    <span>{meter.label}</span>
                    <output>{values[meter.id]}</output>
                    <input
                      max={meter.max}
                      min={meter.min}
                      onChange={(event) => setValues((current) => ({ ...current, [meter.id]: event.target.value }))}
                      step={meter.step}
                      type="range"
                      value={values[meter.id]}
                    />
                  </label>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>

      <aside className={styles.side}>
        <section className={styles.sidePanel}>
          <h2>Estado</h2>
          <p>
            controller: preparado
            {"\n"}serviços: a conectar
            {"\n"}atalhos: reservados por cena
          </p>
        </section>

        {notes.length ? (
          <section className={styles.sidePanel}>
            <h2>Escopo</h2>
            <ul>
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.sidePanel}>
          <h2>Log Local</h2>
          {log.length ? (
            log.map((entry) => <p key={entry.id}>{entry.line}</p>)
          ) : (
            <p>SYSTEM READY</p>
          )}
        </section>
      </aside>
    </main>
  );
}
