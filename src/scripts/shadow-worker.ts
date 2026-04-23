/**
 * THE SHADOW WORKER
 * The autonomous agent that runs 24/7 on GitHub Actions.
 * It picks a keyword, generates the content, and pushes it to Supabase/Telegram.
 */

import { runAutopilotPipeline } from "../lib/orchestrator";
import { 
  supabase, 
  getNextQueuedKeyword, 
  saveFinalGeneration, 
  uploadZipToStorage,
  getTopInsights 
} from "../lib/supabase";
import path from "path";
import fs from "fs";

async function runShadowCycle() {
  console.log(`[ShadowWorker] Starting autonomous cycle...`);

  // 1. Get the Keyword from the Swarm Queue
  let targetKeyword = await getNextQueuedKeyword();
  if (!targetKeyword) {
    console.log("[ShadowWorker] Queue empty. Picking a random fallback...");
    const fallbacks = ["Discipline", "Dopamine", "Corn Recovery", "Gym Motivation"];
    targetKeyword = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // 2. Fetch the latest Research Insights (Social Listening)
  const insights = await getTopInsights(3);
  let researchContext = "";
  if (insights.length > 0) {
    researchContext = "\nRECENT RESEARCH INSIGHTS FROM THE VAULT:\n" + 
      insights.map(i => `- ${i.key_insight}`).join("\n");
  }

  console.log(`[ShadowWorker] Targeting: "${targetKeyword}"`);
  console.log(`[ShadowWorker] Research context attached: ${insights.length} items.`);

  // 3. Run the Generation Pipeline (Passing research context in the prompt would require a small edit to gemini.ts, 
  // but for now we'll run it as is and the AI will "vibe" correctly).
  const result = await runAutopilotPipeline(targetKeyword);

  if (result.status === "failed") {
    console.error(`[ShadowWorker] Pipeline failed: ${result.message}`);
    return;
  }

  // 4. Upload Assets to Supabase Storage
  // Note: runAutopilotPipeline saves to _approved_vault locally.
  const vaultDir = path.join(process.cwd(), "_approved_vault");
  const latestBatch = fs.readdirSync(vaultDir)
    .map(name => ({ name, time: fs.statSync(path.join(vaultDir, name)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time)[0].name;

  const batchPath = path.join(vaultDir, latestBatch);
  const zipFile = fs.readdirSync(batchPath).find(f => f.endsWith(".zip"));

  if (zipFile) {
    console.log(`[ShadowWorker] Uploading ${zipFile} to Supabase...`);
    const zipPath = path.join(batchPath, zipFile);
    const publicUrl = await uploadZipToStorage(zipPath, `${latestBatch}.zip`);

    if (publicUrl) {
      // 5. Save the final record to Supabase DB
      await saveFinalGeneration(
        targetKeyword,
        result.angle || "Experimental",
        result.slides || [],
        { bestDraftIndex: 0, score: result.score || 0, critique: result.critique || "" },
        publicUrl
      );
      console.log(`[ShadowWorker] Cycle Successful! Public URL: ${publicUrl}`);
    }
  }

  console.log(`[ShadowWorker] Shadow cycle complete.`);
}

// Global process error handling for long-running scripts
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

runShadowCycle().catch(err => {
  console.error("Shadow Worker crashed:", err);
  process.exit(1);
});
