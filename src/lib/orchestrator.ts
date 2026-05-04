import fs from "fs";
import path from "path";
import os from "os";
import { selectDraftWithTaste, JudgeResult, generateStoryCaption } from "./gemini";
import { fetchPortraitPhotos } from "./pexels";
import { compositeSlide, compositeCtaSlide } from "./compositor";
import { GeneratedSlide, CTA_SLIDE_TEXT, CTA_SLIDE_SUBTEXT } from "./types";
import { fetchMusicTracks, FreesoundTrack } from "./freesound";
import { createBatchZip } from "./archive";
import { sendApprovalRequest } from "./telegram";

export interface OrchestratorResult {
  status: "posted" | "saved_for_review" | "failed";
  score?: number;
  critique?: string;
  angle?: string;
  vaultFolder?: string;
  slides?: GeneratedSlide[];
  message: string;
}

/**
 * Runs the full agentic pipeline: 
 * 1. Brainstorm -> 2. Judge -> 3. Generate Visuals -> 4. Publish / Save
 */
export async function runAutopilotPipeline(keyword: string, researchContext: string = ""): Promise<OrchestratorResult> {
  console.log(`[Orchestrator] Starting Autopilot Pipeline for: "${keyword}"`);

  // Step 1 & 2: Taste-gated story pipeline
  let winningDraft;
  let evaluation: JudgeResult;
  try {
    const selection = await selectDraftWithTaste(keyword, 6, researchContext, 3);
    winningDraft = selection.draft;
    evaluation = selection.evaluation;
  } catch (err) {
    console.error(`[Orchestrator] Brainstormer failed:`, err);
    return { status: "failed", message: "Failed to brainstorm hooks via Gemini." };
  }

  // Reject if poor quality
  if (evaluation.bestDraftIndex === -1 || evaluation.score < 8) {
    return {
      status: "failed",
      score: evaluation.score,
      critique: evaluation.critique,
      message: "The Judge rejected all generated concepts (score < 8/10). Pipeline aborted."
    };
  }

  console.log(`[Orchestrator] Winner chosen! Score: ${evaluation.score}/10. Angle: ${winningDraft.angle}`);

  try {
    // Step 3: Fetch Images & Composite Visuals (Force use of raw keyword to avoid "corn plant" imagery)
    const expectedSlidesCount = winningDraft.slides.length + 1; // +1 for CTA
    const photos = await fetchPortraitPhotos(keyword, expectedSlidesCount);
    
    if (photos.length < expectedSlidesCount) {
      return { status: "failed", message: "Pexels failed to return enough images for the sequence." };
    }

    const generatedSlides: GeneratedSlide[] = [];

    // Generate Story Slides
    for (let i = 0; i < winningDraft.slides.length; i++) {
      const photo = photos[i];
      const storySlide = winningDraft.slides[i];
      const imageUrl = photo.src.portrait || photo.src.large2x || photo.src.large;
      
      const pngBuffer = await compositeSlide(imageUrl, storySlide.text);
      generatedSlides.push({
        id: `slide-${i + 1}-${Date.now()}`,
        hookText: storySlide.text,
        role: storySlide.role,
        imageBase64: `data:image/png;base64,${pngBuffer.toString("base64")}`,
        photographer: photo.photographer,
      });
    }

    // Generate CTA Slide
    const ctaPhoto = photos[winningDraft.slides.length];
    const ctaImageUrl = ctaPhoto.src.portrait || ctaPhoto.src.large2x || ctaPhoto.src.large;
    const ctaBuffer = await compositeCtaSlide(ctaImageUrl, CTA_SLIDE_TEXT, CTA_SLIDE_SUBTEXT);
    
    generatedSlides.push({
      id: `slide-cta-${Date.now()}`,
      hookText: "Waitlist CTA",
      role: "cta",
      imageBase64: `data:image/png;base64,${ctaBuffer.toString("base64")}`,
      photographer: ctaPhoto.photographer,
    });

    const captionText = await generateStoryCaption({
      keyword,
      angle: winningDraft.angle,
      slides: generatedSlides.map((slide) => ({
        role: slide.role,
        text: slide.hookText,
      })),
    });

    // Step 4: Save to Vault, Zip, and Push to Telegram
    let vaultPath: string | null = null;
    try {
      vaultPath = await saveToApprovedVault(keyword, winningDraft.angle, generatedSlides, evaluation, captionText);
    } catch (err) {
      console.error(`[Orchestrator] Failed to persist vault batch:`, err);
    }
    
    // Fetch matching music
    let audioUrl: string | undefined;
    try {
      const musicTracks = await fetchMusicTracks(winningDraft.vibe, 1, keyword);
      if (musicTracks.length > 0) audioUrl = musicTracks[0].previewUrl;
    } catch (err) {
      console.error(`[Orchestrator] Failed to fetch music for vibe ${winningDraft.vibe}:`, err);
    }

    // Create ZIP
    const base64Files = generatedSlides.map((s, i) => ({
      name: `slide_${i + 1}_${s.role}.png`,
      base64: s.imageBase64.replace(/^data:image\/png;base64,/, "")
    }));

    let zipPath: string | null = null;
    if (vaultPath) {
      try {
        zipPath = await createBatchZip(vaultPath, base64Files, audioUrl, captionText);
      } catch (err) {
        console.error(`[Orchestrator] Failed to create ZIP:`, err);
      }
    }

    // Send to Telegram HITL
    if (vaultPath && zipPath) {
      try {
        await sendApprovalRequest(
          path.basename(vaultPath),
          zipPath,
          winningDraft.angle,
          evaluation.score,
          evaluation.critique
        );
      } catch (err) {
        console.error(`[Orchestrator] Failed to send Telegram approval:`, err);
      }
    }

    return {
      status: "saved_for_review",
      score: evaluation.score,
      critique: evaluation.critique,
      angle: winningDraft.angle,
      vaultFolder: vaultPath ? path.basename(vaultPath) : undefined,
      slides: generatedSlides,
      message: `Scored ${evaluation.score}/10. Saved to local vault for manual review.`
    };
  } catch (err) {
    console.error(`[Orchestrator] Content pipeline failed:`, err);
    return {
      status: "failed",
      score: evaluation.score,
      critique: evaluation.critique,
      angle: winningDraft.angle,
      message: err instanceof Error ? err.message : "Content pipeline failed during asset generation."
    };
  }
}

/**
 * Saves generated content to the local disk (_approved_vault folder).
 * Returns the absolute path of the created folder.
 */
function saveToApprovedVault(
  keyword: string,
  angle: string,
  slides: GeneratedSlide[],
  evaluation: JudgeResult,
  captionText?: string
): string {
  const vaultDir = getApprovedVaultRoot();
  if (!fs.existsSync(vaultDir)) {
    fs.mkdirSync(vaultDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const folderName = `${keyword.replace(/\s+/g, "-")}_${scoreStr(evaluation.score)}_${timestamp}`;
  const savePath = path.join(vaultDir, folderName);
  
  fs.mkdirSync(savePath, { recursive: true });

  // Write images
  slides.forEach((slide, index) => {
    const base64Data = slide.imageBase64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(path.join(savePath, `slide_${index + 1}_${slide.role}.png`), base64Data, "base64");
  });

  // Write metadata
  const metadata = {
    keyword,
    angle,
    score: evaluation.score,
    critique: evaluation.critique,
    caption: captionText,
    slides: slides.map((slide, index) => ({
      order: index + 1,
      role: slide.role,
      text: slide.hookText,
    })),
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(savePath, `metadata.json`), JSON.stringify(metadata, null, 2));

  console.log(`[Orchestrator] Saved batch to ${savePath}`);
  return savePath;
}

function getApprovedVaultRoot(): string {
  const customVaultRoot = process.env.JINTA_VAULT_ROOT;
  if (customVaultRoot) {
    return customVaultRoot;
  }

  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "jinta-approved-vault");
  }

  return path.join(process.cwd(), "_approved_vault");
}

function scoreStr(score: number) {
  return score >= 9 ? "BANGER" : "REVIEW";
}
