import { generateCaixaPretaReply } from "@/lib/openai";
import { showState } from "@/lib/showState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const message = body.message?.trim();

    if (!message) {
      return Response.json({ error: "Mensagem vazia." }, { status: 400 });
    }

    showState.addMessage("user", message, "projection");

    const reply = await generateCaixaPretaReply({
      state: showState.snapshot(),
      userMessage: message
    });

    const assistantMessage = showState.addMessage("assistant", reply, "openai");

    return Response.json({ message: assistantMessage });
  } catch (error) {
    console.error("CHAT ERROR", error);
    return Response.json(
      { error: "A Caixa Preta nao respondeu agora." },
      { status: 500 }
    );
  }
}
