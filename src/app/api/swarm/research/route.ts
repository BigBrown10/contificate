import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { saveResearch } from "@/lib/supabase";
import yts from "yt-search";
import {
  REDDIT_SUBS,
  YT_TOPICS,
  ARTICLE_SOURCES,
  isPornRecoveryRelevant,
  extractTextFromHtml,
  normalizeRedditUrl,
} from "@/lib/research-source";

const REDDIT_HEADERS = {
  "User-Agent": "JINTA-Librarian/1.0 (+https://jinta.xyz; contact: ops@jinta.xyz)",
  "Accept": "application/json",
};

async function fetchJsonWithTimeout(url: string, timeoutMs: number = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: REDDIT_HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * MANUAL TRIGGER: Shadow Librarian
 * This endpoint allows the user to force the Librarian to scrape for new insights
 * directly from the Dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[Librarian] Manual Trigger -> Initializing Live Extraction...");
    
    // 1. Fetch REAL high-signal data from Reddit
    const subreddits = REDDIT_SUBS;
    const sub = subreddits[Math.floor(Math.random() * subreddits.length)];
    
    const redditData = await fetchJsonWithTimeout(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=3`);
    const posts = redditData.data?.children || [];

    // 2. Distill RAW INSIGHTS from the live data using Gemini 2.5
    const genAI = (await import("@google/generative-ai")).GoogleGenerativeAI;
    const client = new genAI(process.env.GEMINI_API_KEY || "");
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const results = [];

    for (const post of posts) {
        const { title, selftext, url, author } = post.data;
        const safeText = typeof selftext === "string" ? selftext : "";
        if (!isPornRecoveryRelevant(title, safeText)) {
          continue;
        }
        
        const prompt = `Persona: Elite Shadow Librarian for JINTA.
        Source: Reddit (${sub})
        Text: "${title} \n ${safeText.slice(0, 500)}"
        
        Task: Extract one relational insight grounded in what this person is actually feeling.
        Keep it raw and human, not preachy. Max 2 sentences.
        Return ONLY the raw insight.`;

        const genResult = await model.generateContent(prompt);
        const insight = genResult.response.text().trim();

        // Save to Supabase -> Normalize the URL
        const actualUrl = normalizeRedditUrl(url);
        
        await saveResearch("reddit", `Post by u/${author} in r/${sub}`, insight, actualUrl);
        
        results.push({ insight, url: actualUrl });
    }

    for (const topic of YT_TOPICS) {
      try {
        const searchResult = await yts(topic);
        const videos = (searchResult.videos || []).slice(0, 2);
        for (const video of videos) {
          const description = typeof video.description === "string" ? video.description : "";
          if (!isPornRecoveryRelevant(video.title, description)) {
            continue;
          }
          const ytPrompt = `Persona: Elite Shadow Librarian for JINTA.
          Source: YouTube (${video.title})
          Text: "${description.slice(0, 400)}"

          Task: Extract one practical, human takeaway from this video context.
          Keep it emotionally grounded and specific. Max 2 sentences.
          Return ONLY the takeaway.`;

          const ytResult = await model.generateContent(ytPrompt);
          const ytInsight = ytResult.response.text().trim();
          await saveResearch(
            "youtube",
            `Video by ${video.author?.name || "unknown"}: ${video.title}`,
            ytInsight,
            video.url
          );
          results.push({ insight: ytInsight, url: video.url });
        }
      } catch (ytErr) {
        console.error("[Librarian] YouTube pull failed for topic:", topic, ytErr);
      }
    }

    for (const sourceUrl of ARTICLE_SOURCES) {
      try {
        const articleResponse = await fetch(sourceUrl, { headers: REDDIT_HEADERS });
        if (!articleResponse.ok) {
          continue;
        }
        const articleHtml = await articleResponse.text();
        const articleText = extractTextFromHtml(articleHtml).slice(0, 3500);
        if (!isPornRecoveryRelevant(sourceUrl, articleText)) {
          continue;
        }

        const articlePrompt = `Persona: Elite Shadow Librarian for JINTA.
        Source: Article (${sourceUrl})
        Text: "${articleText}"

        Task: Extract one practical porn-breakout lesson.
        Keep it direct, relatable, and no fluff. Max 2 sentences.
        Return ONLY the lesson.`;

        const articleResult = await model.generateContent(articlePrompt);
        const articleInsight = articleResult.response.text().trim();
        await saveResearch("article", `Article insight from ${sourceUrl}`, articleInsight, sourceUrl);
        results.push({ insight: articleInsight, url: sourceUrl });
      } catch (articleErr) {
        console.error("[Librarian] Article pull failed for source:", sourceUrl, articleErr);
      }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Synchronized ${results.length} live insights from Reddit, YouTube, and articles.`,
        insights: results
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    console.error("[Librarian API Error]:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
