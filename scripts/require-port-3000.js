const net = require("node:net");

const PORT = 3000;
const HOST = "0.0.0.0";

const server = net.createServer();

server.once("error", (error) => {
  const reason = error.code === "EADDRINUSE"
    ? "a porta 3000 ja esta em uso"
    : `nao foi possivel reservar a porta 3000 (${error.code || error.message})`;

  console.error(`\n[Caixa Preta] ${reason}.`);
  console.error("Pare o processo que esta usando http://localhost:3000 antes de iniciar o projeto.");
  console.error("Exemplo: lsof -nP -iTCP:3000 -sTCP:LISTEN\n");
  process.exit(1);
});

server.once("listening", () => {
  server.close(() => process.exit(0));
});

server.listen(PORT, HOST);
