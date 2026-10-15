import "@fontsource/vt323/400.css";
import "./globals.css";
import ProjectionOperatorSurface from "@/components/ProjectionOperatorSurface";

export const metadata = {
  title: "Caixa Preta Chat",
  description: "Terminal experimental para A Caixa Preta"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body><ProjectionOperatorSurface>{children}</ProjectionOperatorSurface></body>
    </html>
  );
}
