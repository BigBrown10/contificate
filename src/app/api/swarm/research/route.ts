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
    Identify 3 raw, visceral human insights. 
    One from REDDIT, one from YOUTUBE transcripts, and one from deep WEB articles.
    
    The Prompt: 
    Simulate a search through these platforms. Find the "2am thoughts".
    Provide a realistic SOURCE URL for each insight (e.g. to a specific subreddit or a YouTube search for that topic).
    
    Format: Return as a JSON array of objects:
    [
      { "type": "reddit" | "youtube" | "article", "content": "Thread/Video context", "insight": "The visceral human insight", "url": "https://..." },
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
      await saveResearch(item.type || "reddit", item.content, item.insight, item.url);
    }

    return NextResponse.json({ success: true, message: `Librarian has synchronized ${insights.length} visceral insights on "${topic}".` });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
