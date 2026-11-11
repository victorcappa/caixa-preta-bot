const assert = require("node:assert/strict");

async function main() {
  const {
    chooseSceneZeroSuitcaseLightingCue,
    SCENE_ZERO_SUITCASE_LIGHTING_CUE,
    SCENE_ZERO_SUITCASE_LIGHTING_CUES: cues
  } = await import("../lib/scene-zero/suitcaseGame.js");

  assert.equal(cues.length, 16);
  assert.equal(new Set(cues).size, cues.length);
  assert(cues.includes(SCENE_ZERO_SUITCASE_LIGHTING_CUE), "a piada original deve continuar no repertório");
  assert(cues.every((text) => text.startsWith("Ricardinho,") && /luz|ilumina|foco|refletores/i.test(text)));
  assert.equal(chooseSceneZeroSuitcaseLightingCue([], () => 0), cues[0]);
  assert.equal(chooseSceneZeroSuitcaseLightingCue([], () => 0.999), cues.at(-1));

  const history = [];
  const selected = [];
  for (let index = 0; index < cues.length * 3; index += 1) {
    const historyBeforeDraw = [...history];
    const random = () => index % 2 ? 0.999 : 0;
    const cue = chooseSceneZeroSuitcaseLightingCue(history, random);
    assert(cues.includes(cue), "o sorteio deve retornar uma fala do repertório");
    assert.deepEqual(history, historyBeforeDraw, "consultar o repertório não deve consumir nem alterar o histórico");
    assert.equal(chooseSceneZeroSuitcaseLightingCue(history, random), cue, "a mesma consulta não deve consumir outra opção");
    selected.push(cue);
    if (selected.length >= cues.length) {
      assert.equal(new Set(selected.slice(-cues.length)).size, cues.length,
        "cada janela de 16 sorteios deve conter todas as falas, inclusive na virada do ciclo");
    }
    history.push(cue, "Uma fala de outra etapa.");
  }

  console.log("Scene Zero lighting: 16 falas, três ciclos sem repetição e histórico preservado — OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
