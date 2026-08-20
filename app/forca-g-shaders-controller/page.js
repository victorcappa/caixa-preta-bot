import { redirect } from "next/navigation";

export const metadata = {
  title: "Força G Shaders Controller",
  description: "Controller preparado para vídeos e shaders da Força G"
};

export default function ForcaGShadersControllerPage() {
  redirect("/forca-g-samples-controller");
}
