import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load .env.local manually
dotenv.config({ path: ".env.local" });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not found in .env.local");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log("🚀 Telegram HITL Listener started. Monitoring for Approvals/Rejections...");

bot.on("callback_query", async (callbackQuery) => {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;

  if (!action || !msg) return;

  const chatId = msg.chat.id;

  if (action.startsWith("approve_")) {
    const vaultFolder = action.replace("approve_", "");
    
    // Announce processing
    bot.answerCallbackQuery(callbackQuery.id, { text: "Posting to TikTok via Ayrshare..." });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msg.message_id });
    bot.sendMessage(chatId, `⏳ **Auto-posting process started for:** \`${vaultFolder}\``, { parse_mode: "Markdown" });

    try {
      // Find the folder locally
      const vaultPath = path.join(process.cwd(), "_approved_vault", vaultFolder);
      if (!fs.existsSync(vaultPath)) {
         bot.sendMessage(chatId, `❌ **Error:** Could not find local vault folder ${vaultFolder}`);
         return;
      }
      
      const metadataPath = path.join(vaultPath, "metadata.json");
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      
      // Execute TikTok post internally via Playwright
      const response = await fetch("http://localhost:3000/api/telegram-approve", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ keyword: metadata.keyword, folder: vaultFolder })
      });

      if (response.ok) {
         bot.sendMessage(chatId, `✅ **Success!** Native Playwright automation finished uploading to TikTok!`);
      } else {
         const errData = await response.json();
         bot.sendMessage(chatId, `⚠️ **Playwright Error:** ${errData.error || response.status}`);
      }
    } catch (e) {
      console.error(e);
      bot.sendMessage(chatId, `❌ **Error during approval:** ${e.message}`);
    }

  } else if (action.startsWith("reject_")) {
    const vaultFolder = action.replace("reject_", "");
    bot.answerCallbackQuery(callbackQuery.id, { text: "Rejected." });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msg.message_id });
    bot.sendMessage(chatId, `🗑️ **Rejected:** \`${vaultFolder}\` will not be posted.`);
  }
});
