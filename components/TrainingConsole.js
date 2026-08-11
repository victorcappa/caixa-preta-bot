"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Terminal from "./Terminal";
import styles from "./TrainingConsole.module.css";

function createUserMessage(content) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    role: "user",
    content
  };
}

function parseMemories(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((content) => ({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source: "training",
      type: "memory",
      content
    }));
}

function tagsFromText(raw) {
  return raw
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function displayRating(rating) {
  if (rating === "perfect") {
    return "PERFEITO";
  }

  if (rating === "almost") {
    return "QUASE";
  }

  return "RUIM";
}

export default function TrainingConsole() {
  const [status, setStatus] = useState("CONNECTING");
  const [mode, setMode] = useState("host");
  const [input, setInput] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState({
    examples: [],
    styleNotes: [],
    stats: { total: 0, perfect: 0, almost: 0, bad: 0 },
    suggestedTags: [],
    suggestedGameMechanics: []
  });
  const [drafts, setDrafts] = useState({});
  const [styleNoteDraft, setStyleNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const scrollRef = useRef(null);

  const memories = useMemo(() => parseMemories(memoryText), [memoryText]);

  useEffect(() => {
    fetchTrainingState();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  async function fetchTrainingState() {
    try {
      const response = await fetch("/api/training/state");
      const data = await response.json();
      setSnapshot(data);
      setStatus("CONNECTED");
    } catch {
      setStatus("DISCONNECTED");
    }
  }

  function updateDraft(messageId, patch) {
    setDrafts((current) => ({
      ...current,
      [messageId]: {
        rating: null,
        preferredResponse: "",
        notes: "",
        tags: "",
        gameMechanic: "",
        alternatives: [],
        improving: false,
        saved: false,
        error: "",
        ...(current[messageId] || {}),
        ...patch
      }
    }));
  }

  function contextForMessage(message) {
    const index = messages.findIndex((item) => item.id === message.id);
    const userMessage = [...messages.slice(0, index)].reverse().find((item) => item.role === "user");

    return {
      mode,
      memories,
      conversation: messages.slice(Math.max(0, index - 8), index),
      userMessage: userMessage?.content || "",
      modelResponse: message.content
    };
  }

  async function submitMessage(event) {
    event.preventDefault();

    const content = input.trim();
    if (!content || pending) {
      return;
    }

    const userMessage = createUserMessage(content);
    const conversationBeforeReply = [...messages, userMessage];
    setMessages(conversationBeforeReply);
    setInput("");
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/training/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          mode,
          memories,
          conversation: messages
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "TRAINING CHAT FAILED");
      }

      setMessages([...conversationBeforeReply, data.message]);
      updateDraft(data.message.id, {});
    } catch (requestError) {
      setError(requestError.message);
      setMessages(messages);
    } finally {
      setPending(false);
    }
  }

  async function saveExample(message, rating, override = {}) {
    const draft = drafts[message.id] || {};
    const preferredResponse = override.preferredResponse ?? draft.preferredResponse;
    const notes = override.notes ?? draft.notes;
    const tags = override.tags ?? draft.tags;
    const gameMechanic = override.gameMechanic ?? draft.gameMechanic;

    if ((rating === "almost" || rating === "bad") && !preferredResponse?.trim()) {
      updateDraft(message.id, {
        rating,
        error: "ESCREVA COMO VOCE RESPONDERIA."
      });
      return;
    }

    updateDraft(message.id, { rating, error: "" });

    try {
      const response = await fetch("/api/training/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contextForMessage(message),
          rating,
          preferredResponse: preferredResponse?.trim() || null,
          notes: notes?.trim() || null,
          gameMechanic: gameMechanic?.trim() || null,
          tags: tagsFromText(tags || "")
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "SAVE FAILED");
      }

      setSnapshot(data.snapshot);
      updateDraft(message.id, { saved: true, rating });
    } catch (requestError) {
      updateDraft(message.id, { error: requestError.message });
    }
  }

  async function improve(message) {
    const draft = drafts[message.id] || {};
    updateDraft(message.id, { improving: true, error: "" });

    try {
      const response = await fetch("/api/training/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contextForMessage(message),
          rating: draft.rating || "almost",
          notes: draft.notes || ""
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "IMPROVE FAILED");
      }

      updateDraft(message.id, {
        alternatives: data.alternatives || [],
        improving: false
      });
    } catch (requestError) {
      updateDraft(message.id, {
        improving: false,
        error: requestError.message
      });
    }
  }

  async function chooseAlternative(message, alternative) {
    updateDraft(message.id, {
      preferredResponse: alternative,
      rating: "almost"
    });
    await saveExample(message, "almost", { preferredResponse: alternative });
  }

  async function addNote(event) {
    event.preventDefault();

    const content = styleNoteDraft.trim();
    if (!content) {
      return;
    }

    const response = await fetch("/api/training/style-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    const data = await response.json();

    if (response.ok) {
      setSnapshot(data.snapshot);
      setStyleNoteDraft("");
    }
  }

  async function updateNote(note) {
    const response = await fetch("/api/training/style-notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: note.id, content: editingNoteText })
    });
    const data = await response.json();

    if (response.ok) {
      setSnapshot(data.snapshot);
      setEditingNoteId(null);
      setEditingNoteText("");
    }
  }

  async function removeNote(note) {
    const response = await fetch("/api/training/style-notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: note.id })
    });
    const data = await response.json();

    if (response.ok) {
      setSnapshot(data.snapshot);
    }
  }

  const footer = (
    <form className={styles.form} onSubmit={submitMessage}>
      <span aria-hidden="true">&gt;</span>
      <input
        aria-label="Mensagem de treino"
        autoComplete="off"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={pending}
      />
      <span className={styles.status}>{pending ? "PROCESSING" : status}</span>
    </form>
  );

  return (
    <Terminal title="CAIXA PRETA / TREINO" footer={footer}>
      <div className={styles.training}>
        <section className={styles.main}>
          <div className={styles.meta}>
            <span>{status}</span>
            <span>TRAINING EXAMPLES: {snapshot.stats.total}</span>
            <span>GOOD: {snapshot.stats.perfect}</span>
            <span>ALMOST: {snapshot.stats.almost}</span>
            <span>BAD: {snapshot.stats.bad}</span>
            <label>
              MODE:
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="host">HOST</option>
                <option value="malas">MALAS</option>
              </select>
            </label>
          </div>

          <div className={styles.memoryBox}>
            <label htmlFor="training-memory">MEMORY CONTEXT</label>
            <textarea
              id="training-memory"
              placeholder="/memory de treino, uma por linha"
              value={memoryText}
              onChange={(event) => setMemoryText(event.target.value)}
            />
          </div>

          <div className={styles.conversation}>
            {messages.length === 0 ? <p className={styles.empty}>&gt; TRAINING BUFFER EMPTY</p> : null}
            {messages.map((message) => {
              const draft = drafts[message.id] || {};
              const isAssistant = message.role === "assistant";

              return (
                <article className={styles.message} key={message.id}>
                  <p className={isAssistant ? styles.machine : styles.user}>
                    <span>{isAssistant ? "CAIXA >" : "VOCE >"}</span>{" "}
                    {message.content}
                  </p>

                  {isAssistant ? (
                    <div className={styles.feedback}>
                      <div className={styles.feedbackButtons}>
                        <button type="button" onClick={() => saveExample(message, "perfect")}>
                          PERFEITO
                        </button>
                        <button type="button" onClick={() => updateDraft(message.id, { rating: "almost" })}>
                          QUASE
                        </button>
                        <button type="button" onClick={() => updateDraft(message.id, { rating: "bad" })}>
                          RUIM
                        </button>
                        <button type="button" onClick={() => improve(message)} disabled={draft.improving}>
                          {draft.improving ? "GERANDO" : "GERAR ALTERNATIVAS"}
                        </button>
                      </div>

                      <label>
                        NOTAS
                        <textarea
                          value={draft.notes || ""}
                          onChange={(event) => updateDraft(message.id, { notes: event.target.value })}
                          placeholder="mais sarcastico, menos pergunta, perfeito seco..."
                        />
                      </label>

                      <label>
                        TAGS
                        <input
                          value={draft.tags || ""}
                          onChange={(event) => updateDraft(message.id, { tags: event.target.value })}
                          placeholder={(snapshot.suggestedTags || []).slice(0, 6).join(", ")}
                        />
                      </label>

                      <label>
                        GAME MECHANIC
                        <input
                          value={draft.gameMechanic || ""}
                          onChange={(event) => updateDraft(message.id, { gameMechanic: event.target.value })}
                          placeholder={(snapshot.suggestedGameMechanics || []).slice(0, 4).join(", ")}
                        />
                      </label>

                      {draft.rating === "almost" || draft.rating === "bad" ? (
                        <div className={styles.correction}>
                          <label>
                            COMO VOCE RESPONDERIA?
                            <textarea
                              value={draft.preferredResponse || ""}
                              onChange={(event) => updateDraft(message.id, { preferredResponse: event.target.value })}
                              placeholder="escreva a resposta preferida"
                            />
                          </label>
                          <button type="button" onClick={() => saveExample(message, draft.rating)}>
                            SALVAR EXEMPLO
                          </button>
                        </div>
                      ) : null}

                      {draft.alternatives?.length ? (
                        <div className={styles.alternatives}>
                          {draft.alternatives.map((alternative, index) => (
                            <article key={`${message.id}-${index}`}>
                              <strong>ALTERNATIVA {index + 1}</strong>
                              <p>{alternative}</p>
                              <button type="button" onClick={() => chooseAlternative(message, alternative)}>
                                USAR
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : null}

                      {draft.saved ? <p className={styles.saved}>SAVED: {displayRating(draft.rating)}</p> : null}
                      {draft.error ? <p className={styles.error}>{draft.error}</p> : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {pending ? <p className={styles.machine}>CAIXA &gt; _</p> : null}
            {error ? <p className={styles.error}>ERROR: {error}</p> : null}
            <div ref={scrollRef} />
          </div>
        </section>

        <aside className={styles.notes}>
          <h2>STYLE NOTES</h2>
          <form className={styles.noteForm} onSubmit={addNote}>
            <textarea
              aria-label="Nova style note"
              value={styleNoteDraft}
              onChange={(event) => setStyleNoteDraft(event.target.value)}
              placeholder="menos menu, mais comentario, serve foi perfeito..."
            />
            <button type="submit">ADICIONAR</button>
          </form>

          <div className={styles.noteList}>
            {snapshot.styleNotes.length === 0 ? <p>NO STYLE NOTES</p> : null}
            {snapshot.styleNotes.map((note) => (
              <article className={styles.note} key={note.id}>
                {editingNoteId === note.id ? (
                  <>
                    <textarea
                      value={editingNoteText}
                      onChange={(event) => setEditingNoteText(event.target.value)}
                    />
                    <div className={styles.noteActions}>
                      <button type="button" onClick={() => updateNote(note)}>SALVAR</button>
                      <button type="button" onClick={() => setEditingNoteId(null)}>CANCELAR</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{note.content}</p>
                    <div className={styles.noteActions}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditingNoteText(note.content);
                        }}
                      >
                        EDITAR
                      </button>
                      <button type="button" onClick={() => removeNote(note)}>REMOVER</button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </aside>
      </div>
    </Terminal>
  );
}
