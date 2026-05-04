import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { fetchPortraitPhotos } from "@/lib/pexels";
import { compositeSlide, compositeCtaSlide } from "@/lib/compositor";
import { CTA_SLIDE_TEXT, CTA_SLIDE_SUBTEXT } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, keyword, text, role, photographer } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    let resolvedImageUrl = imageUrl as string | undefined;
    let resolvedPhotographer = photographer as string | undefined;

    if (!resolvedImageUrl) {
      const searchKeyword = (keyword || text || "").trim();
      if (!searchKeyword) {
        return NextResponse.json({ error: "Image URL or keyword is required." }, { status: 400 });
      }

      const [photo] = await fetchPortraitPhotos(searchKeyword, 1);
      resolvedImageUrl = photo?.src.portrait || photo?.src.large2x || photo?.src.large;
      resolvedPhotographer = photo?.photographer || resolvedPhotographer;
    }

    if (!resolvedImageUrl) {
      return NextResponse.json({ error: "Unable to resolve a source image." }, { status: 500 });
    }

    console.log(`[Process] Compositing slide: ${role}. Text length: ${text.length}`);

    let pngBuffer: Buffer;
    if (role === "cta") {
      pngBuffer = await compositeCtaSlide(resolvedImageUrl, CTA_SLIDE_TEXT, CTA_SLIDE_SUBTEXT);
    } else {
      pngBuffer = await compositeSlide(resolvedImageUrl, text);
    }

    return NextResponse.json({
      slide: {
        id: `slide-${role}-${Date.now()}`,
        hookText: text.split("\n")[0],
        role: role,
        imageBase64: `data:image/png;base64,${pngBuffer.toString("base64")}`,
        photographer: resolvedPhotographer || "Unknown",
      }
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Compositing failed";
    console.error("Process API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
