// ─── Local Gemma 4 (Ollama) Integration ───
// Generates keyword-aware story hooks using your local Gemma 4 model.
// Falls back to hardcoded hooks if Ollama is unavailable.

import { STORY_SEQUENCES, type StorySlide } from "./hooks";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e4b";

/** Timeout for Ollama calls — 90 seconds max to accommodate local model inference. */
const OLLAMA_TIMEOUT_MS = 90_000;

/**
 * System prompt for Gemma 4 to generate TikTok story hooks.
 * Forces structured JSON output so we can reliably parse it.
 */
const SYSTEM_PROMPT = `You are a TikTok content copywriter for JINTA — a male self-improvement app focused on helping men quit porn addiction and build discipline.

Your job is to write a 4-slide story sequence for a TikTok carousel. Each slide must connect to the next, building a narrative arc:

1. HOOK — A shocking stat, provocative question, or bold claim that stops the scroll. Short. Punchy.
2. PROBLEM — Name the pain point. Make the reader feel seen.
3. DEEPEN — Make it personal. Connect to identity, status, or masculinity.
4. SHIFT — Provide the pivot. Hope, a challenge, or an insight that reframes everything.

Rules:
- Each line must be under 80 characters (it needs to fit on a phone screen overlay)
- No hashtags, no emojis, no quotation marks
- Write in second person ("you", "your")
- Tone: direct, raw, masculine — like a coach who actually cares
- Don't be preachy. Be real.
- Each line should feel like its own standalone statement, but together they build a story

Respond ONLY with a JSON array of 4 objects, each with "text" (string) and "role" (one of: "hook", "problem", "deepen", "shift").

Example:
[
  {"text": "Your brain on porn is like a Ferrari running on cooking oil.", "role": "hook"},
  {"text": "You trade 4 minutes of dopamine for 4 hours of brain fog.", "role": "problem"},
  {"text": "The men winning right now aren't smarter. They're just not distracted.", "role": "deepen"},
  {"text": "90 days clean rewires everything. Most quit on day 3.", "role": "shift"}
]`;

/**
 * Generates story hooks using local Gemma 4 via Ollama.
 * If Ollama is unavailable or Gemma fails, falls back to hardcoded sequences.
 *
 * @param keyword - The user's keyword (e.g. "discipline", "gym motivation")
 * @param count - Number of story slides needed (excluding the CTA)
 */
export async function generateStoryHooks(
  keyword: string,
  count: number
): Promise<{ slides: StorySlide[]; source: "gemma" | "fallback" }> {
  try {
    const slides = await callGemma(keyword, count);
    if (slides.length > 0) {
      return { slides: slides.slice(0, count), source: "gemma" };
    }
  } catch (err) {
    console.warn(
      `[Gemma] Failed to generate hooks, falling back to hardcoded:`,
      err instanceof Error ? err.message : err
    );
  }

  // Fallback to hardcoded sequences
  const { getStorySlides } = await import("./hooks");
  return { slides: getStorySlides(count + 1), source: "fallback" }; // +1 because getStorySlides reserves CTA slot
}

/**
 * Calls local Ollama Gemma 4 to generate story hooks via /api/chat.
 * Uses the chat endpoint (not generate) as Gemma 4 returns empty on /api/generate.
 */
async function callGemma(
  keyword: string,
  count: number
): Promise<StorySlide[]> {
  const sequencesNeeded = Math.ceil(count / 4);

  const userPrompt =
    sequencesNeeded === 1
      ? `Write a 4-slide story sequence about: "${keyword}"`
      : `Write ${sequencesNeeded} connected 4-slide story sequences about: "${keyword}". Return all ${sequencesNeeded * 4} slides as a single flat JSON array.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        options: {
          temperature: 0.8,
          top_p: 0.9,
          num_predict: 400,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();
    const rawText: string = data.message?.content || "";

    if (!rawText) {
      throw new Error("Gemma returned empty response");
    }

    return parseGemmaResponse(rawText);
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Gemma timed out after 90 seconds");
    }
    throw err;
  }
}

/**
 * Parses Gemma's response into StorySlide objects.
 * Handles various output formats (pure JSON, markdown-fenced JSON, etc.)
 */
function parseGemmaResponse(raw: string): StorySlide[] {
  // Try to extract JSON from the response
  let jsonStr = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Find the JSON array boundaries
  const firstBracket = jsonStr.indexOf("[");
  const lastBracket = jsonStr.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1) {
    throw new Error("No JSON array found in Gemma response");
  }
  jsonStr = jsonStr.slice(firstBracket, lastBracket + 1);

  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error("Gemma response is not an array");
  }

  const validRoles = ["hook", "problem", "deepen", "shift", "resolve"];

  const slides: StorySlide[] = parsed
    .filter(
      (item: Record<string, unknown>) =>
        typeof item.text === "string" &&
        typeof item.role === "string" &&
        validRoles.includes(item.role as string)
    )
    .map((item: Record<string, unknown>) => ({
      text: (item.text as string).slice(0, 100), // Enforce max length
      role: item.role as StorySlide["role"],
    }));

  if (slides.length === 0) {
    throw new Error("No valid slides parsed from Gemma response");
  }

  console.log(`[Gemma] Generated ${slides.length} hooks for the batch`);
  return slides;
}

/**
 * Checks if Ollama is available and Gemma model is loaded.
 */
export async function checkOllamaHealth(): Promise<{
  available: boolean;
  model: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { available: false, model: OLLAMA_MODEL, error: "Ollama not responding" };
    }

    const data = await response.json();
    const models = data.models || [];
    const hasGemma = models.some(
      (m: { name: string }) => m.name.startsWith("gemma4")
    );

    return {
      available: hasGemma,
      model: OLLAMA_MODEL,
      error: hasGemma ? undefined : "Gemma 4 model not found in Ollama",
    };
  } catch {
    return { available: false, model: OLLAMA_MODEL, error: "Ollama offline" };
  }
}
