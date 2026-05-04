import fs from "fs";

/**
 * Sends the generated ZIP package to Telegram for Human-in-the-Loop review.
 * Includes an inline keyboard to Approve/Post or Reject.
 */
export async function sendApprovalRequest(
  vaultFolderName: string,
  zipPath: string,
  angle: string,
  score: number,
  critique: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. HITL disabled.");
    return;
  }

  if (!fs.existsSync(zipPath)) {
    console.error(`[Telegram] ZIP file missing at path: ${zipPath}`);
    return;
  }

  try {
    const safeCritique = (critique || "No critique")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    const caption = [
      "JINTA Orchestrator: Ready for HITL review",
      `Angle: ${angle}`,
      `Judge Score: ${score}/10`,
      `Critique: ${safeCritique}`,
      "",
      "This ZIP contains generated carousel slides and a matching background track.",
      "Approve to trigger the TikTok autopost flow."
    ].join("\n");

    const formData = new FormData();
    const fileBuffer = await fs.promises.readFile(zipPath);
    const zipBlob = new Blob([fileBuffer], { type: "application/zip" });

    formData.append("chat_id", chatId);
    formData.append("caption", caption.slice(0, 1000));
    formData.append("document", zipBlob, "tiktok-batch.zip");
    
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "👍 Approve & Auto-Post (Stealth)", callback_data: `approve_${vaultFolderName}` },
          { text: "👎 Reject", callback_data: `reject_${vaultFolderName}` }
        ]
      ]
    };
    formData.append("reply_markup", JSON.stringify(inlineKeyboard));

    console.log(`[Telegram] Sending ZIP to Chat ID ${chatId}...`);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: formData as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Telegram] API Error:", response.status, errorText);
    } else {
      console.log(`[Telegram] Success: Content sent for HITL review!`);
    }

  } catch (error) {
    console.error(`[Telegram] Failed to send to Telegram:`, error);
  }
}
