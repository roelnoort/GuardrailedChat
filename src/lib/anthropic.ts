import Anthropic from "@anthropic-ai/sdk";

export const GUARDRAIL_MODEL = "claude-haiku-5-5";
export const CHATBOT_MODEL = "claude-sonnet-5-5";

let client: Anthropic | undefined;

export function anthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set. Put it in .env.local.");
    }
    client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  }
  return client;
}
