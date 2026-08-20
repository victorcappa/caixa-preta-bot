import ControllerSurface from "@/components/ControllerSurface";
import PreparedSceneController from "@/components/PreparedSceneController";

export const metadata = {
  title: "Transição Psicodélica Controller",
  description: "Controller preparado para a transição psicodélica"
};

const sections = [
  {
    kind: "AUDIO",
    title: "Áudio Processado",
    cues: [
      { label: "Áudio 1" },
      { label: "Processar Voz" },
      { label: "Segundo Áudio" },
      { label: "Stop Áudio", variant: "danger" }
    ]
  },
  {
    kind: "TEXTO",
    title: "Texto Subindo",
    cues: [
      { label: "Iniciar Texto" },
      { label: "Acelerar Texto" },
      { label: "Congelar Texto" },
      { label: "Limpar Texto", variant: "danger" }
    ]
  },
  {
    kind: "CORPO",
    title: "Corpo em Pixel",
    cues: [
      { label: "Pixel Corpo On" },
      { label: "Aumentar Pixel" },
      { label: "Dissolver Corpo" },
      { label: "Pixel Off", variant: "danger" }
    ]
  }
];

const meters = [
  { id: "audioProcess", label: "Processamento", min: 0, max: 100, step: 1, defaultValue: 35 },
  { id: "textSpeed", label: "Velocidade Texto", min: 0, max: 100, step: 1, defaultValue: 40 },
  { id: "pixelBody", label: "Pixel Corpo", min: 0, max: 100, step: 1, defaultValue: 0 }
];

export default function TransicaoPsicodelicaControllerPage() {
  return (
    <ControllerSurface>
      <PreparedSceneController
        title="CENA 2D — TRANSIÇÃO PSICODÉLICA"
        description="Controller preparado para áudio processado, texto subindo, corpo em pixel e segundo áudio."
        sections={sections}
        meters={meters}
        notes={[
          "A lógica final deve conectar os cues a projeção, áudio e processamento visual reais.",
          "Esta aba fica separada do Baralho Mórbido mesmo estando dentro da Cena 2."
        ]}
      />
    </ControllerSurface>
  );
}
