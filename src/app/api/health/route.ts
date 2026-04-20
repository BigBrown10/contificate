import { NextResponse } from "next/server";
import { checkOllamaHealth } from "@/lib/gemma";

export async function GET() {
  const ollama = await checkOllamaHealth();

  return NextResponse.json({
    status: "ok",
    ollama,
    services: {
      pexels: !!process.env.PEXELS_API_KEY,
      freesound: !!process.env.FREESOUND_API_KEY,
      gemma: ollama.available,
    },
  });
}
