# Product Requirements Document: Kokoro TTS Browser Plugin

## 1. Overview

**Product Name:** Kokoro TTS Browser Plugin

**Purpose:** Enable users to highlight text on any webpage and convert it to speech using a local Kokoro TTS API, with configurable voice selection and playback capabilities.

**Platform:** Chrome/Chromium-based browsers

---

## 2. Target Users

- Users who have a local Kokoro TTS API instance running on their network
- Users who want quick text-to-speech conversion while browsing
- Users who prefer local processing over cloud-based TTS services for privacy/performance reasons

---

## 3. Core Features

### 3.1 Text Selection & Context Menu
- **Context Menu Integration:** When user highlights text on a webpage, a context menu option "Read with Kokoro TTS" appears
- **Text Capture:** Plugin captures the selected text (up to reasonable limit, e.g., 5000 characters)
- **Keyboard Shortcut:** Optional support for quick submission (configurable, e.g., Ctrl+Shift+R)

### 3.2 Configuration Screen
- **Accessible via:** Extension icon in Chrome toolbar or right-click menu
- **Settings:**
  - **API URL:** Input field for local network Kokoro TTS API endpoint (e.g., `http://192.168.1.100:8000`)
  - **Voice Selection:** Dropdown menu populated with available voices from the API
  - **API Test/Verification:** Button to test connection and validate API endpoint
  - **Settings Persistence:** All settings saved to Chrome's `chrome.storage.sync` for cross-device sync
  - **Advanced Options** (optional):
    - Language selection
    - Speed adjustment
    - Sample rate preference

### 3.3 Audio Playback
- **Playback Controls:**
  - Play/Pause button
  - Stop button
  - Volume slider
  - Progress bar with seek capability
- **Playback Display:**
  - Shows current status (loading, playing, paused, error)
  - Displays current voice being used
  - Shows elapsed time / total duration
- **Player Location:** Floating player UI or dedicated popup window (user preference)

### 3.4 Error Handling
- **API Connection Errors:** Clear messaging if API is unreachable
- **Invalid Configuration:** Alerts when API URL is not set or invalid
- **API Errors:** Display user-friendly error messages for API-level issues
- **Network Issues:** Graceful handling of network interruptions

---

## 4. User Workflows

### 4.1 Initial Setup
1. User installs plugin from Chrome Web Store
2. User clicks plugin icon to open configuration screen
3. User enters local Kokoro TTS API URL
4. User clicks "Test Connection" button
5. Plugin fetches list of available voices
6. User selects preferred default voice
7. Settings are saved automatically

### 4.2 Text-to-Speech Conversion
1. User highlights text on any webpage
2. Context menu appears with "Read with Kokoro TTS" option
3. User clicks option (or uses keyboard shortcut)
4. Plugin sends request to Kokoro TTS API with selected text and voice
5. Loading indicator appears while API processes
6. Audio player appears with playback controls
7. User can play, pause, seek, or adjust volume
8. Audio plays through browser speakers

### 4.3 Voice Selection (On-Demand)
1. User opens plugin configuration screen
2. User selects different voice from dropdown
3. Settings update automatically
4. Next TTS request uses newly selected voice

---

## 5. Technical Requirements

### 5.1 Architecture
- **Type:** Chrome Extension (Manifest V3)
- **Components:**
  - `manifest.json` - Extension configuration
  - `background.js` - Service worker, context menu handling, API communication
  - `popup.html/js` - Configuration UI
  - `content.js` - Content script for text selection handling
  - `player.html/js` - Audio player UI
  - `styles.css` - Styling for all UI components

### 5.2 APIs & Permissions Required
**Chrome APIs:**
- `chrome.contextMenus` - For context menu creation
- `chrome.storage.sync` - For persisting settings
- `chrome.tabs` - For querying active tab
- `chrome.offscreen` - For audio playback (Manifest V3 compliant)

**Required Permissions in manifest.json:**
```json
"permissions": [
  "contextMenus",
  "storage",
  "offscreen"
],
"host_permissions": [
  "<all_urls>"
]
```

### 5.3 Kokoro TTS API Integration
**Expected API Endpoints:**
- `GET /voices` - Returns list of available voices
  - Response: `{ "voices": ["voice1", "voice2", ...] }`
- `POST /synthesize` - Accepts text and voice, returns audio
  - Request: `{ "text": "...", "voice": "..." }`
  - Response: Audio file (MP3 or WAV, or streaming audio)

**Assumptions:**
- API runs on local network
- API returns audio as MP3/WAV/OGG format
- API response includes audio data or stream URL
- API handles errors with meaningful HTTP status codes

### 5.4 Data Flow
```
User Selection 
    → Content Script captures text
    → Sends to Background Service Worker
    → Background makes API request to Kokoro TTS
    → API returns audio file/stream
    → Player UI loads and displays
    → User can play/control audio
```

### 5.5 Storage Schema
**Chrome Storage (chrome.storage.sync):**
```json
{
  "apiUrl": "http://192.168.1.100:8000",
  "selectedVoice": "voice_name",
  "availableVoices": ["voice1", "voice2"],
  "lastUpdated": "timestamp"
}
```

---

## 6. Configuration Screen Specifications

### 6.1 Layout
- Clean, minimal interface
- Maximum width: 500px
- Sections:
  - **API Configuration**
    - API URL input field with placeholder
    - Test Connection button
    - Connection status indicator
  - **Voice Selection**
    - Dropdown menu populated from API
    - Current selection display
    - Refresh button to re-fetch voices
  - **Advanced Settings** (collapsible)
    - Toggle for popup vs. floating player
    - Volume level slider (default 100%)
    - Auto-play option checkbox

### 6.2 Validation
- API URL must be valid HTTP(S) URL
- Field validation on blur/submit
- Visual feedback for errors (red border, error text)
- Disable submit until valid configuration provided

---

## 7. Context Menu & Interaction

### 7.1 Context Menu
- **Title:** "Read with Kokoro TTS"
- **Icon:** Small speaker icon (16x16px)
- **Trigger:** Right-click on selected text
- **Availability:** Only show if API is configured and valid
- **Action:** Immediately sends selected text to API

### 7.2 Keyboard Shortcut (Optional)
- **Default:** Ctrl+Shift+R (configurable)
- **Function:** Synthesize selected text with current voice
- **Fallback:** Show notification if no text selected

---

## 8. Audio Player UI

### 8.1 Player Display
- **Window Type:** Floating popup (user-closable) or modal
- **Size:** Compact (width: 300-400px, height: 150-200px)
- **Components:**
  - Title showing selected voice
  - Play/Pause button (large, centered)
  - Stop button
  - Progress bar (current time / total time)
  - Volume slider
  - Close button (X)
  - Status text (Playing, Paused, Loading, Error)

### 8.2 Playback Behavior
- Auto-play after synthesis (user preference option)
- Progress updates every 100-200ms
- Allow seeking via progress bar click
- Handle audio errors gracefully

---

## 9. Success Metrics

- Plugin installs successfully without errors
- Configuration screen is intuitive and validation works
- Context menu appears reliably on text selection
- API integration handles normal and error cases
- Audio playback is smooth with no quality loss
- Round-trip time from selection to playback < 5 seconds (assuming <500 character text)
- Plugin does not significantly impact browser performance

---

## 10. Future Enhancements (Out of Scope for MVP)

- **Multiple API Support:** Support alternative TTS APIs
- **Voice Preview:** Play sample audio for each voice
- **Text Editing:** Allow user to edit text before synthesis
- **History:** Store recent synthesized texts
- **Bookmarks:** Save favorite TTS combinations
- **Custom Shortcuts:** User-definable keyboard shortcuts via UI
- **Batch Processing:** Submit multiple text selections queue
- **Download:** Save synthesized audio as file
- **Language Detection:** Auto-detect language from highlighted text
- **Rate Limiting:** Prevent accidental multiple rapid requests
- **Analytics:** Usage tracking (if privacy-conscious approach taken)

---

## 11. Non-Functional Requirements

### 11.1 Performance
- Configuration screen loads in < 1 second
- Context menu appears in < 100ms
- API request timeout: 30 seconds
- Audio playback latency: < 100ms from button click

### 11.2 Security
- API URL validated before use
- No storage of sensitive information
- CORS/security headers respected
- Local network communication only (no external calls)

### 11.3 Compatibility
- Chrome 120+
- Chromium-based browsers (Edge, Brave, etc.)
- Cross-platform (Windows, macOS, Linux)

### 11.4 Accessibility
- Keyboard navigation for all controls
- ARIA labels for screen readers
- High contrast UI options
- Readable font sizes (minimum 14px)

---

## 12. Dependencies

- **Chrome/Chromium:** Version 120 or later
- **Kokoro TTS API:** Must be running and accessible on local network
- **Audio Codec Support:** Browser native MP3/WAV/OGG support

---

## 13. Testing Checklist

- [ ] Plugin installs without warnings
- [ ] Configuration settings persist across browser sessions
- [ ] API connection test works with valid/invalid URLs
- [ ] Voice dropdown populates correctly from API
- [ ] Context menu appears on text selection
- [ ] Text submission triggers API request
- [ ] Audio file downloads and plays correctly
- [ ] Player controls (play, pause, seek, volume) all functional
- [ ] Error messages display clearly
- [ ] Plugin handles network disconnects gracefully
- [ ] Keyboard shortcuts work as expected
- [ ] Settings sync across Chrome profiles (if enabled)

---

## 14. Appendix: API Requirements Summary

### Minimum API Contract
The Kokoro TTS API must support:

**Endpoint 1: Get Available Voices**
```
GET /voices (or similar endpoint name)
Response: JSON list of voice identifiers
```

**Endpoint 2: Synthesize Speech**
```
POST /synthesize (or similar endpoint name)
Request Body: { "text": string, "voice": string }
Response: Audio file binary or stream
```

Actual endpoint paths will be documented once API is tested.
