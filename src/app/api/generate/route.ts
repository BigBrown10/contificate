import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { fetchPortraitPhotos } from "@/lib/pexels";
import { compositeSlide, compositeCtaSlide } from "@/lib/compositor";
import { CTA_SLIDE_TEXT, CTA_SLIDE_SUBTEXT, GeneratedSlide, GenerateResponse, GenerateError } from "@/lib/types";
import { brainstormHooks, judgeDrafts } from "@/lib/gemini";
import { fetchMusicTracks } from "@/lib/freesound";

export const maxDuration = 60; // Allow up to 60s for batch processing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keyword: string = body.keyword?.trim();
    const count: number = Math.min(Math.max(body.count || 5, 2), 20);

    if (!keyword) {
      return NextResponse.json(
        { error: "Keyword is required." } as GenerateError,
        { status: 400 }
      );
    }

    // 1. Generate story hooks via Gemini 2.0 (High-IQ Narrative Engine)
    const storyTargetCount = count - 1; // Subtract 1 for the mandatory CTA slide
    const drafts = await brainstormHooks(keyword, storyTargetCount);
    const evaluation = await judgeDrafts(drafts);
    
    if (evaluation.bestDraftIndex === -1) {
       return NextResponse.json({ error: "The AI Judge rejected the content quality. Try a different keyword." }, { status: 500 });
    }
    
    const winningDraft = drafts[evaluation.bestDraftIndex];
    const storySlides = winningDraft.slides; 
    const countWithCta = storySlides.length + 1; 
    const hookSource = "gemini";

    console.log(
      `[Generate] Using Gemini 2.0 hooks: ${storySlides.length} story + 1 CTA`
    );

    // 2. Fetch photos from Pexels (Force raw keyword for imagery)
    const photos = await fetchPortraitPhotos(keyword, countWithCta);

    // 3. Auto-fetch matching music
    let selectedMusic = null;
    try {
      const tracks = await fetchMusicTracks(winningDraft.vibe || "dark", 1);
      if (tracks.length > 0) selectedMusic = tracks[0];
    } catch (err) {
      console.error("Failed to auto-fetch music:", err);
    }

    // Return the "Plan" for the frontend to process one-by-one
    return NextResponse.json({
      plan: {
        keyword,
        winningAngle: winningDraft.angle,
        storySlides, // Text hooks and roles
        photos: photos.map(p => ({
          url: p.src.portrait || p.src.large2x || p.src.large,
          photographer: p.photographer
        })),
        musicTrack: selectedMusic,
        generatedAt: new Date().toISOString(),
        hookSource: "gemini"
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate Plan API error:", message);
    return NextResponse.json(
      { error: message } as GenerateError,
      { status: 500 }
    );
  }
}
