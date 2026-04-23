/**
 * THE MASTER LIBRARIAN (SWARM AGENT)
 * Fully autonomous research agent that orchestrates social listening across
 * Reddit and YouTube to ground the JINTA narrative in real-time human data.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { saveResearch } from "../lib/supabase";
import yts from "yt-search";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const REDDIT_SUBS = ["pornfree", "NoFap", "getdisciplined", "semenretention"];
const YT_TOPICS = [
  "how to quit corn addiction permanently and fast", 
  "the science of breaking the corn habit", 
  "5 steps to stop porn addiction immediately", 
  "dopamine detox recovery protocol",
  "brain rewiring after porn addiction"
];

/**
 * Scrapes top Reddit posts per sub
 */
async function researchReddit() {
  console.log(`[Master Librarian] 📥 Infiltrating Reddit for Solutions & Struggles...`);
  
  for (const sub of REDDIT_SUBS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=5`);
      if (!res.ok) continue;

      const data = await res.json();
      const posts = data.data?.children || [];

      for (const post of posts) {
        const { title, selftext, url, author, score } = post.data;
        if (score < 10) continue; 

        const prompt = `Persona: Master Librarian for JINTA.
        Source: Reddit (r/${sub})
        Context: "${title}\n${selftext.slice(0, 800)}"
        
        Task: Extract one RAW, VISCERAL human insight. 
        Focus on either the depth of the STRUGGLE or the clarity of a SOLUTION they discovered.
        No coaching talk. No fluff. Max 2 sentences.`;

        const result = await model.generateContent(prompt);
        const insight = result.response.text().trim();
        
        // --- FIX: Normalize Reddit URL to avoid double-prefix ---
        let sourceUrl = url;
        if (url.startsWith("/")) {
          sourceUrl = `https://www.reddit.com${url}`;
        }

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

  for (const topic of YT_TOPICS) {
    try {
      const r = await yts(topic);
      const videos = r.videos.slice(0, 3); // Top 3 per topic

      for (const v of videos) {
        const prompt = `Persona: Master Librarian for JINTA.
        Source: YouTube Authority ("${v.title}")
        Video Metadata: "${v.description.slice(0, 500)}"
        
        Task: Based on the title and description of this high-authority video, 
        synthesize one "Power Hook" or "Scientific Reality" about this topic. 
        What is the core takeaway for someone in the corn loop? Max 2 sentences.`;

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

/**
 * Main Autonomous Loop
 */
export async function runFullResearchCycle() {
  const startTime = Date.now();
  console.log(`[Master Librarian] 🚀 Starting Full Autonomous Research Cycle...`);
  
  await researchReddit();
  await researchYouTube();
  
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`[Master Librarian] ✅ Cycle Complete in ${elapsed}s. Swarm is grounded.`);
}

runFullResearchCycle().catch((err) => {
  console.error("Master Librarian crashed:", err);
  process.exit(1);
});
