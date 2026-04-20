// ─── JINTA Content Engine Types ───

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  liked: boolean;
  alt: string;
}

export interface PexelsSearchResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page?: string;
}

export interface GeneratedSlide {
  id: string;
  hookText: string;
  role: "hook" | "problem" | "deepen" | "shift" | "resolve" | "cta";
  imageBase64: string;
  photographer: string;
}

export interface GenerateRequest {
  keyword: string;
  count: number;
}

export interface GenerateResponse {
  slides: GeneratedSlide[];
  keyword: string;
  generatedAt: string;
  hookSource?: "gemma" | "fallback";
}

export interface GenerateError {
  error: string;
  details?: string;
}
