import { createClient } from "@supabase/supabase-js";
import { GeneratedSlide, JudgeResult } from "./types";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials missing. Persistent state will be disabled.");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * --- QUEUE HELPERS (Autonomous Swarm) ---
 */

export async function getNextQueuedKeyword() {
  const { data, error } = await supabase
    .from("queue")
    .select("keyword")
    .eq("status", "active")
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.keyword;
}

/**
 * --- RESEARCH HELPERS (Librarian Agent) ---
 */

export async function saveResearch(type: "reddit" | "youtube" | "article", content: string, insight: string, url?: string) {
  const { error } = await supabase.from("research_vault").insert({
    source_type: type,
    original_content: content,
    key_insight: insight,
    source_url: url,
  });
  return !error;
}

export async function getTopInsights(count: number = 5) {
  const { data, error } = await supabase
    .from("research_vault")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(count);

  if (error) return [];
  return data;
}

/**
 * --- PIPELINE HELPERS (Generation Storage) ---
 */

export async function saveFinalGeneration(
  keyword: string, 
  angle: string, 
  slides: GeneratedSlide[], 
  evaluation: JudgeResult, 
  zipUrl?: string
) {
  const { data, error } = await supabase.from("generations").insert({
    keyword,
    angle,
    score: evaluation.score,
    critique: evaluation.critique,
    zip_url: zipUrl,
    status: "pending_review",
  }).select();

  return data ? data[0] : null;
}

/**
 * --- STORAGE HELPERS (ZIP Upload) ---
 */

export async function uploadZipToStorage(filePath: string, fileName: string) {
  const fs = require("fs");
  const fileBuffer = fs.readFileSync(filePath);

  const { data, error } = await supabase.storage
    .from("jinta-bundles")
    .upload(`${fileName}`, fileBuffer, {
      contentType: "application/zip",
      upsert: true,
    });

  if (error) {
    console.error("Storage upload failed:", error.message);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from("jinta-bundles")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
