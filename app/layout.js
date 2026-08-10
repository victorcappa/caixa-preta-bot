import "./globals.css";

export const metadata = {
  title: "Caixa Preta Chat",
  description: "Terminal experimental para A Caixa Preta"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
