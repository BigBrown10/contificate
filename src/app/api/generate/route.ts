import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { fetchPortraitPhotos } from "@/lib/pexels";
import { compositeSlide, compositeCtaSlide } from "@/lib/compositor";
import { CTA_SLIDE_TEXT, CTA_SLIDE_SUBTEXT, GeneratedSlide, GenerateResponse, GenerateError } from "@/lib/types";
import { selectDraftWithTaste } from "@/lib/gemini";
import { fetchMusicTracks } from "@/lib/freesound";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60; // Allow up to 60s for batch processing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keyword: string = body.keyword?.trim();
    const isVercel = Boolean(process.env.VERCEL);
    const count: number = isVercel
      ? Math.min(Math.max(body.count || 5, 2), 4)
      : Math.min(Math.max(body.count || 5, 2), 20);

    // --- KNOWLEDGE BASE RETRIEVAL: relevance + source diversity ---
    const keywordTokens = keyword
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);

    let insightRows: any[] | null = null;
    if (isSupabaseConfigured && supabase) {
      const result = await supabase
        .from("research_vault")
        .select("key_insight, source_url, source_type, original_content, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      insightRows = result.data;
    }

    let activeInsights: any[] | null = null;
    if (insightRows && insightRows.length > 0) {
      const scored = insightRows.map((row) => {
        const hay = `${row.key_insight || ""} ${row.original_content || ""}`.toLowerCase();
        const score = keywordTokens.reduce((acc, token) => {
          return acc + (hay.includes(token) ? 1 : 0);
        }, 0);
        return { row, score };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime();
      });

      const perSource = new Map<string, number>();
      const picked: any[] = [];
      for (const item of scored) {
        if (picked.length >= 6) break;
        const source = item.row.source_type || "unknown";
        const used = perSource.get(source) || 0;
        if (used >= 2) continue;
        picked.push(item.row);
        perSource.set(source, used + 1);
      }

      activeInsights = picked;
    }
    
    const researchContext = activeInsights && activeInsights.length > 0
      ? activeInsights.map(i => `[Source: ${i.source_type}] - ${i.key_insight}`).join("\n")
      : "";

    // 1. Generate story hooks via Gemini 2.5 (High-IQ Narrative Engine)
    const storyTargetCount = count - 1;
     const { draft: winningDraft } = await selectDraftWithTaste(
      keyword,
      storyTargetCount,
      researchContext,
      isVercel ? 1 : 3
    );
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
    if (!isVercel) {
      try {
        const tracks = await fetchMusicTracks(winningDraft.vibe || "dark", 1, keyword);
        if (tracks.length > 0) selectedMusic = tracks[0];
      } catch (err) {
        console.error("Failed to auto-fetch music:", err);
      }
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
        hookSource: "gemini",
        researchSources: activeInsights // Attribution
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
