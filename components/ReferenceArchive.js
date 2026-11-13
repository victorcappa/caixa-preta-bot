"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import styles from "./ReferenceArchive.module.css";
import { islandTopics, islandTrails, referenceRelations } from "@/lib/referenceIsland";
import ReferenceExperiment from "./ReferenceExperiment";

const ArchiveScene = dynamic(() => import("./ReferenceArchiveScene"), { ssr: false });
const fold = value => `${value || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const code = (item, index) => /^(CP-|E\d)/.test(item.id) ? item.id : String(index + 1).padStart(3, "0");

export default function ReferenceArchive({ library }) {
  const { items, groups, island } = library;
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [selectedId, setSelectedId] = useState("marcus-garcia-labirinto");
  const [mode, setMode] = useState("3d");
  const [paused, setPaused] = useState(false);
  const [topic, setTopic] = useState(null), [objectId, setObjectId] = useState(null), [focusToken, setFocusToken] = useState(0);
  const [pair, setPair] = useState([]), [gaps, setGaps] = useState(false), [trailId, setTrailId] = useState(null), [trailStep, setTrailStep] = useState(0);
  const hasGap = item => item.status === "research" || item.limitations?.some(limit => /nao.*(localiz|identific|confirm|verific)/.test(fold(limit)));
  const trail = islandTrails.find(trail => trail.id === trailId);
  const gapCount = items.filter(hasGap).length;
  const filtered = useMemo(() => items.filter(item => (group === "all" || item.group === group) &&
    (!topic || item.affinities.includes(topic)) && (!gaps || hasGap(item)) && fold([item.title, item.author, item.description, ...(item.tags || [])].join(" ")).includes(fold(query))), [items, query, group, topic, gaps]);
  const visibleIds = useMemo(() => filtered.map(item => item.id), [filtered]);
  const selected = filtered.find(item => item.id === selectedId) || filtered[0];
  const selectedIndex = selected ? filtered.indexOf(selected) : -1;
  const relations = useMemo(() => selected ? referenceRelations(selected, items) : [], [selected, items]);
  function chooseItem(id) {
    if (!filtered.some(item => item.id === id)) { setQuery(""); setGroup("all"); setTopic(null); setGaps(false); }
    setSelectedId(id);
  }
  function chooseObject(id) { chooseItem(`objeto-${id}`); setObjectId(id); setFocusToken(value => value + 1); }
  function walk(id, step = 0) { const route = islandTrails.find(route => route.id === id); setTrailId(id); setTrailStep(step); setQuery(""); setGroup("all"); setGaps(false); setSelectedId(`objeto-${route.steps[step].object}`); setObjectId(route.steps[step].object); setFocusToken(value => value + 1); setTopic(route.steps[step].topic); setMode("3d"); }
  function cross(id) { setPair(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 2 ? [...current, id] : current); }
  const selectRelative = delta => {
    if (filtered.length) setSelectedId(filtered[(selectedIndex + delta + filtered.length) % filtered.length].id);
  };

  return <main className={styles.archive}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}><span /> CAIXA PRETA / ILHA HOLOGRÁFICA</p>
        <h1>Uma ilha feita<br /> de memória<span>.</span></h1>
        <p className={styles.introduction}>Entre os escombros, objetos e aparições da peça, encontre as fontes que atravessam a voz da Caixa.</p>
      </div>
      <div className={styles.headerNote}><span>ARQUIPÉLAGO / 001</span><p>O acervo fica visível aqui.<br />Em cena, ele vira inconsciente.</p><strong>{items.length}<small>REGISTROS RASTREÁVEIS</small></strong></div>
    </header>

    <div className={styles.toolbar}>
      <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label="Buscar referências" placeholder="Buscar uma ideia, pessoa ou material" value={query} onChange={event => setQuery(event.target.value)} />{query && <button onClick={() => setQuery("")} aria-label="Limpar busca">×</button>}</label>
      <div className={styles.modeSwitch} aria-label="Visualização"><button aria-pressed={mode === "3d"} onClick={() => setMode("3d")}>Ilha 3D</button><button aria-pressed={mode === "list"} onClick={() => setMode("list")}>Lista</button></div>
    </div>
    <div className={styles.filters} aria-label="Filtrar acervo">
      <button data-reference-group="all" aria-pressed={group === "all"} onClick={() => setGroup("all")}>Tudo <span>{items.length}</span></button>
      {groups.map(category => <button key={category.id} data-reference-group={category.id} aria-pressed={group === category.id} onClick={() => setGroup(category.id)}>{category.label} <span>{category.count ?? items.filter(item => item.group === category.id).length}</span></button>)}
    </div>

    <div className={styles.topicFilters} aria-label="Afinidades da ilha"><span>APROXIMAR POR</span>{islandTopics.map(theme => <button key={theme.id} style={{ "--topic-color": theme.color }} data-island-topic={theme.id} aria-pressed={topic === theme.id} onClick={() => setTopic(current => current === theme.id ? null : theme.id)}><i />{theme.label}</button>)}<button data-reference-gaps aria-pressed={gaps} onClick={() => setGaps(value => !value)}>◌ Lacunas {gapCount}</button></div>
    <section className={styles.trails} aria-label="Percursos da ilha"><span>PERCURSOS CURATORIAIS</span><div>{islandTrails.map(route => <button key={route.id} data-island-trail={route.id} aria-pressed={trailId === route.id} onClick={() => walk(route.id)}>{route.label} <b>↗</b></button>)}</div>{trail && <article data-island-trail-step={trailStep}><p><span>0{trailStep + 1} / 0{trail.steps.length}</span>{trail.steps[trailStep].text}</p><div><button onClick={() => setTrailId(null)}>Sair do percurso</button><button disabled={trailStep === 0} onClick={() => walk(trail.id, trailStep - 1)}>← Anterior</button><button disabled={trailStep === trail.steps.length - 1} onClick={() => walk(trail.id, trailStep + 1)}>Próximo vestígio →</button></div></article>}</section>
    {mode === "3d" && <div className={styles.objectBar} aria-label="Objetos cênicos da ilha"><span>MATERIALIZAR</span>{island.models.map(model => <button key={model.id} data-island-object={model.id} aria-pressed={objectId === model.id} title={`${model.label} · ${model.initial ? "presente na ilha" : "carrega sob demanda"}`} onClick={() => chooseObject(model.id)}>{model.label}{!model.initial && <small>＋</small>}</button>)}</div>}

    {filtered.length ? <div className={`${styles.exhibition} ${mode === "list" ? styles.listMode : ""}`}>
      <section className={styles.viewport} aria-label="Explorar acervo">
        <div className={styles.viewportHeader}><span>FIG. 01 / {mode === "3d" ? "ILHA / CAMPO DE MEMÓRIA" : "ÍNDICE DO ACERVO"}</span><span>{String(filtered.length).padStart(3, "0")} FRAGMENTOS</span></div>
        {mode === "3d" ? <>
          <ArchiveScene items={items} manifest={island} visibleIds={visibleIds} topic={topic} selectedId={selected.id} onSelect={chooseItem} onObjectSelect={chooseObject} objectId={objectId} focusToken={focusToken} paused={paused} />
          <div className={styles.sceneLegend}><span><i /> LIGAÇÃO DOCUMENTADA</span><span><i /> PONTE CURATORIAL</span></div>
          <div className={styles.sceneControls}><span>Arraste para orbitar · roda para aproximar · clique para explorar</span><button aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "Retomar movimento" : "Pausar movimento"}</button></div>
        </> : <div className={styles.indexList}>
          {filtered.map((item, index) => <button key={item.id} data-reference-id={item.id} aria-pressed={selected.id === item.id} onClick={() => chooseItem(item.id)}><span>{code(item, index)}</span><div><strong>{item.title}</strong><small>{item.author || item.kind} {item.year ? ` / ${item.year}` : ""}</small></div><em>{item.statusLabel}</em><b aria-hidden="true">↗</b></button>)}
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
        {relations.length > 0 && <details className={styles.relations} open><summary>Fios que atravessam este material</summary><div>{relations.map(relation => <button key={relation.id} onClick={() => chooseItem(relation.id)}><strong>{relation.title} ↗</strong><small data-relation-type={relation.type}>{relation.reason}</small></button>)}</div></details>}
        <div className={styles.crossButton}><button aria-pressed={pair.includes(selected.id)} disabled={pair.length === 2 && !pair.includes(selected.id)} onClick={() => cross(selected.id)}>{pair.includes(selected.id) ? "✓ No cruzamento · retirar" : "＋ Adicionar ao cruzamento"}</button><span>{pair.length} / 2 materiais · laboratório abaixo</span></div>
        <div className={styles.provenance}><span>ORIGEM NO ACERVO</span><code>{selected.sourcePath}</code></div>
        <div className={styles.detailFooter}>{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir fonte original <span>↗</span></a>}<div><button aria-label="Material anterior" onClick={() => selectRelative(-1)}>←</button><button aria-label="Próximo material" onClick={() => selectRelative(1)}>→</button></div></div>
      </article>
    </div> : <div className={styles.empty}><span>∅</span><h2>Nenhum fragmento encontrado.</h2><p>Tente outro termo ou abra o acervo inteiro.</p><button onClick={() => { setQuery(""); setGroup("all"); setTopic(null); setGaps(false); }}>Ver todas as referências</button></div>}

    {mode === "3d" && filtered.length > 0 && <section className={styles.shelf} aria-label="Materiais do arquivo"><div className={styles.shelfHeading}><span>ESCOLHA UM FRAGMENTO</span><span>← DESLIZE PARA EXPLORAR →</span></div><div className={styles.shelfItems}>{filtered.map((item, index) => <button data-reference-id={item.id} key={item.id} aria-pressed={selected.id === item.id} onClick={() => chooseItem(item.id)}><span>{code(item, index)}<i>{item.status === "cited" ? "○" : "●"}</i></span><strong>{item.title}</strong><small>{item.author || item.kind}</small></button>)}</div></section>}
    <ReferenceExperiment items={items} ids={pair} onRemove={cross} />
    <footer className={styles.footer}><p><span>●</span> Transparência de memória</p><p>Texto disponível ≠ obra inteira consultada. As fichas distinguem texto integral, recortes e citações. O repertório inspira a cena; as fontes ficam neste arquivo.</p></footer>
  </main>;
}
