# 🌟 Day — Dynamic Island & Agent Companion for Windows, Linux & Android

<div align="center">

<img src="windows/src-tauri/icons/128x128.png" width="96" alt="Day Icon" />

### An elegant, interactive Dynamic Island & desktop companion for Windows, Linux, and Android.
Keep an eye on system telemetry, media playback, hardware usage, autonomous AI sessions, and mobile link in style.

[![Release](https://img.shields.io/badge/Release-v1.0.6-38bdf8?style=for-the-badge&logo=github)](https://github.com/Sudhan-2603/Day/releases/tag/v1.0.6)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20Android-22c55e?style=for-the-badge)](https://github.com/Sudhan-2603/Day)
[![Repo](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/Sudhan-2603/Day.git)

[📦 Download Releases](#-download--installation) • [✨ Features](#-key-features) • [🖥️ Dashboard Hub](#%EF%B8%8F-dashboard-hub) • [🛠️ Build from Source](#%EF%B8%8F-build-from-source)

---

</div>

## 🚀 What's New in v1.0.6

- 📦 **Cross-Platform Release Binaries**:
  - **Windows**: Full NSIS Setup Installer with GUI Wizard (`Day-Setup.exe`), Standalone Binary (`Day.exe`), 1-Click Installer (`Install-Day.bat`), and Uninstaller (`Uninstall-Day.bat`).
  - **Android**: Signed Release APK (`Day-Android.apk`) for Android 11+ with Phone Link & Home Screen Widgets.
  - **Linux (Ubuntu / Debian)**: Native Debian installer (`Day-Ubuntu-amd64.deb` / `day_1.0.5_amd64.deb`).
  - **Linux (Arch Linux)**: Native Pacman package (`Day-Arch-x86_64.pkg.tar.zst` / `day-1.0.5-1-x86_64.pkg.tar.zst`).
- 🏝️ **Dynamic Island Enhancements**:
  - Fully renamed and streamlined navigation from "Notch" to "Island".
  - Cleaned section headers across settings panels.
  - Right-aligned interactive toggle switches for system and capability features.
  - Real-time systematic telemetry monitoring (CPU, RAM, GPU, Network, Storage).
- 🌐 **Localhost Settings**: Seamless local browser-accessible settings layout on port 1420.
- 🗑️ **Built-in Uninstaller**: Clean uninstaller integrated with Windows "Installed Apps" and standalone script cleanup.

---

## 📦 Download & Installation

Clone the repository:
```bash
git clone https://github.com/Sudhan-2603/Day.git
cd Day
```

### 🪟 Windows

1. **Setup Wizard Installer**:
   - Download [`Day-Setup.exe`](https://github.com/Sudhan-2603/Day/releases/download/v1.0.6/Day-Setup.exe).
   - Run the installer to install Day into `%LOCALAPPDATA%\Programs\Day` with Start Menu & Desktop shortcuts.
   - Built-in uninstaller accessible anytime from Windows **Settings > Apps > Installed apps**.

2. **Portable / Script Install**:
   - Download [`Day.exe`](https://github.com/Sudhan-2603/Day/releases/download/v1.0.6/Day.exe) and [`Install-Day.bat`](https://github.com/Sudhan-2603/Day/releases/download/v1.0.6/Install-Day.bat).
   - Run `Install-Day.bat` for instant 1-click local setup.

---

### 📱 Android

1. Download [`Day-Android.apk`](https://github.com/Sudhan-2603/Day/releases/download/v1.0.6/Day-Android.apk) directly onto your phone (Android 11 or later).
2. Open the file to install (allow installs from your browser or file manager if prompted).
3. On your desktop app, open **Settings > Phone Link**, display the pairing QR code, and scan it with the mobile app.

---

### 🐧 Linux

#### Ubuntu / Debian (`.deb`)
```bash
# Download and install the Debian package
sudo dpkg -i Day-Ubuntu-amd64.deb
sudo apt-get install -f
```

#### Arch Linux (`.pkg.tar.zst`)
```bash
# Install with pacman
sudo pacman -U Day-Arch-x86_64.pkg.tar.zst
```

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

### 🎵 Media & Music Player
* Rich track titles, artist info, album cover art, and playback controls (Play, Pause, Next, Previous).

### ⏱️ Productivity & Focus
* Countdown timer, stopwatch, Pomodoro focus sessions, and desktop clock integration.

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

### Repository
```bash
git clone https://github.com/Sudhan-2603/Day.git
cd Day
```

### Windows Build
```bash
cd windows
npm install
npm run build
npm run tauri -- build --bundles nsis
```
Built binaries and setup installer will be placed in `windows/target/release/bundle/nsis/`.

### Android Build
```bash
cd android
./gradlew assembleRelease
```
The generated APK will be at `android/app/build/outputs/apk/release/app-release-unsigned.apk`.

### Linux Build
```bash
cd windows
npm install
npm run build
cargo build --release
```

---

## 📜 License
Sudhan License © 2026 Day Contributors.
Repository: [https://github.com/Sudhan-2603/Day.git](https://github.com/Sudhan-2603/Day.git)
