# 🌟 Day — Dynamic Island & Agent Companion for Linux & Windows

<div align="center">

<img src="windows/src-tauri/icons/128x128.png" width="96" alt="Day Icon" />

### An elegant, interactive Dynamic Island & desktop companion for Linux and Windows.
Keep an eye on system telemetry, media playback, hardware usage, and autonomous AI sessions in style.

[![Release](https://img.shields.io/badge/Release-v1.0.5-38bdf8?style=for-the-badge&logo=github)](https://github.com/Sudhan-2603/Day/releases/tag/v1.0.5)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows-22c55e?style=for-the-badge)](https://github.com/Sudhan-2603/Day)
[![License](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)](LICENSE)

[📦 Download Latest Release](#-download--installation) • [✨ Features](#-key-features) • [🖥️ Dashboard Hub](#%EF%B8%8F-dashboard-hub) • [🛠️ Build from Source](#%EF%B8%8F-build-from-source)

---

</div>

## 🚀 What's New in v1.0.5

- 🎛️ **Renamed "System & Island" to "System"** across the entire UI and navigation.
- ⚡ **Real Systematic Data Integration**: Direct telemetry without external daemons:
  - **Live CPU Usage & Temperature**: Real-time tick counting via `/proc/stat` and thermal sensors.
  - **Live RAM Memory**: Real RAM breakdown from `/proc/meminfo`.
  - **Real Battery Status**: Live battery percentage, charging state, and alerts scanned directly from `/sys/class/power_supply/BAT*`.
  - **Real Network I/O**: Real throughput from `/proc/net/dev`.
  - **Active Downloads & Background Tasks**: Live detection of active transfers (`.part`, `.crdownload`) and recent downloads in `~/Downloads`.
- 🔘 **Interactive Capabilities Toggle Buttons**: Smooth on/off toggles positioned on the right side of each capability card. Turn individual features on/off dynamically.
- 🎨 **Cleaner Mini Settings**: Removed redundant outfit selector from the compact widget while keeping full wardrobe customization in the dashboard.
- 🛡️ **System Permissions Integration**: Consolidated file and editor permission controls directly under the **System** panel.

---

## ✨ Key Features

### 🏝️ Dynamic Island Design
* **Adaptive Pill & Expanded Cards**: Smooth spring animations that transition from a discreet compact status pill into a rich dashboard card.
* **Situational Expressions**: Day reacts dynamically to errors, uploading status, thinking mode, questions, approvals, and idle states.
* **Drag to Move**: Grab and position the Island anywhere on your multi-monitor desktop setup.

### 📊 Real-Time System Telemetry
* Live CPU %, thermal zone temperatures, and memory usage.
* Live battery charge percentage and AC power supply detection.
* Live network I/O activity tracking.

### 🎵 Media & Spotify MPRIS Player
* Rich track titles, artist info, album cover art, and playback controls (Play, Pause, Next, Previous) over native Linux MPRIS D-Bus.

### ⏱️ Productivity & Focus
* Countdown timer, stopwatch, Pomodoro focus sessions, and desktop clock integration.

---

## 📦 Download & Installation

### 🐧 Linux

#### Arch Linux (`.pkg.tar.zst`)
```bash
# Install the built package
sudo pacman -U day-1.0.5-1-x86_64.pkg.tar.zst
```

#### Ubuntu / Debian (`.deb`)
```bash
# Install Debian package
sudo dpkg -i day_1.0.5_amd64.deb
sudo apt-get install -f
```

---

### 🪟 Windows

#### Windows Setup Installer
1. Download **`Day-Setup.exe`** from the release files.
2. Run the installer to install Day and its companion hook relay to `%LOCALAPPDATA%\Programs\Day`.

#### Portable Version
Run **`Day.exe`** directly with `Day-hook.exe` placed in the same folder.

---

## 🖥️ Dashboard Hub

Click the **Settings ⚙** button to open the full dashboard layout:

| Section | Description |
| :--- | :--- |
| **General** | Interface language, always-visible mode, system autostart, and preferences |
| **System** | Hardware & network monitoring, capability switches, and system permissions |
| **Appearance** | Avatar aura colors, situational expressions, outfit picker, opacity slider, action buttons |
| **Shortcuts** | Global hotkeys for Island toggle (`Alt+Space`), chat prompt, wardrobe, and capture |
| **AI & Keys** | Claude, OpenAI, and local model integrations (Ollama / LMStudio) |

---

## 🛠️ Build from Source

### Prerequisites
* **Node.js**: v20 or newer (`npm`)
* **Rust & Cargo**: Latest stable
* **Linux Dependencies** (Ubuntu/Debian):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libgtk-layer-shell-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libdbus-1-dev
  ```

### Build Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sudhan-2603/Day.git
   cd Day
   ```

2. **Install frontend dependencies:**
   ```bash
   npm --prefix windows install
   ```

3. **Build Frontend & Hook:**
   ```bash
   npm --prefix windows run build
   ```

4. **Build Release Binary:**
   ```bash
   cargo build --release --manifest-path windows/Cargo.toml
   ```

5. **Package Linux Installers:**
   ```bash
   ./scripts/build-arch.sh   # Generates day-1.0.5-1-x86_64.pkg.tar.zst
   ./scripts/build-deb.sh    # Generates day_1.0.5_amd64.deb
   ```

---

## 📜 License

Sudhan License © 2026 Day Contributors.
