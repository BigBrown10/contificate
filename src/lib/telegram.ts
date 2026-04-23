import fs from "fs";
import FormData from "form-data";

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

  try {
    const caption = `🚀 **JINTA AI Orchestrator: Ready for HITL Review**\n\n🔹 **Angle:** ${angle}\n🧠 **Judge Score:** ${score}/10\n💡 **Critique:** ${critique}\n\nThe ZIP contains the generated carousel slides and the matching background track.\n\nDo you want to auto-post this batch to TikTok via Ayrshare?`;

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    formData.append("parse_mode", "Markdown");
    formData.append("document", fs.createReadStream(zipPath));
    
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
      headers: formData.getHeaders(),
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
