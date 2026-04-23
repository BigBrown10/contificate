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
const YT_TOPICS = ["dopamine detox", "brain fog recovery", "porn addiction science", "discipline habits"];

/**
 * Scrapes top Reddit posts per sub
 */
async function researchReddit() {
  console.log(`[Master Librarian] 📥 Infiltrating Reddit...`);
  
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
        
        Task: Extract one RAW, VISCERAL human insight about the neuro-cost of addiction or the struggle for discipline.
        No coaching talk. No fluff. Max 2 sentences.`;

        const result = await model.generateContent(prompt);
        const insight = result.response.text().trim();
        const sourceUrl = url.startsWith("http") ? url : `https://www.reddit.com${url}`;

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

// Support CLI execution
if (require.main === module) {
  runFullResearchCycle().catch(console.error);
}
