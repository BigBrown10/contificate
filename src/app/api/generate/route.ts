import { NextRequest, NextResponse } from "next/server";
import { fetchPortraitPhotos } from "@/lib/pexels";
import { compositeSlide, compositeCtaSlide } from "@/lib/compositor";
import { CTA_SLIDE_TEXT, CTA_SLIDE_SUBTEXT } from "@/lib/hooks";
import { generateStoryHooks } from "@/lib/gemma";
import { GeneratedSlide, GenerateResponse, GenerateError } from "@/lib/types";

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

    // 1. Generate story hooks via Gemma (falls back to hardcoded)
    const storySlots = count - 1; // Reserve 1 for CTA
    const { slides: storySlides, source: hookSource } =
      await generateStoryHooks(keyword, storySlots);

    console.log(
      `[Generate] Using ${hookSource} hooks: ${storySlides.length} story + 1 CTA`
    );

    // 2. Fetch photos from Pexels
    const photos = await fetchPortraitPhotos(keyword, count);

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

    const response: GenerateResponse = {
      slides,
      keyword,
      generatedAt: new Date().toISOString(),
      hookSource, // "gemma" or "fallback" — so the UI can show which engine was used
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
