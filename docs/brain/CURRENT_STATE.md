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
- Scene Zero controller at `/cena-0-controller` and equivalent videomapping controller at `/videomapping-controller`.
- Scene Zero boot/BIOS, sound check measured in the controller, human-verification warmup, 100 authored prompts, manual override, one selected warmup mini game, participant selection, and suitcase flow. The required 30-second play-dead action ends with `OBEDIENTES... ÓTIMO.` and automatically opens the first randomly selected intensity-4 provocation.
- Current Scene Zero suitcase order is 2 -> 3 -> 1: physical challenge, timed hangman/flight state, then tutorial-ending Morel BIOS/glitch sequence.
- Scene 1 Queda Aviao public/controller pair with live text transport, sampler, per-sample effects, global volume, and blackout.
- Unified Scene 2A Forca G public/controller pair for media, audio voices, G-LOC, text, shaders, presets, and stop controls. Legacy shader routes redirect to it.
- Baralho Morbido public/controller pair with its own bounded media/timeline state.
- Generic editable cue controllers and public cue stages for Transicao Psicodelica, Tea For Two, Piloto Videogame, and Tecnologia x Floresta.
- Global glitch, display blackout, robot sound, scene-specific private notes, training UI, game director, performance overlays, and manual Instagram browser controls.
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
