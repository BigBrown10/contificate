import { GoogleGenerativeAI, Schema, Type } from "@google/generative-ai";
import { StorySlide } from "./hooks";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Define the expected output schema for the Brainstormer (Shot 1)
const brainstormerSchema: Schema = {
  type: Type.ARRAY,
  description: "A list of 3 distinct TikTok story sequences.",
  items: {
    type: Type.OBJECT,
    properties: {
      angle: {
        type: Type.STRING,
        description: "The specific trendy angle or sub-topic (e.g., 'Dopamine Detox', '2AM Challenge')."
      },
      slides: {
        type: Type.ARRAY,
        description: "Exactly 4 slides for this story sequence.",
        items: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: "The slide text (under 80 characters)."
            },
            role: {
              type: Type.STRING,
              enum: ["hook", "problem", "deepen", "shift"],
              description: "The narrative role of this slide."
            }
          },
          required: ["text", "role"]
        }
      }
    },
    required: ["angle", "slides"]
  }
};

export interface DraftSequence {
  angle: string;
  slides: StorySlide[];
}

/**
 * SHOT 1: The Brainstormer
 * Takes a broad keyword, researches trendy angles, and generates 3 distinct story arcs.
 */
export async function brainstormHooks(keyword: string): Promise<DraftSequence[]> {
  const prompt = `You are an elite TikTok content strategist for JINTA, a male self-improvement brand.
  
Your task: Take the broad keyword "${keyword}" and brainstorm 3 highly specific, trendy angles that resonate with young men right now (think dopamine detox, monk mode, stoicism, focus, escaping the matrix).

For EACH of the 3 angles, write a 4-slide story sequence.
The narrative arc must be:
1. HOOK - A scroll-stopping, punchy claim.
2. PROBLEM - Name the pain point.
3. DEEPEN - Connect it to identity.
4. SHIFT - The mindset pivot.

Rules for the text:
- Tone: Direct, masculine, raw. No cringe, no emojis, no hashtags.
- Under 80 characters per slide.
- Written in the second person ("you").

Return exactly 3 distinct concepts with their associated 4 slides.`;

  console.log(`[Gemini] Firing Shot 1: Brainstorming angles for "${keyword}"...`);
  
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
      responseSchema: brainstormerSchema,
    }
  });

  const rawText = result.response.text();
  const drafts: DraftSequence[] = JSON.parse(rawText);
  console.log(`[Gemini] Brainstormer returned ${drafts.length} drafts.`);
  return drafts;
}

// Expected output schema for the Judge (Shot 2)
const judgeSchema: Schema = {
  type: Type.OBJECT,
  description: "The evaluation result of the story sequences.",
  properties: {
    bestDraftIndex: {
      type: Type.INTEGER,
      description: "The index (0, 1, or 2) of the best draft. Return -1 if NO draft is worthy of an 8/10."
    },
    score: {
      type: Type.INTEGER,
      description: "The score of the best draft out of 10."
    },
    critique: {
      type: Type.STRING,
      description: "A brutal 1-sentence explanation of why this draft won (or why they all failed)."
    }
  },
  required: ["bestDraftIndex", "score", "critique"]
};

export interface JudgeResult {
  bestDraftIndex: number;
  score: number;
  critique: string;
}

/**
 * SHOT 2: The Brutal Judge
 * Rates the generated drafts and picks the ultimate winner, rejecting weak concepts.
 */
export async function judgeDrafts(drafts: DraftSequence[]): Promise<JudgeResult> {
  const draftsJson = JSON.stringify(drafts, null, 2);
  
  const prompt = `You are the brutal Editor-in-Chief for JINTA, a male self-improvement brand.
You must review the following 3 drafted TikTok story sequences.

Your job is to rate them ruthlessly out of 10 based on:
1. Punchiness: Does the hook physically stop a scrolling user?
2. Relatability: Does the problem hit hard?
3. Brand Voice: Is it raw and masculine, or does it sound like a generic life coach?

Drafts:
${draftsJson}

Instructions:
Select the best draft out of the 3.
Give it a brutal score out of 10.
If the best draft STILL scores below an 8/10, you must reject it by returning bestDraftIndex as -1. We do NOT publish mediocre content.
Provide a 1-sentence gritty critique explaining your decision.
`;

  console.log(`[Gemini] Firing Shot 2: The Brutal Judge is evaluating ${drafts.length} drafts...`);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1, // Low temperature for consistent grading
      responseMimeType: "application/json",
      responseSchema: judgeSchema,
    }
  });

  const rawText = result.response.text();
  const evaluation: JudgeResult = JSON.parse(rawText);
  console.log(`[Gemini] Judge awarded a ${evaluation.score}/10 to Draft ${evaluation.bestDraftIndex}. Critique: ${evaluation.critique}`);
  return evaluation;
}
