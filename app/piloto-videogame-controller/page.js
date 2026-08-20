import ControllerSurface from "@/components/ControllerSurface";
import PreparedSceneController from "@/components/PreparedSceneController";

export const metadata = {
  title: "Piloto Videogame Controller",
  description: "Controller preparado para sons de videogame do piloto"
};

const sections = [
  {
    kind: "SOUNDBOARD",
    title: "Rotina do Piloto",
    cues: [
      { label: "Confirmar Comando", shortcut: "1" },
      { label: "Erro Arcade", shortcut: "2" },
      { label: "Power Up", shortcut: "3" },
      { label: "Game Over", shortcut: "4" },
      { label: "Stop Sons", shortcut: "Esc", variant: "danger" }
    ]
  },
  {
    kind: "ATALHOS",
    title: "Atalhos Configuráveis",
    cues: [
      { label: "Banco A" },
      { label: "Banco B" },
      { label: "Banco C" },
      { label: "Limpar Banco", variant: "danger" }
    ]
  },
  {
    kind: "LIVRE",
    title: "Disparos Livres",
    cues: [
      { label: "Som Livre 1" },
      { label: "Som Livre 2" },
      { label: "Som Livre 3" },
      { label: "Som Livre 4" }
    ]
  }
];

const meters = [
  { id: "master", label: "Volume Master", min: 0, max: 100, step: 1, defaultValue: 75 },
  { id: "ducking", label: "Ducking", min: 0, max: 100, step: 1, defaultValue: 20 }
];

export default function PilotoVideogameControllerPage() {
  return (
    <ControllerSurface>
      <PreparedSceneController
        title="CENA 4 — PILOTO / SONS DE VIDEOGAME"
        description="Soundboard específico da rotina do piloto, com espaço para atalhos configuráveis e disparos livres."
        sections={sections}
        meters={meters}
        notes={[
          "Os atalhos aparecem como reserva de operação; ainda não há binding global.",
          "A soundboard pode virar serviço compartilhado quando os assets finais entrarem."
        ]}
      />
    </ControllerSurface>
  );
}
