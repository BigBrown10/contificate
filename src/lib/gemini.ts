import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";
import { StorySlide } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// Using Gemini 2.5 Flash for elite narrative depth and performance
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Define the expected output schema for the Brainstormer (Shot 1)
const brainstormerSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "A list of 3 distinct TikTok story sequences.",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      angle: {
        type: SchemaType.STRING,
        description: "The specific trendy angle or sub-topic (e.g., 'Dopamine Detox', '2AM Challenge')."
      },
      vibe: {
        type: SchemaType.STRING,
        description: "The musical mood vibe that matches this story sequence."
      },
      slides: {
        type: SchemaType.ARRAY,
        description: "Exactly 6 slides for this story sequence.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            text: {
              type: SchemaType.STRING,
              description: "The slide text (under 90 characters)."
            },
            role: {
              type: SchemaType.STRING,
              format: "enum",
              enum: ["hook", "problem", "deepen", "shift", "insight", "action"],
              description: "The narrative role of this slide."
            }
          },
          required: ["text", "role"]
        }
      }
    },
    required: ["angle", "vibe", "slides"]
  }
};

export interface DraftSequence {
  angle: string;
  vibe: string;
  slides: StorySlide[];
}

/**
 * SHOT 1: The Brainstormer
 * Takes a broad keyword, researches trendy angles, and generates 3 distinct story arcs.
 */
export async function brainstormHooks(keyword: string, storyCount: number = 6): Promise<DraftSequence[]> {
  const prompt = `Your task: Take the broad keyword "${keyword}" and frame it EXCLUSIVELY through the lens of BREAKING CORN ADDICTION. 

The Persona: 
You are the world's most elite copywriter, working for JINTA, a brand dedicated to one mission: Saving men from the corn loop. You write with the grit of a Nike campaign and the investigative depth of Forbes. You are visceral, raw, and direct.

CRITICAL MANDATE:
- SLIDE 1 MUST explicitly mention "Corn" or "Corn Addiction" or "Corn Loop". THIS IS NON-NEGOTIABLE.
- Slide 1 must be the absolute SUBJECT of the brand's mission: Breaking the corn attachment.
- Use the keyword "${keyword}" as the NARRATIVE ANGLE for the corn talk. 
- Every subsequent slide must be grounded in the visceral reality of addiction recovery.

Strategic Pillars (Guidance):
1. THE VOID: The neuro-cost of the corn loop. How it steals your future.
2. THE ASCENSION (POV): The freedom waiting after you break the corn attachment.
3. THE PROTOCOL: Brutally practical steps to stay clean from corn today.

Narrative Structure:
For EACH of the 3 concepts, write a ${storyCount}-slide story sequence.
- Tone: Visceral, minimalist, high-prestige. No fluff. No silly TikTok speak besides "Corn".

CRITICAL TIKTOK ALGOSPEAK RULES:
- "porn" -> "corn"
- "sex" -> "addiction" or "physical loop"
- "fuck" -> "f*ck"
- "addicted" -> "hooked" or "looped"

Return exactly 3 distinct concepts with their associated ${storyCount} slides, including the "vibe" (dark, motivational, gym, success).`;

  console.log(`[Gemini 2.0] Firing Shot 1: Brainstorming angles for "${keyword}"...`);
  
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
      responseSchema: brainstormerSchema,
    }
  });

  const rawText = result.response.text();
  
  // Programmatic Scrubbing: Force-replace any accidental "porn" or "sex" mentions before parsing
  const cleanJson = rawText
    .replace(/porn/gi, "corn")
    .replace(/sex/gi, "seggs")
    .replace(/fucking/gi, "freaking")
    .replace(/fuck/gi, "f*ck");

  const drafts: DraftSequence[] = JSON.parse(cleanJson);
  console.log(`[Gemini 2.0] Brainstormer returned ${drafts.length} drafts.`);
  return drafts;
}

// Expected output schema for the Judge (Shot 2)
const judgeSchema: Schema = {
  type: SchemaType.OBJECT,
  description: "The evaluation result of the story sequences.",
  properties: {
    bestDraftIndex: {
      type: SchemaType.INTEGER,
      description: "The index (0, 1, or 2) of the best draft. Return -1 if NO draft is worthy of an 8/10."
    },
    score: {
      type: SchemaType.INTEGER,
      description: "The score of the best draft out of 10."
    },
    critique: {
      type: SchemaType.STRING,
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
