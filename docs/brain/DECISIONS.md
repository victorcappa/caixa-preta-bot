# Active decisions

Only decisions with direct support in the current implementation belong here.

## ADR-001 — Public projection and private operation stay separate

Status: Active

### Context

The audience must not see recovery controls, credentials, debug status, or scene notes.

### Decision

Public pages and private controllers use separate routes. `lib/projectionScreens.js` registers public destinations; `lib/controllerSurfaces.js` registers operator surfaces. Shared state carries only the data a public renderer needs.

### Reason

The show needs a clean projection while preserving direct operator recovery and override controls.

### Consequences

New scenes normally need explicit public and controller registrations. Controller-only content must not be added to public snapshots or model context.

## ADR-002 — One in-process show state synchronizes the performance

Status: Active

### Context

Chat, scenes, games, audio, projection windows, and controllers must converge during a local performance.

### Decision

`lib/showState.js` is the shared in-memory authority. Server-Sent Events publish changes; `lib/publicRealtime.js` reconciles missed events with revision checks against `app/api/state/route.js`.

### Reason

This keeps local control immediate without introducing a second application or database into the performance path.

### Consequences

State does not survive a server restart. New cross-screen features should extend the existing store/events instead of creating parallel state channels, unless isolation is explicitly justified.

## ADR-003 — Principal and videomapping are layouts of the same public chat

Status: Active

### Context

The 2x2 videomapping view must show the same message, BIOS, counters, and effects as the principal projection without restarting live animations.

### Decision

Both routes render `components/Chat.js`. `components/ProjectionWindowClient.js` uses an in-place layout event for transitions between `/` and `/videomapping` rather than reloading the page.

### Reason

Reloading would reset client typing, media, animation, and timer presentation even when the server state remained intact.

### Consequences

Changes to shared public content must work in both layouts. Quadrant placement belongs to the shared Chat/Scene Zero presentation, not a duplicate chatbot.

## ADR-004 — Authored warmup text is literal and operator-controlled

Status: Active

### Context

Audience actions are dramaturgical material with fixed wording, sequencing metadata, and scoring.

### Decision

`data/audience-warmup-prompts.js` is the source of truth. The warmup endpoint accepts registered prompts, and `components/AudienceWarmupController.js` exposes draw, trigger, timing, reaction, manual progression, and end controls.

### Reason

The performance needs repeatable authored instructions and human control rather than model paraphrase or uncontrolled automation.

### Consequences

Edit the library when changing wording. Do not silently rewrite a prompt in a renderer or model response path.

## ADR-005 — External navigation requires explicit operator action

Status: Active

### Context

Instagram and arbitrary external pages can expose accounts, private content, and irreversible social actions.

### Decision

Autonomous Instagram navigation is disabled. `lib/externalNavigationGuard.js` blocks agent-originated external navigation; the existing Instagram controller runs only from explicit operator paths.

### Reason

The operator must remain responsible for authentication, navigation, review, and sending.

### Consequences

Do not add model tools or scene-entry side effects that open URLs, profiles, apps, or deep links. Keep credentials server-side and out of snapshots/prompts.

## ADR-006 — Scene media reuses shared cue and audio infrastructure

Status: Active

### Context

Several later scenes need editable audio/video/image/text buttons and consistent public playback.

### Decision

Use `lib/controllerCueConfig.js`, `components/EditableCueController.js`, `app/api/controller-cues/`, and `components/PublicSceneStage.js`. Specialized scenes such as Forca G and Baralho retain dedicated state only where their behavior differs.

### Reason

One cue path preserves operator ergonomics, persistence, global volume, blackout, and audio-effect behavior.

### Consequences

Prefer extending the shared cue contract over copying a controller. Empty configured asset paths remain incomplete content, not implementation success.
