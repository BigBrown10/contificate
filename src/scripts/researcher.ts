/**
 * THE LIBRARIAN AGENT
 * Scrapes top recovery subreddits (r/pornfree, r/NoFap) to extract real human 
 * pain points and insights for the JINTA Copywriter.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase, saveResearch } from "../lib/supabase";

const redditSubs = ["pornfree", "NoFap", "getdisciplined"];
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function scrapeReddit() {
  console.log(`[Librarian] Starting research on Reddit...`);

  for (const sub of redditSubs) {
    try {
      // Fetch top posts of the week in JSON format (no API key needed)
      const res = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=week&limit=5`);
      if (!res.ok) continue;

      const data = await res.json();
      const posts = data.data.children;

      for (const post of posts) {
        const { title, selftext, url, score } = post.data;
        if (score < 50) continue; // Only high-signal posts

        console.log(`[Librarian] Analyzing: "${title}"`);

        // Use Gemini to extract the "Raw Human Insight"
        const prompt = `
          Analyze this Reddit post title and content. 
          Extract one visceral, raw human insight about their struggle with corn addiction. 
          What is the REAL pain point? Use their exact tone.

          Title: ${title}
          Content: ${selftext.slice(0, 1000)}

          Return only the insight (1-2 sentences).
        `;

        const result = await model.generateContent(prompt);
        const insight = result.response.text().trim();

        // Save to Supabase
        await saveResearch("reddit", title + "\n" + selftext.slice(0, 500), insight, `https://reddit.com${url}`);
      }
    } catch (err) {
      console.error(`[Librarian] Failed to scrape r/${sub}:`, err);
    }
  }
  console.log(`[Librarian] Research cycle complete.`);
}

// Run if called directly
if (require.main === module) {
  scrapeReddit().catch(console.error);
}
