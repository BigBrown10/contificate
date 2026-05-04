import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { uploadToTikTok } from "@/lib/tiktok-uploader";
import { generateStoryCaption } from "@/lib/gemini";
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

    const metadataPath = path.join(vaultPath, "metadata.json");
    let caption = `today's story in one line: change starts with one honest decision\n\n#${(keyword || "mindset").replace(/\s+/g, "").toLowerCase()} #discipline #growth #storytime`;

    if (fs.existsSync(metadataPath)) {
      try {
        const metadataRaw = fs.readFileSync(metadataPath, "utf8");
        const metadata = JSON.parse(metadataRaw) as {
          keyword?: string;
          angle?: string;
          slides?: Array<{ role?: string; text?: string }>;
        };
        const slidePayload = (metadata.slides || [])
          .filter((s) => typeof s.text === "string" && s.text.trim().length > 0)
          .map((s) => ({ role: s.role, text: s.text as string }));

        if (slidePayload.length > 0) {
          caption = await generateStoryCaption({
            keyword: metadata.keyword || keyword || "mindset",
            angle: metadata.angle,
            slides: slidePayload,
          });
        }
      } catch (captionErr) {
        console.warn("[Telegram-Approve] Caption generation failed, using fallback.", captionErr);
      }
    }
    
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
