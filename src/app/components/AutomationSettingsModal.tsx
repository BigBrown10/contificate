"use client";

import React, { useState, useEffect } from "react";

interface AutomationSettings {
  enabled: boolean;
  intervalHours: number;
  randomOffsetMins: number;
  keywordList: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AutomationSettings;
  onSave: (settings: AutomationSettings) => void;
}

export default function AutomationSettingsModal({ isOpen, onClose, settings, onSave }: Props) {
  const [localSettings, setLocalSettings] = useState<AutomationSettings>(settings);
  const rotationKeywords = Array.from(
    new Set(
      localSettings.keywordList
        .split(/[\n,;|]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings); // Reset to current when opened
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="results-header" style={{ marginBottom: '32px' }}>
          <div>
            <h2 className="results-title italic uppercase tracking-wider" style={{ color: 'var(--accent)' }}>AUTOMATION SETTINGS</h2>
            <p className="results-meta">Configure your Autopilot cadence and keyword rotation.</p>
          </div>
          <button 
            onClick={onClose}
            className="track-play-btn"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Toggle */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'between', 
            padding: '16px', 
            background: 'var(--bg-input)', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border)' 
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>Enable Autopilot</p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Run generation automatically on a timer.</p>
            </div>
            <button
              onClick={() => setLocalSettings(s => ({ ...s, enabled: !s.enabled }))}
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: '28px',
                width: '48px',
                alignItems: 'center',
                borderRadius: '9999px',
                transition: 'all 0.2s',
                border: 'none',
                cursor: 'pointer',
                background: localSettings.enabled ? 'var(--accent)' : 'var(--text-muted)'
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  height: '20px',
                  width: '20px',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'transform 0.2s',
                  transform: localSettings.enabled ? 'translateX(24px)' : 'translateX(4px)'
                }}
              />
            </button>
          </div>

          {/* Interval */}
          <div className="input-group">
            <label className="input-label">Base Frequency (Hours)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                min={0.5}
                max={24}
                step={0.5}
                value={localSettings.intervalHours}
                onChange={(e) => setLocalSettings(s => ({ ...s, intervalHours: parseFloat(e.target.value) || 1 }))}
                className="input-field"
                style={{ paddingRight: '50px' }}
              />
              <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '13px' }}>hr</span>
            </div>
          </div>

          {/* Randomness */}
          <div className="input-group">
            <label className="input-label">Random Jitter (Mins)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                min={0}
                max={120}
                value={localSettings.randomOffsetMins}
                onChange={(e) => setLocalSettings(s => ({ ...s, randomOffsetMins: parseInt(e.target.value) || 0 }))}
                className="input-field"
                style={{ paddingRight: '50px' }}
              />
              <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: '13px' }}>min</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '4px' }}>
              Adds/subtracts minutes to keep posting intervals randomized.
            </p>
          </div>

          <div className="input-group">
            <label className="input-label">Automation Keywords</label>
            <textarea
              value={localSettings.keywordList}
              onChange={(e) => setLocalSettings(s => ({ ...s, keywordList: e.target.value }))}
              className="caption-textarea"
              placeholder="discipline, dopamine, corn recovery"
              rows={4}
              style={{ minHeight: '120px' }}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '4px' }}>
              Separate terms with commas or line breaks. The system will rotate through them one by one.
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Active keywords: {rotationKeywords.length || 0}
            </p>
          </div>

          <button
            onClick={() => {
               onSave(localSettings);
               onClose();
            }}
            className="btn-generate"
            style={{ width: '100%', padding: '18px', background: 'var(--accent)' }}
          >
            SAVE CONFIGURATION
          </button>
        </div>
      </div>
    </div>
  );
}
