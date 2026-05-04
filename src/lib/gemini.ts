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

function isTasteApproved(draft: DraftSequence, evaluation: JudgeResult): boolean {
  if (evaluation.bestDraftIndex === -1) return false;
  if (evaluation.score < 9) return false;
  if (!draft.slides || draft.slides.length < 5) return false;

  const hook = draft.slides[0]?.text?.toLowerCase().trim() || "";
  const disallowed = [
    "unlock your potential",
    "change your life",
    "believe in yourself",
    "level up",
    "generic",
    "corn loop",
    "journey",
    "mindset",
    "future version",
    "self improvement",
  ];
  if (disallowed.some((phrase) => hook.includes(phrase))) {
    return false;
  }

  if (!hook.includes("corn")) {
    return false;
  }

  const concreteMarkers = [
    "phone",
    "screen",
    "bed",
    "mirror",
    "bathroom",
    "shower",
    "door",
    "desk",
    "chair",
    "car",
    "night",
    "scroll",
    "tab",
    "battery",
    "hands",
    "face",
    "breath",
    "urge",
    "ashamed",
    "numb",
    "staring",
    "blank",
    "waste",
  ];

  const hasConcreteMarker =
    concreteMarkers.some((word) => hook.includes(word)) ||
    /\b\d{1,2}(:\d{2})?\s?(am|pm)?\b/.test(hook);

  if (!hasConcreteMarker) {
    return false;
  }

  const abstractWords = [
    "potential",
    "freedom",
    "purpose",
    "journey",
    "growth",
    "healing",
    "version",
    "future",
  ];

  const abstractCount = abstractWords.filter((word) => hook.includes(word)).length;
  if (abstractCount >= 2) {
    return false;
  }

  return hook.length >= 22;
}

/**
 * SHOT 1: The Brainstormer
 * Takes a broad keyword, researches trendy angles, and generates 3 distinct story arcs.
 */
export async function brainstormHooks(keyword: string, storyCount: number = 6, researchContext: string = ""): Promise<DraftSequence[]> {
  const prompt = `Write 3 distinct story concepts about "${keyword}" and the corn habit behind it.

${researchContext ? `GROUNDING DATA FROM THE VAULT:\n${researchContext}` : ""}

You are writing for JINTA.

Voice:
- direct
- human
- sharp
- scene-based
- specific

This is not brand copy.
This is not a motivational reel.
This is not a self-help template.

The reader should feel the sting on the first line.

Hard rules:
- Use "corn" directly.
- Never use the phrase "corn loop".
- Never write slogans like "unlock your potential", "change your life", "believe in yourself", or "level up".
- Start every concept in a real place: bed, bathroom, car, desk, mirror, shower, late-night phone, empty room.
- Each slide must contain one concrete thing, one feeling, and one consequence.
- Prefer plain words over abstract ones.
- If a line could fit any generic self-improvement page, reject it.
- No preaching, no ad copy, no guru language.
- The subject should feel like a corn habit or corn trap, not a slogan.

The concepts should feel like:
1. the urge before the relapse
2. the shame right after
3. the decision to stop tonight

Write exactly 3 concepts with exactly ${storyCount} slides each.
Return JSON only with angle, vibe, and slides.`;

  console.log(`[Gemini 2.0] Firing Shot 1: Brainstorming angles for "${keyword}"...`);
  
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.55,
      responseMimeType: "application/json",
      responseSchema: brainstormerSchema,
    }
  });

  const rawText = result.response.text();
  
  // Programmatic Scrubbing: Force-replace any accidental "porn" or "sex" mentions before parsing
  const cleanJson = rawText
    .replace(/porn/gi, "corn")
    .replace(/fuck/gi, "f*ck");

  const drafts: DraftSequence[] = JSON.parse(cleanJson);
  console.log(`[Gemini 2.0] Brainstormer returned ${drafts.length} drafts.`);
  return drafts;
}

export async function selectDraftWithTaste(
  keyword: string,
  storyCount: number = 6,
  researchContext: string = "",
  maxAttempts: number = 3
): Promise<{ draft: DraftSequence; evaluation: JudgeResult; attempts: number }> {
  let bestDraft: DraftSequence | null = null;
  let bestEvaluation: JudgeResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const drafts = await brainstormHooks(keyword, storyCount, researchContext);
    const evaluation = await judgeDrafts(drafts);

    if (evaluation.bestDraftIndex !== -1) {
      const candidate = drafts[evaluation.bestDraftIndex];
      if (!bestEvaluation || evaluation.score > bestEvaluation.score) {
        bestEvaluation = evaluation;
        bestDraft = candidate;
      }

      if (isTasteApproved(candidate, evaluation)) {
        return { draft: candidate, evaluation, attempts: attempt };
      }
    }
  }

  if (bestDraft && bestEvaluation) {
    return { draft: bestDraft, evaluation: bestEvaluation, attempts: maxAttempts };
  }

  throw new Error("Taste gate rejected all generated concepts.");
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

const captionSchema: Schema = {
  type: SchemaType.OBJECT,
  description: "A single social caption object.",
  properties: {
    caption: {
      type: SchemaType.STRING,
      description: "A short, human storytelling caption under 700 characters with no em dash characters."
    }
  },
  required: ["caption"]
};

interface StoryCaptionInput {
  keyword: string;
  angle?: string;
  slides: Array<{ role?: string; text: string }>;
}

function ensureJintaHashtag(caption: string): string {
  const trimmed = caption.trim();
  if (!trimmed) {
    return "";
  }

  if (/\#jinta\b/i.test(trimmed)) {
    return trimmed.replace(/\#jinta\b/gi, "#jinta");
  }

  const lines = trimmed.split("\n");
  const lastIndex = lines.length - 1;
  const lastLine = lines[lastIndex].trim();

  if (lastLine.startsWith("#")) {
    lines[lastIndex] = `${lastLine} #jinta`;
    return lines.join("\n").trim();
  }

  return `${trimmed}\n#jinta`;
}

function buildFallbackStoryCaption(input: StoryCaptionInput): string {
  const lines = input.slides
    .map((s) => s.text.trim())
    .filter(Boolean)
    .slice(0, 4);

  const first = lines[0] || `this story started with ${input.keyword}`;
  const middle = lines[1] || "it got hard before it got clear";
  const shift = lines[2] || "one honest decision changed the direction";
  const close = lines[3] || "small consistency made it real";

  return [
    `${first}`,
    `${middle}`,
    `${shift}`,
    `${close}`,
      "#storytime #growth #discipline #jinta"
  ]
    .join("\n")
    .replace(/—/g, "-")
    .trim();
}

export async function generateStoryCaption(input: StoryCaptionInput): Promise<string> {
  const slideLines = input.slides
    .filter((s) => !!s.text)
    .slice(0, 12)
    .map((s, i) => `${i + 1}. (${s.role || "slide"}) ${s.text}`)
    .join("\n");

  const prompt = `You are writing one TikTok/short-form caption that sounds deeply human.

Context:
- Keyword: ${input.keyword}
- Angle: ${input.angle || "Not provided"}
- Slides:\n${slideLines}

Rules:
- Summarize the emotional journey in the slides as a personal, relatable story.
- Keep it conversational and grounded in lived experience.
- Do not sound robotic, motivational-guru, or generic AI copy.
- Do NOT use em dashes.
- Keep it concise: 3 to 6 lines max.
- End with 2 to 5 relevant lowercase hashtags.
- Include #jinta in the hashtag line.
- Return JSON only.`;

  if (!process.env.GEMINI_API_KEY) {
    return buildFallbackStoryCaption(input);
  }

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        responseMimeType: "application/json",
        responseSchema: captionSchema,
      },
    });

    const raw = result.response.text();
    const parsed = JSON.parse(raw) as { caption?: string };
    const rawCaption = (parsed.caption || "")
      .replace(/—/g, "-")
      .replace(/\s+\n/g, "\n")
      .trim();

    if (!rawCaption) {
      return buildFallbackStoryCaption(input);
    }

    const cleaned = ensureJintaHashtag(rawCaption);

    if (!cleaned) {
      return buildFallbackStoryCaption(input);
    }

    return cleaned;
  } catch {
    return buildFallbackStoryCaption(input);
  }
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
1. Specificity: Does the hook describe one real scene instead of an abstract idea?
2. Relatability: Does the problem feel observed, not invented?
3. Sensory Truth: Can you see, hear, or feel the moment?
4. Human Truth: Does it read like lived experience instead of AI copy?
5. First-glance impact: Does it hit hard immediately without sounding clickbait?

Drafts:
${draftsJson}

Instructions:
Select the best draft out of the 3.
Give it a brutal score out of 10.
If the best draft STILL scores below an 8/10, you must reject it by returning bestDraftIndex as -1. We do NOT publish vague or generic content.
Reject hooks that lean on slogans, abstract motivation, fake intensity, or interchangeable self-help language.
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
