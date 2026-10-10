Release Notes – Day 0.1.0 (Windows)
Overview
Day is the rebranded version of Coucou, a lightweight Tauri‑based assistant that lives in the system tray and provides quick access to common tasks. All branding strings have been replaced with Day, and the executable has been renamed to Day.exe.

New Features
Branding overhaul – All UI text, titles, tooltips, and config entries now show Day instead of Coucou.
Custom avatar colour – Settings page now lets users pick an avatar colour for the mini‑bot; the bot canvas updates in‑real‑time to reflect the chosen colour.
Enhanced curve border – UI curve border adjustments for a fresher look.
Tray icon & menu – Updated tray icon and menu entries to use the Day branding.
Windows release build – Day.exe is generated in windows/target/release/ and ready for distribution.
Fixed Bugs / Improvements
Replaced all leftover occurrences of “Coucou” (including comments, identifiers, and resource names) with “Day”.
Fixed build‑time path references for the hook executable (Day‑hook.exe).
Updated tauri.conf.json, tauri.linux.conf.json, and related asset manifests.
Cleaned up language files (i18n/strings.json, extra.json).
Known Limitations
The NSIS installer step failed due to a temporary download timeout. The portable Day.exe works fully; an installer can be generated later once NSIS binaries are available.
How to Run
powershell

# From the project root
cd windows
# Run the portable executable
./target/release/Day.exe
You can also create a shortcut or add it to your startup folder if you want Day to launch automatically.
