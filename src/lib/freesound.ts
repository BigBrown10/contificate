// ─── Freesound API Integration ───
// Fetches royalty-free instrumental music previews for TikTok slides.
// Uses preview-hq-mp3 URLs which don't require OAuth2.

import fs from "fs";
import path from "path";

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

const MUSIC_USAGE_FILE = path.join(process.cwd(), "_cache", "music-usage.json");

function loadMusicUsage(): { recentTrackIds: number[] } {
  try {
    if (!fs.existsSync(MUSIC_USAGE_FILE)) return { recentTrackIds: [] };
    return JSON.parse(fs.readFileSync(MUSIC_USAGE_FILE, "utf8"));
  } catch {
    return { recentTrackIds: [] };
  }
}

function saveMusicUsage(data: { recentTrackIds: number[] }) {
  const dir = path.dirname(MUSIC_USAGE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MUSIC_USAGE_FILE, JSON.stringify(data, null, 2), "utf8");
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Searches Freesound for instrumental music tracks matching a mood.
 * Returns preview MP3 URLs (no OAuth needed — just API key).
 *
 * @param mood - Mood keyword (e.g. "dark", "motivational", "gym")
 * @param count - Number of tracks to return (default 5)
 */
export async function fetchMusicTracks(
  mood: string,
  count: number = 5,
  keyword?: string
): Promise<FreesoundTrack[]> {
  const apiKey = process.env.FREESOUND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "FREESOUND_API_KEY is not set. Get one free at https://freesound.org/apiv2/apply/"
    );
  }

  // Map mood and keyword to a strict search query
  const normalizedMood = mood.toLowerCase().trim();
  const moodQuery = MOOD_KEYWORDS[normalizedMood] || MOOD_KEYWORDS["default"];
  const keywordTerms = (keyword || "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2)
    .slice(0, 4)
    .join(" ");

  const searchQuery = keywordTerms
    ? `${keywordTerms} ${moodQuery} instrumental`
    : moodQuery;

  const params = new URLSearchParams({
    query: searchQuery,
    fields: "id,name,duration,previews,username,license,tags",
    filter: "duration:[30 TO 180]", // 30s - 3min tracks
    sort: "score",
    page_size: String(Math.min(count * 8, 40)), // Fetch much wider to allow randomization
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

  const usage = loadMusicUsage();
  const filteredByRecency = withPreviews.filter((r) => !usage.recentTrackIds.includes(r.id));
  const pool = filteredByRecency.length >= count ? filteredByRecency : withPreviews;
  const chosen = shuffle(pool).slice(0, count);

  const tracks: FreesoundTrack[] = chosen.map((r) => ({
    id: r.id,
    name: r.name,
    duration: Math.round(r.duration),
    previewUrl: r.previews!["preview-hq-mp3"]!,
    username: r.username,
    license: r.license,
    tags: r.tags.slice(0, 5),
  }));

  usage.recentTrackIds = [...tracks.map((t) => t.id), ...usage.recentTrackIds].slice(0, 20);
  saveMusicUsage(usage);

  return tracks;
}
