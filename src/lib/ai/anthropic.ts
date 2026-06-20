import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicKey } from "@/lib/env";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: getAnthropicKey() });
  }
  return client;
}
