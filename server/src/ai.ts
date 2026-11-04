import { buildReviewPrompt, evaluate, parseReviewJson } from "../../shared/src";
import type { AiReview, ProposalInput, RuleBook } from "../../shared/src";
import { config } from "./config";

/** Calls the Anthropic Messages API and returns the parsed panel review. */
export async function runAiReview(input: ProposalInput, book: RuleBook): Promise<AiReview> {
  const ev = evaluate(input, book);
  const prompt = buildReviewPrompt(input, ev, book);
  const r = await fetch(`${config.anthropicBaseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": config.anthropicKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: config.claudeModel, max_tokens: 6000, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!r.ok) {
    const body = await r.text();
    const err: any = new Error(`Anthropic API ${r.status}: ${body.slice(0, 300)}`);
    if (r.status === 401) err.userMessage = "The Claude API key is not valid. Ask the administrator to check it.";
    if (r.status === 429 || r.status === 529) err.userMessage = "Claude is busy right now. Try again in a minute.";
    throw err;
  }
  const j: any = await r.json();
  const text = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  const parsed = parseReviewJson(text);
  return parsed || { verdict: text.slice(0, 6000) };
}
