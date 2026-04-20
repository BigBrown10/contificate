import { PexelsPhoto, PexelsSearchResponse } from "./types";

const PEXELS_API_BASE = "https://api.pexels.com/v1";

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
        const photos = await searchPexels(apiKey, term, perSearch);
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
      const photos = await searchPexels(apiKey, fallbackTerm, count * 2);
      allPhotos.push(...photos);
    } catch {
      // Fall back to raw keyword
    }
  }

  // Final fallback: raw keyword
  if (allPhotos.length < count) {
    const photos = await searchPexels(apiKey, keyword, count * 2);
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

  // Shuffle and return requested count
  const shuffled = unique.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Raw Pexels API search call.
 */
async function searchPexels(
  apiKey: string,
  query: string,
  perPage: number
): Promise<PexelsPhoto[]> {
  const params = new URLSearchParams({
    query,
    orientation: "portrait",
    per_page: String(Math.min(perPage, 80)),
    page: "1",
    size: "large",
  });

  const response = await fetch(`${PEXELS_API_BASE}/search?${params}`, {
    headers: { Authorization: apiKey },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Pexels rate limit reached (200 req/hr).");
    }
    throw new Error(`Pexels API error ${response.status}`);
  }

  const data: PexelsSearchResponse = await response.json();
  return data.photos || [];
}
