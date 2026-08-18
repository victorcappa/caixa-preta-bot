export const BARALHO_MORBIDO_TOTAL_CARDS = 10;

function padCardId(number) {
  return `${number}`.padStart(2, "0");
}

export const BARALHO_MORBIDO_CARDS = Array.from({ length: BARALHO_MORBIDO_TOTAL_CARDS }, (_, index) => {
  const id = padCardId(index + 1);

  return {
    id,
    video: {
      file: `${id}.mp4`,
      path: `videos/baralho-morbido/${id}.mp4`,
      src: `/api/game-assets?file=${encodeURIComponent(`videos/baralho-morbido/${id}.mp4`)}`
    },
    title: `Carta ${id}`,
    text: "",
    category: "acidente",
    metadata: {}
  };
});

export function getBaralhoMorbidoCard(id) {
  return BARALHO_MORBIDO_CARDS.find((card) => card.id === id) || null;
}
