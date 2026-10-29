# Day — Personal AI Assistant

An ambient, lightweight personal AI assistant featuring an interactive capsule dynamic island, responsive expressions and outfits, customizable appearance settings, and cross-platform desktop integration.

## Features
- **Capsule Dynamic Island**: Sleek, compact ambient island UI with live state indicators, quick actions, and toggle controls.
- **Bot Avatar & Animations**: Warm circular avatar with smooth dynamic expressions (Idle, Smile, Wink, Happy, Surprised, Sad, Angry, Sleep, Confused, Love, Laughing, Shy) and custom outfit skins.
- **Redesigned Settings & Appearance**: Full-featured settings dashboard with company branding, brand color picker, interface themes (System Preference, Light, Dark), transparent sidebar toggle, and view modes.
- **Claude Code Integration**: Streamlined focus on Claude code assistant workflows.

## Project Structure
- `windows/` — Tauri + Vite + TypeScript desktop application for Windows.
- `android/` — Android companion client.
- `linux/` — Linux desktop support.
- `NotchBuddy/` — macOS Notch dynamic island integration.
- `relay/` — Relay server and communication bridge.
- `design/` — UI design assets and reference specs.

## Getting Started (Windows)
```bash
cd windows
npm install
npm run dev
```

For production builds:
```bash
cd windows
npm run build
```
