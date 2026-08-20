import ControllerSurface from "@/components/ControllerSurface";
import PreparedSceneController from "@/components/PreparedSceneController";

export const metadata = {
  title: "Força G Samples Controller",
  description: "Controller preparado para samples audiovisuais da Força G"
};

const sections = [
  {
    kind: "VÍDEOS",
    title: "Disparos Principais",
    cues: [
      { label: "Força G Isabela", shortcut: "1" },
      { label: "Força G Robinson", shortcut: "2" },
      { label: "Força G Ney", shortcut: "3" },
      { label: "Stop Vídeo", shortcut: "Esc", variant: "danger" }
    ]
  },
  {
    kind: "INSERTS",
    title: "Imagens e Explicações",
    cues: [
      { label: "Insert Explicativo A" },
      { label: "Insert Explicativo B" },
      { label: "Imagem Técnica" },
      { label: "Limpar Insert", variant: "danger" }
    ]
  },
  {
    kind: "AUDIO",
    title: "Samples Livres",
    cues: [
      { label: "Impacto Curto" },
      { label: "Motor Grave" },
      { label: "Respiração" },
      { label: "Cortar Samples", variant: "danger" }
    ]
  },
  {
    kind: "DEEPFAKES",
    title: "Materiais Preparados",
    cues: [
      { label: "Deepfake 1" },
      { label: "Deepfake 2" },
      { label: "Deepfake 3" },
      { label: "Stop Deepfake", variant: "danger" }
    ]
  }
];

const meters = [
  { id: "gain", label: "Volume Samples", min: 0, max: 100, step: 1, defaultValue: 70 },
  { id: "videoMix", label: "Mistura Vídeo", min: 0, max: 100, step: 1, defaultValue: 100 }
];

export default function ForcaGSamplesControllerPage() {
  return (
    <ControllerSurface>
      <PreparedSceneController
        title="CENA 2A — FORÇA G / SAMPLES AUDIOVISUAIS"
        description="Controller preparado para disparar vídeos, imagens, sons, deepfakes e inserts explicativos quando os serviços finais forem conectados."
        sections={sections}
        meters={meters}
        notes={[
          "Usar assets existentes em assets/videos/forca-g/ quando a camada de disparo for ligada.",
          "Manter esta aba separada dos shaders para operação rápida."
        ]}
      />
    </ControllerSurface>
  );
}
