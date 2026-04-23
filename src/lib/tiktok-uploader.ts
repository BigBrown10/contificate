
async function getChromium() {
  const { chromium } = await import("playwright-extra");
  const stealth = (await import("puppeteer-extra-plugin-stealth")).default;
  chromium.use(stealth());
  return chromium;
}
import fs from "fs";
import path from "path";

export async function uploadToTikTok(
  slidePaths: string[],
  captionText: string
): Promise<boolean> {
  const STATE_FILE = path.join(process.cwd(), "tiktok_state.json");
  
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error("Missing tiktok_state.json. Please run 'node src/scripts/tiktok-session.mjs' first.");
  }
  
  const chromium = await getChromium();
  const browser = await chromium.launch({
    headless: true, // Auto-set true for serverless/worker environments
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({
    storageState: STATE_FILE,
    viewport: { width: 1280, height: 720 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();

  try {
    console.log("🌐 Navigating to TikTok Upload portal...");
    await page.goto("https://www.tiktok.com/creator-center/upload", { waitUntil: "networkidle" });
    
    // Sometimes it redirects to standard tiktok.com/upload
    await page.waitForTimeout(5000); 

    // Find the file input and inject the multiple slides!
    // Often TikTok puts it in an IFrame, let's try direct first.
    console.log("📁 Attaching photo slides...");
    
    // We try to locate the file input directly
    let fileInput = page.locator('input[type="file"]');
    
    // If TikTok is using an iframe right now
    if (await fileInput.count() === 0) {
      console.log("Looking inside iframe...");
      const frame = page.frames().find(f => f.url().includes('creator-center') || f.url().includes('upload'));
      if (frame) {
        fileInput = frame.locator('input[type="file"]');
      }
    }

    if (await fileInput.count() === 0) {
      throw new Error("Could not find the File Input handle on TikTok. The UI might have changed.");
    }

    // Attach all slide paths
    await fileInput.first().setInputFiles(slidePaths);
    console.log(`✅ Uploaded ${slidePaths.length} PNGs into the browser.`);

    // Wait for TikTok to process the batch of images
    await page.waitForTimeout(10000);

    // Type the caption
    console.log("✍️ Typing caption...");
    // Find Draft Editor
    const editorParts = [
      '[contenteditable="true"]',
      '.public-DraftEditor-content',
      '.DraftEditor-root'
    ];
    
    let editorFound = false;
    for (const sel of editorParts) {
      const editor = page.locator(sel).first();
      if (await editor.isVisible().catch(()=>false)) {
        await editor.click();
        // Type out the caption slowly like a human
        await page.keyboard.type(captionText, { delay: 50 });
        editorFound = true;
        break;
      }
    }

    // If we're inside an iframe
    if (!editorFound) {
      const frame = page.frames().find(f => f.url().includes('creator-center') || f.url().includes('upload'));
      if (frame) {
        for (const sel of editorParts) {
           const editor = frame.locator(sel).first();
           if (await editor.isVisible().catch(()=>false)) {
             await editor.click();
             await frame.page().keyboard.type(captionText, { delay: 50 });
             editorFound = true;
             break;
           }
        }
      }
    }

    if (!editorFound) {
      console.warn("⚠️ Could not find caption text box, but continuing anyway...");
    }

    // Wait a few seconds to let any auto-checks finish
    await page.waitForTimeout(5000);

    console.log("🚀 Clicking POST button...");
    // Standard text matches for post button.
    const postButtonMatches = [
      page.getByRole("button", { name: "Post" }),
      page.locator('button:has-text("Post")'),
    ];

    let clicked = false;
    for (const btn of postButtonMatches) {
        if (await btn.count() > 0 && await btn.first().isVisible()) {
           await btn.first().click();
           clicked = true;
           break;
        }
    }

    if (!clicked) {
       // Check iframe
       const frame = page.frames().find(f => f.url().includes('upload'));
       if (frame) {
         const btn = frame.locator('button:has-text("Post")');
         if (await btn.count() > 0 && await btn.first().isVisible()) {
             await btn.first().click();
             clicked = true;
         }
       }
    }

    if (!clicked) {
      throw new Error("Could not find the Post button.");
    }

    console.log("✅ Post button clicked!");
    // Wait for success banner
    await page.waitForTimeout(10000); 

    // Refresh storage state (keeps cookies fresh)
    await context.storageState({ path: STATE_FILE });

    await browser.close();
    return true;
  } catch (err) {
    console.error("❌ Playwright Automation Failed:", err);
    await browser.close();
    throw err;
  }
}
