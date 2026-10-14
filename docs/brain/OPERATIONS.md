# Operations

Commands are documented here, not executed automatically. Effects and validation boundaries are explicit.

## Install and configuration

Requirements: Node.js 20 or newer and npm.

```bash
npm install
```

Effect: writes dependencies under `node_modules/` and may access the package registry.

For live model calls, create `.env.local` with `OPENAI_API_KEY=<your-key>`. `OPENAI_MODEL` is optional. Never commit or paste values into the brain. `docs/brain/INVENTORY.md` lists environment variable names only.

## Development and build

```bash
npm run dev
```

Effect: starts a local Next development server on port 3000 and writes `.next/`. It fails if that port is occupied.

```bash
npm run lint
npm run build
npm start
```

`build` writes production artifacts to `.next/`; `start` serves them on port 3000. Stop `dev` before `build` or `start`.

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

Targeted logical and browser commands are listed in the generated inventory. Run the narrowest relevant logical test first. Browser tests generally require `npm run dev` already running on port 3000 and prove Chromium behavior only where their assertions reach. They do not prove Safari, physical audio, live OpenAI, Instagram, or deployment.

## Start a local presentation

1. Before audience entry, run `npm run show:prepare`; then start the production runtime with `npm run show`.
2. Open `http://localhost:3000/operator` as the private hub.
3. In `ABRIR NOVA JANELA COM`, open the desired public route from the operator so the projection window receives an ID and registers.
4. Move that public window to the extended display/projector and enter fullscreen manually.
5. Use `MUDAR PARA TELA` or the scene-controller tabs only after the projection status reports a connected window.
6. For Scene Zero, open `/cena-0-controller` (or `/videomapping-controller`), confirm microphone permission/status, then use `BOOT` and the visible operator sequence.
7. Before audience entry, verify text, blackout/recovery, global volume, media playback, selected audio output, microphone level, and STOP ALL on the actual browser/hardware path.

If Operator reports an interrupted session, inspect scene, step, and snapshot time. Choose `RETOMAR APRESENTAÇÃO` to restore it paused and with transient media/external browser state stopped, or `INICIAR NOVA APRESENTAÇÃO` to discard that recovery path deliberately. Nothing restores automatically.

`MODO EMERGÊNCIA` is available at the top of Operator. Activating it cancels and blocks external requests, pauses automatic/timed activity, preserves snapshots, and keeps local/manual controls available. Deactivating it permits future external requests but deliberately leaves the show in manual control.

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

If generated Next artifacts are demonstrably stale, stop the server first and then remove only `.next/`. This deletes rebuildable cache/output and should not be done merely because it is documented here.

## Persistence, health, and writes

- Recovery snapshots are written asynchronously and atomically to `.runtime/show/current.json`; checksum/schema/store-version failures are rejected. The live singleton remains authoritative.
- `GET /api/health` reports `core` app/storage/emergency state separately from optional internet/OpenAI/request state. Optional failure does not make the core unhealthy.
- `data/scene-notes.json`, `data/controller-cues.json`, and `data/forca-g-sampler-settings.json` are local persisted operator data and can be changed by their UIs.
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
- `npm run test:public-realtime:browser` checks projection/controller convergence with normal SSE and with public SSE blocked.

Audit artifacts default to `artifacts/bot-audit-2026-10-14`; reusable audit scripts accept `CAIXA_PRETA_AUDIT_OUTPUT`. Results and remaining acceptance limits are in `BOT_TEST_REPORT.md`. Asynchronous browser predicates must use `scripts/browser-test-utils.js`, not async `waitForFunction`.

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
