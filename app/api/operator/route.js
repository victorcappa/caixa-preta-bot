import { generateCaixaPretaReply } from "@/lib/openai";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseCommand(raw) {
  const trimmed = raw.trim();
  const [name] = trimmed.split(/\s+/);
  const content = trimmed.slice(name.length).trim();

  return { name, content };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const rawCommand = body.command?.trim();

    if (!rawCommand) {
      return Response.json({ error: "COMMAND REQUIRED" }, { status: 400 });
    }

    if (!rawCommand.startsWith("/")) {
      return Response.json({ error: "COMMAND REQUIRED" }, { status: 400 });
    }

    const { name, content } = parseCommand(rawCommand);

    if (name === "/reset") {
      showState.reset();
      return Response.json({ message: "SESSION RESET" });
    }

    if (name === "/memory") {
      if (!content) {
        return Response.json({ error: "MEMORY EMPTY" }, { status: 400 });
      }

      const memory = showState.addMemory(content);
      return Response.json({
        message: `MEMORY STORED: ${new Date(memory.timestamp).toLocaleTimeString("pt-BR")}`
      });
    }

    if (name === "/say") {
      if (!content) {
        return Response.json({ error: "SAY EMPTY" }, { status: 400 });
      }

      const reply = await generateCaixaPretaReply({
        state: showState.snapshot(),
        operatorInstruction: content
      });

      showState.addMessage("assistant", reply, "operator");
      return Response.json({ message: "SAY DELIVERED" });
    }

    return Response.json({ error: `UNKNOWN COMMAND: ${name}` }, { status: 400 });
  } catch (error) {
    console.error("OPERATOR ERROR", error);
    const missingKey = error.message?.includes("OPENAI_API_KEY");

    return Response.json(
      { error: missingKey ? error.message : "OPENAI REQUEST FAILED" },
      { status: 500 }
    );
  }
}
