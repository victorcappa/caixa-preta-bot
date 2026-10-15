# System map

Use this as “if the task is X, start at Y.” Search for the relevant symbol before opening an entire large file.

## Core runtime

- Show state or reset -> `lib/showState.js` -> relevant reducer/director -> owning API route.
- Public realtime drift -> `lib/publicRealtime.js` -> `app/api/events/route.js` -> `app/api/state/route.js`.
- Projection window registration/navigation -> `components/ProjectionWindowClient.js` -> `app/api/projection/route.js` -> `lib/projectionScreens.js`.
- Public/private screen registry -> `lib/projectionScreens.js` and `lib/controllerSurfaces.js`.
- Global stop -> `app/api/operator/route.js` (`stopAllRoutines`) -> `lib/stopAllSignal.js` -> media consumers.
- Snapshot/restart recovery -> `lib/showState.js` -> `lib/showSessionPersistence.js` -> `app/api/show-session/route.js` -> `components/OperatorConsole.js`.
- Emergency Mode and health -> `app/api/reliability/route.js`, `lib/externalRequestControl.js`, and `app/api/health/route.js`.

## Public chatbot and model

- Revealed Operator / private conversation / personality -> `OPERATOR_PUBLICO.md`, `app/api/operator-public/route.js`, `lib/operatorPublic.js`, and `lib/showState.js`.
- Right-menu launcher -> `components/OperatorPublicLauncher.js` in `components/SceneZeroController.js`; private controls/monitor -> `components/PublicOperatorControls.js` and `components/OperatorLivePreview.js`.
- LIVE reply pacing -> `components/OperatorTypedReply.js`, using private `robotSound` typing speed/punctuation pause; completed history is restored immediately.
- Training conversation/feedback -> `components/TrainingConsole.js`, `app/api/training/`, and `lib/training.js`; visible composer sends by Enter or button and preserves the draft after errors.
- Editable public conversation/sliders reuse `components/PublicOperatorControls.js` with `publicSurface`; private operational commands remain outside the projection.
- Stable public 65/35 layout -> `app/layout.js` -> `components/ProjectionOperatorSurface.js` -> `components/PublicOperatorLayout.js`.

- Bot parameters tab -> `app/operator/page.js`, `components/OperatorBotSettings.js`, `components/RobotSoundControls.js`, and `components/PublicOperatorControls.js` (`parametersOnly`); timing helpers in `lib/robot-sound/state.js`. Save acknowledgement/dirty-field merging lives in `RobotSoundControls`; `_refreshRobotSoundSettings` in `lib/showState.js` refreshes the live normalization after development reload. The technical console remains in the Principal OP drawer.
- Public text/layout/typing -> `components/Chat.js` and `components/Chat.module.css`.
- Visual performance event -> `components/PerformanceLayer.js` -> `lib/performanceEvents.js`.
- Chat request/model envelope -> `app/api/chat/route.js` -> `lib/openai.js`.
- OpenAI timeout/local fallback -> `lib/externalRequestControl.js` -> `lib/showFallback.js` -> normal chat message/typewriter flow.
- Public render containment -> `components/PublicErrorBoundary.js`, `app/global-error.js`, and `app/not-found.js`.
- System prompt -> `prompts/buildSystemPrompt.js` -> `prompts/personality.js`, `prompts/rules.js`, `prompts/modes.js`.
- Play knowledge -> `lib/knowledge.js` -> `knowledge/`.
- Web research policy/state -> `lib/research/ResearchDirector.js` and `docs/autonomia-pesquisa.md`.

## Scene Zero

- Overall private UI -> `components/SceneZeroController.js`.
- API orchestration and delayed sequences -> `app/api/scene-zero/route.js`.
- Scene Zero state shape -> `lib/scene-zero/state.js`; integration -> `lib/showState.js` (`controlSceneZero`).
- Boot/BIOS/unlock copy and timings -> `data/scene-zero-unlock.js`; transitions -> `lib/scene-zero/unlock.js`.
- Public BIOS/unlock/countdown rendering -> `components/SceneZeroProjectionLayer.js` and its CSS module.
- Sound meter/microphone -> `components/SceneZeroController.js` uses `lib/audienceMicrophoneMeter.js` and `public/audio-worklets/audience-meter.js`; audio-clock sampling continues in hidden tabs/windows, with a timer fallback. Public receives numeric level only.
- Warmup prompt library -> `data/audience-warmup-prompts.js`; selection/timers -> `lib/audienceWarmup.js`; UI -> `components/AudienceWarmupController.js`.
- Warmup mini games -> `data/audience-warmup-minigames.js` and `components/AudienceWarmupController.js`.
- Participant selection -> `app/api/scene-zero/route.js` -> `lib/participants.js` -> `lib/showState.js`.
- Suitcase order/content -> `lib/scene-zero/suitcaseGame.js`; route orchestration -> `app/api/scene-zero/route.js`; public state -> `lib/scene-zero/state.js`.
- Hangman -> `lib/scene-zero/suitcaseHangman.js` and `data/scene-zero-hangman-words.js`.
- Physical challenge -> `data/scene-zero-physical-challenges.js` and `data/scene-zero-gincanas.js`.
- Morel ending -> `data/scene-zero-morel.js` -> suitcase handlers in `app/api/scene-zero/route.js`.
- Older general suitcase mode -> `lib/suitcases/SuitcaseDirector.js`; do not confuse it with the current Scene Zero 2 -> 3 -> 1 orchestration.

## Scene and media surfaces

- Scene controller menu/grouping -> `lib/controllerSurfaces.js` -> `components/ControllerSurface.js`.
- Editable cue definitions/persistence/uploads -> `lib/controllerCueConfig.js` -> `app/api/controller-cues/route.js`.
- Editable cue private UI -> `components/EditableCueController.js`.
- Generic public cue playback -> `components/SceneProjectionPage.js` -> `components/PublicSceneStage.js`.
- Per-scene audio graph/effects -> `lib/sceneAudioGraph.js` and `components/SceneAudioEffectsControls.js`.
- Private scene notes -> `components/SceneNotes.js` -> `app/api/scene-notes/route.js` -> `lib/sceneNotes.js` and `data/scene-notes.json`.

## Specific scenes

- Queda Aviao -> `app/queda-aviao-controller/QuedaAviaoController.js`, `app/queda-aviao/QuedaAviaoPlayer.js`, `lib/queda-aviao/state.js`.
- Forca G -> `components/ForcaGSamplerController.js`, `components/ForcaGSamplerStage.js`, `lib/forca-g-sampler/`, `assets/sampler-forca-g/manifest.json`.
- Baralho Morbido -> `app/baralho-morbido-controller/BaralhoMorbidoController.js`, `app/baralho-morbido/BaralhoMorbidoDisplay.js`, `lib/baralho-morbido/`.
- Transicao/Tea/Piloto -> matching page in `app/` -> `components/EditableCueController.js` and `components/PublicSceneStage.js`.
- Tecnologia x Floresta -> `app/tecnologia-floresta/` and controller config in `lib/controllerCueConfig.js`.

## Cross-cutting effects

- Glitch -> `lib/glitch/state.js` -> `app/api/glitch/route.js` -> `components/PublicGlitchLayer.js` / `components/GlitchOverlay.js`.
- Robot sound and shared microphone sensitivity -> `lib/robot-sound/RobotSoundEngine.js`, `lib/robot-sound/state.js`, `components/RobotSoundControls.js`; the Scene Zero meter applies sensitivity in `components/SceneZeroController.js`; dedicated private route -> `app/sound-control/page.js` / `components/SoundControlPanel.js`.
- Global volume -> `lib/globalVolume.js` -> `app/api/global-volume/route.js` -> media stages/controllers.
- Blackout -> `lib/displayBlackout.js` -> `components/DisplayBlackout.js` -> public surfaces.
- Instagram -> `lib/instagram/InstagramController.js`; embedded UI -> `components/InstagramBrowserPanel.js`; server endpoints -> `app/api/instagram/`.
- External-navigation safety -> `lib/externalNavigationGuard.js` and calls in `lib/showState.js`.

## Validation

- Available commands and discovered checks -> `docs/brain/INVENTORY.md` (read only the relevant section).
- Cheap project checks -> `package.json` scripts.
- Browser checks -> matching `scripts/*-browser-test.js`; these usually require `npm run dev` already running on port 3000.
- Reliability unit/scenario checks -> `scripts/show-reliability-test.js` and `scripts/show-reliability-scenario.js`.
