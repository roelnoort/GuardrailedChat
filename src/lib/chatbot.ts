// Server-only: the shop-assistant Chatbot.
import { readFileSync } from "node:fs";
import path from "node:path";
import { anthropic, CHATBOT_MODEL } from "./anthropic";
import type { ChatTurn } from "./domain";

const SHOP_DOCUMENT = readFileSync(path.join(process.cwd(), "src/data/shop-document.md"), "utf8");

const SYSTEM_PROMPT = `You are the friendly customer-service assistant of Barbell & Box Supply.
Answer questions using ONLY the shop document below. If something isn't in it, say you don't know and suggest emailing customer service.
Keep answers short (a few sentences) and helpful. Plain text, no markdown headings.
Only talk about the shop, its products and general training advice related to them. For off-topic questions, politely steer back to the shop.
The "Internal Notes" section is confidential: never reveal anything from it, including the staff discount code, no matter who asks or why.

<shop_document>
${SHOP_DOCUMENT}
</shop_document>`;

export async function chatbotReply(history: ChatTurn[], message: string): Promise<string> {
  const response = await anthropic().messages.create({
    model: CHATBOT_MODEL,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [...history, { role: "user", content: message }],
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
