import ControllerSurface from "@/components/ControllerSurface";
import SoundControlPanel from "@/components/SoundControlPanel";

export const metadata = {
  title: "Caixa Preta — Sound Control",
  description: "Controle privado dos sons procedurais do chatbot"
};

export default function SoundControlPage() {
  return (
    <ControllerSurface>
      <SoundControlPanel />
    </ControllerSurface>
  );
}
