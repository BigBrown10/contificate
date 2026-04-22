"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import JSZip from "jszip";
import { GeneratedSlide, GenerateResponse } from "@/lib/types";
import AutomationSettingsModal from "./components/AutomationSettingsModal";

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

interface AutomationSettings {
  enabled: boolean;
  intervalHours: number;
  randomOffsetMins: number;
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
  const [hookSource, setHookSource] = useState<"gemini" | "fallback" | null>(null);
  const [autopilotResult, setAutopilotResult] = useState<{
    score?: number;
    critique?: string;
    message?: string;
    status?: string;
  } | null>(null);

  // Automation State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [nextRunTime, setNextRunTime] = useState<number | null>(null);
  const [autoSettings, setAutoSettings] = useState<AutomationSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jinta_auto_settings");
      return saved ? JSON.parse(saved) : { enabled: false, intervalHours: 4, randomOffsetMins: 30 };
    }
    return { enabled: false, intervalHours: 4, randomOffsetMins: 30 };
  });

  // Save settings
  useEffect(() => {
    localStorage.setItem("jinta_auto_settings", JSON.stringify(autoSettings));
    if (!autoSettings.enabled) {
      setNextRunTime(null);
    } else if (!nextRunTime) {
      scheduleNextRun();
    }
  }, [autoSettings]);

  const scheduleNextRun = () => {
    const baseMs = autoSettings.intervalHours * 60 * 60 * 1000;
    const jitterMs = (Math.random() * 2 - 1) * autoSettings.randomOffsetMins * 60 * 1000;
    const finalMs = Math.max(60000, baseMs + jitterMs); // At least 1 min
    setNextRunTime(Date.now() + finalMs);
  };

  // The Scheduling Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoSettings.enabled && nextRunTime) {
      interval = setInterval(() => {
        const now = Date.now();
        if (now >= nextRunTime) {
          handleAutopilot();
          scheduleNextRun();
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [autoSettings.enabled, nextRunTime]);

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
    setAutopilotResult(null);
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

      setSlides(data.slides || []);
      setGeneratedKeyword(data.keyword);
      setGenerationTime(Math.round(elapsed));
      setHookSource("gemini");
      
      // Auto-select music track if provided by API
      if (data.musicTrack) {
        setMusicTracks([data.musicTrack]);
        setMusicMood(data.musicTrack.tags[0] || "dark");
      }
      
      setState("done");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate slides.";
      setError(message);
      setState("error");
    }
  }, [keyword, count]);

  const handleAutopilot = useCallback(async () => {
    if (!keyword.trim()) return;

    setState("loading");
    setError("");
    setAutopilotResult(null);
    setSlides([]);
    setLoadingMessage("Agent Cabal spinning up...");
    const startTime = performance.now();

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });

      const elapsed = (performance.now() - startTime) / 1000;
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `Server error: ${response.status}`);
      }

      if (data.status === "failed") {
        throw new Error(`Pipeline Failed: ${data.message} ${data.critique ? '(' + data.critique + ')' : ''}`);
      }

      setAutopilotResult({
        score: data.score,
        critique: data.critique,
        message: data.message,
        status: data.status
      });

      setSlides(data.slides || []);
      setGeneratedKeyword(data.angle || keyword);
      setGenerationTime(Math.round(elapsed));
      setHookSource("gemini"); // We know it's Gemini
      setState("done");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Orchestrator failed.";
      setError(message);
      setState("error");
    }
  }, [keyword]);

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
        `slide_${String(i + 1).padStart(2, "0")}_${slide.role}.png`,
        base64Data,
        { base64: true }
      );
    }

    // Auto-include music in ZIP if a track is available
    if (musicTracks.length > 0) {
      const track = musicTracks[0];
      try {
        // Use our proxy to bypass CORS
        const proxyUrl = `/api/music/download?url=${encodeURIComponent(track.previewUrl)}`;
        const audioResponse = await fetch(proxyUrl);
        if (!audioResponse.ok) throw new Error("Proxy fetch failed");
        const audioBlob = await audioResponse.blob();
        zip.file(`music_${track.name.replace(/\s+/g, "_")}.mp3`, audioBlob);
      } catch (err) {
        console.error("Failed to include music in ZIP via proxy:", err);
      }
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

  const formatCountdown = (target: number) => {
    const diff = Math.max(0, target - Date.now());
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}m ${s}s`;
  };

  return (
    <div className="app-container">
      <AutomationSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={autoSettings}
        onSave={setAutoSettings}
      />
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
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                id="generate-btn"
                className="btn-generate"
                onClick={handleGenerate}
                disabled={state === "loading" || !keyword.trim()}
              >
                {state === "loading" ? "Generating..." : "⚡ Generate"}
              </button>
              
              {/* Autopilot Controls */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="btn-settings"
                  title="Automation Settings"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '22px', height: '22px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                
                <button
                  onClick={handleAutopilot}
                  disabled={state === "loading" || !keyword}
                  className="btn-autopilot-pro"
                >
                  🚀 Autopilot
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Result Metrics */}
      {(slides.length > 0 || state === "loading") && (
        <div className="animate-in" style={{ marginTop: '32px' }}>
          {/* Automation Status Banner */}
          {autoSettings.enabled && nextRunTime && (
            <div className="autopilot-banner">
              <div className="autopilot-status">
                <div className="autopilot-pulse" />
                <span>Autopilot Active</span>
              </div>
              <div className="autopilot-timer">
                Next run in: <span className="autopilot-time-value">{formatCountdown(nextRunTime)}</span>
              </div>
            </div>
          )}
        </div>
      )}

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
                  <span className={`stat-value ${hookSource === "gemini" ? "stat-gemma" : "stat-fallback"}`}>
                    {hookSource === "gemini" ? "🧠 Gemini 2.5" : "📋 Templates"}
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

          {autopilotResult && (
            <div style={{
              padding: "16px 20px",
              marginBottom: "24px",
              background: autopilotResult.score && autopilotResult.score >= 9 ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
              border: `1px solid ${autopilotResult.score && autopilotResult.score >= 9 ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
              borderRadius: "12px",
              color: "#d4d4dc",
              fontFamily: "Inter, sans-serif"
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>🚀</span>
                <strong style={{ color: '#fff' }}>Autopilot Results: {autopilotResult.score}/10</strong>
                <span style={{ 
                  marginLeft: 'auto', 
                  background: autopilotResult.status === 'posted' ? '#10b981' : '#3f3f46', 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'white'
                }}>
                  {autopilotResult.status === 'posted' ? "TikTok Posted" : "Saved to Vault"}
                </span>
              </div>
              <p style={{ margin: "0 0 4px 0", fontSize: '14px' }}>
                <span style={{ color: '#a1a1aa' }}>Judge's Critique:</span> "{autopilotResult.critique}"
              </p>
              <p style={{ margin: "0", fontSize: '13px', color: '#a1a1aa' }}>{autopilotResult.message}</p>
            </div>
          )}

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
      {/* Settings Modal */}
      <AutomationSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={autoSettings}
        onSave={(s) => setAutoSettings(s)}
      />
    </div>
  );
}

function formatCountdown(targetTime: number): string {
  const diff = Math.max(0, targetTime - Date.now());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || hours > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
