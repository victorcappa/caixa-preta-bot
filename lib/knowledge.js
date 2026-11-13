import fs from "fs";
import path from "path";

export const knowledgeFiles = [
  "universe.md",
  "dramaturgy.md",
  "chatbot.md",
  "characters.md",
  "concepts.md",
  "glossary.md",
  "show-map.md"
];

let cache;

function readKnowledgeFile(fileName) {
  const filePath = path.join(process.cwd(), "knowledge", fileName);
  const content = fs.readFileSync(filePath, "utf8").trim();

  return `# knowledge/${fileName}\n\n${content}`;
}

export function getKnowledgeContext() {
  const fingerprint = `${process.cwd()}:${knowledgeFiles.map(file => {
    const stat = fs.statSync(path.join(process.cwd(), "knowledge", file));
    return `${stat.size}:${stat.mtimeMs}`;
  }).join(":")}`;
  if (cache?.fingerprint !== fingerprint) {
    const sections = knowledgeFiles.map(readKnowledgeFile);

    cache = {
      fingerprint,
      loaded: true,
      files: [...knowledgeFiles],
      content: sections.join("\n\n---\n\n")
    };

    if (process.env.NODE_ENV === "development") {
      console.log("[CAIXA PRETA]");
      console.log("knowledge loaded");
    }
  }

  return cache.content;
}

export function getKnowledgeStatus() {
  getKnowledgeContext();

  return {
    loaded: cache.loaded,
    files: [...cache.files],
    count: cache.files.length
  };
}
