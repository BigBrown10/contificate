import fs from "fs";
import os from "os";
import path from "path";

const LOCAL_CACHE_DIR = path.join(process.cwd(), "_cache");
const FALLBACK_CACHE_DIR = path.join(os.tmpdir(), "contificate-cache");

function ensureWritableDirectory(dir: string) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveCacheFile(fileName: string) {
  const preferredDir = process.env.CONTIFICATE_CACHE_DIR || LOCAL_CACHE_DIR;
  const cacheDir = ensureWritableDirectory(preferredDir)
    ? preferredDir
    : FALLBACK_CACHE_DIR;

  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, fileName);
}