const fs = require("node:fs");
const path = require("node:path");
const OpenAI = require("openai");

const projectRoot = path.resolve(__dirname, "..");
const localEnvPath = path.join(projectRoot, ".env.local");
const outputDirectory = path.join(projectRoot, "assets", "sampler-forca-g", "audio");
const model = "gpt-4o-mini-tts";
const responseFormat = "mp3";

const input = [
  "Registro familiar para o propósito de preservar os ditados, as vozes e as últimas palavras de um membro da família à beira da morte — assim como de grandes homens —, a fonografia indubitavelmente superará a fotografia.",
  "No campo da multiplicação de matrizes originais e da repetição indefinida de uma mesma coisa, a eletrotipia bem-sucedida do registro original é essencial."
].join(" ");

const baseInstructions = [
  "Fale em português brasileiro.",
  "Interprete uma caracterização genérica, sem imitar nenhuma pessoa real: um homem brasileiro muito idoso, de aproximadamente 80 a 90 anos.",
  "A voz deve soar envelhecida, grave, frágil e levemente rouca, mas permanecer perfeitamente compreensível.",
  "Leia lentamente, de maneira cuidadosa e contemplativa, com pequenas pausas naturais entre pensamentos e, ocasionalmente, antes de palavras importantes.",
  "A respiração pode parecer um pouco cansada. A dicção é culta e precisa, mas não perfeitamente regular.",
  "Evite completamente voz de locutor, publicidade, podcast ou narração moderna. Não seja entusiasmado e não dramatize excessivamente.",
  "A sensação deve ser a de um homem muito velho registrando um texto para preservação histórica, como um depoimento ou registro fonográfico de arquivo.",
  "Mantenha o ritmo humano e ligeiramente irregular.",
  "Dê peso especial às expressões ‘últimas palavras’, ‘à beira da morte’, ‘fonografia’, ‘fotografia’, ‘repetição indefinida’ e ‘registro original’.",
  "Termine a última frase lentamente, com uma pequena sensação de esgotamento, seguida de silêncio."
].join(" ");

const variations = [
  {
    file: "registro-fonografico-idoso-01.mp3",
    voice: "cedar",
    speed: 0.88,
    direction: "Priorize gravidade, contenção e fragilidade física, sem perder a nitidez das palavras."
  },
  {
    file: "registro-fonografico-idoso-02.mp3",
    voice: "onyx",
    speed: 0.9,
    direction: "Priorize uma tessitura baixa, pausas reflexivas e uma rouquidão discreta, nunca caricatural."
  },
  {
    file: "registro-fonografico-idoso-03.mp3",
    voice: "ash",
    speed: 0.86,
    direction: "Priorize vulnerabilidade, cansaço respiratório sutil e irregularidade humana no ritmo."
  }
];

function loadLocalEnvironment() {
  if (!process.env.OPENAI_API_KEY && fs.existsSync(localEnvPath)) {
    process.loadEnvFile(localEnvPath);
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ausente. Configure a chave no ambiente ou em .env.local.");
  }
}

function isMp3(buffer) {
  if (buffer.length < 3) return false;
  const hasId3Header = buffer.subarray(0, 3).toString("ascii") === "ID3";
  const hasMpegFrame = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  return hasId3Header || hasMpegFrame;
}

async function generateVariation(client, variation, index) {
  const outputPath = path.join(outputDirectory, variation.file);
  const temporaryPath = `${outputPath}.tmp`;
  const instructions = `${baseInstructions} ${variation.direction}`;

  console.log(`\n[${index + 1}/${variations.length}] Gerando ${variation.file}`);
  console.log(`Modelo: ${model}`);
  console.log(`Voz: ${variation.voice}`);
  console.log(`Velocidade: ${variation.speed}`);
  console.log(`Instruções: ${instructions}`);

  const speech = await client.audio.speech.create({
    model,
    voice: variation.voice,
    input,
    instructions,
    response_format: responseFormat,
    speed: variation.speed
  });
  const buffer = Buffer.from(await speech.arrayBuffer());

  if (!isMp3(buffer)) {
    throw new Error(`A resposta para ${variation.file} não parece ser um MP3 válido.`);
  }

  await fs.promises.writeFile(temporaryPath, buffer);
  await fs.promises.rename(temporaryPath, outputPath);

  const stats = await fs.promises.stat(outputPath);
  if (!stats.isFile() || stats.size <= 0) {
    throw new Error(`O arquivo ${variation.file} foi criado vazio ou inválido.`);
  }

  console.log(`Criado: ${outputPath} (${stats.size} bytes)`);
  return { outputPath, size: stats.size };
}

async function main() {
  loadLocalEnvironment();
  await fs.promises.mkdir(outputDirectory, { recursive: true });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results = [];

  for (const [index, variation] of variations.entries()) {
    results.push(await generateVariation(client, variation, index));
  }

  console.log("\nGeração concluída. Arquivos validados:");
  for (const result of results) {
    console.log(`- ${result.outputPath} (${result.size} bytes)`);
  }
  console.log("\nAviso de uso: estas vozes foram geradas por IA e não são vozes humanas.");
}

main().catch((error) => {
  console.error("\nFalha ao gerar as vozes:", error?.message || error);
  process.exitCode = 1;
});
