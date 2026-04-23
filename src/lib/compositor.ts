import sharp from "sharp";
import { SLIDE_WIDTH, SLIDE_HEIGHT, CTA_SLIDE_SUBTEXT } from "./types";

/**
 * JINTA Slide Compositor
 *
 * Composites a Pexels photo into a TikTok-ready 1080×1920 slide with:
 * 1. Full-bleed background image (cover-cropped)
 * 2. Dark gradient overlay (bottom 60%)
 * 3. "JINTA" wordmark (top-left)
 * 4. Hook text (bold, white, centered, bottom third)
 * 5. CTA line ("Download JINTA. Link in bio.")
 */
export async function compositeSlide(
  imageUrl: string,
  hookText: string
): Promise<Buffer> {
  // 1. Fetch the image from Pexels
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  // 2. Resize/crop to exact slide dimensions
  const baseImage = sharp(imageBuffer).resize(SLIDE_WIDTH, SLIDE_HEIGHT, {
    fit: "cover",
    position: "centre",
  });

  // 3. Create gradient overlay SVG (bottom 60%)
  const gradientOverlay = createGradientOverlay();

  // 4. Create JINTA wordmark SVG
  const logoOverlay = createLogoOverlay();

  // 5. Create hook text SVG
  const hookOverlay = createHookTextOverlay(hookText);
  // Calculate raw line count for positioning logic
  const linesCount = wrapText(hookText, 25).length;

  // 7. Composite all layers
  const result = await baseImage
    .composite([
      { input: gradientOverlay, top: 0, left: 0 },
      { input: logoOverlay, top: 60, left: 48 },
      { input: hookOverlay, top: SLIDE_HEIGHT - (450 + (linesCount * 30)), left: 0 },
    ])
    .png({ quality: 90 })
    .toBuffer();

  return result;
}

/**
 * Composites the FINAL CTA slide — different layout:
 * - Heavier dark overlay (entire image)
 * - Large JINTA logo centered
 * - CTA heading text
 * - Subtext ("Link in bio →")
 */
export async function compositeCtaSlide(
  imageUrl: string,
  ctaHeading: string,
  ctaSubtext: string
): Promise<Buffer> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  const baseImage = sharp(imageBuffer).resize(SLIDE_WIDTH, SLIDE_HEIGHT, {
    fit: "cover",
    position: "centre",
  });

  const darkOverlay = createFullDarkOverlay();
  const bigLogo = createBigLogoOverlay();
  const ctaHeadingOverlay = createCtaHeadingOverlay(ctaHeading);
  const ctaSubOverlay = createCtaSubtextOverlay(ctaSubtext);

  const result = await baseImage
    .composite([
      { input: darkOverlay, top: 0, left: 0 },
      { input: bigLogo, top: 500, left: (SLIDE_WIDTH - 500) / 2 },
      { input: ctaHeadingOverlay, top: 900, left: 0 },
      { input: ctaSubOverlay, top: 1400, left: 0 },
    ])
    .png({ quality: 90 })
    .toBuffer();

  return result;
}

// ─── SVG Layer Generators ───

function createGradientOverlay(): Buffer {
  const svg = `
    <svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0" />
          <stop offset="30%" stop-color="#000000" stop-opacity="0" />
          <stop offset="55%" stop-color="#000000" stop-opacity="0.4" />
          <stop offset="75%" stop-color="#000000" stop-opacity="0.7" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.92" />
        </linearGradient>
      </defs>
      <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="url(#grad)" />
    </svg>
  `;
  return Buffer.from(svg);
}

/**
 * Full dark overlay for CTA slide — 75% opacity everywhere.
 */
function createFullDarkOverlay(): Buffer {
  const svg = `
    <svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="#000000" opacity="0.75" />
    </svg>
  `;
  return Buffer.from(svg);
}

function createLogoOverlay(): Buffer {
  const svg = `
    <svg width="240" height="70" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.7" />
        </filter>
      </defs>
      <text
        x="0"
        y="50"
        font-family="DejaVu Sans, sans-serif"
        font-size="44"
        font-weight="900"
        fill="white"
      >JINTA</text>
    </svg>
  `;
  return Buffer.from(svg);
}

/**
 * Big centered JINTA logo for CTA slide.
 */
function createBigLogoOverlay(): Buffer {
  const svg = `
    <svg width="500" height="120" xmlns="http://www.w3.org/2000/svg">
      <text
        x="250"
        y="90"
        font-family="sans-serif"
        font-size="100"
        font-weight="900"
        fill="white"
        text-anchor="middle"
        letter-spacing="16"
      >JINTA</text>
    </svg>
  `;
  return Buffer.from(svg);
}

function createHookTextOverlay(hookText: string): Buffer {
  const fontSize = 64; // Increased for impact
  const lineHeight = 86;
  const lines = wrapText(hookText, 25);
  const totalTextHeight = lines.length * lineHeight;
  const padding = 60;
  const boxHeight = totalTextHeight + (padding * 2);
  const svgWidth = SLIDE_WIDTH;
  
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${svgWidth / 2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("\n        ");

  const svg = `
    <svg width="${svgWidth}" height="${boxHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- High-Prestige Cinematic Shadow Box -->
      <rect 
        x="0" 
        y="0" 
        width="${svgWidth}" 
        height="${boxHeight}" 
        fill="#000000" 
        fill-opacity="0.6" 
      />
      <text
        x="${svgWidth / 2}"
        y="${padding + fontSize - 10}"
        font-family="DejaVu Sans, sans-serif"
        font-size="${fontSize}"
        font-weight="900"
        fill="#ffffff"
        text-anchor="middle"
      >
        ${tspans}
      </text>
    </svg>
  `;
  return Buffer.from(svg);
}

/**
 * CTA heading for the final slide — larger text, gold accent.
 */
function createCtaHeadingOverlay(text: string): Buffer {
  const fontSize = 48;
  const lineHeight = 66;
  const lines = wrapText(text, 24);
  const totalTextHeight = lines.length * lineHeight;
  const svgHeight = 450;
  const startY = (svgHeight - totalTextHeight) / 2 + fontSize;

  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${SLIDE_WIDTH / 2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("\n        ");

  const svg = `
    <svg width="${SLIDE_WIDTH}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${SLIDE_WIDTH / 2}"
        y="${startY}"
        font-family="sans-serif"
        font-size="${fontSize}"
        font-weight="900"
        fill="white"
        text-anchor="middle"
        letter-spacing="1"
      >
        ${tspans}
      </text>
    </svg>
  `;
  return Buffer.from(svg);
}

/**
 * Subtext for CTA slide ("Link in bio →").
 */
function createCtaSubtextOverlay(text: string): Buffer {
  const svg = `
    <svg width="${SLIDE_WIDTH}" height="80" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${SLIDE_WIDTH / 2}"
        y="50"
        font-family="sans-serif"
        font-size="32"
        font-weight="600"
        fill="#D4AF37"
        text-anchor="middle"
        letter-spacing="3"
      >${escapeXml(text)}</text>
    </svg>
  `;
  return Buffer.from(svg);
}

function createCtaOverlay(text: string): Buffer {
  const svg = `
    <svg width="${SLIDE_WIDTH}" height="80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="ctaShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="#000000" flood-opacity="0.6" />
        </filter>
      </defs>
      <text
        x="${SLIDE_WIDTH / 2}"
        y="40"
        font-family="Arial, Helvetica, sans-serif"
        font-size="26"
        font-weight="400"
        fill="white"
        text-anchor="middle"
        opacity="0.85"
        letter-spacing="2"
        filter="url(#ctaShadow)"
      >${escapeXml(text)}</text>
    </svg>
  `;
  return Buffer.from(svg);
}

// ─── Utilities ───

function wrapText(text: string, maxChars: number): string[] {
  // Handle explicit newlines first
  const paragraphs = text.split("\n").filter((p) => p.trim().length > 0);
  const allLines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxChars) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) allLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) allLines.push(currentLine);
  }

  return allLines;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
