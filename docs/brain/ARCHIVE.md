# Brain archive

This file holds compact facts that no longer describe the current implementation but still help prevent a likely mistake. Current facts belong in `docs/brain/CURRENT_STATE.md`; detailed history belongs in Git.

## Initial state

No superseded brain entries were imported when this operational layer was created. Historical material in `README.md`, `docs/`, Git, and `bot-old/` was not copied here merely to fill the archive.

## Tarot global typing (superseded 2026-11-12)

Tarot formerly inherited global robot typing speed/punctuation pauses and divided both by its reveal multiplier. This made global speed changes accelerate readings and shortened paragraph holds to zero. Independent Tarot timing now replaces that coupling; see `lib/tarot/typing.js` and **Apresentação → Ritmo da escrita** in `docs/TAROT_TREINAMENTO.md`. Preserve one paragraph hold before blank lines; speed must scale only the character interval. Guards: `scripts/tarot-typing-test.js`, `scripts/tarot-typing-browser-test.js`.
