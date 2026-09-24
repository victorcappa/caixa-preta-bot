# Proven learnings

Each entry records a reproduced problem, its cause, the working response, and a regression guard.

## Participant name screen must finish before the chatbot resumes

- Problem: after the roulette selected a participant, the name overlay stayed up while the center-stage and suitcase instructions were already advancing inside it without the chatbot typewriter.
- Cause: the `selected` state both owned the full overlay and scheduled every post-selection message by mutating the overlay's `lastComment`.
- Working response: make `selected` a dedicated name hold, close it after five seconds in automatic mode or `→`/click in manual mode, then enter a separate `post_selection` state and publish the two instructions through the normal chatbot message path.
- Prevent regression: the selected overlay renders only the participant name; do not publish post-selection messages until it has closed, and do not permit the next-stage shortcut until both typed lines finish.

## Audience agreements belong before the first warmup challenge

- Problem: the attention/timer/success/failure agreements appeared only when the suitcase game began, after the audience had already received the required play-dead challenge.
- Cause: the agreements were attached to the first suitcase selection instead of the existing human-verification handoff.
- Working response: publish them through the audience warmup system sequence after the questions introduction, use source/effect metadata to trigger the existing attention, countdown, error, and success presentation, then stop on an operator-only `START`/`GAME OVER` choice. The chosen authored sarcastic response uses the normal chatbot path and force-arms `questions-start` only after its reading delay, so manual mode cannot strand or skip it.
- Prevent regression: verify the authored order in both automatic and manual modes, lock the real five-second timer demo until it finishes, expose the choice buttons only after `Podemos começar?` finishes typing, hold the selected choice long enough to animate on both public and operator screens, require the selected sarcastic comment before `play-dead-30`, and never generate the suitcase explanation during participant selection.

## Suitcase explanation must finish before its draw

- Problem: the suitcase draw replaced the robot's green explanation before the audience could read it.
- Cause: `scene-zero-suitcase-choice` lacked a typewriter-completion acknowledgement, and a server timeout estimated the speaking duration then immediately activated the suitcase.
- Working response: have `Chat` acknowledge exact message IDs. At the first suitcase, publish the authored rules and Ricardinho cue as separate green messages; manual mode uses `briefing → briefing_ready → briefing` before `ready`, while automatic mode applies reading holds. Keep the legacy director active without queuing its `ESCOLHA UMA MALA` overlay.
- Prevent regression: ensure participant selection publishes only the center-stage call, test both briefing screens and their manual gate, then validate `ready → starting` without duplicate activation.

## Manual suitcase reveal needs two operator gates

- Problem: the suitcase number, `ABRA A MALA`, and the next activity ran together even when the operator selected manual mode.
- Cause: the projection and activity start were both derived from elapsed time after `suitcase-select`.
- Working response: retain the automatic timed path, but in manual mode hold the selected number, require `→` for `ABRA A MALA`, and require another `→` before starting the suitcase content. Tie each action to the current selection sequence so a stale timer or click cannot advance a later suitcase.
- Prevent regression: check the `drawing → selected → open → complete` cue phases and verify that the challenge, hangman, and tutorial wait until `complete`.

## Suitcase instructions must finish before dependent mechanics

- Problem: adding an authored line immediately before a timer or final sequence can let the next action replace the green typewriter before the participant reads it.
- Cause: a newly published assistant message does not itself gate Scene Zero state, and another public message interrupts the active typewriter.
- Working response: track the active suitcase briefing/content message ID in `showState`, acknowledge it from `Chat`, and only then prepare the draw, enable the first timer, or start the final tutorial-ending sequence. Keep a guarded fallback for a missing browser acknowledgement.
- Prevent regression: manual operator instructions may publish a normal bot message but must not mutate game state; disable them while a critical automatic suitcase instruction is active so they cannot interrupt that gate.

## Mala 2 is one fixed 15-second key challenge

- Problem: selectable audience-object tasks contradicted the physical contents of Mala 2 and let the operator extend or automatically retry a challenge announced as only 15 seconds.
- Cause: Mala 2 reused the generic gincana bank, object-target UI, `+ 5 SEGUNDOS`, and the same retry mechanism as the hangman.
- Working response: keep the existing shared gincana timer/state but reduce its authored bank to balloons/key, gate it behind a wait-for-`VALENDO!` instruction, and publish `VALENDO!` plus the game-start sound on timer start. Keep `assets/audios/uba-hey.mp3` behind explicit controller play/stop actions in shared state; a timeout uses the stored `tempo esgotado` observation to fire a dedicated procedural whistle.
- Prevent regression: assert there is no audience-object copy, selectable challenge, added-time control, automatic Mala 2 retry, or automatic music start. Its timer must start at 15 seconds; only `TOCAR UBA UBA HEY` starts the track, while manual stop, pause, terminal result, unmount, or departure stop and rewind it. Timer resume/restart must leave the music stopped, and only timeout whistles.

## Hangman retries start after the failure line, not at timer expiry

- Problem: immediately restarting a failed hangman timer makes the 10-second chance run underneath the red error message, and revealing the lost word makes the retry meaningless.
- Cause: game completion, public result presentation, and the next timer were previously treated as one synchronous transition.
- Working response: publish an authored sarcastic failure through the normal chatbot with the existing red visual/error sound, retain its message ID in shared `showState`, and start a fresh 10-second timer only after `Chat` acknowledges that typewriter. Preserve correct hangman progress while clearing its error count, and never expose the secret during a retry.
- Prevent regression: browser-test hangman failure, including red presentation, hidden challenge panel while announcing, exact 10-second resumed timer, and a later green success. Guard the acknowledgement by retry status and message ID so stale callbacks cannot restart a completed or different game.

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

## Reels comments need a feed fallback and a usable publish control

- Problem: the robot speaks in the chatbot but does not comment on Reels.
- Cause: the Reels feed may omit a permalink or video source, so posting was skipped before opening comments; a global first `Post` selector can also point to a disabled button.
- Working response: identify the visible Reel or comment control, use the feed position as a fallback key, open its comments, select a visible field and an enabled publish control near it, and expose the last send result in Instagram state.
- Prevent regression: test a Reel without a permalink/source and a disabled first publish button; a local mock does not prove that a real Instagram comment was accepted.

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
