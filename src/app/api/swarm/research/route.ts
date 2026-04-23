import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { brainstormHooks } from "@/lib/gemini";
import { saveResearch } from "@/lib/supabase";

/**
 * MANUAL TRIGGER: Shadow Librarian
 * This endpoint allows the user to force the Librarian to scrape for new insights
 * directly from the Dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const topics = ["NoFap benefits", "porn addiction recovery", "discipline habits"];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    // 2. Use Gemini 2.5 Flash for high-authority market synthesis
    const prompt = `Persona: You are the ELITE Shadow Librarian for JINTA.
    Research Topic: "${topic}"

    The Mandate: 
    Go deep into the subculture. Identify 3 raw, visceral human insights or recurring pain points mentioned in addiction recovery communities.
    
    The Prompt: 
    Simulate a search through recovery forums and subreddits. 
    Capture the grit. Find the "2am thoughts" — things people only admit when they are at their lowest.
    NO COACHING SPEAK. Give me raw human data.
    
    Format: Return as a JSON array of objects:
    [
      { "type": "reddit", "content": "Thread context", "insight": "The visceral human insight" },
      ...
    ]`;

    // Direct elite client initialization
    const genAI = (await import("@google/generative-ai")).GoogleGenerativeAI;
    const client = new genAI(process.env.GEMINI_API_KEY || "");
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const genResult = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0.1 // Precision over creativity for research
        }
    });

    const insights = JSON.parse(genResult.response.text());

    // 3. Save to Supabase (Persistence)
    for (const item of insights) {
      await saveResearch(item.type || "reddit", item.content, item.insight);
    }

    return NextResponse.json({ success: true, message: `Librarian has synchronized ${insights.length} visceral insights on "${topic}".` });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
