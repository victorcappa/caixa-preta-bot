# Operations

Commands are documented here, not executed automatically. Effects and validation boundaries are explicit.

## Install and configuration

Requirements: Node.js 20 or newer and npm.

```bash
npm install
```

Effect: writes dependencies under `node_modules/` and may access the package registry.

For live model calls, create `.env.local` with `OPENAI_API_KEY=<your-key>`. `OPENAI_MODEL` is optional. Never commit or paste values into the brain. `docs/brain/INVENTORY.md` lists environment variable names only.

Bot models are `gpt-5.6-terra` (default) and `gpt-5.6-luna`. `lib/openaiModels.js` migrates retired mini/nano aliases, environment overrides and saved choices by tier. Responses requests previously using `minimal` now use supported `low` effort. Check migration/recovery with `npm run test:operator-preferences`. These replacements have higher per-token prices than the retired models. See the [official deprecations](https://developers.openai.com/api/docs/deprecations) and [model pricing](https://developers.openai.com/api/docs/pricing).

## Development and build

```bash
npm run dev
```

Effect: starts a local Next development server on port 3000 and writes `.next-dev/`. It fails if that port is occupied. Development output is separate from the production build in `.next/`.

```bash
npm run lint
npm run build
npm start
```

`build` writes production artifacts to `.next/`; `start` serves them on port 3000. `build` and `show:prepare` refuse to run while port 3000 is occupied, before touching the build. Preserve the current recovery snapshot and stop the identified server before rebuilding; never run `next build` directly in a checkout serving a presentation. Browser audits that need their own build must use an isolated source copy, as `scripts/operator-public-audit-utils.js` does.

For the presentation, build before the room opens and use the production launcher:

```bash
npm run show:prepare
npm run show
```

`show:prepare` creates the production build. `show` never builds or starts a development server: it requires an existing `.next/BUILD_ID`, verifies writable snapshot storage and a free port 3000, starts `next start`, and waits for the local core health check. It never kills a process occupying the port. Stop it with `Ctrl-C` or a targeted `SIGTERM`.

## Cheap checks

```bash
npm run brain:sync
npm run brain:check
npm run brain:summary
npm run lint
```

`brain:sync` rewrites only the generated region of `docs/brain/INVENTORY.md`. `brain:check` performs existence, size, path-reference, generated-header, and obvious-secret checks; it is not an application test.

Targeted checks: generated inventory. Check each script's server/fixture requirements. Browser assertions prove Chromium behavior, not Safari, physical audio, live APIs or deployment.

Post-demo cloud: run `npm run point-cloud:prepare` before the show; private button, photos and offline tests: `docs/POST_DEMO_POINT_CLOUD.md`.

`test:audience-warmup:transition` checks play-dead → first question and timer/typing gates, manual/automatic, with isolated fake time (Node 22.15+/24; no model/live-show writes).

Weekly news refresh/cache and offline checks: `docs/AQUECIMENTO_ATUALIDADES.md`.

## Start a local presentation

1. Before audience entry, run `npm run show:prepare`; then start the production runtime with `npm run show`.
2. Use `/operator` only for bot parameters. For projection windows, emergency/recovery and technical commands, open Principal `/` and its **OP** drawer.
3. In `ABRIR NOVA JANELA COM`, open the desired public route from the operator so the projection window receives an ID and registers.
4. Move that public window to the extended display/projector and enter fullscreen manually.
5. Use `MUDAR PARA TELA` or the scene-controller tabs only after the projection status reports a connected window.
6. Open `/cena-0-controller` (or `/videomapping-controller`), confirm microphone access and use `BOOT`. Keep the controller open: its audio clock detects sound while hidden. The public page never requests the microphone.
7. Before audience entry, verify text, blackout/recovery, global volume, media playback, selected audio output, microphone level, and STOP ALL on the actual browser/hardware path.

Timer with time left: `Shift + →` advances where allowed; at zero, `→` suffices. Challenge guards remain. Otherwise `→` advances, `Shift + →` returns. `←` ignored. Malas: 2 → 1 → 3.

If the technical OP terminal reports an interrupted session, inspect scene, step, and snapshot time. Choose `RETOMAR APRESENTAÇÃO` to restore it paused and with transient media/external browser state stopped, or `INICIAR NOVA APRESENTAÇÃO` to discard that recovery path deliberately. Nothing restores automatically.
Before restart, preserve the old recovery file, then POST `/api/show-session` with `action: "capture-current"` and the current `sessionId`. This explicitly captures live state even when an older file is guarded. Verify disk/session/revision equality; shut down only after success.

`MODO EMERGÊNCIA` is available at the top of the technical OP terminal in Principal. Activating it cancels and blocks external requests, pauses automatic/timed activity, preserves snapshots, and keeps local/manual controls available. Deactivating it permits future external requests but deliberately leaves the show in manual control.

Direct public routes and all controller routes are listed in `docs/brain/INVENTORY.md`. The canonical registries are `lib/projectionScreens.js` and `lib/controllerSurfaces.js`.

## Reset and stop controls

- `REINICIAR` beside Scene Zero BOOT performs the application reset path.
- `/reset` in the operator stops active routines and clears the in-memory show session.
- `/stopall` stops active performance routines/media without being a deployment or process shutdown.
- Scene-specific reset/stop buttons affect only their documented domain.

Effect: reset operations change live show state and can interrupt public output. Use them only with operator intent. After a full reset, confirm that the intended projection window is still registered; reopen it from the operator if necessary.

## End a local server safely

Identify the exact listener:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Inspect the command/PID. Then request graceful termination of only that PID:

```bash
kill -TERM <confirmed-pid>
```

Effect: terminates a local process. Repeat the `lsof` command; no listener means the port is free. Never use broad `pkill node`/`killall` for this repository.

If generated Next artifacts are demonstrably stale, stop the server first and then remove only the affected output directory (`.next-dev/` for development or `.next/` for production). These are rebuildable artifacts; do not clear them while their server is running.

## Persistence, health, and writes

- Operator choices save atomically to `.runtime/show/operator-preferences.json` (or the configured runtime directory), independently of recovery. New sessions, BIOS/Tarot reset and restart keep tuning; recovery also retains the latest choices. Scope, capture/activation and checks: `docs/PREFERENCIAS_OPERADOR.md`.
- Recovery snapshots are written asynchronously and atomically to `.runtime/show/current.json`; checksum/schema/store-version failures are rejected. The live singleton remains authoritative.
- `show-reliability-v43` rejects earlier snapshots because suitcase IDs 1 and 3 changed. Files remain on disk; start a new presentation. Operator preferences are independent.
- `GET /api/health` reports `core` app/storage/emergency state separately from optional internet/OpenAI/request state. Optional failure does not make the core unhealthy.
- `data/scene-notes.json`, `data/controller-cues.json`, and `data/forca-g-sampler-settings.json` are local persisted operator data and can be changed by their UIs.
- Scene Zero and general game draws use only valid names from the `publico` group in `data/publico.json`. Only when that list is empty do they draw from `equipe`; session-memory names never enter the pool. The rule also applies after reset/recovery and to the legacy `all`/`audience-only` values retained by POST `/api/show-session` (`participant-selection-scope`). An in-progress draw keeps its prepared candidates. Check with `node --no-warnings scripts/participant-pool-test.js` and `npm run test:games`; both use isolated participant fixtures.
- Controller uploads create and write beneath assets/controller-cues/ on first use.
- Instagram uses a local browser profile under `.runtime/`; never inspect or publish it casually.

Targeted reliability checks:

```bash
npm run test:show-reliability
npm run test:show-reliability:scenario
```

The scenario check owns port 3000 temporarily, refuses to run when it is occupied, uses isolated temporary snapshot storage, and exercises restart/resume, offline fallback, public error containment, new-session discard, and Emergency Mode. Do not run it during a live or rehearsing session.

Audit checks (never run against a live show):

- `npm run test:openai:failures` owns port 3000 and temporary snapshots; intercepts OpenAI in its child process using a fake key. Tests 401/429/500, connection loss, timeout, empty/invalid output and recovery without calling the real provider.
- `npm run test:openai:live` makes one real generation on a dedicated server with the configured key; resets the temporary session and checks operator context. It has a real provider cost and must never target the active show.
- `npm run test:instagram:readonly` uses a disposable copy of the local browser profile, permits GET/HEAD and named GraphQL Queries, blocks writes and login, and reports only status/counts. It requires network access and never validates posting.
- `npm run test:scene-zero:e2e` requires a dedicated local server, resets its session and follows BOOT → synthetic sound check → agreements → questions → minigame → participant → malas → final blackout. It also checks scoped routes and audio asset ranges; Baralho/videos are excluded. It does not prove physical microphone/audio or the entire later dramaturgy.
- `test:public-realtime:browser`: isolated build/runtime; SSE, polling, offline/reload and multiple bot/control windows. `test:public-realtime:multiwindow`: HTTP/1.1 fixture, closed/frozen windows, free command sockets. No live state/model calls.

Audit artifacts: `artifacts/bot-audit-2026-10-14`, override `CAIXA_PRETA_AUDIT_OUTPUT`. Limits: `BOT_TEST_REPORT.md`. Async browser predicates require `scripts/browser-test-utils.js`, never async `waitForFunction`.

These checks were validated with the reliability layer now versioned in this checkout, including its launcher, health and recovery files. The dated audit evidence is versioned under `artifacts/`; runtime snapshots and browser profiles remain local.

## Deployment

No deployment script, CI workflow, hosting manifest, or confirmed production procedure is versioned in the current repository. `npm run build` validates a production build locally; it does not deploy. Any deployment would have external effects and requires an explicit target, credentials, authorization, and post-deploy verification.

## Update the brain

After a material architecture, workflow, command, route, or current-state change:

1. Edit only the affected editorial brain file.
2. Replace stale current facts; move only useful superseded facts to `docs/brain/ARCHIVE.md`.
3. Run `npm run brain:sync`.
4. Run `npm run brain:check`.

Brain maintenance never authorizes commit, push, merge, deploy, data deletion, infrastructure changes, or external messages.

## Operator Público

Scene Zero’s REVELAR OPERATOR opens public conversation; ABRIR CONVERSA opens private controls. `/operator` has parameters. CONECTAR PROJEÇÃO AO VIVO gives a muted monitor. Operation: `OPERATOR_PUBLICO.md`. Live training: `docs/TREINO_AO_VIVO.md`.

For projection calibration, open `/?menu` in a separate control tab and keep the actual projection window without `?menu`. The menu tab does not register as the active projection. Choose **PERFIL TECIDO** to try larger bold white text without glow, or **VISUAL ORIGINAL** to disable the profile. Adjust typeface, weight, general scale, line spacing and per-module text scale; select a public module to move/resize it numerically or in the schematic preview. **RESTAURAR COMPONENTE** clears its geometry and text scale. Changes sync to connected public windows and persist in operator preferences; a failed save offers retry. Alt+M toggles the menu and Esc closes it. These adjustments do not change the projector's physical resolution; check clipping and readability on the actual projector and fabric, particularly after enlarging long text. Other canvas-rendered graphics keep their own rendering settings.

The fabric profile reserves more space for the Tarot reading and fits complete Tarot and bot text in their areas, reducing the configured font as far as 24 px when needed. Disable **Encaixar texto do bot e Tarô na área** to retain the chosen size and original overflow behavior. If 24 px is still too large, enlarge the affected module or shorten the text; check on the actual projection.

`npm run test:operator-public` is local. `npm run test:operator-public:browser` builds an isolated temporary copy and uses port 3311 without resetting port 3000. `npm run test:operator-public:live` makes two real OpenAI calls on isolated port 3312 and sends character/context data; use only with explicit authorization.

`npm run test:audience-microphone` checks meter RMS, silent output and timer cleanup. `npm run test:audience-microphone:background` builds an isolated copy on port 3313, runs the existing sound-check scenario, then tests a hidden Operator tab and an unfocused Operator window in native Chromium without focus emulation with synthetic audio and paint callbacks disabled. It does not use the physical mic or reset port 3000. Closing/discarding the capture tab, OS sleep or permission revocation still stops capture; physical-browser/hardware rehearsal remains required. See [MDN AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process) and [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

## Bot parameters

The adjacent **modelo-3D** tab (`/modelo-3d`) owns private image uploads, TRELLIS generation and local black-background turntable MP4s. Configuration, per-generation cost authorization, recovery, checks and the unresolved live-provider acceptance boundary: `docs/MODELO_3D.md`.

`/operator` exposes only typing speed (5–60 characters/s), punctuation pause (0–2 s), minimum gap between lines (0–10 s), font, typing click frequency, the four personality sliders and model selection. Conversation, preview, games, projection controls and diagnostics stay out of this tab. The right-menu launcher still opens the public conversation.

Punctuation pause and minimum gap default to zero, preserving the existing pacing until adjusted. `lib/robot-sound/state.js` defines the shared timing calculations; `components/Chat.js` applies them to the public line, and server reading estimates include the pauses before automatic continuation. Authored scene holds can be longer than the configured minimum gap. The simultaneous glitch/collapse composition retains its concurrent lines. The LIVE Operator receives genuine streaming deltas and reveals new replies at the configured typing speed/punctuation pause, including text buffered after the stream ends. Private speed changes apply while it types. Completed history is restored immediately on reload; cancelled replies stop typing.

Parameter saves retain unsaved fields during SSE updates, reject missing/mismatched acknowledgements, and ignore older server sequences. A visible error offers retry without resetting the handle. Development hot reload refreshes sound normalization on the existing `showState` object, preserving listeners, scene and history. A process started before `_refreshRobotSoundSettings` existed needs one restart; preserve its recovery snapshot and explicitly resume the interrupted presentation. Verify with `node --no-warnings scripts/robot-sound-hot-refresh-test.js` (Node 22.15+/24) and the continuous-drag cases in `test:operator-public:browser`.
