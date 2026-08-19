import ProjectionWindowClient from "@/components/ProjectionWindowClient";
import BaralhoMorbidoDisplay from "./BaralhoMorbidoDisplay";

export const metadata = {
  title: "Baralho Morbido",
  description: "Projecao publica do Baralho Morbido"
};

export default function BaralhoMorbidoPage() {
  return (
    <>
      <ProjectionWindowClient />
      <BaralhoMorbidoDisplay />
    </>
  );
}
