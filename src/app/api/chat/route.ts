import { chatbotReply } from "@/lib/chatbot";
import { decide, type ChatRequest, type ChatResponse } from "@/lib/domain";
import { runGuardrails } from "@/lib/guardrails";

export async function POST(req: Request) {
  const { message, history, enabled } = (await req.json()) as ChatRequest;
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Empty message" }, { status: 400 });
  }

  // Sequential: the Guardrails decide first; the Chatbot only ever sees passed messages.
  const verdicts = await runGuardrails(message, enabled);
  const outcome = decide(verdicts);
  const result: ChatResponse = { verdicts, outcome };

  if (outcome.kind === "passed") {
    try {
      result.reply = await chatbotReply(history ?? [], message);
    } catch (err) {
      result.chatbotError = err instanceof Error ? err.message : String(err);
      console.error("[chatbot] error:", result.chatbotError);
    }
  }

  return Response.json(result);
}
