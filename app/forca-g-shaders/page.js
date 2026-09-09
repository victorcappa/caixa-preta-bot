import { redirect } from "next/navigation";

export const metadata = {
  title: "Forca G Shaders",
  description: "Projecao publica preta para a cena Forca G Shaders"
};

export default function ForcaGShadersPage() {
  redirect("/forca-g-samples");
}
