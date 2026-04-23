import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { compositeSlide, compositeCtaSlide } from "@/lib/compositor";
import { CTA_SLIDE_TEXT, CTA_SLIDE_SUBTEXT } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, text, role, photographer } = body;

    if (!imageUrl || !text) {
      return NextResponse.json({ error: "Image URL and text are required." }, { status: 400 });
    }

    console.log(`[Process] Compositing slide: ${role}. Text length: ${text.length}`);

    let pngBuffer: Buffer;
    if (role === "cta") {
      pngBuffer = await compositeCtaSlide(imageUrl, CTA_SLIDE_TEXT, CTA_SLIDE_SUBTEXT);
    } else {
      pngBuffer = await compositeSlide(imageUrl, text);
    }

    return NextResponse.json({
      slide: {
        id: `slide-${role}-${Date.now()}`,
        hookText: text.split("\n")[0],
        role: role,
        imageBase64: `data:image/png;base64,${pngBuffer.toString("base64")}`,
        photographer: photographer || "Unknown",
      }
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Compositing failed";
    console.error("Process API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
