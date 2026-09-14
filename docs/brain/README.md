# Caixa Preta project brain

This `brain` is a compact operational memory layer for agents working in this repository. It shortens orientation time by routing a task to current facts, relevant code, established decisions, proven traps, and real operating procedures.

It is not an application feature named Brain, an AI memory store, a replacement for code, or a replacement for detailed project documentation. The implementation remains the source of truth.

## Files

- `AGENTS.md`: small repository router and exploration budget.
- `docs/brain/CURRENT_STATE.md`: verified current state, including partial and disabled behavior.
- `docs/brain/SYSTEM_MAP.md`: practical task-to-file map.
- `docs/brain/DECISIONS.md`: active, evidence-backed ADRs.
- `docs/brain/LEARNINGS.md`: proven failures, causes, fixes, and regression guards.
- `docs/brain/OPERATIONS.md`: safe local operation and validation procedures.
- `docs/brain/INVENTORY.md`: bounded, objective inventory generated from the worktree.
- `docs/brain/ARCHIVE.md`: useful facts that no longer describe the current system.

Do not put secrets, exhaustive source summaries, copied implementation, speculative plans, transient logs, or successive versions of the same current fact in the brain.

## Maintenance

After a material change, update only the editorial document whose facts changed, then run:

```bash
npm run brain:sync
npm run brain:check
```

Use `npm run brain:summary` for a short orientation message. `brain:sync` replaces only the marked generated section of `docs/brain/INVENTORY.md`; text outside the markers is preserved.

When a fact stops being current, replace it in `docs/brain/CURRENT_STATE.md`. If its history still prevents a likely regression, move a compact note to `docs/brain/ARCHIVE.md`; otherwise delete it. Do not grow current-state documents by appending dated versions.

The size limits enforced by `brain:check` are intentional. If a document approaches its limit, remove duplication and route to source files instead of expanding the brain.
