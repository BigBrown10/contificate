// ─── JINTA Content Engine Constants ───
export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1920;

export const CTA_SLIDE_TEXT = "Build your kingdom in silence.\n\nSecure your access to jinta.xyz today.";
export const CTA_SLIDE_SUBTEXT = "jinta.xyz →";

// ─── JINTA Content Engine Types ───

import { FreesoundTrack } from "./freesound";

export interface StorySlide {
  text: string;
  role: "hook" | "problem" | "deepen" | "shift" | "insight" | "action" | "resolve";
}

export interface StorySequence {
  id: string;
  name: string;
  slides: StorySlide[];
}

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
  role: "hook" | "problem" | "deepen" | "shift" | "insight" | "action" | "resolve" | "cta";
  imageBase64: string;
  photographer: string;
}

export interface GenerateRequest {
  keyword: string;
  count: number;
}

export interface GenerationPlan {
  keyword: string;
  winningAngle: string;
  storySlides: StorySlide[];
  photos?: {
    url: string;
    photographer: string;
  }[];
  musicTrack?: FreesoundTrack | null;
  generatedAt: string;
  hookSource: string;
}

export interface GenerateResponse {
  plan?: GenerationPlan;
  slides?: GeneratedSlide[];
  keyword?: string;
  generatedAt?: string;
  hookSource?: "gemini" | "fallback";
  musicTrack?: FreesoundTrack | null;
}

export interface GenerateError {
  error: string;
  details?: string;
}

export interface JudgeResult {
  bestDraftIndex: number;
  score: number;
  critique: string;
}
