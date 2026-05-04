import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import fs from "fs";
import path from "path";
import { sendApprovalRequest } from "@/lib/telegram";

interface BatchMetadata {
  keyword?: string;
  angle?: string;
  score?: number;
  critique?: string;
}

function getApprovedVaultRoot() {
  return path.join(process.cwd(), "_approved_vault");
}

function findLatestFolder(vaultRoot: string) {
  const folders = fs
    .readdirSync(vaultRoot)
    .map((name) => {
      const fullPath = path.join(vaultRoot, name);
      const stats = fs.statSync(fullPath);
      return stats.isDirectory()
        ? { name, fullPath, createdAt: stats.mtimeMs }
        : null;
    })
    .filter((entry): entry is { name: string; fullPath: string; createdAt: number } => entry !== null)
    .sort((a, b) => b.createdAt - a.createdAt);

  return folders[0]?.name || null;
}

function findZipPath(vaultPath: string) {
  const zipFile = fs.readdirSync(vaultPath).find((file) => file.endsWith(".zip"));
  return zipFile ? path.join(vaultPath, zipFile) : null;
}

export async function POST(request: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json(
        { error: "Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({} as { folder?: string }));
    const requestedFolder = typeof body?.folder === "string" ? body.folder.trim() : "";

    const vaultRoot = getApprovedVaultRoot();
    if (!fs.existsSync(vaultRoot)) {
      return NextResponse.json({ error: "No approved vault folder exists yet." }, { status: 404 });
    }

    const folder = requestedFolder || findLatestFolder(vaultRoot);
    if (!folder) {
      return NextResponse.json({ error: "No approved vault batch was found." }, { status: 404 });
    }

    const vaultPath = path.join(vaultRoot, folder);
    if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
      return NextResponse.json({ error: "Folder not found locally." }, { status: 404 });
    }

    const metadataPath = path.join(vaultPath, "metadata.json");
    const zipPath = findZipPath(vaultPath);

    if (!zipPath) {
      return NextResponse.json({ error: "ZIP file not found in the selected batch." }, { status: 404 });
    }

    const metadata: BatchMetadata = fs.existsSync(metadataPath)
      ? JSON.parse(fs.readFileSync(metadataPath, "utf8"))
      : {};

    await sendApprovalRequest(
      folder,
      zipPath,
      metadata.angle || metadata.keyword || folder,
      typeof metadata.score === "number" ? metadata.score : 0,
      metadata.critique || "Manual Telegram send from the dashboard."
    );

    return NextResponse.json({
      success: true,
      folder,
      message: `Sent ${folder} to Telegram for HITL review.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error sending to Telegram";
    console.error("Telegram Send API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}