# Proven learnings

Each entry records a reproduced problem, its cause, the working response, and a regression guard.

## Port 3000 must belong to the intended checkout

- Problem: local startup fails or tests hit stale code.
- Cause: another Next/Node listener already owns port 3000; the project intentionally refuses an alternate port.
- Working response: run `lsof -nP -iTCP:3000 -sTCP:LISTEN`, inspect the PID/command, terminate only that confirmed listener, and verify the port again.
- Prevent regression: keep `scripts/require-port-3000.js` in both `dev` and `start`; never kill Node processes broadly.

## Dev and build must not share `.next` concurrently

- Problem: the dev server can report missing or inconsistent manifests/chunks.
- Cause: `next dev` and `next build` write different artifacts into the same `.next` directory.
- Working response: stop the dev server before building. If stale generated chunks remain, remove only `.next` while no Next process is running, then restart.
- Prevent regression: serialize browser checks/dev and production builds in local workflows.

## A long-lived singleton can preserve stale state during development

- Problem: edited initial state or new store methods do not appear in the running app.
- Cause: `lib/showState.js` deliberately reuses a `globalThis` singleton when `STORE_VERSION` and method guards match.
- Working response: restart the server; when the persisted in-process shape intentionally changes, update `STORE_VERSION` and verify reset behavior.
- Prevent regression: do not infer current runtime state from source inspection alone after hot reload.

## SSE needs revision reconciliation

- Problem: a public screen can miss an update during connection loss or the initial subscription window.
- Cause: delivery timing between listener registration, initial snapshot, and a transient EventSource interruption.
- Working response: subscribe before the initial snapshot server-side; share one public EventSource and probe the lightweight revision endpoint, fetching a full snapshot only when behind.
- Prevent regression: preserve revision ordering in `lib/publicRealtime.js` and run `scripts/public-realtime-browser-test.js` after sync changes.

## Projection navigation requires a registered live window

- Problem: controller navigation returns `PROJECTION WINDOW UNKNOWN` or targets a closed tab.
- Cause: navigation was attempted before registration/heartbeat or against a stale window ID.
- Working response: let `components/ProjectionWindowClient.js` register first and choose a connected window from projection state.
- Prevent regression: add public screens to `lib/projectionScreens.js`, keep the client mounted, and await registration in browser checks before navigation.

## Principal/videomapping navigation must not reload shared presentation

- Problem: returning between the two Scene Zero public views resets typing, media, or animation.
- Cause: full browser navigation remounts `Chat`.
- Working response: use `history.replaceState` plus `PUBLIC_LAYOUT_CHANGE_EVENT` for those two registered layouts.
- Prevent regression: keep both pages on the same `Chat` implementation and test both navigation directions.

## Browser audio and microphone are distinct from code correctness

- Problem: media is logically active but silent, or the sound meter remains inactive.
- Cause: autoplay policy, user-gesture requirements, permission state, selected output, or physical routing.
- Working response: unlock the public window with an interaction, grant microphone permission in the Scene Zero controller, and perform a physical sound check.
- Prevent regression: report static/browser/physical-audio outcomes separately; do not make the public projection request microphone access.

## Baralho Morbido should not congest the global public stream

- Problem: a high-frequency deck display path can interfere with the main Operator/Chat stream.
- Cause: mixing its specialized media refresh needs into every global SSE consumer.
- Working response: keep its bounded polling/state path and filter Baralho events in `app/api/events/route.js`.
- Prevent regression: do not migrate it to the shared stream without measuring the full multi-screen behavior.

## Scene notes must stay keyed and private

- Problem: a note can appear under the wrong scene or leak toward public/model state.
- Cause: using one shared client draft or placing notes in the general show snapshot.
- Working response: persist by stable scene key through `app/api/scene-notes/route.js` and render only inside `components/ControllerSurface.js`.
- Prevent regression: test entering a note, switching scenes, and returning; never add notes to public events or prompt construction.
