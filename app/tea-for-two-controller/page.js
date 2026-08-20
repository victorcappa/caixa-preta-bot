import ControllerSurface from "@/components/ControllerSurface";
import PreparedSceneController from "@/components/PreparedSceneController";

export const metadata = {
  title: "Tea For Two Controller",
  description: "Controller preparado para Tea For Two e transição"
};

const sections = [
  {
    kind: "MÚSICA",
    title: "Tea For Two",
    cues: [
      { label: "Disparar Música", shortcut: "1" },
      { label: "Fade In" },
      { label: "Fade Out" },
      { label: "Stop", shortcut: "Esc", variant: "danger" },
      { label: "Restart" }
    ]
  },
  {
    kind: "TRANSIÇÃO",
    title: "Movimento de Cena",
    cues: [
      { label: "Preparar Entrada" },
      { label: "Segurar Loop" },
      { label: "Liberar Transição" },
      { label: "Cortar Transição", variant: "danger" }
    ]
  }
];

const meters = [
  { id: "musicVolume", label: "Volume Música", min: 0, max: 100, step: 1, defaultValue: 80 },
  { id: "fadeTime", label: "Tempo Fade", min: 0, max: 20, step: 1, defaultValue: 5 }
];

export default function TeaForTwoControllerPage() {
  return (
    <ControllerSurface>
      <PreparedSceneController
        title="CENA 3 — TEA FOR TWO / TRANSIÇÃO"
        description="Aba preparada para disparar a música, fazer fade, parar e reiniciar sem expor controles de outras cenas."
        sections={sections}
        meters={meters}
        notes={[
          "Asset detectado: assets/audios/Doris Day - Tea For Two (1950).mp3.",
          "A etapa seguinte deve ligar os botões ao serviço real de áudio."
        ]}
      />
    </ControllerSurface>
  );
}
