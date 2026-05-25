# Kokoro TTS Browser Extension

A Chrome extension that converts selected text to speech using a self-hosted [Kokoro TTS](https://github.com/remsky/Kokoro-FastAPI) API. All processing is local — no cloud, no tracking.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4f46e5?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-7c3aed)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Right-click any selected text** → "Read with Kokoro TTS"
- **Keyboard shortcut** `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`)
- **Floating audio player** with play/pause/stop, seek bar, and volume control
- **Voice selector** — pulls available voices directly from your API
- **Settings popup** — configure API URL, default voice, auto-play, and volume
- **OpenAI-compatible API** support (`/audio/voices`, `/audio/speech`)
- **CORS-free** — all network calls go through the background service worker

---

## Requirements

- Chrome 120+ (or any Chromium-based browser)
- A running [Kokoro TTS API](https://github.com/remsky/Kokoro-FastAPI) instance accessible on your local network

---

## Installation

### From source (developer mode)

1. Clone this repo:
   ```bash
   git clone https://github.com/b00111111/kokoro-tts-extension.git
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the cloned folder

5. The Kokoro TTS icon will appear in your toolbar

---

## Setup

1. Click the extension icon in the Chrome toolbar
2. Enter your Kokoro TTS API URL (e.g. `http://192.168.1.x:8880/v1`)
3. Click **Test Connection** — your available voices will populate automatically
4. Select your preferred default voice
5. Done — highlight text on any page and right-click to start

---

## Usage

| Action | How |
|---|---|
| Synthesize selected text | Right-click → **🔊 Read with Kokoro TTS** |
| Quick synthesize | Select text → `Ctrl+Shift+R` |
| Change voice | Click extension icon → Voice Selection dropdown |
| Adjust volume | Volume slider in the player, or set a default in Advanced Settings |
| Replay | Click ↺ in the player |

---

## API Compatibility

Designed for the [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) OpenAI-compatible server. The extension expects:

| Endpoint | Method | Purpose |
|---|---|---|
| `{baseUrl}/audio/voices` | GET | Fetch available voices |
| `{baseUrl}/audio/speech` | POST | Synthesize audio |

**Speech request body:**
```json
{
  "model": "kokoro",
  "input": "Text to synthesize",
  "voice": "af_heart",
  "response_format": "mp3",
  "speed": 1.0
}
```

Set your **Base URL** to include the version prefix if your API uses one (e.g. `http://host:8880/v1`).

---

## Project Structure

```
kokoro-tts-extension/
├── manifest.json       # MV3 extension config
├── background.js       # Service worker — menus, shortcuts, API calls
├── content.js          # Returns selected text to background
├── popup.html/js       # Configuration UI
├── player.html/js      # Floating audio player
├── styles.css          # Shared design tokens
├── generate_icons.js   # Icon generator (Node.js, no dependencies)
└── icons/              # 16, 32, 48, 128px PNGs
```

---

## Regenerating Icons

If you don't have Node.js, the PowerShell fallback generates icons using .NET System.Drawing. With Node:

```bash
node generate_icons.js
```

---

## License

MIT
