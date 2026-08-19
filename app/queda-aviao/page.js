import ProjectionWindowClient from "@/components/ProjectionWindowClient";
import QuedaAviaoPlayer from "./QuedaAviaoPlayer";

export const metadata = {
  title: "Queda Avião",
  description: "Sequência textual para A Caixa Preta"
};

export default function QuedaAviaoPage() {
  return (
    <>
      <ProjectionWindowClient />
      <QuedaAviaoPlayer />
    </>
  );
}
