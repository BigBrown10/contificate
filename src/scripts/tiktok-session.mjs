import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import readline from "readline";

chromium.use(stealth());

const STATE_FILE = path.join(process.cwd(), "tiktok_state.json");

async function main() {
  console.log("🚀 Booting TikTok Session Capture...");
  
  const browser = await chromium.launch({
    headless: false, // Must be visible for manual login
    args: ["--disable-blink-features=AutomationControlled"]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();
  await page.goto("https://www.tiktok.com/login");

  console.log("=========================================");
  console.log("⚠️  ACTION REQUIRED: ");
  console.log("Please log into your TikTok account in the opened browser window.");
  console.log("Solve any captchas and ensure you are fully logged in and on the homepage.");
  console.log("=========================================");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("👉 Press Enter HERE when you are successfully logged in...", async () => {
    // Save state
    await context.storageState({ path: STATE_FILE });
    console.log(`✅ Session saved successfully to: ${STATE_FILE}`);
    
    await browser.close();
    rl.close();
    process.exit(0);
  });
}

main().catch(console.error);
