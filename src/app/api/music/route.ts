import { NextRequest, NextResponse } from "next/server";
import { fetchMusicTracks } from "@/lib/freesound";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mood = searchParams.get("mood") || "dark";
    const keyword = searchParams.get("keyword") || undefined;
    const count = Math.min(Math.max(Number(searchParams.get("count")) || 5, 1), 10);

    const tracks = await fetchMusicTracks(mood, count, keyword);

    return NextResponse.json({
      tracks,
      mood,
      keyword,
      availableMoods: [
        "dark",
        "motivational",
        "luxury",
        "gym",
        "success",
        "calm",
        "aggressive",
        "emotional",
        "confident",
      ],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Music API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
