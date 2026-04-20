// ─── Freesound API Integration ───
// Fetches royalty-free instrumental music previews for TikTok slides.
// Uses preview-hq-mp3 URLs which don't require OAuth2.

export interface FreesoundTrack {
  id: number;
  name: string;
  duration: number;
  previewUrl: string; // HQ MP3 preview (~128kbps)
  username: string;
  license: string;
  tags: string[];
}

interface FreesoundSearchResult {
  id: number;
  name: string;
  duration: number;
  previews?: {
    "preview-hq-mp3"?: string;
    "preview-lq-mp3"?: string;
    "preview-hq-ogg"?: string;
    "preview-lq-ogg"?: string;
  };
  username: string;
  license: string;
  tags: string[];
}

interface FreesoundSearchResponse {
  count: number;
  results: FreesoundSearchResult[];
}

/**
 * Maps user-facing mood/keywords to Freesound search queries
 * that return clean instrumental tracks (no vocals).
 */
const MOOD_KEYWORDS: Record<string, string> = {
  "dark": "dark cinematic instrumental",
  "motivational": "motivational epic instrumental",
  "luxury": "luxury lounge smooth instrumental",
  "gym": "intense workout instrumental beat",
  "success": "triumphant orchestral instrumental",
  "calm": "calm ambient piano instrumental",
  "aggressive": "aggressive trap beat instrumental",
  "emotional": "emotional piano cinematic instrumental",
  "confident": "confident hip hop beat instrumental",
  "default": "dark cinematic motivational instrumental",
};

/**
 * Searches Freesound for instrumental music tracks matching a mood.
 * Returns preview MP3 URLs (no OAuth needed — just API key).
 *
 * @param mood - Mood keyword (e.g. "dark", "motivational", "gym")
 * @param count - Number of tracks to return (default 5)
 */
export async function fetchMusicTracks(
  mood: string,
  count: number = 5
): Promise<FreesoundTrack[]> {
  const apiKey = process.env.FREESOUND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "FREESOUND_API_KEY is not set. Get one free at https://freesound.org/apiv2/apply/"
    );
  }

  // Map mood to search query
  const normalizedMood = mood.toLowerCase().trim();
  const searchQuery =
    MOOD_KEYWORDS[normalizedMood] || MOOD_KEYWORDS["default"];

  const params = new URLSearchParams({
    query: searchQuery,
    fields: "id,name,duration,previews,username,license,tags",
    filter: "duration:[30 TO 180]", // 30s - 3min tracks
    sort: "rating_desc",
    page_size: String(Math.min(count * 2, 15)), // Fetch extra in case some lack previews
    token: apiKey,
  });

  const response = await fetch(
    `https://freesound.org/apiv2/search/text/?${params}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error("Freesound rate limit reached. Try again later.");
    }
    if (response.status === 401) {
      throw new Error("Invalid Freesound API key. Check your .env.local.");
    }
    throw new Error(`Freesound API error ${response.status}: ${errorText}`);
  }

  const data: FreesoundSearchResponse = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error(
      `No music found for mood "${mood}". Try "dark", "motivational", or "gym".`
    );
  }

  // Filter to only tracks that have HQ MP3 previews
  const withPreviews = data.results.filter(
    (r) => r.previews && r.previews["preview-hq-mp3"]
  );

  const tracks: FreesoundTrack[] = withPreviews.slice(0, count).map((r) => ({
    id: r.id,
    name: r.name,
    duration: Math.round(r.duration),
    previewUrl: r.previews!["preview-hq-mp3"]!,
    username: r.username,
    license: r.license,
    tags: r.tags.slice(0, 5),
  }));

  return tracks;
}
