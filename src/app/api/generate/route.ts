import { NextRequest, NextResponse } from "next/server";
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

    // 2. Fetch photos from Pexels (Force use of raw keyword to avoid "corn plant" imagery)
    const photos = await fetchPortraitPhotos(keyword, countWithCta);

    // 3. Composite each slide
    const slides: GeneratedSlide[] = [];

    // Process story slides
    for (let i = 0; i < storySlides.length; i++) {
      const photo = photos[i];
      const storySlide = storySlides[i];

      try {
        const imageUrl =
          photo.src.portrait || photo.src.large2x || photo.src.large;
        const pngBuffer = await compositeSlide(imageUrl, storySlide.text);

        slides.push({
          id: `slide-${i + 1}-${Date.now()}`,
          hookText: storySlide.text,
          role: storySlide.role,
          imageBase64: `data:image/png;base64,${pngBuffer.toString("base64")}`,
          photographer: photo.photographer,
        });
      } catch (err) {
        console.error(`Failed to composite story slide ${i + 1}:`, err);
      }
    }

    // Process final CTA slide
    const ctaPhoto = photos[storySlides.length];
    try {
      const imageUrl =
        ctaPhoto.src.portrait || ctaPhoto.src.large2x || ctaPhoto.src.large;
      const pngBuffer = await compositeCtaSlide(
        imageUrl,
        CTA_SLIDE_TEXT,
        CTA_SLIDE_SUBTEXT
      );

      slides.push({
        id: `slide-cta-${Date.now()}`,
        hookText: CTA_SLIDE_TEXT.split("\n")[0],
        role: "cta",
        imageBase64: `data:image/png;base64,${pngBuffer.toString("base64")}`,
        photographer: ctaPhoto.photographer,
      });
    } catch (err) {
      console.error(`Failed to composite CTA slide:`, err);
    }

    if (slides.length === 0) {
      return NextResponse.json(
        {
          error: "Failed to generate any slides. Try a different keyword.",
        } as GenerateError,
        { status: 500 }
      );
    }

    // 4. Auto-fetch a matching music track for the ZIP
    let selectedMusic = null;
    try {
      const tracks = await fetchMusicTracks(winningDraft.vibe || "dark", 1);
      if (tracks.length > 0) selectedMusic = tracks[0];
    } catch (err) {
      console.error("Failed to auto-fetch music:", err);
    }

    const response: GenerateResponse & { musicTrack?: any } = {
      slides,
      keyword,
      generatedAt: new Date().toISOString(),
      hookSource,
      musicTrack: selectedMusic,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate API error:", message);
    return NextResponse.json(
      { error: message } as GenerateError,
      { status: 500 }
    );
  }
}
