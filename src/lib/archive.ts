import fs from "fs";
import path from "path";
// @ts-ignore - archiver types missing in devDependencies
import archiver from "archiver";

/**
 * Creates a ZIP file containing the specified images, optional caption text, and MP3 file.
 * Returns the path to the newly created ZIP file.
 */
export async function createBatchZip(
  folderPath: string,
  imageFiles: { name: string; base64: string }[],
  audioResourceUrl?: string,
  captionText?: string
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const zipPath = path.join(folderPath, "tiktok-batch.zip");
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      resolve(zipPath);
    });

    archive.on("error", (err: any) => {
      reject(err);
    });

    archive.pipe(output);

    // Append images
    for (const image of imageFiles) {
      archive.append(Buffer.from(image.base64, "base64"), { name: image.name });
    }

    if (captionText && captionText.trim().length > 0) {
      archive.append(Buffer.from(captionText.trim() + "\n", "utf8"), { name: "caption.txt" });
    }

    // Download and append audio
    if (audioResourceUrl) {
      try {
        const response = await fetch(audioResourceUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          archive.append(Buffer.from(arrayBuffer), { name: "background-track.mp3" });
        } else {
          console.error("[Archiver] Failed to fetch audio URL:", response.status);
        }
      } catch (err) {
        console.error("[Archiver] Error downloading audio:", err);
      }
    }

    archive.finalize();
  });
}
