# Current state

Verified against the current worktree on 2026-09-14. Code wins if this snapshot drifts.

## Runtime and architecture

- Next.js App Router 15 with React 19 and server routes under `app/api/`.
- Local runtime is fixed to `http://localhost:3000` by `scripts/require-port-3000.js`.
- `lib/showState.js` owns the in-process show state: conversation, public message, Scene Zero, games, suitcases, projection windows, cues, glitch, audio, research, Instagram status, and performance events.
- Public screens receive state through `app/api/events/route.js`; `lib/publicRealtime.js` adds revision-based reconciliation through `app/api/state/route.js`.
- Public projection windows register through `app/api/projection/route.js`. Public routes are declared in `lib/projectionScreens.js`; private controller routes are declared in `lib/controllerSurfaces.js`.
- Prompt composition lives in `prompts/`; curated play knowledge lives in `knowledge/`; the OpenAI boundary is `lib/openai.js`.

## How to start

Install with `npm install`, configure `OPENAI_API_KEY` in `.env.local` for live model calls, then run `npm run dev`. See `docs/brain/OPERATIONS.md` for show startup and validation boundaries.

## Implemented

- Main public chatbot at `/` and private technical hub at `/operator`.
- Alternative `/videomapping` 2x2 presentation reuses the same `Chat`, `showState`, and realtime connection. Switching between `/` and `/videomapping` in a controlled projection window changes layout in place.
- Scene Zero controller at `/cena-0-controller` and equivalent videomapping controller at `/videomapping-controller`. Its right-side index is operational: BOOT, ESCUTA DE DECIBÉIS, ESQUENTAR PÚBLICO, ESCOLHER PARTICIPANTE, and JOGO DAS MALAS can be re-entered from the menu. Returning to ESCUTA DE DECIBÉIS keeps the completed BIOS at 100%, resets later verification progress, and immediately reopens microphone listening. Returning from the suitcases interrupts their active game, timers, browser routine, glitch, and final blackout before restoring the selected earlier stage.
- Before the required play-dead prompt, the human-verification introduction is spoken through the normal main chatbot text path. With no authored verification title, its progress bar is a compact top HUD instead of a full-screen cover; the principal layout reserves vertical space for that HUD, while videomapping retains its separate status quadrant.
- In the Scene Zero controller, `←` returns one operational stage: within BIOS it rewinds one boot step and pauses autoplay; from sound check it returns to BOOT, from warmup to sound check, from participant selection to warmup, and from suitcases to participant selection. At the first BIOS step it returns to BOOT standby. It does not replay or erase a previously published question; the established stage-return actions handle timer and game cancellation.
- During the Scene Zero question round, `↑` records the same contextual `MUITOS` response as the lateral button, and `↓` records `POUCOS`. Both shortcuts are inactive outside an active question and while typing in editable fields.
- `Space` ends the stalled BIOS or question round, draws the game once its briefing reaches `ready_for_draw`, and ends an active minigame. The first press after questions opens the authored briefing; another press when the draw button is enabled starts the draw. `→` follows the available continuation: it starts the draw, reveals it in manual mode, starts a ready minigame timer (including Tapão's second round), or resumes a paused timer. Pausing clears the obsolete timer-expiry transition. These shortcuts leave other stages and form fields alone.
- After the minigame completion dialogue finishes, `→` enters participant selection through the same `set-stage` action as the stage index. It waits until the roulette and both post-selection lines are complete before another `→` enters the suitcase game and announces its first choice. The shortcut does not interrupt those handoffs.
- In the suitcase game, the explanation uses the green chatbot typewriter and signals completion. In manual mode the first choice waits for `→` (or its click fallback) after that signal; in automatic mode it waits another 2.5 seconds before beginning the suitcase draw. A conservative fallback handles missing typing acknowledgements, and stale choice timers are guarded by message ID and choice status.
- Within the suitcase game, manual mode pauses twice after each draw: the selected number holds until `→` displays `ABRA A MALA`, then another `→` starts that suitcase's content (Mala 2 instruction, Mala 3 hangman instruction, or Mala 1 tutorial ending). Automatic mode retains the timed reveal and start. Afterward, `→` starts the prepared Mala 2 challenge timer if still idle; on a suitcase whose activity has begun, it requests the next suitcase using the existing `suitcase-next` handoff. It does nothing during a choice announcement or before Mala 3's automatic hangman instruction/start finishes, and does not skip beyond the last suitcase.
- Scene Zero boot/BIOS, sound check measured in the controller, human-verification warmup, 100 authored prompts, manual override, one selected warmup mini game, participant selection, and suitcase flow. The right arrow is the primary forward control: from standby it starts `BOOT`, while booting it advances one BIOS step, at the intentional 78% stall it executes `ENCERRAR BIOS`, after the BIOS it consumes the current pending transition in either operating mode, and during the question round it runs the reaction-plus-draw flow with intensity `4 · PROVOCATIVE` by default. `ENCERRAR BIOS` also remains visible directly below the main `BOOT` controls as a click fallback; it fills the BIOS to 100% before starting the sound check and is not part of the collapsed warmup panel. The required 20-second play-dead action ends with `OBEDIENTES... ÓTIMO.` and opens the first randomly selected intensity-4 provocation; in manual mode, `→` also completes that timed action and schedules the provocation after the acknowledgement. For every later question, the operator records a contextual `MUITOS` or `POUCOS` result, with `POUCOS` below `MUITOS`; `SORTEAR` stays clickable and shows an explicit instruction when that response is still missing, while the backend preserves the guard and only then publishes a non-repeated authored reaction through the normal green chatbot typewriter before selecting and firing the next prompt. Finishing the questions and finishing or skipping the minigame use the same green chatbot path, and minigames start directly on their real timer without a preliminary three-second timer. Default durations are 10 seconds per Tapão round and 25 seconds for Piscada and Serinho. The shared fixed timer projects only its number.
- Current Scene Zero suitcase order is 2 -> 3 -> 1: physical challenge, timed hangman/flight state, then tutorial-ending Morel BIOS/glitch sequence. Participant selection displays an animated `/pensando...` while its generated sequence is prepared, then generates a named call to the center of the stage followed by the three-suitcase explanation. Each suitcase uses a five-second audible draw/reveal ending in `ABRA A MALA`; physical and hangman panels occupy the auxiliary view only while their timers are active, so result comments return to the green chatbot immediately. The object challenge always ends by telling the participant to leave the collected objects inside the suitcase for the chatbot's later brechó. The hangman exposes its word theme without exposing the answer and has a low procedural motif while active. The final BIOS glitch uses the full public frame, including all videomapping quadrants, and ends in global blackout.
- The controller header intentionally exposes only Principal, Videomapping, Sound Control, Operator, Glitch, and Treino. `/sound-control` owns the shared procedural sound controls and the Scene Zero microphone-sensitivity adjustment without navigating the public projection. The Scene Zero controller is also an audio relay sink and its fixed lateral index has a `CHAMAR ATENÇÃO` cue, so that operating path does not depend on keeping Sound Control open. Other controller routes remain registered and reachable from their direct operating paths; the former global blackout tab bar is not rendered.
- Scene 1 Queda Aviao public/controller pair with live text transport, sampler, per-sample effects, global volume, and blackout.
- Unified Scene 2A Forca G public/controller pair for media, audio voices, G-LOC, text, shaders, presets, and stop controls. Legacy shader routes redirect to it.
- Baralho Morbido public/controller pair with its own bounded media/timeline state.
- Generic editable cue controllers and public cue stages for Transicao Psicodelica, Tea For Two, Piloto Videogame, and Tecnologia x Floresta.
- Global glitch, display blackout, robot sound with shared pitch/typing controls and `ROBÔ ATUAL` / default `WINDOWS 95 / 8-BIT` PC-speaker style (including Scene Zero BIOS, draw, minigame, and hangman cues), scene-specific private notes, training UI, game director, performance overlays, and manual Instagram browser controls. Public typewriter timing defaults to 60 ms per character and remains operator-adjustable.
- Public and private concerns are separate: controller notes and controls are not projected or sent to the model.

## Partially implemented or content-dependent

- Transicao Psicodelica, Tea For Two, and Piloto Videogame public routes intentionally start black and show/play only configured cues. Their controller mechanics exist; completeness depends on authored cues and media.
- Tecnologia x Floresta has a dedicated dark public display and editable audio controller, but the code describes it as a layer rather than a finished visual scene.
- Several editable cue defaults have empty asset paths. The controls exist, but an empty pad is not a completed show cue.
- Live OpenAI research, model responses, browser Instagram interaction, microphone behavior, autoplay, and physical audio depend on local credentials, browser permissions, current session state, and hardware. Static checks do not prove them.

## Disabled by default or constrained

- Autonomous Instagram navigation is hard-disabled in `lib/research/ResearchDirector.js`; external navigation requires explicit operator action and is guarded by `lib/externalNavigationGuard.js`.
- Performative research is off unless `CAIXA_PRETA_PERFORMATIVE_RESEARCH` is explicitly true.
- Old `/forca-g-shaders` routes are compatibility redirects, not a separate active scene system.
- No versioned CI or deployment workflow is present. There is no repository-backed production deployment procedure to claim as implemented.

## Known operational constraints

- State is process-local. Restarting Next creates a new show session; `/reset` clears the current show session.
- The global singleton is version-gated by `STORE_VERSION` in `lib/showState.js`; stale dev processes can retain old state/code combinations.
- Browser media and microphone paths require real browser interaction and permissions; physical output needs a separate sound check.
- Browser checks require the expected local server and deliberate waits for SSE/timer convergence.
- The repository contains archived `bot-old/`; it is not the current implementation.

## Active worktree context

The current branch is `feature-verificacao-humana-bios`. At this snapshot, Scene Zero unlock/BIOS, warmup, public projection, and videomapping files have uncommitted changes. Inspect `git status` and the relevant diff before editing those domains; do not overwrite unrelated work. Treat this paragraph as transient and replace it when that work lands or is abandoned.
