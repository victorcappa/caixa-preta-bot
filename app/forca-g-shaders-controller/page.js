import ControllerSurface from "@/components/ControllerSurface";
import PreparedSceneController from "@/components/PreparedSceneController";

export const metadata = {
  title: "Força G Shaders Controller",
  description: "Controller preparado para vídeos e shaders da Força G"
};

const sections = [
  {
    kind: "VÍDEO",
    title: "Vídeo Principal",
    cues: [
      { label: "Carregar Principal", shortcut: "1" },
      { label: "Play" },
      { label: "Pause" },
      { label: "Restart" },
      { label: "Stop", shortcut: "Esc", variant: "danger" }
    ]
  },
  {
    kind: "EFEITOS",
    title: "Estados Visuais",
    cues: [
      { label: "Visão em Túnel" },
      { label: "Redout" },
      { label: "Deformação" },
      { label: "Limpar Efeitos", variant: "danger" }
    ]
  },
  {
    kind: "DEEPFAKE",
    title: "Camadas Humanas",
    cues: [
      { label: "Deepfake Entrada" },
      { label: "Deepfake Intensificar" },
      { label: "Deepfake Dissolver" },
      { label: "Stop Deepfake", variant: "danger" }
    ]
  }
];

const meters = [
  { id: "tunnel", label: "Visão em Túnel", min: 0, max: 100, step: 1, defaultValue: 0 },
  { id: "redout", label: "Redout", min: 0, max: 100, step: 1, defaultValue: 0 },
  { id: "warp", label: "Deformação", min: 0, max: 100, step: 1, defaultValue: 0 },
  { id: "intensity", label: "Intensidade Geral", min: 0, max: 100, step: 1, defaultValue: 45 }
];

export default function ForcaGShadersControllerPage() {
  return (
    <ControllerSurface>
      <PreparedSceneController
        title="CENA 2B — FORÇA G / VÍDEOS E SHADERS"
        description="Aba independente para vídeo principal, visão em túnel, redout, deformações e intensidade visual."
        sections={sections}
        meters={meters}
        notes={[
          "Não juntar com os samples: esta aba é para parâmetros contínuos e vídeo principal.",
          "Pode reutilizar futuramente os controles de shader já usados no Glitch."
        ]}
      />
    </ControllerSurface>
  );
}
