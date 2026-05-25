'use strict';

// ── DOM refs ───────────────────────────────────────────────────────────
const urlInput       = document.getElementById('api-url');
const urlError       = document.getElementById('url-error');
const testBtn        = document.getElementById('test-btn');
const statusRow      = document.getElementById('status-row');
const statusPill     = document.getElementById('connection-status');
const voiceSelect    = document.getElementById('voice-select');
const refreshBtn     = document.getElementById('refresh-voices');
const autoPlayToggle = document.getElementById('auto-play');
const volumeSlider   = document.getElementById('volume');
const volumeDisplay  = document.getElementById('volume-display');
const advToggle      = document.getElementById('advanced-toggle');
const advSection     = document.getElementById('advanced-section');

// ── Storage helpers ────────────────────────────────────────────────────
const DEFAULTS = {
  apiUrl: '', selectedVoice: '', availableVoices: [],
  autoPlay: true, volume: 80,
};

const getSettings = () => chrome.storage.sync.get(DEFAULTS);
const saveSettings = (updates) => chrome.storage.sync.set(updates);

// ── Status helpers ─────────────────────────────────────────────────────
function setHeaderStatus(type, label) {
  statusPill.className = `status-pill ${type}`;
  statusPill.querySelector('.dot').style.display = type === 'unconfigured' ? 'none' : '';
  statusPill.querySelector('.label').textContent = label;
}

function showInlineStatus(type, label) {
  statusRow.innerHTML = `<span class="status-pill ${type}"><span class="dot"></span>${label}</span>`;
}

function clearInlineStatus() { statusRow.innerHTML = ''; }

// ── Voice dropdown ─────────────────────────────────────────────────────
function populateVoices(voices, selected) {
  voiceSelect.innerHTML = '';
  if (!voices.length) {
    voiceSelect.innerHTML = '<option value="" disabled>No voices returned by API</option>';
    return;
  }
  voices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    opt.selected = v === selected;
    voiceSelect.appendChild(opt);
  });
  // If nothing matched, select first
  if (!voiceSelect.value && voices.length) {
    voiceSelect.value = voices[0];
    saveSettings({ selectedVoice: voices[0] });
  }
}

// ── Connection test ────────────────────────────────────────────────────
async function testConnection() {
  const url = urlInput.value.trim();
  if (!isValidUrl(url)) {
    urlInput.classList.add('error');
    urlError.style.display = '';
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = 'Connecting…';
  clearInlineStatus();
  setHeaderStatus('testing', 'Connecting…');

  const start = Date.now();
  try {
    // Route through the background service worker to avoid CORS restrictions.
    const { success, voices, error } = await chrome.runtime.sendMessage({
      type:   'FETCH_VOICES',
      apiUrl: url,
    });
    if (!success) throw new Error(error);

    const elapsed = Date.now() - start;

    await saveSettings({ apiUrl: url, availableVoices: voices });

    const { selectedVoice } = await chrome.storage.sync.get({ selectedVoice: '' });
    populateVoices(voices, selectedVoice);

    setHeaderStatus('connected', 'Connected');
    showInlineStatus('connected', `${voices.length} voice${voices.length !== 1 ? 's' : ''} · ${elapsed}ms`);
    urlInput.classList.add('success');
    urlInput.classList.remove('error');
  } catch (err) {
    setHeaderStatus('error', 'Unreachable');
    showInlineStatus('error', err.message);
    urlInput.classList.add('error');
    urlInput.classList.remove('success');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '🔌 Test Connection';
  }
}

// ── Validation ─────────────────────────────────────────────────────────
function isValidUrl(str) {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

// ── Init ───────────────────────────────────────────────────────────────
async function init() {
  const s = await getSettings();

  urlInput.value          = s.apiUrl;
  volumeSlider.value      = s.volume;
  volumeDisplay.textContent = `${s.volume}%`;
  autoPlayToggle.classList.toggle('off', !s.autoPlay);

  if (s.availableVoices.length) {
    populateVoices(s.availableVoices, s.selectedVoice);
    setHeaderStatus('connected', 'Connected');
    showInlineStatus('connected', `${s.availableVoices.length} voice${s.availableVoices.length !== 1 ? 's' : ''} cached`);
    urlInput.classList.add('success');
  } else if (s.apiUrl) {
    setHeaderStatus('unconfigured', 'Not tested');
  }
}

// ── Event listeners ────────────────────────────────────────────────────
testBtn.addEventListener('click', testConnection);
refreshBtn.addEventListener('click', testConnection);

urlInput.addEventListener('blur', () => {
  const url = urlInput.value.trim();
  if (!url) return;
  if (!isValidUrl(url)) {
    urlInput.classList.add('error');
    urlError.style.display = '';
  } else {
    urlInput.classList.remove('error');
    urlError.style.display = 'none';
    saveSettings({ apiUrl: url });
  }
});

urlInput.addEventListener('input', () => {
  urlInput.classList.remove('error', 'success');
  urlError.style.display = 'none';
  clearInlineStatus();
  setHeaderStatus('unconfigured', 'Not tested');
});

voiceSelect.addEventListener('change', () => saveSettings({ selectedVoice: voiceSelect.value }));

autoPlayToggle.addEventListener('click', () => {
  const on = autoPlayToggle.classList.toggle('off');
  autoPlayToggle.setAttribute('aria-checked', String(!on));
  saveSettings({ autoPlay: !on });
});
autoPlayToggle.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); autoPlayToggle.click(); }
});

volumeSlider.addEventListener('input', () => {
  volumeDisplay.textContent = `${volumeSlider.value}%`;
});
volumeSlider.addEventListener('change', () => saveSettings({ volume: Number(volumeSlider.value) }));

advToggle.addEventListener('click', () => {
  const open = advSection.classList.toggle('open');
  advToggle.querySelector('.chevron').textContent = open ? '▾' : '▸';
});

init();
