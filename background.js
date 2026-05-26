'use strict';

// Player tab ID persisted in storage so it survives service worker restarts.
// If kept only in memory, SW termination resets it to null and a second player
// window gets opened while the old one is still alive — causing an echo.
const getPlayerTabId  = async () => (await chrome.storage.local.get({ playerTabId: null })).playerTabId;
const setPlayerTabId  = (id) => chrome.storage.local.set({ playerTabId: id });
const clearPlayerTabId = ()  => chrome.storage.local.remove('playerTabId');

// ── Setup ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'kokoro-read',
    title: '🔊 Read with Kokoro TTS',
    contexts: ['selection'],
  });
});

// ── Triggers ───────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'kokoro-read') return;
  const text = info.selectionText?.trim();
  if (text) triggerSynthesis(text);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'synthesize-selection') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const { text } = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
    if (text?.trim()) triggerSynthesis(text.trim());
  } catch {
    // Tab cannot receive messages (e.g. chrome:// pages).
  }
});

// ── Message handler (popup uses this to fetch voices CORS-free) ────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'FETCH_VOICES') {
    fetchVoices(msg.apiUrl).then(sendResponse);
    return true; // keep channel open for async response
  }
});

async function fetchVoices(apiUrl) {
  try {
    const base = apiUrl.replace(/\/+$/, '');
    const res  = await fetch(`${base}/audio/voices`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    const raw  = Array.isArray(data.voices) ? data.voices
               : Array.isArray(data)         ? data
               : [];
    const voices = raw.map(v =>
      typeof v === 'string' ? v : (v.voice_id ?? v.name ?? v.id ?? JSON.stringify(v))
    );
    return { success: true, voices };
  } catch (err) {
    return {
      success: false,
      error: err.name === 'TimeoutError' ? 'Request timed out' : err.message,
    };
  }
}

// ── Settings ───────────────────────────────────────────────────────────

async function getSettings() {
  return chrome.storage.sync.get({
    apiUrl: '', selectedVoice: '', autoPlay: true, volume: 80, speed: 1.0,
  });
}

// ── SW Keepalive ───────────────────────────────────────────────────────
// MV3 service workers are suspended after ~30 s with no Chrome API activity.
// A plain fetch() doesn't reset that timer, so long synthesis requests get
// terminated mid-flight, producing "user aborted the request" AbortErrors.
// We prevent suspension by pinging chrome.storage every 20 s while busy.

function startKeepalive() {
  return setInterval(() => chrome.storage.local.get('_ka'), 20_000);
}
function stopKeepalive(timer) {
  clearInterval(timer);
}

// ── Core synthesis flow ────────────────────────────────────────────────
// All network calls happen here in the service worker — no CORS issues.

async function triggerSynthesis(text) {
  const settings = await getSettings();

  if (!settings.apiUrl) {
    chrome.notifications.create('kokoro-not-configured', {
      type: 'basic',
      iconUrl: 'icons/48.png',
      title: 'Kokoro TTS — not configured',
      message: 'Click the extension icon to enter your API URL first.',
    });
    return;
  }

  const id = Date.now().toString();

  // Tell the player to show the loading state immediately.
  await chrome.storage.local.set({
    pendingSynthesis: {
      id,
      state:    'loading',
      voice:    settings.selectedVoice,
      autoPlay: settings.autoPlay,
      volume:   settings.volume,
      speed:    settings.speed,
    },
  });

  await openOrFocusPlayer();

  // Fetch audio in the service worker (CORS-free).
  // Keep the SW alive with a heartbeat — fetch() doesn't reset Chrome's
  // 30-second idle timer, so without this the SW is suspended mid-request.
  const keepalive = startKeepalive();
  try {
    const base = settings.apiUrl.replace(/\/+$/, '');
    const res  = await fetch(`${base}/audio/speech`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:           'kokoro',
        input:           text,
        voice:           settings.selectedVoice,
        response_format: 'mp3',
        speed:           settings.speed ?? 1.0,
      }),
      signal:  AbortSignal.timeout(300_000), // 5 min — large texts take time
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `HTTP ${res.status} ${res.statusText}`);
    }

    const blob    = await res.blob();
    const dataUrl = await blobToDataUrl(blob);

    await chrome.storage.local.set({
      pendingSynthesis: {
        id,
        state:    'ready',
        voice:    settings.selectedVoice,
        autoPlay: settings.autoPlay,
        volume:   settings.volume,
        speed:    settings.speed,
        dataUrl,
      },
    });
  } catch (err) {
    const msg =
      err.name === 'TimeoutError' || err.name === 'AbortError'
        ? 'Synthesis timed out — the server took too long. Try shorter text or check that the API is responsive.'
        : err.message.length > 120 ? err.message.slice(0, 120) + '…' : err.message;

    await chrome.storage.local.set({
      pendingSynthesis: { id, state: 'error', error: msg },
    });
  } finally {
    stopKeepalive(keepalive);
  }
}

// ── Player window ──────────────────────────────────────────────────────

async function openOrFocusPlayer() {
  const playerTabId = await getPlayerTabId();

  if (playerTabId !== null) {
    try {
      const tab = await chrome.tabs.get(playerTabId);
      // sendMessage may fail if the player page hasn't finished loading yet;
      // pendingSynthesis in storage acts as the fallback in that case.
      chrome.tabs.sendMessage(playerTabId, { type: 'NEW_SYNTHESIS' }).catch(() => {});
      await chrome.windows.update(tab.windowId, { focused: true });
      return;
    } catch {
      // Tab no longer exists — clear stale ID and fall through to open a new window.
      await clearPlayerTabId();
    }
  }

  const win = await chrome.windows.create({
    url:     chrome.runtime.getURL('player.html'),
    type:    'popup',
    width:   380,
    height:  280,
    focused: true,
  });

  await setPlayerTabId(win.tabs?.[0]?.id ?? null);
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const playerTabId = await getPlayerTabId();
  if (tabId === playerTabId) await clearPlayerTabId();
});

// ── Utilities ──────────────────────────────────────────────────────────

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  // Process in chunks to avoid call-stack overflow on large audio files.
  for (let i = 0; i < bytes.byteLength; i += 4096) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 4096, bytes.byteLength)));
  }
  const mime = blob.type || 'audio/mpeg';
  return `data:${mime};base64,${btoa(binary)}`;
}
