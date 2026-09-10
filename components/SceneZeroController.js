"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import InstagramBrowserPanel from "./InstagramBrowserPanel";
import AudienceWarmupController from "./AudienceWarmupController";
import { setSharedInstagramPanelVisible } from "@/lib/instagram/panelClient";
import { robotSoundEngine } from "@/lib/robot-sound/RobotSoundEngine";
import { SCENE_ZERO_GLITCH_LEVELS, SCENE_ZERO_PERSONALITY_DIRECTIONS, SCENE_ZERO_STAGES, sceneZeroStageLabel } from "@/lib/scene-zero/state";
import { nextSceneZeroSuitcase, SCENE_ZERO_FIRST_CHALLENGE, SCENE_ZERO_SECOND_CHALLENGE } from "@/lib/scene-zero/suitcaseGame";
import styles from "./SceneZeroController.module.css";

const PRIMARY_STAGES = [
  ["collection", "COLETA DE DADOS"],
  ["participant", "ESCOLHER PARTICIPANTE"],
  ["suitcases", "JOGO DAS MALAS"],
  ["cake", "É BOLO?"],
  ["singing", "MALA — CANTAR 15s"],
  ["glitch", "GLITCH"],
  ["instagram", "INSTAGRAM"],
  ["collapse", "GLITCH / COLAPSO"],
  ["airport", "AEROPORTO"],
  ["tea", "TEA FOR TWO"]
];

const COLLECTION_RESULTS = [
  ["none", "NINGUÉM"],
  ["few", "POUCOS"],
  ["half", "METADE"],
  ["many", "MUITOS"],
  ["almost_all", "QUASE TODOS"],
  ["all", "TODOS"]
];

const SCENE_ZERO_INDEX = [
  ["scene-zero-boot", "BOOT"],
  ["scene-zero-unlock", "ESQUENTAR PÚBLICO"],
  ["scene-zero-participant", "ESCOLHER PARTICIPANTE"],
  ["scene-zero-suitcases", "JOGO DAS MALAS"],
  ["scene-zero-extras", "OUTROS"]
];

function remainingTimer(timer, now, fallback = 15) {
  if (timer?.status === "running" && timer.endsAt) {
    return Math.max(0, Math.ceil((Date.parse(timer.endsAt) - now) / 1000));
  }
  return timer?.remainingSeconds ?? fallback;
}

export default function SceneZeroController() {
  const [snapshot, setSnapshot] = useState({ sceneZero: null, audienceWarmup: null, instagram: null, game: null, suitcase: null, glitch: null, memories: [] });
  const [pending, setPending] = useState("");
  const [detail, setDetail] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [collectionObservation, setCollectionObservation] = useState("");
  const [gincanaObservation, setGincanaObservation] = useState("");
  const [personalityGuidance, setPersonalityGuidance] = useState("");
  const [personalityGuidanceDirty, setPersonalityGuidanceDirty] = useState(false);
  const [browserCommand, setBrowserCommand] = useState("");
  const [googleGuidance, setGoogleGuidance] = useState("");
  const [instagramGuidance, setInstagramGuidance] = useState("");
  const [instagramPanelClosed, setInstagramPanelClosed] = useState(false);
  const [glitchVideos, setGlitchVideos] = useState([]);
  const [glitchVideoFile, setGlitchVideoFile] = useState("");
  const [glitchVideoLoop, setGlitchVideoLoop] = useState(false);
  const [glitchVideoTransitionSeconds, setGlitchVideoTransitionSeconds] = useState(5.2);
  const [activeIndexSection, setActiveIndexSection] = useState("scene-zero-boot");
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [openSuitcaseControls, setOpenSuitcaseControls] = useState(null);
  const [notice, setNotice] = useState("SISTEMA PRONTO");
  const [now, setNow] = useState(Date.now());
  const teaAudioRef = useRef(null);
  const gincanaAutoCommentRef = useRef(null);

  useEffect(() => {
    fetch("/api/state").then((response) => response.json()).then(setSnapshot).catch(() => setNotice("SEM CONEXÃO"));
    fetch("/api/glitch")
      .then((response) => response.json())
      .then((data) => {
        const videos = data.videos || [];
        setGlitchVideos(videos);
        setGlitchVideoFile(data.glitch?.video?.file || videos[0]?.file || "");
        setGlitchVideoLoop(Boolean(data.glitch?.video?.loop));
        setGlitchVideoTransitionSeconds(Number(((data.glitch?.video?.transitionMs || 5200) / 1000).toFixed(1)));
      })
      .catch(() => setNotice("VÍDEOS DE GLITCH INDISPONÍVEIS"));
    const events = new EventSource("/api/events?client=scene-zero-controller");
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setSnapshot(payload.state || {});
    };
    events.onerror = () => setNotice("SSE DESCONECTADO");
    return () => events.close();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => robotSoundEngine.armAutoUnlock(), []);

  useEffect(() => robotSoundEngine.armAudioRelay(), []);

  useEffect(() => {
    const activeSuitcase = snapshot.sceneZero?.suitcaseGame?.currentSuitcase;
    setOpenSuitcaseControls([1, 2, 3].includes(activeSuitcase) ? activeSuitcase : null);
  }, [snapshot.sceneZero?.suitcaseGame?.currentSuitcase]);

  useEffect(() => {
    if (snapshot.instagram?.embeddedPanelSequence > 0) {
      setInstagramPanelClosed(false);
    }
  }, [snapshot.instagram?.embeddedPanelSequence]);

  useEffect(() => {
    if (snapshot.instagram?.embeddedPanelVisible === false) setInstagramPanelClosed(true);
    if (snapshot.instagram?.embeddedPanelVisible === true) setInstagramPanelClosed(false);
  }, [snapshot.instagram?.embeddedPanelVisible]);

  const browserProcessing = ["STARTING", "NAVIGATING", "ACTING"].includes(snapshot.instagram?.status);
  const informationProcessing = Boolean(pending) || browserProcessing;

  useEffect(() => {
    if (informationProcessing) robotSoundEngine.startThinking();
    else robotSoundEngine.stopThinking();
    return () => robotSoundEngine.stopThinking();
  }, [informationProcessing]);

  useEffect(() => {
    if (!personalityGuidanceDirty) {
      setPersonalityGuidance(snapshot.sceneZero?.personalityGuidance?.text || "");
    }
  }, [snapshot.sceneZero?.personalityGuidance?.text, personalityGuidanceDirty]);

  useEffect(() => {
    const sections = SCENE_ZERO_INDEX
      .map(([id]) => document.getElementById(id))
      .filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio || a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]?.target?.id) setActiveIndexSection(visible[0].target.id);
    }, {
      rootMargin: "-8% 0px -68% 0px",
      threshold: [0, 0.05, 0.2, 0.5]
    });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  async function sceneAction(action, payload = {}) {
    if (pending) return null;
    setPending(action);
    setNotice(`PROCESSANDO ${action.toUpperCase()}...`);
    try {
      const response = await fetch("/api/scene-zero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, detail, ...payload })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO CENA 0");
      if (data.sceneZero) setSnapshot((current) => ({ ...current, sceneZero: data.sceneZero }));
      setNotice(data.message || action.toUpperCase());
      setDetail("");
      return data;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setPending("");
    }
  }

  async function bootScene() {
    if (pending || sceneZero.unlock?.status !== "STANDBY") return;
    setPending("unlock-boot");
    setNotice("INICIANDO BIOS...");
    try {
      const response = await fetch("/api/audience-warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock-boot" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO AO INICIAR BIOS");
      if (data.unlock) {
        setSnapshot((current) => ({
          ...current,
          sceneZero: { ...current.sceneZero, unlock: data.unlock }
        }));
      }
      setNotice(data.message || "BIOS INICIADA");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPending("");
    }
  }

  async function operatorCommand(command) {
    if (pending) return null;
    setPending(command);
    try {
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO OPERATOR");
      setNotice(data.message || command);
      return data;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setPending("");
    }
  }

  async function copyInstagramPassword() {
    if (pending) return;
    setPending("instagram-copy-password");
    setNotice("COPIANDO SENHA DO INSTAGRAM...");

    try {
      const response = await fetch("/api/instagram/password", {
        method: "POST",
        cache: "no-store",
        headers: { "X-Caixa-Preta-Operator": "scene-zero" }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "SENHA DO INSTAGRAM INDISPONÍVEL");
      setNotice("SENHA DO INSTAGRAM COPIADA");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPending("");
    }
  }

  async function updateInstagramPanelVisibility(visible) {
    setInstagramPanelClosed(!visible);
    try {
      await setSharedInstagramPanelVisible(visible);
      setNotice(visible ? "PAINEL DO INSTAGRAM EXIBIDO" : "PAINEL DO INSTAGRAM OCULTADO NO OPERATOR E NO PÚBLICO");
    } catch (error) {
      setInstagramPanelClosed(visible);
      setNotice(error.message);
    }
  }

  async function addMemory() {
    const content = memoryText.trim();
    if (!content) return;
    const stored = await operatorCommand(`/memory ${content}`);
    if (stored) setMemoryText("");
  }

  async function glitchVideoAction(action) {
    if (pending) return;
    const transitionSeconds = Math.min(30, Math.max(0.6, Number(glitchVideoTransitionSeconds) || 5.2));
    setGlitchVideoTransitionSeconds(transitionSeconds);
    setPending(action);
    setNotice(`PROCESSANDO ${action.toUpperCase()}...`);
    try {
      const response = await fetch("/api/glitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          payload: {
            file: glitchVideoFile,
            loop: glitchVideoLoop,
            preset: "video",
            transitionMs: Math.round(transitionSeconds * 1000)
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ERRO GLITCH + VÍDEO");
      if (data.state) setSnapshot((current) => ({ ...current, glitch: data.state }));
      if (data.videos) setGlitchVideos(data.videos);
      setNotice(action === "video" ? "GLITCH + VÍDEO ATIVO" : "VÍDEO ENCERRADO / BOT RESTAURADO");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPending("");
    }
  }

  function teaAction(action) {
    const audio = teaAudioRef.current;
    if (audio) {
      if (action === "tea-stop") {
        audio.pause();
        audio.currentTime = 0;
      } else {
        audio.currentTime = 0;
        audio.play().catch(() => setNotice("ÁUDIO BLOQUEADO PELO NAVEGADOR"));
      }
    }
    sceneAction(action);
  }

  async function recordCollectionResult(result, estimatedCount = null) {
    const recorded = await sceneAction("collection-record-result", {
      result,
      estimatedCount,
      observation: collectionObservation
    });
    if (recorded) setCollectionObservation("");
  }

  async function savePersonalityGuidance(guidance) {
    const saved = await sceneAction("set-personality-guidance", { guidance });
    if (saved) setPersonalityGuidanceDirty(false);
  }

  async function togglePersonalityDirection(direction) {
    const current = sceneZero.personalityGuidance?.quickDirections || [];
    const active = current.includes(direction.id);
    const sameCategoryIds = new Set(
      SCENE_ZERO_PERSONALITY_DIRECTIONS
        .filter((candidate) => candidate.category === direction.category)
        .map((candidate) => candidate.id)
    );
    const withoutCategory = current.filter((id) => !sameCategoryIds.has(id));
    const quickDirections = active ? withoutCategory : [...withoutCategory, direction.id];
    await sceneAction("set-personality-guidance", { quickDirections });
  }

  async function clearPersonalityGuidance() {
    setPersonalityGuidance("");
    const cleared = await sceneAction("set-personality-guidance", { guidance: "", quickDirections: [] });
    if (cleared) setPersonalityGuidanceDirty(false);
  }

  const sceneZero = snapshot.sceneZero || {};
  const unlockStatusLabel = sceneZero.unlock?.status === "BOOT_FAILED"
    ? "AGUARDANDO INÍCIO MANUAL"
    : (sceneZero.unlock?.status || "STANDBY").replaceAll("_", " ");
  const collection = sceneZero.collection || {};
  const timer = sceneZero.timer || {};
  const seconds = remainingTimer(timer, now);
  const instagram = snapshot.instagram || {};
  const instagramLoginVerified = instagram.sessionAuthenticated === true;
  const suitcase = snapshot.suitcase || {};
  const suitcaseGame = sceneZero.suitcaseGame || {};
  const gincana = suitcaseGame.gincana || {};
  const gincanaTimer = gincana.timer || {};
  const gincanaSeconds = remainingTimer(gincanaTimer, now, null);
  const nextSuitcase = nextSceneZeroSuitcase(suitcaseGame);
  const morelBios = suitcaseGame.morelBios || {};
  const morelBiosRunning = morelBios.status === "running";
  const morelBiosBlackout = morelBiosRunning && Date.parse(morelBios.endsAt || "") <= now;
  const globalGlitch = snapshot.glitch || {};
  const participantSelection = sceneZero.participantSelection || {};
  const participantSelectionBusy = ["preparing", "awaiting_invite", "countdown", "roulette"].includes(participantSelection.status);
  const participantCountdown = participantSelection.status === "countdown"
    ? countdownSeconds(participantSelection.countdownEndsAt, now)
    : null;
  const questions = useMemo(() => [...(collection.questions || [])].reverse(), [collection.questions]);
  const latestMemories = useMemo(() => [...(snapshot.memories || [])].slice(-5).reverse(), [snapshot.memories]);

  useEffect(() => {
    const sequence = gincanaTimer.sequence;
    if (
      pending
      || gincana.currentTask?.id !== "evidencias_objeto_microfone"
      || gincanaTimer.status !== "complete"
      || gincana.result
      || gincanaAutoCommentRef.current === sequence
    ) return;

    gincanaAutoCommentRef.current = sequence;
    setPending("gincana-auto-comment");
    setNotice("GERANDO COMENTÁRIO SOBRE A CANTORIA...");
    void fetch("/api/scene-zero", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "gincana-complete",
        detail: "A contagem de 20 segundos de Evidências chegou ao fim. Faça agora o comentário sarcástico sobre a cantoria."
      })
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "ERRO AO GERAR COMENTÁRIO");
        if (data.sceneZero) setSnapshot((current) => ({ ...current, sceneZero: data.sceneZero }));
        setNotice(data.message || "COMENTÁRIO GERADO");
      })
      .catch((error) => setNotice(error.message))
      .finally(() => setPending(""));
  }, [gincana.currentTask?.id, gincana.result, gincanaTimer.sequence, gincanaTimer.status, pending]);

  function challengeControls(challenge, startLabel) {
    const active = gincana.currentTask?.id === challenge.id;
    return (
      <>
        <Readout label="DESAFIO FIXO" value={challenge.instruction} />
        <Readout label="DIFICULDADE / OBSERVAÇÕES" value={`${challenge.difficulty} · ${challenge.notes}`} />
        <div className={`${styles.timer} ${active && gincanaTimer.status === "complete" ? styles.timerComplete : ""}`}>{active ? gincanaSeconds ?? "—" : "—"}</div>
        <strong className={styles.timerStatus}>TEMPO: 20s<br />{active ? (gincanaTimer.status || "idle").toUpperCase() : "AGUARDANDO A MALA"}</strong>
        <Button primary onClick={() => sceneAction("gincana-timer-start")} pending={pending || !active}>{startLabel}</Button>
        <Button onClick={() => sceneAction("gincana-timer-pause")} pending={pending || !active || gincanaTimer.status !== "running"}>PAUSAR</Button>
        <Button onClick={() => sceneAction("gincana-timer-resume")} pending={pending || !active || gincanaTimer.status !== "paused"}>CONTINUAR</Button>
        <Button onClick={() => sceneAction("gincana-timer-restart")} pending={pending || !active}>REINICIAR</Button>
        <Button danger onClick={() => sceneAction("gincana-timer-cancel")} pending={pending || !active}>CANCELAR</Button>
        <label className={styles.observationField}>
          O QUE ACONTECEU / REAÇÃO
          <input value={gincanaObservation} onChange={(event) => setGincanaObservation(event.target.value)} placeholder="Ex.: conseguiu; o público acertou; descrição difícil" />
        </label>
        <Button onClick={async () => {
          const result = await sceneAction("gincana-complete", { detail: gincanaObservation });
          if (result) setGincanaObservation("");
        }} pending={pending || !active}>AÇÃO CONCLUÍDA</Button>
        <Button danger onClick={async () => {
          const result = await sceneAction("gincana-failed", { detail: gincanaObservation });
          if (result) setGincanaObservation("");
        }} pending={pending || !active}>FALHOU / TEMPO ESGOTADO</Button>
        <Readout label="RESULTADO" value={active && gincana.result ? `${gincana.result.toUpperCase()} · ${gincana.elapsedSeconds ?? 0}s decorridos` : "AGUARDANDO"} />
        <Readout label="ÚLTIMO COMENTÁRIO DO BOT" value={active ? gincana.lastComment : null} />
      </>
    );
  }

  function navigateToSection(event, id) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveIndexSection(id);
  }

  return (
    <main className={styles.controller}>
      <audio
        preload="auto"
        ref={teaAudioRef}
        src="/api/game-assets?file=audios%2FDoris%20Day%20-%20Tea%20For%20Two%20(1950).mp3"
      />
      <aside className={styles.indexNav} aria-label="Índice da Cena 0">
        <strong>ÍNDICE / CENA 0</strong>
        <span>{sceneZeroStageLabel(sceneZero.stage)}</span>
        <nav>
          {SCENE_ZERO_INDEX.map(([id, label], index) => (
            <a
              aria-current={activeIndexSection === id ? "location" : undefined}
              className={activeIndexSection === id ? styles.activeIndexLink : ""}
              href={`#${id}`}
              key={id}
              onClick={(event) => navigateToSection(event, id)}
            >
              <b>{`${index + 1}`.padStart(2, "0")}</b>
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <section aria-label="Boot da Cena 0" className={styles.bootPanel} id="scene-zero-boot">
        <div className={styles.bootHeading}>
          <span>01</span>
          <div>
            <h2>BOOT</h2>
            <p>INICIA A BIOS E A VERIFICAÇÃO HUMANA</p>
          </div>
        </div>
        <div className={styles.bootStatus}>
          <strong>{sceneZero.unlock?.progress || 0}%</strong>
          <span>{unlockStatusLabel}</span>
        </div>
        <div className={styles.bootActions}>
          <button
            className={styles.bootPrimary}
            disabled={Boolean(pending) || sceneZero.unlock?.status !== "STANDBY"}
            onClick={bootScene}
            type="button"
          >BOOT</button>
          <button
            className={styles.bootReset}
            disabled={Boolean(pending)}
            onClick={() => operatorCommand("/reset")}
            type="button"
          >REINICIAR</button>
        </div>
      </section>

      <section className={styles.warmupDisclosure} data-ready={Boolean(snapshot.sceneZero)} id="scene-zero-unlock">
        <button
          aria-expanded={warmupOpen}
          className={styles.warmupDisclosureToggle}
          onClick={() => setWarmupOpen((current) => !current)}
          type="button"
        >
          <span className={styles.warmupDisclosureTitle}>
            <strong>ESQUENTAR PÚBLICO</strong>
            <small>AQUECIMENTO DA PLATEIA · AÇÕES E PROGRESSO</small>
          </span>
          <span className={styles.warmupDisclosureStatus}>
            {sceneZero.unlock?.progress || 0}% · {unlockStatusLabel}
          </span>
          <span className={styles.warmupDisclosureAction} aria-hidden="true" />
        </button>
        {warmupOpen ? (
          <div className={styles.warmupDisclosureBody}>
            <AudienceWarmupController
              disabled={Boolean(pending)}
              onLog={(line) => setNotice(line)}
              showBootButton={false}
              state={snapshot.audienceWarmup}
              unlock={sceneZero.unlock}
            />
          </div>
        ) : null}
      </section>

      <ControlBlock id="scene-zero-participant" title="ESCOLHER PARTICIPANTE" wide>
        <Button primary onClick={() => sceneAction("participant-volunteers")} pending={pending || participantSelectionBusy}>INICIAR SELEÇÃO / 10s</Button>
        <Button onClick={() => sceneAction("choose-another-participant")} pending={pending || participantSelectionBusy}>NOVA ROLETA / OUTRA PESSOA</Button>
        <Readout label="ETAPA DA SELEÇÃO" value={participantSelection.status === "countdown" ? `MÃOS LEVANTADAS — ${participantCountdown}s` : participantSelection.status === "awaiting_invite" ? "AGUARDANDO FIM DA FALA" : (participantSelection.status || "idle").toUpperCase()} />
        <Readout label="PARTICIPANTE ESCOLHIDO" value={sceneZero.currentParticipant?.name} />
        <details className={styles.participantDetails}>
          <summary>DETALHES DA ROLETA</summary>
          <Readout label="NOMES NA ROLETA" value={(participantSelection.candidates || []).map((participant) => participant.name).join(" · ")} />
          <Readout label="COMENTÁRIO DA ROLETA" value={participantSelection.lastComment} />
          <small>Marcus Garcia e Victor Cappa nunca entram no sorteio.</small>
        </details>
      </ControlBlock>

      <ControlBlock id="scene-zero-suitcases" title="JOGO DAS MALAS" wide>
        <div className={styles.suitcaseOverview}>
          <span>{(suitcaseGame.status || "idle").toUpperCase()}</span>
          <strong>MALA ATUAL: {suitcaseGame.currentSuitcase || "—"}</strong>
          <span>PARTICIPANTE: {sceneZero.currentParticipant?.name || "—"}</span>
          <span>ORDEM REALIZADA: {(suitcaseGame.openedSuitcases || []).join(" → ") || "—"}</span>
          <Button primary onClick={() => sceneAction("suitcase-next")} pending={pending || !nextSuitcase}>
            {nextSuitcase ? "ROBÔ ESCOLHER PRÓXIMA MALA" : "TODAS AS MALAS ESCOLHIDAS"}
          </Button>
          <Button onClick={() => sceneAction("suitcase-finish")} pending={pending || Boolean(nextSuitcase) || suitcaseGame.status === "finished"}>FINALIZAR JOGO DAS MALAS / PREENCHER BARRA</Button>
        </div>
        <div className={styles.suitcaseGrid}>
          <section className={`${styles.suitcaseCard} ${suitcaseGame.currentSuitcase === 2 ? styles.activeSuitcase : ""}`}>
            <h3>1ª ESCOLHA — MALA 2 / EVIDÊNCIAS</h3>
            <Button onClick={() => setOpenSuitcaseControls((current) => current === 2 ? null : 2)} pressed={openSuitcaseControls === 2}>{openSuitcaseControls === 2 ? "COMPRIMIR" : "CONTROLES"}</Button>
            <div className={styles.suitcaseDetails} hidden={openSuitcaseControls !== 2}>
            {challengeControls(SCENE_ZERO_FIRST_CHALLENGE, "INICIAR EVIDÊNCIAS / 20s")}
            </div>
          </section>

          <section className={`${styles.suitcaseCard} ${suitcaseGame.currentSuitcase === 3 ? styles.activeSuitcase : ""}`}>
            <h3>2ª ESCOLHA — MALA 3 / OBJETO PELO CHEIRO</h3>
            <Button onClick={() => setOpenSuitcaseControls((current) => current === 3 ? null : 3)} pressed={openSuitcaseControls === 3}>{openSuitcaseControls === 3 ? "COMPRIMIR" : "CONTROLES"}</Button>
            <div className={styles.suitcaseDetails} hidden={openSuitcaseControls !== 3}>
            {challengeControls(SCENE_ZERO_SECOND_CHALLENGE, "INICIAR ADIVINHAÇÃO / 20s")}
            </div>
          </section>

          <section className={`${styles.suitcaseCard} ${suitcaseGame.currentSuitcase === 1 ? styles.activeSuitcase : ""}`}>
            <h3>3ª ESCOLHA — MALA 1 / NOVA BIOS</h3>
            <Button onClick={() => setOpenSuitcaseControls((current) => current === 1 ? null : 1)} pressed={openSuitcaseControls === 1}>{openSuitcaseControls === 1 ? "COMPRIMIR" : "CONTROLES"}</Button>
            <div className={styles.suitcaseDetails} hidden={openSuitcaseControls !== 1}>
              <Readout label="SEQUÊNCIA" value="GLITCH CRESCENTE → BIOS CORROMPIDA → BLACKOUT" />
              <Readout label="STATUS" value={morelBiosBlackout ? "BLACKOUT FINAL" : morelBiosRunning ? "BIOS CORROMPIDA NA PROJEÇÃO" : morelBios.status === "stopped" ? "INTERROMPIDA" : "AGUARDANDO"} />
              <Button primary onClick={() => sceneAction("morel-bios-start")} pending={pending || suitcaseGame.currentSuitcase !== 1}>RECARREGAR GLITCH + BIOS</Button>
              <Button danger onClick={() => sceneAction("morel-bios-stop")} pending={pending || !morelBiosRunning}>INTERROMPER BIOS / BLACKOUT</Button>
              <Readout label="FIM DO JOGO" value={suitcaseGame.status === "finished" ? `FINALIZADO · ${suitcaseGame.endedAt ? new Date(suitcaseGame.endedAt).toLocaleTimeString("pt-BR") : "REGISTRADO"}` : "A BARRA PERMANECE TRAVADA ATÉ FINALIZAR"} />
            </div>
          </section>
        </div>

        <details className={styles.legacySuitcaseControls}>
          <summary>CONTROLES LEGADOS DAS MALAS / PESQUISA DO PARTICIPANTE</summary>
          <Readout label="SUITCASE DIRECTOR EXISTENTE" value={`${suitcase.phase || "IDLE"} / ${suitcase.activeExperience || "—"}`} />
          <Button onClick={() => operatorCommand("/mala start")} pending={pending}>INICIAR / RETOMAR LEGADO</Button>
          <Button primary onClick={() => sceneAction("suitcase-research-person")} pending={pending || !sceneZero.currentParticipant?.name}>PESQUISAR PARTICIPANTE</Button>
          <Button onClick={() => sceneAction("suitcase-research-stop")} pending={pending || instagram.browserMode !== "person_research"}>FECHAR PESQUISA</Button>
          <Button danger onClick={() => operatorCommand("/mala abort")} pending={pending}>INTERROMPER JOGO LEGADO</Button>
        </details>
      </ControlBlock>

      <section className={styles.extrasDisclosure} id="scene-zero-extras">
        <button
          aria-expanded={extrasOpen}
          className={styles.extrasDisclosureToggle}
          onClick={() => setExtrasOpen((current) => !current)}
          type="button"
        >
          <span>
            <strong>OUTROS CONTROLES</strong>
            <small>MEMÓRIA · PERSONALIDADE · DIREÇÃO · COLETA · GLITCH · NAVEGADOR · ÁUDIO</small>
          </span>
          <span className={styles.extrasDisclosureAction} aria-hidden="true" />
        </button>
        {extrasOpen ? <div className={styles.extrasDisclosureBody}>

      <section className={styles.memoryPanel} id="scene-zero-memory">
        <div className={styles.memoryHeading}>
          <div>
            <h2>MEMÓRIA DA SESSÃO</h2>
            <p>Registra uma observação silenciosa para o bot usar como contexto quando for relevante.</p>
          </div>
          <strong>{snapshot.memories?.length || 0} REGISTROS</strong>
        </div>
        <div className={styles.memoryComposer}>
          <input
            aria-label="Nova memória da sessão"
            onChange={(event) => setMemoryText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                addMemory();
              }
            }}
            placeholder="Ex.: uma pessoa na primeira fila está filmando tudo"
            value={memoryText}
          />
          <Button primary onClick={addMemory} pending={pending || !memoryText.trim()}>ADICIONAR /MEMORY</Button>
        </div>
        {latestMemories.length ? (
          <ol className={styles.memoryList} aria-label="Memórias mais recentes">
            {latestMemories.map((memory) => (
              <li key={memory.id}>
                <time>{new Date(memory.timestamp).toLocaleTimeString("pt-BR")}</time>
                <span>{memory.content}</span>
              </li>
            ))}
          </ol>
        ) : <p className={styles.emptyMemory}>NENHUMA MEMÓRIA REGISTRADA NESTA SESSÃO.</p>}
      </section>

      <section className={styles.personalityPanel} id="scene-zero-personality">
        <div>
          <h2>ORIENTAÇÕES DE PERSONALIDADE</h2>
          <p>Orienta as próximas falas silenciosamente, sem trocar etapa nem interromper processos ativos.</p>
        </div>
        <label className={styles.orientationField}>
          DIREÇÃO PERSISTENTE PARA O BOT
          <textarea
            value={personalityGuidance}
            onChange={(event) => {
              setPersonalityGuidance(event.target.value);
              setPersonalityGuidanceDirty(true);
            }}
            placeholder="Ex.: mais impaciente e sarcástica; respostas mais curtas; implicar com excesso de confiança"
            rows={3}
          />
        </label>
        <div className={styles.personalityActions}>
          <Button
            primary
            onClick={() => savePersonalityGuidance(personalityGuidance)}
            pending={pending || !personalityGuidanceDirty}
          >SALVAR ORIENTAÇÕES</Button>
          <Button
            danger
            onClick={clearPersonalityGuidance}
            pending={pending || (!personalityGuidance && !sceneZero.personalityGuidance?.text && !sceneZero.personalityGuidance?.quickDirections?.length)}
          >LIMPAR</Button>
        </div>
        <div className={styles.personalityQuickGrid}>
          {SCENE_ZERO_PERSONALITY_DIRECTIONS.map((direction) => {
            const active = sceneZero.personalityGuidance?.quickDirections?.includes(direction.id);
            return (
              <Button
                key={direction.id}
                onClick={() => togglePersonalityDirection(direction)}
                pending={pending}
                pressed={Boolean(active)}
                primary={Boolean(active)}
              >{direction.label}</Button>
            );
          })}
        </div>
        <Readout
          label="ORIENTAÇÃO ATIVA"
          value={[
            sceneZero.personalityGuidance?.text,
            ...(sceneZero.personalityGuidance?.quickDirections || []).map((id) => (
              SCENE_ZERO_PERSONALITY_DIRECTIONS.find((direction) => direction.id === id)?.label
            ))
          ].filter(Boolean).join(" · ") || "NENHUMA"}
        />
      </section>

      <section className={styles.stagePanel} id="scene-zero-direction">
        <h2>DIREÇÃO DRAMATÚRGICA</h2>
        <p>O botão muda o contexto. A fala é improvisada pelo bot.</p>
        <div className={styles.stageGrid}>
          {PRIMARY_STAGES.map(([stage, label]) => (
            <button
              className={sceneZero.stage === stage ? styles.activeStage : styles.stageButton}
              disabled={Boolean(pending)}
              key={stage}
              onClick={() => sceneAction("set-stage", { stage })}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <label className={styles.detailField}>
          CONTEXTO OPCIONAL PARA A PRÓXIMA AÇÃO
          <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Ex.: metade levantou a mão; houve silêncio; alguém hesitou" />
        </label>
      </section>

      <div className={styles.blocks}>
        <ControlBlock id="scene-zero-collection" title="PERGUNTAS / COLETA">
          <small>Na etapa COLETA, alimenta o dataset. Nas demais etapas, faz perguntas avulsas sem mudar ou encerrar o processo atual.</small>
          <Button onClick={() => sceneAction("collection-new-question")} pending={pending}>NOVA PERGUNTA</Button>
          <Button onClick={() => sceneAction("collection-rephrase")} pending={pending}>REFORMULAR</Button>
          <Button onClick={() => sceneAction("collection-comment")} pending={pending}>COMENTAR RESULTADO</Button>
          <Button onClick={() => sceneAction("collection-refresh-local-context")} pending={pending}>ATUALIZAR CONTEXTO SP</Button>
          <Button danger onClick={() => sceneAction("collection-end")} pending={pending}>ENCERRAR COLETA</Button>
          <div className={styles.quickGrid}>
            {COLLECTION_RESULTS.map(([result, label]) => (
              <Button key={result} onClick={() => recordCollectionResult(result)} pending={pending}>{label}</Button>
            ))}
          </div>
          <div className={styles.quickGrid}>
            {["0", "1", "2", "3", "4", "5+"].map((count) => (
              <Button key={count} onClick={() => recordCollectionResult("count", count)} pending={pending}>{count}</Button>
            ))}
          </div>
          <label className={styles.observationField}>
            OBSERVAÇÃO / CORREÇÃO RÁPIDA
            <input
              value={collectionObservation}
              onChange={(event) => setCollectionObservation(event.target.value)}
              placeholder="Ex.: demoraram; riram; uma pessoa respondeu; plateia confusa"
            />
          </label>
          <Button
            onClick={() => recordCollectionResult("qualitative")}
            pending={pending || !collectionObservation.trim()}
          >REGISTRAR SÓ OBSERVAÇÃO</Button>
          <Readout label="ÚLTIMA PERGUNTA" value={collection.lastQuestion} />
          <Readout label="AÇÃO SOLICITADA" value={collection.lastRequestedAction} />
          <Readout label="ÚLTIMO COMENTÁRIO" value={collection.lastComment} />
          <Readout label="TEMPORIZAÇÃO" value={collection.activeCountdown?.status === "running"
            ? `${countdownSeconds(collection.activeCountdown.endsAt, now)}s / ${collection.activeCountdown.durationSeconds}s`
            : (collection.activeCountdown?.status || "idle").toUpperCase()} />
          <Readout label="DATASET" value={`${collection.questions?.length || 0} intervenções · ${collection.segments?.length || 0} segmentos · ${collection.instructionCount || 0} instruções`} />
          <Readout label="OBEDIÊNCIA" value={collection.obedience
            ? `respostas ${collection.obedience.answered || 0} · resistência ${collection.obedience.resisted || 0} · demora ${collection.obedience.delayed || 0} · confusão ${collection.obedience.confused || 0} · antecipação ${collection.obedience.anticipated || 0}`
            : "—"} />
          <Readout label="CONTEXTO SP" value={collection.localContext?.status === "ready"
            ? `${new Date(collection.localContext.updatedAt).toLocaleString("pt-BR")} — ${collection.localContext.summary}`
            : collection.localContext?.status === "error"
              ? `ERRO — ${collection.localContext.error || "não atualizado"}`
              : (collection.localContext?.status || "idle").toUpperCase()} />
          {questions.length ? <ol className={styles.history}>{questions.slice(0, 8).map((item) => <li key={item.id}>{item.text}</li>)}</ol> : null}
        </ControlBlock>

        <ControlBlock id="scene-zero-singing" title="CANTAR 15s" wide>
          <div className={`${styles.timer} ${timer.status === "complete" ? styles.timerComplete : ""}`}>{seconds}</div>
          <strong className={styles.timerStatus}>{timer.status === "complete" ? "FIM" : (timer.status || "idle").toUpperCase()}</strong>
          <Button primary onClick={() => sceneAction("timer-start")} pending={pending}>INICIAR TIMER</Button>
          <Button onClick={() => sceneAction("timer-pause")} pending={pending}>PAUSAR</Button>
          <Button onClick={() => sceneAction("timer-resume")} pending={pending}>CONTINUAR</Button>
          <Button onClick={() => sceneAction("timer-restart")} pending={pending}>REINICIAR</Button>
          <Button danger onClick={() => sceneAction("timer-cancel")} pending={pending}>CANCELAR</Button>
        </ControlBlock>

        <ControlBlock id="scene-zero-glitch" title="GLITCH" wide>
          <div className={styles.levels}>
            {SCENE_ZERO_GLITCH_LEVELS.map((level) => (
              <Button primary={sceneZero.glitchLevel === level} key={level} onClick={() => sceneAction("set-glitch", { level })} pending={pending}>
                {level === "normal" ? "NORMAL" : level.replace("glitch-", "GLITCH ").toUpperCase()}
              </Button>
            ))}
          </div>
          <Button onClick={() => sceneAction("step-glitch", { delta: 1 })} pending={pending}>GLITCH +</Button>
          <Button onClick={() => sceneAction("step-glitch", { delta: -1 })} pending={pending}>GLITCH -</Button>
          <Button danger onClick={() => sceneAction("set-glitch", { level: "normal" })} pending={pending}>RESET</Button>
          <div className={styles.glitchVideoConfig}>
            <label className={styles.glitchVideoField}>
              VÍDEO FINAL
              <select value={glitchVideoFile} onChange={(event) => setGlitchVideoFile(event.target.value)}>
                {glitchVideos.length ? glitchVideos.map((video) => (
                  <option key={video.file} value={video.file}>{video.file}</option>
                )) : <option value="">NENHUM VÍDEO EM assets/videos/glitch</option>}
              </select>
            </label>
            <label className={styles.glitchVideoField}>
              TEMPO DE GLITCH ATÉ O VÍDEO DOMINAR
              <div className={styles.glitchDurationInput}>
                <input
                  max="30"
                  min="0.6"
                  onChange={(event) => setGlitchVideoTransitionSeconds(Number(event.target.value))}
                  step="0.1"
                  type="number"
                  value={glitchVideoTransitionSeconds}
                />
                <span>SEGUNDOS</span>
              </div>
            </label>
            <label className={styles.glitchLoopField}>
              <input checked={glitchVideoLoop} onChange={(event) => setGlitchVideoLoop(event.target.checked)} type="checkbox" />
              REPETIR VÍDEO EM LOOP
            </label>
            <div className={styles.glitchDurationPresets} aria-label="Atalhos de duração do glitch">
              {[1, 3, 5, 10].map((duration) => (
                <Button
                  key={duration}
                  onClick={() => setGlitchVideoTransitionSeconds(duration)}
                  pressed={glitchVideoTransitionSeconds === duration}
                  primary={glitchVideoTransitionSeconds === duration}
                >{duration}s</Button>
              ))}
            </div>
          </div>
          <Button primary onClick={() => glitchVideoAction("video")} pending={pending || !glitchVideoFile}>GLITCH + VÍDEO</Button>
          <Button danger onClick={() => glitchVideoAction("video-stop")} pending={pending || globalGlitch.mode !== "video"}>VOLTAR AO BOT</Button>
          <Readout
            label="GLITCH + VÍDEO GLOBAL"
            value={globalGlitch.mode === "video"
              ? `${globalGlitch.video?.file || "—"} · ${(globalGlitch.video?.transitionMs || 0) / 1000}s até dominar · ${globalGlitch.video?.loop ? "LOOP" : "SEM LOOP"}`
              : "INATIVO"}
          />
        </ControlBlock>

        <ControlBlock id="scene-zero-browser" title="GOOGLE + INSTAGRAM / COMANDO LIVRE" wide>
          <Button primary onClick={() => sceneAction("instagram-manual-login")} pending={pending}>ABRIR / VERIFICAR LOGIN MANUAL DO INSTAGRAM</Button>
          <Button onClick={copyInstagramPassword} pending={pending}>COPIAR SENHA DO INSTAGRAM</Button>
          <Readout label="LOGIN DO INSTAGRAM" value={instagramLoginVerified ? "SESSÃO AUTENTICADA · PERFIS LIBERADOS" : "USE O PAINEL ABAIXO PARA TOCAR EM CONTINUE/CONTINUAR E CONCLUIR O LOGIN. NENHUMA CREDENCIAL SERÁ PREENCHIDA AUTOMATICAMENTE."} />
          <label className={styles.browserCommandField}>
            COMANDO EM LINGUAGEM NATURAL
            <textarea
              value={browserCommand}
              onChange={(event) => setBrowserCommand(event.target.value)}
              placeholder="Ex.: entre no Google, busque algo e comente. Ao mesmo tempo, abra uma aba do Instagram e procure o perfil do Nikolas Ferreira."
              rows={4}
            />
          </label>
          <Button
            primary
            onClick={() => sceneAction("browser-command-start", { command: browserCommand })}
            pending={pending || !browserCommand.trim()}
          >ENTENDER E EXECUTAR</Button>
          <div className={styles.browserQuickCommands}>
            <div className={styles.browserQuickField}>
              <strong>GOOGLE</strong>
              <input
                aria-label="Comando rápido para o Google"
                value={googleGuidance}
                onChange={(event) => setGoogleGuidance(event.target.value)}
                placeholder="Ex.: buscar notícias sobre IA e comentar a primeira"
              />
              <Button
                onClick={() => sceneAction("google-guidance-start", { guidance: googleGuidance })}
                pending={pending || !googleGuidance.trim()}
              >EXECUTAR GOOGLE</Button>
            </div>
            <div className={styles.browserQuickField}>
              <strong>INSTAGRAM</strong>
              <input
                aria-label="Nome ou perfil para buscar no Instagram"
                value={instagramGuidance}
                onChange={(event) => setInstagramGuidance(event.target.value)}
                placeholder="Ex.: Nikolas Ferreira ou @usuario"
              />
              <Button
                onClick={() => sceneAction("browser-instagram-start", { person: instagramGuidance })}
                pending={pending || !instagramGuidance.trim()}
              >BUSCAR PERFIL</Button>
            </div>
          </div>
          <Button
            danger
            onClick={() => sceneAction("browser-stop")}
            pending={pending || instagram.status === "DISCONNECTED"}
          >FECHAR NAVEGADOR</Button>
          {instagram.embedded && instagram.status !== "DISCONNECTED" && instagramPanelClosed ? (
            <Button onClick={() => updateInstagramPanelVisibility(true)} pending={pending}>MOSTRAR NAVEGADOR</Button>
          ) : null}
          <Readout label="NAVEGADOR REAL" value={`${instagram.status || "DISCONNECTED"} / ${instagram.message || "—"}`} />
          <Readout label="COMANDO EM EXECUÇÃO" value={instagram.research?.guidance || instagram.research?.person || "INATIVO"} />
          {instagram.secondaryBrowser?.active ? (
            <Readout label="ABAS ABERTAS" value={`PRINCIPAL · ${instagram.secondaryBrowser.label || "SECUNDÁRIA"}`} />
          ) : null}
          {instagram.embedded && instagram.status !== "DISCONNECTED" && instagram.embeddedPanelVisible !== false && !instagramPanelClosed ? (
            <div className={styles.instagramPanel}>
              <InstagramBrowserPanel instagram={instagram} onClose={() => updateInstagramPanelVisibility(false)} />
            </div>
          ) : null}
        </ControlBlock>

        <ControlBlock id="scene-zero-airport" title="AEROPORTO / TEA FOR TWO" wide>
          <Readout label="AEROPORTO" value={sceneZero.airportActive ? "TELA ESTÁVEL ATIVA" : "INATIVO"} />
          <Readout label="TEA FOR TWO" value={(sceneZero.teaForTwo?.status || "stopped").toUpperCase()} />
          <Button primary onClick={() => teaAction("tea-play")} pending={pending}>PLAY</Button>
          <Button onClick={() => teaAction("tea-restart")} pending={pending}>RESTART</Button>
          <Button danger onClick={() => teaAction("tea-stop")} pending={pending}>STOP</Button>
        </ControlBlock>
      </div>
        </div> : null}
      </section>
      <footer className={styles.notice}>{pending ? `PROCESSANDO: ${pending}` : notice}</footer>
    </main>
  );
}

function ControlBlock({ children, id, title, wide = false }) {
  return <section className={`${styles.block} ${wide ? styles.wide : ""}`} id={id}><h2>{title}</h2><div className={styles.controls}>{children}</div></section>;
}

function Button({ children, danger = false, onClick, pending, pressed, primary = false }) {
  return <button aria-pressed={pressed} className={danger ? styles.danger : primary ? styles.primary : styles.button} disabled={Boolean(pending)} onClick={onClick} type="button">{children}</button>;
}

function Readout({ label, value }) {
  return <p className={styles.readout}><span>{label}</span><strong>{value || "—"}</strong></p>;
}

function countdownSeconds(endsAt, now) {
  return endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)) : 10;
}
