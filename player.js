'use strict';

// ── DOM refs ───────────────────────────────────────────────────────────
const statusText    = document.getElementById('status-text');
const playerTitle   = document.getElementById('player-title');
const errorBanner   = document.getElementById('error-banner');
const errorMsg      = document.getElementById('error-message');
const playBtn       = document.getElementById('play-btn');
const stopBtn       = document.getElementById('stop-btn');
const replayBtn     = document.getElementById('replay-btn');
const progressBar   = document.getElementById('progress-bar');
const progressFill  = document.getElementById('progress-fill');
const progressThumb = document.getElementById('progress-thumb');
const timeElapsed   = document.getElementById('time-elapsed');
const timeDuration  = document.getElementById('time-duration');
const volumeSlider  = document.getElementById('volume-slider');
const volumeIcon    = document.getElementById('volume-icon');
const downloadBtn   = document.getElementById('download-btn');

// ── Audio ──────────────────────────────────────────────────────────────
const audio = new Audio();
let isDragging   = false;
let currentDataUrl  = null;
let currentVoice    = null;
let currentMimeType = 'audio/mpeg';

// ── Storage watcher ────────────────────────────────────────────────────
// The background service worker writes synthesis state here; we react to it.

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pendingSynthesis) {
    handleUpdate(changes.pendingSynthesis.newValue);
  }
});

// On load: pick up whatever state the background already wrote.
chrome.storage.local.get('pendingSynthesis').then(({ pendingSynthesis }) => {
  if (pendingSynthesis) handleUpdate(pendingSynthesis);
});

function handleUpdate(s) {
  if (!s) return;
  if (s.state === 'loading') {
    showLoading(s.voice);
  } else if (s.state === 'ready') {
    chrome.storage.local.remove('pendingSynthesis');
    applyAudio(s);
  } else if (s.state === 'error') {
    chrome.storage.local.remove('pendingSynthesis');
    showError(s.error);
  }
}

function showLoading(voice) {
  hideError();
  setStatus('loading', '⏳ Synthesizing…');
  playerTitle.textContent = voice || 'Kokoro TTS';
  playBtn.disabled     = true;
  stopBtn.disabled     = true;
  replayBtn.disabled   = true;
  downloadBtn.disabled = true;
  downloadBtn.style.opacity = '0.35';
  audio.pause();
  resetProgress();
}

function applyAudio({ dataUrl, voice, autoPlay, volume, speed }) {
  hideError();
  playerTitle.textContent = voice || 'Kokoro TTS';

  playBtn.disabled   = false;
  stopBtn.disabled   = false;
  replayBtn.disabled = false;

  audio.volume       = Math.max(0, Math.min(1, (volume ?? 80) / 100));
  audio.playbackRate = speed ?? 1.0;
  volumeSlider.value = volume ?? 80;
  updateVolumeIcon(audio.volume);

  audio.src = dataUrl;

  currentDataUrl  = dataUrl;
  currentVoice    = voice;
  currentMimeType = dataUrl.match(/^data:([^;]+)/)?.[1] || 'audio/mpeg';
  downloadBtn.disabled = false;
  downloadBtn.style.opacity = '1';

  if (autoPlay !== false) {
    audio.play().catch(() => {
      // Autoplay may be blocked by browser policy; show the play button ready.
      setStatus('idle', '◦ Ready — press play');
    });
  } else {
    setStatus('idle', '◦ Ready');
  }
}

// ── Audio events ───────────────────────────────────────────────────────

audio.addEventListener('loadedmetadata', () => {
  timeDuration.textContent = fmt(audio.duration);
});

audio.addEventListener('timeupdate', () => {
  if (!isDragging) syncProgress();
});

audio.addEventListener('play', () => {
  setStatus('playing', '▶ Now Playing');
  playBtn.textContent = '⏸';
  playBtn.setAttribute('aria-label', 'Pause');
});

audio.addEventListener('pause', () => {
  if (audio.ended) return;
  setStatus('paused', '⏸ Paused');
  playBtn.textContent = '▶';
  playBtn.setAttribute('aria-label', 'Play');
});

audio.addEventListener('ended', () => {
  setStatus('idle', '◦ Done');
  playBtn.textContent = '▶';
  playBtn.setAttribute('aria-label', 'Play');
  syncProgress();
});

audio.addEventListener('error', () => {
  showError('Audio playback failed — unsupported format or corrupt response.');
});

// ── Controls ───────────────────────────────────────────────────────────

playBtn.addEventListener('click', () => {
  if (!audio.src) return;
  if (audio.paused) audio.play();
  else audio.pause();
});

stopBtn.addEventListener('click', () => {
  audio.pause();
  audio.currentTime = 0;
  setStatus('idle', '◦ Stopped');
  playBtn.textContent = '▶';
  syncProgress();
});

replayBtn.addEventListener('click', () => {
  if (!audio.src) return;
  audio.currentTime = 0;
  audio.play();
});

// ── Download ───────────────────────────────────────────────────────────

downloadBtn.addEventListener('click', () => {
  if (!currentDataUrl) return;
  const ext      = currentMimeType === 'audio/mpeg' ? 'mp3' : currentMimeType.split('/')[1] || 'mp3';
  const ts       = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const safeName = (currentVoice || 'tts').replace(/[^a-z0-9_-]/gi, '_');
  const filename = `kokoro-${safeName}-${ts}.${ext}`;
  const a        = document.createElement('a');
  a.href         = currentDataUrl;
  a.download     = filename;
  a.click();
});

// ── Volume ─────────────────────────────────────────────────────────────

volumeSlider.addEventListener('input', () => {
  audio.volume = volumeSlider.value / 100;
  updateVolumeIcon(audio.volume);
});

function updateVolumeIcon(vol) {
  volumeIcon.textContent = vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊';
}

// ── Progress bar ───────────────────────────────────────────────────────

function syncProgress() {
  const d = audio.duration || 0;
  const c = audio.currentTime || 0;
  setProgressUI(d > 0 ? c / d : 0, c, d);
}

function setProgressUI(fraction, current, duration) {
  const pct = `${fraction * 100}%`;
  progressFill.style.width = pct;
  progressThumb.style.left = pct;
  progressBar.setAttribute('aria-valuenow', Math.round(fraction * 100));
  timeElapsed.textContent  = fmt(current);
  timeDuration.textContent = fmt(duration);
}

function resetProgress() {
  setProgressUI(0, 0, 0);
}

function fractionFromEvent(e) {
  const rect = progressBar.getBoundingClientRect();
  return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
}

progressBar.addEventListener('mousedown', (e) => {
  if (!audio.duration) return;
  isDragging = true;
  const f = fractionFromEvent(e);
  setProgressUI(f, f * audio.duration, audio.duration);
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging || !audio.duration) return;
  setProgressUI(fractionFromEvent(e), fractionFromEvent(e) * audio.duration, audio.duration);
});

document.addEventListener('mouseup', (e) => {
  if (!isDragging || !audio.duration) return;
  isDragging = false;
  audio.currentTime = fractionFromEvent(e) * audio.duration;
});

// ── Helpers ────────────────────────────────────────────────────────────

function setStatus(state, label) {
  document.body.dataset.state = state;
  statusText.textContent = label;
}

function showError(message) {
  errorBanner.style.display = 'flex';
  errorMsg.textContent = message;
  setStatus('error', '✕ Error');
  playBtn.disabled   = false;
  stopBtn.disabled   = false;
  replayBtn.disabled = false;
}

function hideError() {
  errorBanner.style.display = 'none';
}

function fmt(seconds) {
  if (!seconds || !isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
