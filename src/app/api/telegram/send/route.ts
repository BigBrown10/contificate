import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import fs from "fs";
import os from "os";
import path from "path";
import JSZip from "jszip";
import { sendApprovalRequest } from "@/lib/telegram";
import { GeneratedSlide } from "@/lib/types";

interface BatchMetadata {
  keyword?: string;
  angle?: string;
  score?: number;
  critique?: string;
  caption?: string;
}

interface PreviewSlidePayload {
  imageBase64: string;
  role?: GeneratedSlide["role"];
  hookText?: string;
  photographer?: string;
}

interface PreviewBatchPayload {
  keyword?: string;
  angle?: string;
  caption?: string;
  slides?: PreviewSlidePayload[];
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

function stripDataUrlPrefix(value: string) {
  return value.replace(/^data:image\/png;base64,/, "");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "preview";
}

async function sendSavedFolderToTelegram(folder: string) {
  const vaultRoot = getApprovedVaultRoot();
  if (!fs.existsSync(vaultRoot)) {
    return NextResponse.json({ error: "No approved vault folder exists yet." }, { status: 404 });
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
}

async function sendPreviewBatchToTelegram(payload: PreviewBatchPayload) {
  const slides = Array.isArray(payload.slides) ? payload.slides : [];
  if (slides.length === 0) {
    return NextResponse.json({ error: "No preview slides were provided." }, { status: 400 });
  }

  const zip = new JSZip();
  slides.forEach((slide, index) => {
    zip.file(
      `slide_${String(index + 1).padStart(2, "0")}_${slide.role || "slide"}.png`,
      stripDataUrlPrefix(slide.imageBase64),
      { base64: true }
    );
  });

  const caption = payload.caption?.trim() || "Preview batch generated from deployed autopilot.";
  const keyword = payload.keyword?.trim() || "preview";
  const angle = payload.angle?.trim() || keyword;

  zip.file("caption.txt", `${caption}\n`);
  zip.file(
    "metadata.json",
    JSON.stringify(
      {
        keyword,
        angle,
        caption,
        generatedAt: new Date().toISOString(),
        slides: slides.map((slide, index) => ({
          order: index + 1,
          role: slide.role,
          text: slide.hookText,
          photographer: slide.photographer,
        })),
      },
      null,
      2
    )
  );

  const zipBuffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jinta-preview-"));
  const zipFileName = `${slugify(keyword || angle)}.zip`;
  const tempZipPath = path.join(tempDir, zipFileName);
  fs.writeFileSync(tempZipPath, zipBuffer);

  await sendApprovalRequest(
    `preview_${Date.now()}`,
    tempZipPath,
    angle,
    0,
    "Preview batch generated from deployed autopilot.",
    {
      includeActions: false,
      zipFileName,
      messageOverride: "JINTA Preview Batch: Ready for Telegram review",
    }
  );

  return NextResponse.json({
    success: true,
    preview: true,
    message: "Preview batch sent to Telegram.",
  });
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

    const body = await request.json().catch(() => ({} as BatchMetadata & PreviewBatchPayload & { folder?: string }));
    const requestedFolder = typeof body?.folder === "string" ? body.folder.trim() : "";
    const previewSlides = Array.isArray(body?.slides) ? body.slides : [];
    if (requestedFolder) {
      return await sendSavedFolderToTelegram(requestedFolder);
    }

    if (previewSlides.length > 0) {
      return await sendPreviewBatchToTelegram(body);
    }

    return NextResponse.json({ error: "No approved vault folder or preview slides were provided." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error sending to Telegram";
    console.error("Telegram Send API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}