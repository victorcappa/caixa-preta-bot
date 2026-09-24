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
- Working response: publish them through the audience warmup system sequence after the questions introduction, use source/effect metadata to trigger the existing attention, countdown, error, and success presentation, then stop on an operator-only `START`/`GAME OVER` choice. The selected animation, authored sarcastic response, and `questions-start` are separate pending transitions in manual mode; automatic mode consumes them after their reading delays.
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
- Working response: track the active suitcase briefing/content message ID in `showState` and acknowledge it from `Chat`. Multi-line content uses an explicit `ready` state between lines in manual mode; automatic mode waits two seconds after acknowledgement. The final turntable instruction still waits for an explicit operator arrow/button before the tutorial-ending sequence.
- Prevent regression: verify that the second Mala 2 line cannot appear before manual `→`, automatic lines hold for two seconds after typing, and completing `Use o disco no toca-discos.` leaves the suitcase game active and the unlock below 100% until the operator advances.

## Mala 2 is one fixed 15-second key challenge with same-game retry

- Problem: selectable audience-object tasks contradicted Mala 2; after failure, advancing could also draw the next suitcase instead of retrying the failed game.
- Cause: Mala 2 reused the generic gincana bank, object-target UI, `+ 5 SEGUNDOS`, and the same retry mechanism as the hangman.
- Working response: keep one balloons/key task, no selector/add-time/audience objects, and require `VALENDO!`. Failure publishes a red sarcastic line through the normal typewriter and blocks the next draw. Automatic mode restarts the same 15-second task after acknowledgement; manual mode changes retry from `announcing` to `ready` and waits for the operator. Music remains manual.
- Prevent regression: test same-task retry without roulette, verify manual `ready` leaves the timer failed until `gincana-retry-start`, preserve 15 seconds, and keep `uba-hey.mp3` stopped until `TOCAR UBA UBA HEY`.

## Hangman retries start after the failure line, not at timer expiry

- Problem: immediately restarting a failed hangman timer makes the additional chance run underneath the red error message, and revealing the lost word makes the retry meaningless.
- Cause: game completion, public result presentation, and the next timer were previously treated as one synchronous transition.
- Working response: publish an authored sarcastic failure through the normal chatbot with the existing red visual/error sound and retain its message ID in shared `showState`. The first attempt keeps 60 seconds. Automatic mode starts a fresh 30-second timer after `Chat` acknowledges the typewriter; manual mode enters retry `ready` and waits for the operator. Preserve correct progress while clearing the error count, and never expose the secret during a retry.
- Prevent regression: browser-test hangman failure, including red presentation, hidden challenge panel while announcing, manual `ready`, exact 30-second resumed timer, and a later green success. Guard the acknowledgement by retry status and message ID so stale callbacks cannot restart a completed or different game.

## Manual mode must convert completion into a ready state

- Problem: some speeches still advanced by a timeout after typing, and the pre-draw hangman could remain in `challenge_result` with no usable forward control.
- Cause: `forceAutomatic` bypassed the manual queue in warmup transitions; suitcase retries and emergence callbacks invoked the next mechanic directly; the controller exposed the hangman continuation only after a separate acknowledgement changed the result state.
- Working response: in manual mode, typewriter completion only arms or marks the next transition `ready`. START/GAME OVER comments, required timers, acknowledgements, reactions, emergence lines, suitcase retries, and hangman success each require one operator advance. Accept both valid hangman result states and keep a guarded fallback acknowledgement.
- Prevent regression: assert no `forceAutomatic: true` remains, verify every manual speech uses a reading lock plus one pending action, and ensure the controller always exposes an enabled continuation for `emergence_ready`, retry `ready`, `challenge_result`, and `challenge_complete`.

## A pre-draw challenge must not mutate suitcase selection early

- Problem: attaching the hangman to Mala 3 selected and opened the suitcase before the requested challenge had finished.
- Cause: suitcase activation, public roulette, and activity startup were previously one sequence keyed by `currentSuitcase === 3`.
- Working response: keep Mala 2 current while the choice state owns the pre-draw hangman. Only after its green success message finishes does manual `→` or the automatic two-second hold publish the Mala 3 announcement and start the existing roulette.
- Prevent regression: assert that `currentSuitcase === 2` and `openedSuitcases === [2]` during the entire hangman, then verify Mala 3 is added only after victory. For the last suitcase, verify the one-option joke completes before the roulette still runs.

## Manual suitcase recovery must invalidate current work

- Problem: a failed or stranded suitcase stage could leave the operator without a reliable way to resume, while two fast right-arrow events could consume consecutive manual gates.
- Cause: normal suitcase selection enforced the authored order but had no operator-only override, and the UI request lock cleared before the new SSE state identified the completed transition.
- Working response: expose one manual recovery button per suitcase. Before using the normal roulette and activation path, invalidate pending selection/content sequences and cancel active gincana, hangman, audio, Instagram, BIOS, glitch, blackout, and stale timers while retaining opened-suitcase history. Lock right-arrow advancement to a token derived from the current suitcase stage and release it only after a changed snapshot arrives.
- Prevent regression: keep forced selection restricted to operator manual mode, route it through the existing suitcase activation flow, test all three buttons, and verify that two immediate right-arrow presses advance only the currently loaded stage.

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
