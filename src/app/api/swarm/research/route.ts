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
    console.log("[Librarian] Manual Trigger -> Initializing Live Extraction...");
    
    // 1. Fetch REAL high-signal data from Reddit
    const subreddits = ["pornfree", "NoFap", "getdisciplined"];
    const sub = subreddits[Math.floor(Math.random() * subreddits.length)];
    
    const redditRes = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=3`);
    if (!redditRes.ok) throw new Error(`Reddit API failed: ${redditRes.status}`);
    
    const redditData = await redditRes.json();
    const posts = redditData.data?.children || [];

    // 2. Distill RAW INSIGHTS from the live data using Gemini 2.5
    const genAI = (await import("@google/generative-ai")).GoogleGenerativeAI;
    const client = new genAI(process.env.GEMINI_API_KEY || "");
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const results = [];

    for (const post of posts) {
        const { title, selftext, url, author } = post.data;
        
        const prompt = `Persona: Elite Shadow Librarian for JINTA.
        Source: Reddit (${sub})
        Text: "${title} \n ${selftext.slice(0, 500)}"
        
        Task: Extract one visceral, 2am-thought level insight about their addiction struggle. 
        Keep it raw and human. Max 2 sentences. 
        Return ONLY the raw insight.`;

        const genResult = await model.generateContent(prompt);
        const insight = genResult.response.text().trim();

        // Save to Supabase -> Normalize the URL
        let actualUrl = url;
        if (url.startsWith("/")) {
          actualUrl = `https://www.reddit.com${url}`;
        }
        
        await saveResearch("reddit", `Post by u/${author} in r/${sub}`, insight, actualUrl);
        
        results.push({ insight, url: actualUrl });
    }

    return NextResponse.json({ 
        success: true, 
        message: `Synchronized ${results.length} live insights from r/${sub}.`,
        insights: results
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    console.error("[Librarian API Error]:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
