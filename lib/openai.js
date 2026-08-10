import OpenAI from "openai";
import { caixaPretaSystemPrompt } from "@/prompts/caixaPreta";

let client;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ausente. Configure a chave em .env.local.");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  return client;
}

function memoryBlock(memories) {
  if (!memories.length) {
    return "Nenhuma memoria registrada nesta apresentacao.";
  }

  return memories
    .slice(-30)
    .map((memory) => {
      const time = new Date(memory.timestamp).toLocaleTimeString("pt-BR");
      return `[${time}] ${memory.content}`;
    })
    .join("\n");
}

function conversationMessages(conversation) {
  return conversation.slice(-20).map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: `${message.role === "assistant" ? "CAIXA PRETA" : "PUBLICO"}: ${message.content}`
  }));
}

export async function generateCaixaPretaReply({ state, userMessage, operatorInstruction }) {
  const input = [
    {
      role: "system",
      content: caixaPretaSystemPrompt
    },
    {
      role: "user",
      content: `MEMORIA DA APRESENTACAO:\n${memoryBlock(state.memories)}`
    },
    ...conversationMessages(state.conversation)
  ];

  if (operatorInstruction) {
    input.push({
      role: "user",
      content: `ORIENTACAO DO OPERADOR:\n${operatorInstruction}\n\nGere somente a frase final que deve aparecer na projecao.`
    });
  } else {
    input.push({
      role: "user",
      content: `CONVERSA - PUBLICO:\n${userMessage}`
    });
  }

  const response = await getClient().responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-nano",
    input,
    max_output_tokens: 600,
    reasoning: {
      effort: "minimal"
    }
  });

  const text = response.output_text?.trim();

  if (!text) {
    console.error("OPENAI EMPTY RESPONSE", {
      id: response.id,
      status: response.status,
      incompleteDetails: response.incomplete_details,
      usage: response.usage,
      output: response.output
    });
    throw new Error("OpenAI retornou uma resposta vazia.");
  }

  return text;
}
