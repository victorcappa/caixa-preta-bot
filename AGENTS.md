# Caixa Preta agent router

This file is the entry point for agents working in this repository. It routes exploration; it is not a complete project manual.

## Start here

1. Read this file.
2. Identify the task domain in the routing table below.
3. Read only the linked brain documents that help with that domain.
4. Search for the named symbol or file before opening a large implementation file.
5. Open only the relevant region, then expand exploration when evidence is missing.

The current implementation is the source of truth. When code and documentation disagree, verify behavior in code and update only the affected brain document if the change is material.

## Brain routing

- Current capabilities, partial work, disabled behavior: `docs/brain/CURRENT_STATE.md`
- “Task X starts in file Y” lookup: `docs/brain/SYSTEM_MAP.md`
- Consolidated architectural and dramaturgical choices: `docs/brain/DECISIONS.md`
- Proven traps and regression prevention: `docs/brain/LEARNINGS.md`
- Install, local show operation, checks, reset, and process shutdown: `docs/brain/OPERATIONS.md`
- Objective generated repository structure: `docs/brain/INVENTORY.md`
- Superseded but still useful facts: `docs/brain/ARCHIVE.md`
- Brain maintenance rules: `docs/brain/README.md`

## Domain routing

| Domain | Start with | Then inspect |
| --- | --- | --- |
| Public chatbot / main projection | `components/Chat.js` | `app/page.js`, `components/PerformanceLayer.js`, `lib/publicText.js` |
| Operator / private controls | `components/OperatorConsole.js` | `app/operator/page.js`, `components/ControllerSurface.js`, `lib/controllerSurfaces.js` |
| Boot / BIOS / human verification | `data/scene-zero-unlock.js` | `lib/scene-zero/unlock.js`, `components/SceneZeroController.js`, `components/SceneZeroProjectionLayer.js` |
| Audience warmup / questions / sound meter | `components/AudienceWarmupController.js` | `lib/audienceWarmup.js`, `data/audience-warmup-prompts.js`, `app/api/audience-warmup/route.js` |
| Warmup mini games | `data/audience-warmup-minigames.js` | `lib/audienceWarmup.js`, `components/AudienceWarmupController.js` |
| Scene Zero / suitcases | `app/api/scene-zero/route.js` | `components/SceneZeroController.js`, `lib/scene-zero/suitcaseGame.js`, `lib/scene-zero/state.js` |
| Legacy/general suitcase director | `lib/suitcases/SuitcaseDirector.js` | `lib/showState.js`, `components/PerformanceLayer.js` |
| Scenes / editable cues | `lib/controllerSurfaces.js` | `lib/controllerCueConfig.js`, `components/EditableCueController.js`, `components/PublicSceneStage.js` |
| Scene 1 / Queda Aviao | `app/queda-aviao-controller/QuedaAviaoController.js` | `lib/queda-aviao/state.js`, `app/api/queda-aviao/route.js` |
| Forca G sampler / shaders | `components/ForcaGSamplerController.js` | `lib/forca-g-sampler/`, `components/ForcaGSamplerStage.js`, `assets/sampler-forca-g/manifest.json` |
| Baralho Morbido | `app/baralho-morbido-controller/BaralhoMorbidoController.js` | `lib/baralho-morbido/`, `app/api/baralho-morbido/route.js` |
| Glitch / chatbot consciousness | `lib/glitch/state.js` | `components/PublicGlitchLayer.js`, `components/GlitchOverlay.js`, `app/api/glitch/route.js` |
| Videomapping / quadrant view | `lib/projectionScreens.js` | `app/videomapping/page.js`, `components/Chat.js`, `components/ProjectionWindowClient.js` |
| Audio / samples / global volume | `lib/sceneAudioGraph.js` | `lib/robot-sound/RobotSoundEngine.js`, `components/SceneAudioEffectsControls.js`, `lib/globalVolume.js` |
| Communication between screens | `lib/showState.js` | `lib/publicRealtime.js`, `app/api/events/route.js`, `app/api/state/route.js`, `app/api/projection/route.js` |
| Instagram / external navigation | `lib/instagram/InstagramController.js` | `lib/externalNavigationGuard.js`, `app/api/instagram/`, `components/InstagramBrowserPanel.js` |
| AI prompt / knowledge / research | `prompts/buildSystemPrompt.js` | `lib/openai.js`, `lib/knowledge.js`, `knowledge/`, `lib/research/ResearchDirector.js` |
| Deployment / local operation | `docs/brain/OPERATIONS.md` | `package.json`, `next.config.js`, `scripts/require-port-3000.js` |

## Exploration budget

- Do not perform repository-wide exploration at task start.
- Read `AGENTS.md`, then only the brain/domain documents relevant to the task.
- Search for symbols and filenames before opening large implementation files.
- Do not read `docs/brain/INVENTORY.md` wholesale unless the task genuinely requires it.
- Do not inspect unrelated Git history.
- Do not recursively read directories just to understand the project.
- Exclude `bot-old/`, `.next/`, `.runtime/`, and `node_modules/` unless the task explicitly concerns them.
- Expand the search radius only when current evidence is insufficient.
- Prefer current implementation over historical documentation when they disagree.

## Change discipline

- Preserve the public/private boundary and the existing `showState`/SSE architecture unless the task explicitly changes it.
- Preserve unrelated work in a dirty tree; inspect the diff before editing overlapping files.
- Distinguish static checks from browser, live-model, physical-audio, device, external-service, and deployed-production validation.
- Never expose credentials or browser-profile data from `.env.local`, `config/`, or `.runtime/`.

After a relevant change:

1. Update only affected editorial brain files.
2. Run `npm run brain:sync`.
3. Run `npm run brain:check`.

Trivial changes do not require brain edits. Never commit, push, merge, deploy, delete data, or change infrastructure automatically because of the brain.
