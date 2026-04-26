import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({ insights: [], history: [] });
    }

    // 1. Fetch latest research insights (wider window), then balance by source
    const { data: insightRows, error: insightError } = await supabase
      .from("research_vault")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    // 2. Fetch latest shadow worker generations
    const { data: history, error: historyError } = await supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6);

    if (insightError || historyError) {
      throw new Error(insightError?.message || historyError?.message);
    }

    const bySource = new Map<string, any[]>();
    for (const row of insightRows || []) {
      const key = row.source_type || "unknown";
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key)!.push(row);
    }

    const balanced: any[] = [];
    const sourceOrder = ["reddit", "article", "youtube", "unknown"];
    for (const source of sourceOrder) {
      const rows = bySource.get(source) || [];
      balanced.push(...rows.slice(0, 4));
    }

    balanced.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({
      insights: balanced.slice(0, 12),
      history: history || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch swarm status";
    console.error("Swarm Status API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
