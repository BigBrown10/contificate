import { compositeSlide } from "../lib/compositor";
import fs from "fs";
import path from "path";

async function test() {
  console.log("🧪 Testing Compositor Rendering...");
  const testImageUrl = "https://images.pexels.com/photos/143580/pexels-photo-143580.jpeg"; // Random portrait
  const testText = "The silent sadness?\nIt's the grip of the loop.";

  try {
    const buffer = await compositeSlide(testImageUrl, testText);
    const outputPath = path.join(process.cwd(), "test_render.png");
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Success! Rendered to: ${outputPath}`);
    console.log("Please open this file to verify if the text is visible and readable.");
  } catch (err) {
    console.error("❌ Test Failed:", err);
  }
}

test();
