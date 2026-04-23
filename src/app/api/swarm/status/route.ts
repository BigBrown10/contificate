import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch latest research insights
    const { data: insights, error: insightError } = await supabase
      .from("research_vault")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6);

    // 2. Fetch latest shadow worker generations
    const { data: history, error: historyError } = await supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6);

    if (insightError || historyError) {
      throw new Error(insightError?.message || historyError?.message);
    }

    return NextResponse.json({
      insights: insights || [],
      history: history || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch swarm status";
    console.error("Swarm Status API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
