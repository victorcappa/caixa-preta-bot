import fs from "fs";
import path from "path";

const knowledgeFiles = [
  "universe.md",
  "dramaturgy.md",
  "chatbot.md",
  "characters.md",
  "concepts.md",
  "glossary.md"
];

let cache;

function readKnowledgeFile(fileName) {
  const filePath = path.join(process.cwd(), "knowledge", fileName);
  const content = fs.readFileSync(filePath, "utf8").trim();

  return `# knowledge/${fileName}\n\n${content}`;
}

export function getKnowledgeContext() {
  if (!cache) {
    const sections = knowledgeFiles.map(readKnowledgeFile);

    cache = {
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
  if (!cache) {
    getKnowledgeContext();
  }

  return {
    loaded: cache.loaded,
    files: [...cache.files],
    count: cache.files.length
  };
}
