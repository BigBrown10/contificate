import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { generateStoryCaption } from "@/lib/gemini";

interface CaptionSlide {
  role?: string;
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keyword: string = body.keyword?.trim();
    const angle: string | undefined = body.angle?.trim();
    const slides: CaptionSlide[] = Array.isArray(body.slides) ? body.slides : [];

    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required." }, { status: 400 });
    }

    if (slides.length === 0) {
      return NextResponse.json({ error: "At least one slide is required." }, { status: 400 });
    }

    const caption = await generateStoryCaption({ keyword, angle, slides });

    return NextResponse.json({ caption });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Caption generation failed";
    console.error("Caption API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
