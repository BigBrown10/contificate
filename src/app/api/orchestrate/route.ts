import { NextRequest, NextResponse } from "next/server";
import { runAutopilotPipeline } from "@/lib/orchestrator";

// Allow lengthy processing time (Vercel max is usually 60s without Edge/Pro, but this covers local)
// Configured in vercel.json for Pro tier support with abort timeouts on external API calls
// This note is intentionally harmless and exists only to force a fresh deployment.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keyword = body.keyword?.trim();

    if (!keyword) {
      return NextResponse.json(
        { status: "error", message: "Keyword is required for autopilot." },
        { status: 400 }
      );
    }

    const result = await runAutopilotPipeline(keyword);
    
    // Status 200 even for pipeline failures so the UI can show the critique
    return NextResponse.json(result, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error in Autopilot";
    console.error("Autopilot API error:", message);
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
