"use client";

import { useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import { GeneratedSlide, GenerateResponse } from "@/lib/types";

type AppState = "idle" | "loading" | "done" | "error";

interface MusicTrack {
  id: number;
  name: string;
  duration: number;
  previewUrl: string;
  username: string;
  license: string;
  tags: string[];
}

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [count, setCount] = useState(10);
  const [state, setState] = useState<AppState>("idle");
  const [slides, setSlides] = useState<GeneratedSlide[]>([]);
  const [error, setError] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [generatedKeyword, setGeneratedKeyword] = useState("");
  const [generationTime, setGenerationTime] = useState(0);
  const [hookSource, setHookSource] = useState<"gemma" | "fallback" | null>(null);

  // Music state
  const [musicMood, setMusicMood] = useState("dark");
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState("");
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!keyword.trim()) return;

    setState("loading");
    setError("");
    setSlides([]);
    setLoadingMessage("Searching Pexels for images...");

    const startTime = Date.now();

    try {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed < 5) {
          setLoadingMessage("Fetching portrait images from Pexels...");
        } else if (elapsed < 15) {
          setLoadingMessage("Compositing slides with hooks & overlays...");
        } else if (elapsed < 30) {
          setLoadingMessage("Almost there — rendering final PNGs...");
        } else {
          setLoadingMessage("Processing large batch — hang tight...");
        }
      }, 3000);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), count }),
      });

      clearInterval(interval);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      const data: GenerateResponse = await response.json();
      const elapsed = (Date.now() - startTime) / 1000;

      setSlides(data.slides);
      setGeneratedKeyword(data.keyword);
      setGenerationTime(Math.round(elapsed));
      setHookSource(data.hookSource || "fallback");
      setState("done");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setState("error");
    }
  }, [keyword, count]);

  const handleFetchMusic = useCallback(async () => {
    setMusicLoading(true);
    setMusicError("");
    setMusicTracks([]);

    try {
      const response = await fetch(
        `/api/music?mood=${encodeURIComponent(musicMood)}&count=5`
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Server error: ${response.status}`);
      }
      const data = await response.json();
      setMusicTracks(data.tracks);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch music";
      setMusicError(message);
    } finally {
      setMusicLoading(false);
    }
  }, [musicMood]);

  const handlePlayPause = useCallback(
    (track: MusicTrack) => {
      if (playingTrackId === track.id) {
        // Pause current
        audioRef.current?.pause();
        setPlayingTrackId(null);
      } else {
        // Play new
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(track.previewUrl);
        audio.onended = () => setPlayingTrackId(null);
        audio.play();
        audioRef.current = audio;
        setPlayingTrackId(track.id);
      }
    },
    [playingTrackId]
  );

  const handleDownloadSingle = useCallback(
    (slide: GeneratedSlide, index: number) => {
      const link = document.createElement("a");
      link.href = slide.imageBase64;
      link.download = `jinta-slide-${String(index + 1).padStart(2, "0")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    []
  );

  const handleDownloadZip = useCallback(async () => {
    if (slides.length === 0) return;

    const zip = new JSZip();

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const base64Data = slide.imageBase64.replace(
        /^data:image\/png;base64,/,
        ""
      );
      zip.file(
        `jinta-slide-${String(i + 1).padStart(2, "0")}.png`,
        base64Data,
        { base64: true }
      );
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jinta-slides-${generatedKeyword}-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [slides, generatedKeyword]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && state !== "loading") {
        handleGenerate();
      }
    },
    [handleGenerate, state]
  );

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">JINTA</span>
        </div>
        <h1 className="header-title">Content Engine</h1>
        <p className="header-subtitle">
          Generate TikTok-ready slides in seconds. Type a keyword. Get a batch.
          Download and post.
        </p>
      </header>

      {/* Input Section */}
      <section className="input-section" id="input-section">
        <div className="input-row">
          <div className="input-group" style={{ flex: 3 }}>
            <label className="input-label" htmlFor="keyword-input">
              Keyword
            </label>
            <input
              id="keyword-input"
              type="text"
              className="input-field"
              placeholder='e.g. "luxury lifestyle", "gym motivation", "success mindset"'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={state === "loading"}
              autoFocus
            />
          </div>

          <div className="input-group" style={{ flex: 0.7 }}>
            <label className="input-label" htmlFor="count-select">
              Slides
            </label>
            <select
              id="count-select"
              className="select-field"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={state === "loading"}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>

          <div className="input-group" style={{ flex: "none" }}>
            <label className="input-label">&nbsp;</label>
            <button
              id="generate-btn"
              className="btn-generate"
              onClick={handleGenerate}
              disabled={state === "loading" || !keyword.trim()}
            >
              {state === "loading" ? (
                <>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(10,10,12,0.3)",
                      borderTop: "2px solid #0a0a0c",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                      display: "inline-block",
                    }}
                  />
                  Generating...
                </>
              ) : (
                <>⚡ Generate</>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Loading State */}
      {state === "loading" && (
        <section className="loading-section animate-in">
          <div className="loading-spinner" />
          <p className="loading-text">{loadingMessage}</p>
          <p className="loading-subtext">
            Generating {count} slides for &ldquo;{keyword}&rdquo;
          </p>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: "70%", transition: "width 8s ease" }}
            />
          </div>
        </section>
      )}

      {/* Error State */}
      {state === "error" && (
        <section className="error-section animate-in">
          <div className="error-icon">⚠️</div>
          <p className="error-text">{error}</p>
          <p className="error-hint">
            Try a different keyword or reduce the slide count.
          </p>
        </section>
      )}

      {/* Results */}
      {state === "done" && slides.length > 0 && (
        <section className="results-section animate-in">
          <div className="results-header">
            <div>
              <h2 className="results-title">
                Generated Slides{" "}
                <span className="results-count">({slides.length})</span>
              </h2>
              <div className="stats-bar">
                <div className="stat-item">
                  <span className="stat-value">{slides.length}</span>
                  <span className="stat-label">Slides</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{generationTime}s</span>
                  <span className="stat-label">Generation Time</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">1080×1920</span>
                  <span className="stat-label">Resolution</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">£0</span>
                  <span className="stat-label">Cost</span>
                </div>
                <div className="stat-item">
                  <span className={`stat-value ${hookSource === "gemma" ? "stat-gemma" : "stat-fallback"}`}>
                    {hookSource === "gemma" ? "🧠 Gemma 4" : "📋 Templates"}
                  </span>
                  <span className="stat-label">Hook Engine</span>
                </div>
              </div>
            </div>

            <button
              id="download-zip-btn"
              className="btn-download"
              onClick={handleDownloadZip}
            >
              📦 Download ZIP
            </button>
          </div>

          {/* Slide Grid */}
          <div className="slide-grid">
            {slides.map((slide, i) => (
              <div key={slide.id} className="slide-card">
                <div className="slide-image-wrapper">
                  <img
                    className="slide-image"
                    src={slide.imageBase64}
                    alt={`JINTA slide: ${slide.hookText.slice(0, 50)}`}
                    loading="lazy"
                  />
                  <div className="slide-overlay">
                    <button
                      className="slide-download-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadSingle(slide, i);
                      }}
                    >
                      ↓ Download
                    </button>
                  </div>
                </div>
                <div className="slide-info">
                  <p className="slide-hook">{slide.hookText}</p>
                  <span
                    className={`slide-category ${slide.role === "cta" ? "slide-cta-badge" : ""}`}
                  >
                    {slide.role.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Music Section */}
          <div className="music-section">
            <h3 className="music-title">🎵 Background Music</h3>
            <p className="music-subtitle">
              Find royalty-free instrumentals to pair with your slides
            </p>

            <div className="music-controls">
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label" htmlFor="mood-select">
                  Mood
                </label>
                <select
                  id="mood-select"
                  className="select-field"
                  value={musicMood}
                  onChange={(e) => setMusicMood(e.target.value)}
                  disabled={musicLoading}
                >
                  <option value="dark">Dark / Cinematic</option>
                  <option value="motivational">Motivational / Epic</option>
                  <option value="luxury">Luxury / Lounge</option>
                  <option value="gym">Gym / Intense</option>
                  <option value="success">Triumphant / Orchestral</option>
                  <option value="calm">Calm / Ambient</option>
                  <option value="aggressive">Aggressive / Trap</option>
                  <option value="emotional">Emotional / Piano</option>
                  <option value="confident">Confident / Hip-Hop</option>
                </select>
              </div>
              <button
                className="btn-generate"
                onClick={handleFetchMusic}
                disabled={musicLoading}
                style={{ alignSelf: "flex-end" }}
              >
                {musicLoading ? "Searching..." : "🔍 Find Tracks"}
              </button>
            </div>

            {musicError && (
              <div className="music-error">
                <p className="error-text">{musicError}</p>
              </div>
            )}

            {musicTracks.length > 0 && (
              <div className="music-tracks">
                {musicTracks.map((track) => (
                  <div
                    key={track.id}
                    className={`track-card ${playingTrackId === track.id ? "track-playing" : ""}`}
                  >
                    <button
                      className="track-play-btn"
                      onClick={() => handlePlayPause(track)}
                      aria-label={
                        playingTrackId === track.id ? "Pause" : "Play"
                      }
                    >
                      {playingTrackId === track.id ? "⏸" : "▶"}
                    </button>
                    <div className="track-info">
                      <span className="track-name">{track.name}</span>
                      <span className="track-meta">
                        {formatDuration(track.duration)} · by {track.username}
                      </span>
                    </div>
                    <div className="track-tags">
                      {track.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="track-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <a
                      href={track.previewUrl}
                      download={`${track.name}.mp3`}
                      className="track-download"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ↓
                    </a>
                  </div>
                ))}
                <p className="music-attribution">
                  Music from{" "}
                  <a
                    href="https://freesound.org"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Freesound.org
                  </a>{" "}
                  — check individual track licenses for attribution
                  requirements.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Empty / Idle State */}
      {state === "idle" && (
        <section className="empty-state">
          <div className="empty-icon">🎬</div>
          <h3 className="empty-title">Ready to generate</h3>
          <p className="empty-text">
            Enter a keyword above and hit Generate to create TikTok-ready
            slides. Each batch tells a connected story with JINTA branding —
            ending with a waitlist CTA.
          </p>
        </section>
      )}
    </div>
  );
}
