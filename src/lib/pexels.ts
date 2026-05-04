import { PexelsPhoto, PexelsSearchResponse } from "./types";
import fs from "fs";
import path from "path";
import { resolveCacheFile } from "./runtime-cache";

const PEXELS_API_BASE = "https://api.pexels.com/v1";
const PEXELS_USAGE_FILE = resolveCacheFile("pexels-usage.json");
const PIXABAY_API_BASE = "https://pixabay.com/api";
const UNSPLASH_API_BASE = "https://api.unsplash.com/search/photos";

/**
 * Maps user-facing keywords to Pexels search terms that return
 * clean editorial photos (no baked-in text, no letter blocks, no quotes).
 *
 * The problem: searching "success mindset" on Pexels returns motivational
 * poster images with text already on them, which clashes with our overlays.
 * Solution: translate to photographic/visual keywords.
 */
const KEYWORD_ENRICHMENTS: Record<string, string[]> = {
  "success mindset": ["man confident portrait", "businessman silhouette", "focused athlete"],
  "success": ["man suit city", "confident portrait dark", "luxury watch hands"],
  "mindset": ["man thinking window", "morning routine male", "meditation man"],
  "gym motivation": ["weightlifting dark gym", "athlete training intense", "muscular back gym"],
  "gym": ["dark gym weights", "man deadlift", "boxing training"],
  "motivation": ["man running dawn", "climb mountain peak", "ocean waves power"],
  "luxury lifestyle": ["luxury car night", "penthouse city view", "designer watch wrist"],
  "luxury car": ["sports car dark", "supercar street night", "car interior luxury"],
  "luxury": ["gold black aesthetic", "expensive watch", "private jet interior"],
  "discipline": ["cold shower man", "early morning run", "clean desk minimal"],
  "confidence": ["man walking city", "sharp dressed man", "eye contact portrait"],
  "self improvement": ["reading book man", "journal writing", "sunrise jog silhouette"],
  "nofap": ["man meditating nature", "cold water splashing", "focused eyes portrait"],
  "porn addiction": ["man in shadow", "broken chain", "sunrise new beginning"],
};

/**
 * Fetches portrait-oriented photos from Pexels for a given keyword.
 * Uses enriched search terms to get clean editorial photos.
 */
export async function fetchPortraitPhotos(
  keyword: string,
  count: number
): Promise<PexelsPhoto[]> {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "PEXELS_API_KEY is not set. Add it to your .env.local file."
    );
  }

  // Find enrichment terms, or use the keyword directly with "dark portrait" appended
  const normalizedKeyword = keyword.toLowerCase().trim();
  const enrichedTerms = KEYWORD_ENRICHMENTS[normalizedKeyword];

  let allPhotos: PexelsPhoto[] = [];

  if (enrichedTerms) {
    // Search multiple enriched terms and combine for variety
    const searches = enrichedTerms.slice(0, 3);
    const perSearch = Math.ceil((count * 2) / searches.length); // fetch 2x so we can pick the best

    for (const term of searches) {
      try {
        const photos = await searchAllProviders(apiKey, term, perSearch);
        allPhotos.push(...photos);
      } catch {
        // Skip failed searches, continue with others
      }
    }
  }

  // If enrichment didn't give us enough, fall back to original keyword + "dark portrait"
  if (allPhotos.length < count) {
    const fallbackTerm = `${keyword} dark portrait`;
    try {
      const photos = await searchAllProviders(apiKey, fallbackTerm, count * 2);
      allPhotos.push(...photos);
    } catch {
      // Fall back to raw keyword
    }
  }

  // Final fallback: raw keyword
  if (allPhotos.length < count) {
    const photos = await searchAllProviders(apiKey, keyword, count * 2);
    allPhotos.push(...photos);
  }

  if (allPhotos.length === 0) {
    throw new Error(
      `No photos found for keyword "${keyword}". Try a different keyword.`
    );
  }

  // Deduplicate by photo ID
  const seen = new Set<number>();
  const unique = allPhotos.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const selected = selectDiversePhotos(unique, count);
  recordImageUsage(selected);
  return selected;
}

async function searchAllProviders(apiKey: string, query: string, perPage: number) {
  const results = await Promise.allSettled([
    searchPexels(apiKey, query, perPage),
    searchPixabay(query, perPage),
    searchUnsplash(query, perPage),
  ]);

  const merged: PexelsPhoto[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      merged.push(...result.value);
    }
  }
  return merged;
}

function loadUsage(): Record<string, { count: number; firstSlideCount: number }> {
  try {
    if (!fs.existsSync(PEXELS_USAGE_FILE)) return {};
    return JSON.parse(fs.readFileSync(PEXELS_USAGE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveUsage(usage: Record<string, { count: number; firstSlideCount: number }>) {
  const dir = path.dirname(PEXELS_USAGE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(PEXELS_USAGE_FILE, JSON.stringify(usage, null, 2), "utf8");
}

function photoKey(photo: PexelsPhoto) {
  return String(photo.id);
}

function selectDiversePhotos(unique: PexelsPhoto[], count: number): PexelsPhoto[] {
  const usage = loadUsage();
  const shuffled = [...unique].sort(() => Math.random() - 0.5);

  // Never reuse a first-slide image if alternatives exist.
  const firstSlideCandidates = shuffled.filter((photo) => {
    const key = photoKey(photo);
    const stats = usage[key];
    return !stats || stats.firstSlideCount === 0;
  });
  const firstSlidePhoto = firstSlideCandidates[0] || shuffled[0];
  const selected: PexelsPhoto[] = [];
  if (firstSlidePhoto) selected.push(firstSlidePhoto);

  // For all other slide positions, cap each photo to 2 lifetime uses if possible.
  for (const photo of shuffled) {
    if (selected.length >= count) break;
    if (photo.id === firstSlidePhoto?.id) continue;
    const key = photoKey(photo);
    const stats = usage[key];
    if (!stats || stats.count < 2) {
      selected.push(photo);
    }
  }

  // If strict constraints run out of options, relax to fill batch.
  for (const photo of shuffled) {
    if (selected.length >= count) break;
    if (selected.some((s) => s.id === photo.id)) continue;
    selected.push(photo);
  }

  return selected.slice(0, count);
}

function recordImageUsage(selected: PexelsPhoto[]) {
  const usage = loadUsage();
  selected.forEach((photo, index) => {
    const key = photoKey(photo);
    const current = usage[key] || { count: 0, firstSlideCount: 0 };
    current.count += 1;
    if (index === 0) current.firstSlideCount += 1;
    usage[key] = current;
  });
  saveUsage(usage);
}

/**
 * Raw Pexels API search call.
 */
async function searchPexels(
  apiKey: string,
  query: string,
  perPage: number
): Promise<PexelsPhoto[]> {
  const totalPerPage = Math.min(perPage, 80);
  const pageCount = Math.min(3, Math.max(1, Math.ceil(perPage / 40)));
  const collected: PexelsPhoto[] = [];

  for (let page = 1; page <= pageCount; page++) {
    const params = new URLSearchParams({
      query,
      orientation: "portrait",
      per_page: String(totalPerPage),
      page: String(page),
      size: "large",
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout
    try {
      const response = await fetch(`${PEXELS_API_BASE}/search?${params}`, {
        headers: { Authorization: apiKey },
        next: { revalidate: 3600 },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Pexels rate limit reached (200 req/hr).");
        }
        throw new Error(`Pexels API error ${response.status}`);
      }

      const data: PexelsSearchResponse = await response.json();
      collected.push(...(data.photos || []));
      if (!data.next_page) break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return collected;
}

interface PixabayResponse {
  hits: Array<{
    id: number;
    largeImageURL: string;
    webformatURL: string;
    user: string;
    user_id: number;
    tags: string;
    imageWidth: number;
    imageHeight: number;
  }>;
}

async function searchPixabay(query: string, perPage: number): Promise<PexelsPhoto[]> {
  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (!pixabayKey) return [];

  const params = new URLSearchParams({
    key: pixabayKey,
    q: query,
    image_type: "photo",
    orientation: "vertical",
    safesearch: "true",
    per_page: String(Math.min(perPage, 50)),
    page: "1",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  try {
    const response = await fetch(`${PIXABAY_API_BASE}/?${params}`, {
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const data: PixabayResponse = await response.json();
    return (data.hits || []).map((hit) => ({
      id: Number(`2${hit.id}`),
      width: hit.imageWidth || 1080,
      height: hit.imageHeight || 1920,
      url: hit.largeImageURL || hit.webformatURL,
      photographer: hit.user || "Pixabay",
      photographer_url: `https://pixabay.com/users/${hit.user || ""}-${hit.user_id || ""}/`,
      photographer_id: hit.user_id || 0,
      avg_color: "#111111",
      src: {
        original: hit.largeImageURL || hit.webformatURL,
        large2x: hit.largeImageURL || hit.webformatURL,
        large: hit.webformatURL || hit.largeImageURL,
        medium: hit.webformatURL || hit.largeImageURL,
        small: hit.webformatURL || hit.largeImageURL,
        portrait: hit.largeImageURL || hit.webformatURL,
        landscape: hit.webformatURL || hit.largeImageURL,
        tiny: hit.webformatURL || hit.largeImageURL,
      },
      liked: false,
      alt: hit.tags || "pixabay image",
    }));
  } finally {
    clearTimeout(timeoutId);
  }
}

interface UnsplashResponse {
  results: Array<{
    id: string;
    width: number;
    height: number;
    alt_description: string | null;
    user: {
      name: string;
      username: string;
    };
    urls: {
      raw: string;
      full: string;
      regular: string;
      small: string;
      thumb: string;
    };
  }>;
}

async function searchUnsplash(query: string, perPage: number): Promise<PexelsPhoto[]> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) return [];

  const params = new URLSearchParams({
    query,
    orientation: "portrait",
    per_page: String(Math.min(perPage, 30)),
    page: "1",
    content_filter: "high",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  try {
    const response = await fetch(`${UNSPLASH_API_BASE}?${params}`, {
      headers: {
        Authorization: `Client-ID ${unsplashKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const data: UnsplashResponse = await response.json();
    return (data.results || []).map((item, index) => ({
      id: Number(`3${index}${Math.abs(hashCode(item.id))}`),
      width: item.width || 1080,
      height: item.height || 1920,
      url: item.urls.full || item.urls.regular,
      photographer: item.user?.name || "Unsplash",
      photographer_url: `https://unsplash.com/@${item.user?.username || ""}`,
      photographer_id: 0,
      avg_color: "#101010",
      src: {
        original: item.urls.raw || item.urls.full,
        large2x: item.urls.full || item.urls.regular,
        large: item.urls.regular || item.urls.full,
        medium: item.urls.regular || item.urls.small,
        small: item.urls.small || item.urls.thumb,
        portrait: item.urls.regular || item.urls.full,
        landscape: item.urls.regular || item.urls.full,
        tiny: item.urls.thumb || item.urls.small,
      },
      liked: false,
      alt: item.alt_description || "unsplash image",
    }));
  } finally {
    clearTimeout(timeoutId);
  }
}

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
