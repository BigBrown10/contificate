import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { uploadToTikTok } from "@/lib/tiktok-uploader";
import path from "path";
import fs from "fs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folder, keyword } = body;

    const vaultPath = path.join(process.cwd(), "_approved_vault", folder);
    
    if (!fs.existsSync(vaultPath)) {
      return NextResponse.json({ error: "Folder not found locally." }, { status: 404 });
    }

    // Get all PNGs inside the designated vault
    const files = fs.readdirSync(vaultPath).filter(f => f.endsWith(".png")).sort();
    const absoluteSlidePaths = files.map(file => path.join(vaultPath, file));

    const caption = `Are you ready to level up? Start acting like it.\n\n#${keyword?.replace(/\s+/g, '')} #discipline #jinta #masculinity #mindset`;
    
    console.log(`[Telegram-Approve] Spawning Playwright to upload ${folder} to TikTok natively...`);
    
    await uploadToTikTok(absoluteSlidePaths, caption);
    
    return NextResponse.json({ success: true, message: "Playwright Automation complete." }, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error in Auto-Post";
    console.error("[Telegram-Approve] API error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
