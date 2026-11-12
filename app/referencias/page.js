import ControllerSurface from "@/components/ControllerSurface";
import ReferenceArchive from "@/components/ReferenceArchive";
import { getReferenceLibrary } from "@/lib/referenceLibrary";

export const dynamic = "force-dynamic";
export const metadata = { title: "Referências · Caixa Preta" };

export default async function ReferencesPage() {
  const library = await getReferenceLibrary();
  return <ControllerSurface><ReferenceArchive library={library} /></ControllerSurface>;
}
