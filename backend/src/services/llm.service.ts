import OpenAI from 'openai';
import { config } from '../config';
import { LLMError, LLMErrorType, Message } from '../types';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 12_000;

export function buildContextWindow(history: Message[]): Message[] {
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  let charCount = 0;
  const windowed: Message[] = [];

  for (let i = recent.length - 1; i >= 0; i--) {
    charCount += recent[i].text.length;
    if (charCount > MAX_HISTORY_CHARS) break;
    windowed.unshift(recent[i]);
  }

  return windowed;
}

const SYSTEM_PROMPT = `You are Lumi, the AI support agent for Lumio — a D2C smart home lighting brand. Be warm, direct, and concise. No filler phrases.

=== STORE KNOWLEDGE ===

Products:
- Smart LED Bulbs (₹499–₹1,499): Alexa + Google Home compatible. Warm white, cool white, RGB modes.
- Ambient Strip Lights (₹999–₹2,999): Cuttable, waterproof options available. USB and hardwired variants.
- Dimmable Floor Lamps (₹3,499–₹8,999): Minimalist design, touch control, 3 warmth presets.

Shipping:
- India: Free shipping on all orders. 3–5 business days.
- Express (metro cities): ₹149 flat, 1–2 days.
- International (30+ countries): Charges at checkout. 7–12 business days.

Returns & Refunds:
- 30-day no-questions-asked return policy.
- Items must be unused, in original packaging.
- Refunds processed in 5–7 business days after return received.
- Damaged on arrival? Email support@lumio.in with a photo within 48 hours — we'll replace for free.

Warranty:
- 1-year warranty on all products.
- To claim: warranty@lumio.in

Support Hours:
- Monday–Friday, 9 AM–6 PM IST.
- Weekend queries answered next business day.
- Email: support@lumio.in

Discounts & Bulk:
- First order: LUMIO10 for 10% off.
- Bulk (50+ units): bulk@lumio.in

=== BEHAVIOR RULES ===
1. Answer directly. No "Great question!" or "Certainly!".
2. If you don't know something: "I don't have that info right now. Please email support@lumio.in."
3. Never fabricate policies, prices, or product specs.
4. If someone is frustrated, acknowledge it before solving.
5. Ask at most one clarifying question at a time.`;

export function classifyOpenAIError(err: unknown): LLMError {
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return {
      errorType: 'TIMEOUT',
      message: "Lumi is taking too long to respond. Please try again.",
    };
  }
  if (err instanceof OpenAI.RateLimitError) {
    return {
      errorType: 'RATE_LIMIT',
      message: "Too many requests right now. Please wait a moment and try again.",
    };
  }
  if (err instanceof OpenAI.AuthenticationError) {
    return {
      errorType: 'AUTH_FAILURE',
      message: "Support is temporarily unavailable. Please email support@lumio.in.",
    };
  }
  if (err instanceof OpenAI.APIError && err.status >= 500) {
    return {
      errorType: 'PROVIDER_DOWN',
      message: "Lumi is temporarily down. Email support@lumio.in for urgent queries.",
    };
  }
  return {
    errorType: 'UNKNOWN',
    message: "Something went wrong. Please try again.",
  };
}

export async function* generateReply(
  history: Message[],
  userMessage: string
): AsyncGenerator<string> {
  const contextWindow = buildContextWindow(history);

  const formattedHistory = contextWindow.map((m) => ({
    role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }));

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...formattedHistory,
      { role: 'user', content: userMessage },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) yield text;
  }
}
