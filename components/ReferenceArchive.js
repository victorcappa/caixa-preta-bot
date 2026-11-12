"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import styles from "./ReferenceArchive.module.css";

const ArchiveScene = dynamic(() => import("./ReferenceArchiveScene"), { ssr: false });
const fold = value => `${value || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const code = (item, index) => /^(CP-|E\d)/.test(item.id) ? item.id : String(index + 1).padStart(3, "0");

export default function ReferenceArchive({ library }) {
  const { items, groups } = library;
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [selectedId, setSelectedId] = useState("marcus-garcia-labirinto");
  const [mode, setMode] = useState("3d");
  const [paused, setPaused] = useState(false);
  const filtered = useMemo(() => items.filter(item => (group === "all" || item.group === group) &&
    fold([item.title, item.author, item.description, ...(item.tags || [])].join(" ")).includes(fold(query))), [items, query, group]);
  const selected = filtered.find(item => item.id === selectedId) || filtered[0];
  const selectedIndex = selected ? filtered.indexOf(selected) : -1;
  const selectRelative = delta => {
    if (filtered.length) setSelectedId(filtered[(selectedIndex + delta + filtered.length) % filtered.length].id);
  };

  return <main className={styles.archive}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}><span /> CAIXA PRETA / MEMÓRIA EXPOSTA</p>
        <h1>O que alimenta<br /> a caixa<span>.</span></h1>
        <p className={styles.introduction}>Textos, práticas e pessoas em órbita. Abra um fragmento e encontre o que existe por trás da voz.</p>
      </div>
      <div className={styles.headerNote}><span>ARQUIVO VIVO / 001</span><p>O acervo fica visível aqui.<br />Em cena, ele vira inconsciente.</p><strong>{items.length}<small>REGISTROS RASTREÁVEIS</small></strong></div>
    </header>

    <div className={styles.toolbar}>
      <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label="Buscar referências" placeholder="Buscar uma ideia, pessoa ou material" value={query} onChange={event => setQuery(event.target.value)} />{query && <button onClick={() => setQuery("")} aria-label="Limpar busca">×</button>}</label>
      <div className={styles.modeSwitch} aria-label="Visualização"><button aria-pressed={mode === "3d"} onClick={() => setMode("3d")}>Arquivo 3D</button><button aria-pressed={mode === "list"} onClick={() => setMode("list")}>Lista</button></div>
    </div>
    <div className={styles.filters} aria-label="Filtrar acervo">
      <button data-reference-group="all" aria-pressed={group === "all"} onClick={() => setGroup("all")}>Tudo <span>{items.length}</span></button>
      {groups.map(category => <button key={category.id} data-reference-group={category.id} aria-pressed={group === category.id} onClick={() => setGroup(category.id)}>{category.label} <span>{category.count ?? items.filter(item => item.group === category.id).length}</span></button>)}
    </div>

    {filtered.length ? <div className={`${styles.exhibition} ${mode === "list" ? styles.listMode : ""}`}>
      <section className={styles.viewport} aria-label="Explorar acervo">
        <div className={styles.viewportHeader}><span>FIG. 01 / {mode === "3d" ? "CAMPO DE MEMÓRIA" : "ÍNDICE DO ACERVO"}</span><span>{String(filtered.length).padStart(3, "0")} FRAGMENTOS</span></div>
        {mode === "3d" ? <>
          <ArchiveScene items={filtered} selectedId={selected.id} onSelect={setSelectedId} paused={paused} />
          <div className={styles.sceneLegend}><span><i /> MATERIAL INCORPORADO</span><span><i /> REFERÊNCIA CITADA</span></div>
          <div className={styles.sceneControls}><span>Arraste para girar · clique para abrir</span><button aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "Retomar movimento" : "Pausar movimento"}</button></div>
        </> : <div className={styles.indexList}>
          {filtered.map((item, index) => <button key={item.id} data-reference-id={item.id} aria-pressed={selected.id === item.id} onClick={() => setSelectedId(item.id)}><span>{code(item, index)}</span><div><strong>{item.title}</strong><small>{item.author || item.kind} {item.year ? ` / ${item.year}` : ""}</small></div><em>{item.statusLabel}</em><b aria-hidden="true">↗</b></button>)}
        </div>}
      </section>

      <article className={styles.detail} data-reference-detail={selected.id} aria-label="Material selecionado" aria-live="polite">
        <div className={styles.detailMeta}><span>{groups.find(category => category.id === selected.group)?.label || selected.kind}</span><span>{String(selectedIndex + 1).padStart(3, "0")} / {String(filtered.length).padStart(3, "0")}</span></div>
        <p className={styles.status} data-status={selected.status}><i />{selected.statusLabel}</p>
        <h2>{selected.title}</h2>
        {selected.subtitle && <p className={styles.byline}>{selected.subtitle}</p>}
        {selected.author && <p className={styles.byline}>{selected.author}{selected.year ? ` · ${selected.year}` : ""}</p>}
        <p className={styles.description}>{selected.description}</p>
        {selected.coverUrl && <figure className={styles.cover}><img src={selected.coverUrl} alt="Capa do PDF original de Labirinto de Labirintos" width="110" height="155" /><figcaption>Capa do documento<br />original incorporado</figcaption></figure>}
        <div className={styles.evidence}><span>COMO ISSO ENTRA NA MEMÓRIA</span><p>{selected.evidence || selected.statusLabel}</p><div>{selected.pageCount > 0 && <b>{selected.pageCount} páginas</b>}{selected.chunkCount > 0 && <b>{selected.chunkCount} fragmentos locais</b>}</div></div>
        {selected.excerpt && <div className={styles.excerpt}><span>JANELA PARA O MATERIAL</span><p>{selected.excerpt}</p></div>}
        {selected.works?.length > 0 && <details className={styles.works} open><summary>Trabalhos e pesquisas <span>{selected.works.length}</span></summary><div>{selected.works.map((work, index) => <section key={`${work.title}-${index}`}><span>{work.category || work.type || work.kind || "Obra / pesquisa"}{work.year ? ` · ${work.year}` : ""}</span><h3>{work.url ? <a href={work.url} target="_blank" rel="noopener noreferrer">{work.title} ↗</a> : work.title}</h3><p>{work.summary}</p>{(work.readStatus || work.coverage || work.contentStatus) && <small>{work.readStatus || work.coverage || (work.contentStatus === "full_text_indexed" ? "Texto integral indexado no acervo." : "Créditos, descrição ou resumo público consultados; obra integral não incorporada.")}</small>}</section>)}</div></details>}
        {selected.limitations?.length > 0 && <details className={styles.limits}><summary>Limites desta pesquisa</summary><ul>{selected.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul></details>}
        {selected.sources?.length > 0 && <details className={styles.limits}><summary>Fontes públicas consultadas</summary><ul>{selected.sources.map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || "Fonte pública"} ↗</a>{source.accessedAt ? ` · ${source.accessedAt}` : ""}</li>)}</ul></details>}
        {selected.tags?.length > 0 && <div className={styles.tags}>{selected.tags.slice(0, 6).map(tag => <span key={tag}>{tag}</span>)}</div>}
        <div className={styles.provenance}><span>ORIGEM NO ACERVO</span><code>{selected.sourcePath}</code></div>
        <div className={styles.detailFooter}>{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir fonte original <span>↗</span></a>}<div><button aria-label="Material anterior" onClick={() => selectRelative(-1)}>←</button><button aria-label="Próximo material" onClick={() => selectRelative(1)}>→</button></div></div>
      </article>
    </div> : <div className={styles.empty}><span>∅</span><h2>Nenhum fragmento encontrado.</h2><p>Tente outro termo ou abra o acervo inteiro.</p><button onClick={() => { setQuery(""); setGroup("all"); }}>Ver todas as referências</button></div>}

    {mode === "3d" && filtered.length > 0 && <section className={styles.shelf} aria-label="Materiais do arquivo"><div className={styles.shelfHeading}><span>ESCOLHA UM FRAGMENTO</span><span>← DESLIZE PARA EXPLORAR →</span></div><div className={styles.shelfItems}>{filtered.map((item, index) => <button data-reference-id={item.id} key={item.id} aria-pressed={selected.id === item.id} onClick={() => setSelectedId(item.id)}><span>{code(item, index)}<i>{item.status === "cited" ? "○" : "●"}</i></span><strong>{item.title}</strong><small>{item.author || item.kind}</small></button>)}</div></section>}
    <footer className={styles.footer}><p><span>●</span> Transparência de memória</p><p>Texto disponível ≠ obra inteira consultada. As fichas distinguem texto integral, recortes e citações. O repertório inspira a cena; as fontes ficam neste arquivo.</p></footer>
  </main>;
}
