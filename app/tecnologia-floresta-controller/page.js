import ControllerSurface from "@/components/ControllerSurface";
import PreparedSceneController from "@/components/PreparedSceneController";

export const metadata = {
  title: "Tecnologia Floresta Controller",
  description: "Controller preparado para a camada Tecnologia × Floresta"
};

const sections = [
  {
    kind: "BANCO",
    title: "Banco de Sons",
    cues: [
      { label: "Máquina Baixa" },
      { label: "Folha / Ruído" },
      { label: "Pulso Digital" },
      { label: "Cortar Banco", variant: "danger" }
    ]
  },
  {
    kind: "LOOPS",
    title: "Loops",
    cues: [
      { label: "Loop Tecnologia" },
      { label: "Loop Floresta" },
      { label: "Loop Híbrido" },
      { label: "Stop Loops", variant: "danger" }
    ]
  },
  {
    kind: "CROSSFADES",
    title: "Experimentos",
    cues: [
      { label: "Crossfade A → B" },
      { label: "Crossfade B → A" },
      { label: "Mutação Lenta" },
      { label: "Reset Mix", variant: "danger" }
    ]
  }
];

const meters = [
  { id: "technology", label: "Tecnologia", min: 0, max: 100, step: 1, defaultValue: 50 },
  { id: "forest", label: "Floresta", min: 0, max: 100, step: 1, defaultValue: 50 },
  { id: "crossfade", label: "Crossfade", min: 0, max: 100, step: 1, defaultValue: 50 }
];

export default function TecnologiaFlorestaControllerPage() {
  return (
    <ControllerSurface>
      <PreparedSceneController
        title="CAMADA — TECNOLOGIA × FLORESTA"
        description="Camada preparada para banco de sons, loops, crossfades e experimentações sonoras fora das cenas numeradas."
        sections={sections}
        meters={meters}
        notes={[
          "Pensada como camada transversal, não como cena única.",
          "Pode compartilhar soundboard e mixer com Piloto / Videogame."
        ]}
      />
    </ControllerSurface>
  );
}
