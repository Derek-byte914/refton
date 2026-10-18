# Refton Audio Studio

Original bilingual (RU/EN), browser-local audio effects studio. The GitHub Pages version is served directly from the repository root. It has no application backend, music uploads, analytics, account system, or external runtime CDN.

## Run / self-host
Serve this directory using a static HTTPS host (localhost works for development). ES modules, AudioWorklet, IndexedDB and Web Audio API are required. No build step or runtime package installation is needed.

## Project files
- `index.html`, `style.css`, `icon.svg`: responsive interface.
- `app.js`: UI, playback, import/export, persistence flow.
- `audio.js`: audio graph, presets, WAV serializer.
- `i18n.js`: bilingual strings, help, and legal notices.
- `storage.js`: IndexedDB and portable backup format.
- `capture-worklet.js`: PCM capture of a playable media element.
- `export-worker.js`: MP3 encoding adapter.
- `vendor/lame.min.js`: unchanged lamejs 1.2.1, loaded as a separate library.
- `LICENSE.txt`, `vendor/*`: application and third-party licenses/notices.

## Privacy and limits
Application files and source are public. User projects are not published. Project files are stored only in the browser. Clearing browser storage removes them. Private browsing and storage quotas may prevent persistence. Back up important projects. Backups are not encrypted.

Codec support depends on the browser. DRM and unsupported codecs are not decoded. The video fallback needs a visible tab and awake screen, and may introduce initial capture delay. It does not use the microphone.

## Licensing
Original application: MIT (`LICENSE.txt`). MP3 encoding uses lamejs 1.2.1 under its bundled LGPL terms. The unmodified standalone script, original author notice, original author notice, LGPLv3, and GPLv3 texts are bundled. The exact lamejs 1.2.1 source package is linked from npm in the UI. LAME: https://lame.sourceforge.net/ ; lamejs: https://github.com/zhuker/lamejs .

Use audio files only when you have the rights to process and share them. No third-party songs or samples are included. The demo track is synthesized in code.
