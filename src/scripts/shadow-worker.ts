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
  const result = await runAutopilotPipeline(targetKeyword, researchContext);

  if (result.status === "failed") {
    console.error(`[ShadowWorker] Pipeline failed: ${result.message}`);
    return;
  }

  // 4. Upload Assets to Supabase Storage
  // Note: runAutopilotPipeline saves to _approved_vault locally.
  const vaultDir = path.join(process.cwd(), "_approved_vault");
  if (!fs.existsSync(vaultDir)) {
    console.warn("[ShadowWorker] No approved vault found yet; skipping storage upload.");
    return;
  }

  const latestBatchEntry = result.vaultFolder
    ? {
        name: result.vaultFolder,
        fullPath: path.join(vaultDir, result.vaultFolder),
        time: fs.existsSync(path.join(vaultDir, result.vaultFolder))
          ? fs.statSync(path.join(vaultDir, result.vaultFolder)).mtime.getTime()
          : Date.now(),
      }
    : fs.readdirSync(vaultDir)
    .map(name => ({
      name,
      fullPath: path.join(vaultDir, name),
      time: fs.statSync(path.join(vaultDir, name)).mtime.getTime()
    }))
    .filter(entry => fs.statSync(entry.fullPath).isDirectory())
    .sort((a, b) => b.time - a.time)[0];

  if (!latestBatchEntry) {
    console.warn("[ShadowWorker] No batch folder found in approved vault.");
    return;
  }

  const latestBatch = latestBatchEntry.name;

  const batchPath = path.join(vaultDir, latestBatch);
  const zipFile = fs.readdirSync(batchPath).find(f => f.endsWith(".zip"));
  let publicUrl: string | null = null;

  if (zipFile) {
    console.log(`[ShadowWorker] Uploading ${zipFile} to Supabase...`);
    const zipPath = path.join(batchPath, zipFile);
    publicUrl = await uploadZipToStorage(zipPath, `${latestBatch}.zip`);

    if (publicUrl) {
      console.log(`[ShadowWorker] Cycle Successful! Public URL: ${publicUrl}`);
    } else {
      console.warn("[ShadowWorker] ZIP upload failed; saving generation record without a public URL.");
    }
  } else {
    console.warn("[ShadowWorker] No ZIP file found in batch; saving generation record without a public URL.");
  }

  // 5. Save the final record to Supabase DB even if storage upload fails.
  await saveFinalGeneration(
    targetKeyword,
    result.angle || "Experimental",
    result.slides || [],
    { bestDraftIndex: 0, score: result.score || 0, critique: result.critique || "" },
    publicUrl || undefined
  );

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
