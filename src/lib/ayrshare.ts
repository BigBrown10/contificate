import { GeneratedSlide } from "./types";

const AYRSHARE_API_URL = "https://app.ayrshare.com/api";

/**
 * Uploads a base64 image to Ayrshare to get a hosted URL required for posting.
 */
async function uploadImageToAyrshare(base64DataUri: string, filename: string): Promise<string> {
  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) throw new Error("AYRSHARE_API_KEY is not defined");

  const response = await fetch(`${AYRSHARE_API_URL}/media`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      file: base64DataUri,
      fileName: filename
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ayrshare upload failed: ${err}`);
  }

  const data = await response.json();
  return data.url; // Ayrshare hosted URL
}

/**
 * Creates a TikTok post with a photo carousel.
 * @param slides The generated slides containing base64 images.
 * @param caption The description/caption for the post.
 */
export async function postTikTokCarousel(slides: GeneratedSlide[], caption: string) {
  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) {
    console.warn("[Ayrshare] Missing API key, skipping auto-post.");
    return false;
  }

  console.log(`[Ayrshare] Uploading ${slides.length} images to Ayrshare servers...`);
  
  // 1. Upload all slides to Ayrshare to get host URLs
  const uploadPromises = slides.map((slide, index) => 
    uploadImageToAyrshare(slide.imageBase64, `slide-${index}.png`)
  );
  
  const hostedUrls = await Promise.all(uploadPromises);
  console.log("[Ayrshare] All images uploaded successfully.");

  // 2. Create the TikTok post
  console.log("[Ayrshare] Sending TikTok carousel post request...");
  
  const postResponse = await fetch(`${AYRSHARE_API_URL}/post`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      post: caption,
      platforms: ["tiktok"],
      mediaUrls: hostedUrls
    })
  });

  if (!postResponse.ok) {
    const err = await postResponse.text();
    throw new Error(`Ayrshare TikTok post failed: ${err}`);
  }

  const result = await postResponse.json();
  console.log("[Ayrshare] Successfully posted to TikTok!", result);
  return result;
}
