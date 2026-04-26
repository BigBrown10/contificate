/**
 * THE MASTER LIBRARIAN (SWARM AGENT)
 * Fully autonomous research agent that orchestrates social listening across
 * Reddit and YouTube to ground the JINTA narrative in real-time human data.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import yts from "yt-search";
import {
  REDDIT_SUBS,
  YT_TOPICS,
  ARTICLE_SOURCES,
  isPornRecoveryRelevant,
  extractTextFromHtml,
  normalizeRedditUrl,
} from "../lib/research-source";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const NETWORK_HEADERS = {
  "User-Agent": "JINTA-Librarian/1.0 (+https://jinta.xyz; contact: ops@jinta.xyz)",
  "Accept": "application/json",
};

type SaveResearchFn = (
  type: "reddit" | "youtube" | "article",
  content: string,
  insight: string,
  url?: string
) => Promise<boolean>;

let saveResearchFnPromise: Promise<SaveResearchFn> | null = null;

async function getSaveResearchFn(): Promise<SaveResearchFn> {
  if (!saveResearchFnPromise) {
    saveResearchFnPromise = import("../lib/supabase")
      .then((mod) => mod.saveResearch)
      .catch((error) => {
        console.warn("[Master Librarian] Supabase module unavailable, continuing without persistence.", error);
        const noOp: SaveResearchFn = async () => false;
        return noOp;
      });
  }

  return saveResearchFnPromise;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: NETWORK_HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Scrapes top Reddit posts per sub
 */
async function researchReddit() {
  console.log(`[Master Librarian] 📥 Infiltrating Reddit for Solutions & Struggles...`);
  const saveResearch = await getSaveResearchFn();
  
  for (const sub of REDDIT_SUBS) {
    try {
      const data = await fetchJsonWithTimeout(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=5`);
      const posts = data.data?.children || [];

      for (const post of posts) {
        const { title, selftext, url, author, score } = post.data;
        if (score < 10) continue; 
        const body = typeof selftext === "string" ? selftext : "";
        if (!isPornRecoveryRelevant(title, body)) {
          continue;
        }

        const prompt = `Persona: Master Librarian for JINTA.
        Source: Reddit (r/${sub})
        Context: "${title}\n${body.slice(0, 800)}"
        
        Task: Extract one deeply human insight grounded in real lived experience.
        Focus on what they felt, what changed, or what is still unresolved.
        Keep it relational and specific.
        No coaching clichés. No fluff. Max 2 sentences.`;

        const result = await model.generateContent(prompt);
        const insight = result.response.text().trim();
        
        // --- FIX: Normalize Reddit URL to avoid double-prefix ---
        const sourceUrl = normalizeRedditUrl(url);

        await saveResearch("reddit", `Insight from u/${author} in r/${sub}`, insight, sourceUrl);
        console.log(`[Master Librarian] Saved Reddit Insight: ${title.slice(0, 40)}...`);
      }
    } catch (err) {
      console.error(`[Master Librarian] Reddit Error (${sub}):`, err);
    }
  }
}

/**
 * Searches YouTube for authority-building topics
 */
async function researchYouTube() {
  console.log(`[Master Librarian] 📥 Monitoring YouTube Authority Streams...`);
  const saveResearch = await getSaveResearchFn();

  for (const topic of YT_TOPICS) {
    try {
      const r = await yts(topic);
      const videos = (r.videos || []).slice(0, 3); // Top 3 per topic

      for (const v of videos) {
        const description = typeof v.description === "string" ? v.description : "";
        if (!isPornRecoveryRelevant(v.title, description)) {
          continue;
        }
        const prompt = `Persona: Master Librarian for JINTA.
        Source: YouTube Authority ("${v.title}")
        Video Metadata: "${description.slice(0, 500)}"
        
        Task: Based on the title and description, synthesize one human-centered takeaway.
        Keep it practical and relational, like advice from someone who has been there.
        Max 2 sentences.`;

        const result = await model.generateContent(prompt);
        const insight = result.response.text().trim();

        await saveResearch("youtube", `Authority: ${v.author.name} ("${v.title}")`, insight, v.url);
        console.log(`[Master Librarian] Saved YouTube Insight: ${v.title.slice(0, 40)}...`);
      }
    } catch (err) {
      console.error(`[Master Librarian] YouTube Error (${topic}):`, err);
    }
  }
}

async function researchArticles() {
  console.log(`[Master Librarian] 📚 Ingesting recovery articles as knowledge base...`);
  const saveResearch = await getSaveResearchFn();

  for (const sourceUrl of ARTICLE_SOURCES) {
    try {
      const response = await fetch(sourceUrl, {
        headers: NETWORK_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const text = extractTextFromHtml(html).slice(0, 3500);
      if (!isPornRecoveryRelevant(sourceUrl, text)) {
        continue;
      }

      const prompt = `Persona: Master Librarian for JINTA.
      Source: Article (${sourceUrl})
      Excerpt: "${text}"

      Task: Extract one practical porn-recovery insight.
      Keep it specific, human, and no fluff. Max 2 sentences.`;

      const result = await model.generateContent(prompt);
      const insight = result.response.text().trim();

      await saveResearch("article", `Article insight from ${sourceUrl}`, insight, sourceUrl);
      console.log(`[Master Librarian] Saved Article Insight: ${sourceUrl}`);
    } catch (err) {
      console.error(`[Master Librarian] Article Error (${sourceUrl}):`, err);
    }
  }
}

/**
 * Main Autonomous Loop
 */
export async function runFullResearchCycle() {
  const startTime = Date.now();
  console.log(`[Master Librarian] 🚀 Starting Full Autonomous Research Cycle...`);
  
  const results = await Promise.allSettled([
    researchReddit(),
    researchYouTube(),
    researchArticles(),
  ]);

  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`[Master Librarian] Source jobs completed. Failed jobs: ${failed}/${results.length}`);
  
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`[Master Librarian] ✅ Cycle Complete in ${elapsed}s. Swarm is grounded.`);
}

runFullResearchCycle().catch((err) => {
  console.error("Master Librarian crashed:", err);
  process.exit(1);
});
