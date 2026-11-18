// Day for Windows — app wiring and the commands the island calls.

mod agent_hooks;
mod agents;
mod agy_approvals;
mod agy_rules;
mod chat;
mod claude;
mod claude_code;
mod cli_relay;
mod codex_plan;
mod config_file;
mod desktop;
mod files;
mod flow;
mod github;
mod herdr;
mod hooks;
mod i18n;
mod identity;
mod integrations;
mod calcom;
mod island;
mod launch;
mod local_chat;
mod log;
mod mail;
mod net;
mod notes;
mod openai_compat;
mod phone_link;
mod pipe;
mod platform;
#[cfg(target_os = "linux")]
mod portal;
mod recap;
mod secrets;
mod session_window;
mod settings;
mod shortcuts;
mod sounds;
mod speech;
mod spotify;
mod tray;
mod update;
mod voice;
#[cfg(windows)]
mod webview_drop;
mod webview_memory;
mod whatsapp;

use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::{ManagerExt, MacosLauncher};

use chat::{Chat, ChatContext, ChatReply, ModelInfo};
use files::DroppedFile;
use hooks::{HookPreview, HookStatus};
use island::{PollGate, ScreenInfo};
use pipe::Pending;
use settings::Settings;

pub struct Shared {
    pub settings: Mutex<Settings>,
    pub gate: Arc<PollGate>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootInfo {
    settings: Settings,
    screen: ScreenInfo,
    version: String,
    hook_path: String,
    /// False where the OS has no global cursor (Wayland): the page then reports
    /// the cursor from its own mouse events.
    cursor_poll: bool,
}

#[tauri::command]
fn boot(app: AppHandle, shared: State<Shared>) -> BootInfo {
    let mut settings = shared.settings.lock().unwrap().clone();
    // The real state of ~/.claude/settings.json wins over whatever we stored.
    let hooks_status = hooks::status();
    settings.hooks_installed = hooks_status.installed;
    settings.plan_relay_installed = hooks_status.plan_relay_installed;
    let screen = island::screen_info(&app, &settings.screen);
    BootInfo {
        settings,
        screen,
        version: env!("CARGO_PKG_VERSION").to_string(),
        hook_path: settings::hook_exe_path().to_string_lossy().to_string(),
        cursor_poll: platform::CURSOR_POLL,
    }
}

#[tauri::command]
fn save_settings(app: AppHandle, shared: State<Shared>, settings: Settings) {
    let (settings, screen_changed, autostart_changed, shortcuts_changed) = {
        let mut current = shared.settings.lock().unwrap();
        let screen_changed = current.screen != settings.screen;
        let autostart_changed = current.autostart != settings.autostart;
        let shortcuts_changed = current.shortcuts != settings.shortcuts;
        // Where Day sits on the desktop is desktop.rs's to say, not a webview's.
        let mut settings = settings.clone();
        settings.desktop_Day = current.desktop_Day.clone();
        // Same for the phone link: only its own commands turn it on or off.
        settings.phone_link = current.phone_link;
        settings.phone_chat = current.phone_chat;
        settings.phone_details = current.phone_details;
        settings.phone_answers = current.phone_answers;
        settings.phone_diffs = current.phone_diffs;
        settings.phone_usage = current.phone_usage;
        settings.phone_recap = current.phone_recap;
        settings.phone_services = current.phone_services.clone();
        settings.phone_relay = current.phone_relay;
        settings.phone_relay_url = current.phone_relay_url.clone();
        settings.phone_chat_models = current.phone_chat_models.clone();
        // Antigravity approvals: only their own switch changes them (agy_approvals.rs).
        settings.agy_approvals_enabled = current.agy_approvals_enabled;
        *current = settings;
        (current.clone(), screen_changed, autostart_changed, shortcuts_changed)
    };
    if let Err(err) = settings::save(&settings) {
        log::line(format!("could not save settings: {err}"));
    }
    if autostart_changed {
        let manager = app.autolaunch();
        let result = if settings.autostart { manager.enable() } else { manager.disable() };
        if let Err(err) = result {
            eprintln!("[Day] autostart: {err}");
        }
    }
    if screen_changed {
        let collapsed = shared.gate.collapsed.load(Ordering::Relaxed);
        let size = *shared.gate.collapsed_size.lock().unwrap();
        island::apply_geometry(&app, &settings.screen, collapsed.then_some(size));
    }
    integrations::settings_saved(&app, &settings.active_integrations);
    spotify::sync(&app, &settings.active_integrations);
    whatsapp::sync(&settings.active_integrations);
    if shortcuts_changed {
        shortcuts::apply(&app, &settings.shortcuts);
    }
    if i18n::set_picked(&settings.language) {
        language_changed(&app);
    }
    // Keep the other window in step (island ⇄ settings window).
    let _ = app.emit("settings-changed", settings);
}

/// The island reports the system's languages at launch, for "System" in
/// Settings → Language (WebView2 and WebKitGTK know them best).
#[tauri::command]
fn set_system_languages(app: AppHandle, languages: Vec<String>) {
    if i18n::set_system(languages) {
        language_changed(&app);
    }
}

/// What Rust labels itself follows the new language: the tray menu and the
/// settings window's title. The webviews switch on their own.
fn language_changed(app: &AppHandle) {
    tray::retitle(app);
    if let Some(window) = app.get_webview_window(HUB_LABEL) {
        let _ = window.set_title("Day");
    }
}

/// Read the native operating system clipboard without triggering browser permissions.
#[tauri::command]
fn read_clipboard_text() -> Option<String> {
    arboard::Clipboard::new().ok().and_then(|mut c| c.get_text().ok())
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct RealSystemInfo {
    pub network_name: String,
    pub network_type: String,
    pub online: bool,
    pub battery_level: Option<i64>,
    pub computer_name: String,
}

/// Query actual system network, battery, and workstation info.
#[tauri::command]
fn get_system_info() -> RealSystemInfo {
    let computer_name = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows PC".into());
    let mut network_name = "Local Network".to_string();
    let mut network_type = "WiFi".to_string();
    let mut online = false;
    let mut battery_level = None;

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let script = r#"[PSCustomObject]@{ name = (Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name -First 1); alias = (Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object -ExpandProperty InterfaceAlias -First 1); conn = (Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IPv4Connectivity -First 1); battery = (Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -ExpandProperty EstimatedChargeRemaining -First 1) } | ConvertTo-Json -Compress"#;
        if let Ok(output) = std::process::Command::new("powershell")
            .args(&["-NoProfile", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(text.trim()) {
                    if let Some(n) = v.get("name").and_then(|x| x.as_str()) {
                        if !n.is_empty() {
                            network_name = n.to_string();
                        }
                    }
                    if let Some(a) = v.get("alias").and_then(|x| x.as_str()) {
                        if !a.is_empty() {
                            network_type = a.to_string();
                        }
                    }
                    if let Some(c) = v.get("conn").and_then(|x| x.as_i64()) {
                        online = c == 4;
                    }
                    if let Some(b) = v.get("battery").and_then(|x| x.as_i64()) {
                        battery_level = Some(b);
                    }
                }
            }
        }
    }

    RealSystemInfo {
        network_name,
        network_type,
        online,
        battery_level,
        computer_name,
    }
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct SystemMetrics {
    pub cpu_percent: i64,
    pub ram_used_gb: f64,
    pub ram_total_gb: f64,
    pub ram_percent: i64,
    pub storage_used_gb: f64,
    pub storage_total_gb: f64,
    pub storage_percent: i64,
    pub gpu_name: String,
    pub network_rx_mb: f64,
    pub network_tx_mb: f64,
}

/// Query real-time system performance telemetry (CPU, RAM, Storage, GPU, Network).
#[tauri::command]
fn get_system_metrics() -> SystemMetrics {
    let mut cpu_percent = 15;
    let mut ram_used_gb = 8.0;
    let mut ram_total_gb = 16.0;
    let mut ram_percent = 50;
    let mut storage_used_gb = 180.0;
    let mut storage_total_gb = 256.0;
    let mut storage_percent = 70;
    let mut gpu_name = "Integrated GPU".to_string();
    let mut network_rx_mb = 0.0;
    let mut network_tx_mb = 0.0;

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let script = r#"$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue; $totRam = if ($os) { [math]::Round($os.TotalVisibleMemorySize / 1MB, 1) } else { 16.0 }; $freeRam = if ($os) { [math]::Round($os.FreePhysicalMemory / 1MB, 1) } else { 8.0 }; $usedRam = [math]::Round($totRam - $freeRam, 1); $ramPct = [math]::Round(($usedRam / [math]::Max($totRam, 1)) * 100); $cpu = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average; if ($null -eq $cpu) { $cpu = 15 }; $d = Get-PSDrive C -ErrorAction SilentlyContinue; $dUsed = if ($d) { [math]::Round($d.Used/1GB, 1) } else { 100.0 }; $dFree = if ($d) { [math]::Round($d.Free/1GB, 1) } else { 50.0 }; $dTot = [math]::Round($dUsed + $dFree, 1); $dPct = [math]::Round(($dUsed / [math]::Max($dTot, 1)) * 100); $gpu = (Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name -First 1); if (!$gpu) { $gpu = "Graphics Adapter" }; $stats = Get-NetAdapterStatistics -ErrorAction SilentlyContinue; $rx = if ($stats) { ($stats | Measure-Object -Property ReceivedBytes -Sum).Sum } else { 0 }; $tx = if ($stats) { ($stats | Measure-Object -Property SentBytes -Sum).Sum } else { 0 }; [PSCustomObject]@{ cpu_percent = [int]$cpu; ram_used_gb = [double]$usedRam; ram_total_gb = [double]$totRam; ram_percent = [int]$ramPct; storage_used_gb = [double]$dUsed; storage_total_gb = [double]$dTot; storage_percent = [int]$dPct; gpu_name = [string]$gpu; network_rx_mb = [double][math]::Round($rx / 1MB, 1); network_tx_mb = [double][math]::Round($tx / 1MB, 1) } | ConvertTo-Json -Compress"#;
        if let Ok(output) = std::process::Command::new("powershell")
            .args(&["-NoProfile", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(text.trim()) {
                    if let Some(c) = v.get("cpu_percent").and_then(|x| x.as_i64()) { cpu_percent = c; }
                    if let Some(r) = v.get("ram_used_gb").and_then(|x| x.as_f64()) { ram_used_gb = r; }
                    if let Some(r) = v.get("ram_total_gb").and_then(|x| x.as_f64()) { ram_total_gb = r; }
                    if let Some(r) = v.get("ram_percent").and_then(|x| x.as_i64()) { ram_percent = r; }
                    if let Some(s) = v.get("storage_used_gb").and_then(|x| x.as_f64()) { storage_used_gb = s; }
                    if let Some(s) = v.get("storage_total_gb").and_then(|x| x.as_f64()) { storage_total_gb = s; }
                    if let Some(s) = v.get("storage_percent").and_then(|x| x.as_i64()) { storage_percent = s; }
                    if let Some(g) = v.get("gpu_name").and_then(|x| x.as_str()) { gpu_name = g.to_string(); }
                    if let Some(n) = v.get("network_rx_mb").and_then(|x| x.as_f64()) { network_rx_mb = n; }
                    if let Some(n) = v.get("network_tx_mb").and_then(|x| x.as_f64()) { network_tx_mb = n; }
                }
            }
        }
    }

    SystemMetrics {
        cpu_percent,
        ram_used_gb,
        ram_total_gb,
        ram_percent,
        storage_used_gb,
        storage_total_gb,
        storage_percent,
        gpu_name,
        network_rx_mb,
        network_tx_mb,
    }
}

/// Open native live Windows command prompt (cmd.exe)
#[tauri::command]
fn open_system_cmd() -> bool {
    #[cfg(windows)]
    {
        use std::process::Command;
        let _ = Command::new("cmd.exe").args(&["/k"]).spawn();
        true
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Hidden island → shrink the window to the invisible wake strip and park the
/// cursor poll; anything else → full panel and 60 Hz polling.
#[tauri::command]
fn set_collapsed(app: AppHandle, shared: State<Shared>, collapsed: bool, width: Option<f64>, height: Option<f64>) {
    let pref = shared.settings.lock().unwrap().screen.clone();
    shared.gate.collapsed.store(collapsed, Ordering::Relaxed);
    // An older page sends no size: the wake strip, as before.
    let size = island::clamp_collapsed((width.unwrap_or(island::STRIP_W), height.unwrap_or(island::STRIP_H)));
    *shared.gate.collapsed_size.lock().unwrap() = size;
    // The poll stops first: a tick of it after this could make the closed
    // island click-through again (see spawn_cursor_poll).
    if collapsed {
        shared.gate.set_active(false);
    }
    island::apply_geometry(&app, &pref, collapsed.then_some(size));
    // The closed island must always take the mouse, and a resize invalidates the flag.
    island::refresh_click_through(&app, &shared.gate);
    shared.gate.set_active(!collapsed);
    platform::set_pointer_watch(!collapsed);
}

/// The front end pushes the island shape; Rust decides click-through from it.
#[tauri::command]
fn set_island_rect(app: AppHandle, shared: State<Shared>, x: f64, y: f64, width: f64, height: f64) {
    shared.gate.set_rect(island::IslandRect { x, y, w: width, h: height });
    // Without the cursor poll the input region is the click-through: it follows the island.
    if !platform::CURSOR_POLL {
        island::refresh_click_through(&app, &shared.gate);
    }
}

#[tauri::command]
fn focus_window(app: AppHandle, focused: bool) {
    let Some(win) = island::window(&app) else { return };
    platform::set_activating(&win, focused);
    if focused {
        let _ = win.set_focus();
    }
}

#[tauri::command]
fn reposition(app: AppHandle, shared: State<Shared>) {
    let pref = shared.settings.lock().unwrap().screen.clone();
    let collapsed = shared.gate.collapsed.load(Ordering::Relaxed);
    let size = *shared.gate.collapsed_size.lock().unwrap();
    island::apply_geometry(&app, &pref, collapsed.then_some(size));
}

/// The panel is laid out in CSS px against the window's own scale. If the webview
/// reports a different devicePixelRatio (it ends up bigger than the window and gets
/// cut), correct its zoom so one CSS px is one logical px again.
#[tauri::command]
fn fit_zoom(app: AppHandle, dpr: f64) -> bool {
    let Some(win) = island::window(&app) else { return false };
    let scale = win.scale_factor().unwrap_or(1.0);
    static ZOOM: std::sync::Mutex<f64> = std::sync::Mutex::new(1.0);
    let mut zoom = ZOOM.lock().unwrap();
    if let Some(new_zoom) = island::calculate_zoom_correction(*zoom, scale, dpr) {
        *zoom = new_zoom;
        log::line(format!("webview dpr {dpr} != window scale {scale} — setting zoom {new_zoom:.3}"));
        let _ = win.set_zoom(new_zoom);
        true
    } else {
        false
    }
}


/// The displays the island can be pinned to, for Settings.
#[tauri::command]
fn list_monitors(app: AppHandle) -> Vec<island::MonitorChoice> {
    island::monitor_choices(&app)
}

#[tauri::command]
fn open_url(url: String) {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return;
    }
    platform::open_url(&url);
}

/// Opens a GitLab link only when it belongs to the configured instance. This
/// also covers self-hosted installations without exposing their token.
#[tauri::command]
fn open_gitlab_url(url: String) {
    let base = secrets::get("gitlab-url").unwrap_or_else(|| "https://gitlab.com".into());
    let (Ok(target), Ok(instance)) = (reqwest::Url::parse(&url), reqwest::Url::parse(base.trim())) else { return };
    if is_forge_instance_url(&target, &instance) {
        open_url(url);
    }
}

fn is_forge_instance_url(target: &reqwest::Url, instance: &reqwest::Url) -> bool {
    if !matches!(target.scheme(), "http" | "https")
        || target.scheme() != instance.scheme()
        || target.host_str() != instance.host_str()
        || target.port_or_known_default() != instance.port_or_known_default()
    {
        return false;
    }
    let base = instance.path().trim_end_matches('/');
    base.is_empty() || target.path() == base || target.path().starts_with(&format!("{base}/"))
}

/// The configured Gitea address is a credential-store value, so the island
/// asks Rust to open it instead of ever receiving it.
#[tauri::command]
fn open_gitea() {
    if let Some(url) = secrets::get("gitea-url") {
        open_url(url);
    }
}

#[tauri::command]
fn open_gitea_url(url: String) {
    let (Ok(target), Some(base)) = (reqwest::Url::parse(&url), secrets::get("gitea-url")) else { return };
    let Ok(instance) = reqwest::Url::parse(&base) else { return };
    if is_forge_instance_url(&target, &instance) {
        open_url(url);
    }
}

/// "Open terminal" opens the working folder in VS Code when `code` is on PATH,
/// and falls back to the file manager otherwise.
#[tauri::command]
fn open_in_vscode(path: Option<String>) -> bool {
    // No shell anywhere near this. The path is a project folder chosen by
    // whoever is using Claude Code, and a shell would happily read `&`, `^`, `%`
    // or `$` in a folder name as syntax. Finding the launcher ourselves and
    // handing the path over as a separate argument keeps it a path.
    let path = path.filter(|p| !p.is_empty());
    // It arrives in a hook payload: only an existing folder, given by its full
    // path, goes any further. `code` would read `--something` as an option, and
    // xdg-open would launch a file with whatever handles its type.
    if let Some(p) = path.as_deref() {
        let p = std::path::Path::new(p);
        if !(p.is_absolute() && p.is_dir()) {
            return false;
        }
    }
    if let Some(code) = platform::find_on_path("code") {
        let mut cmd = Command::new(code);
        if let Some(p) = path.as_deref() {
            cmd.arg(p);
        }
        if platform::no_console(&mut cmd).spawn().is_ok() {
            return true;
        }
    }
    if let Some(p) = path.as_deref() {
        platform::reveal_folder(p);
    }
    false
}

/// "Open terminal": brings forward the terminal or editor window the session
/// runs in, when it was found (see session_window.rs); otherwise opens the
/// folder in VS Code, as before. A session in herdr also gets its pane selected,
/// and never falls back to VS Code.
#[tauri::command]
fn open_session(session_id: Option<String>, path: Option<String>) -> bool {
    let in_herdr = session_id.as_deref().is_some_and(herdr::focus);
    let Some(owners) = session_id.as_deref().and_then(session_window::lookup) else {
        return in_herdr || open_in_vscode(path);
    };
    let folder = path.as_deref().map(session_window::folder_name).unwrap_or_default().to_string();
    #[cfg(windows)]
    {
        if platform::focus_session_window(&owners, &folder) || in_herdr {
            return true;
        }
        open_in_vscode(path)
    }
    // Linux asks the display server, KWin or the terminal, which can take a
    // moment: never on the UI thread a sync command runs on. VS Code still
    // opens when none of them could bring the window forward.
    #[cfg(target_os = "linux")]
    {
        std::thread::spawn(move || {
            if !platform::focus_session_window(&owners, &folder) && !in_herdr {
                open_in_vscode(path);
            }
        });
        true
    }
}

/// The Claude Desktop pill's target: the Claude app (Windows, and Linux with
/// Anthropic's .deb).
#[tauri::command]
fn open_claude_desktop() -> bool {
    platform::open_claude_desktop()
}

/// The file behind a live diff, if it may be handed to the editor: an existing
/// regular file given by its full path. Anything else — a relative path, a
/// folder, a path `code` could read as an option — goes no further.
fn diff_file(path: &str) -> Option<&std::path::Path> {
    let p = std::path::Path::new(path);
    (p.is_absolute() && p.is_file()).then_some(p)
}

/// The diff card's ↗: opens the edited file in VS Code when `code` is on PATH,
/// otherwise shows its folder. The file itself is never opened by its type —
/// xdg-open or Explorer would run a script that Claude just wrote.
#[tauri::command]
fn open_file_in_vscode(path: String) -> bool {
    let Some(file) = diff_file(&path) else { return false };
    if let Some(code) = platform::find_on_path("code") {
        let mut cmd = Command::new(code);
        cmd.arg(file);
        if platform::no_console(&mut cmd).spawn().is_ok() {
            return true;
        }
    }
    if let Some(folder) = file.parent().filter(|d| d.is_dir()) {
        platform::reveal_folder(&folder.to_string_lossy());
    }
    false
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Tray → Pause. Paused means paused: the pollers stop talking to the network,
/// not just the island stopping showing things.
#[tauri::command]
fn set_paused(paused: bool) {
    integrations::set_paused(paused);
}

// ── Claude Code hooks ─────────────────────────────────────────────────────────

#[tauri::command]
fn hooks_status() -> HookStatus {
    hooks::status()
}

/// Pill ID → whether that agent's hooks reach Day. Read-only.
#[tauri::command]
fn agent_hooks_status() -> std::collections::HashMap<String, bool> {
    agent_hooks::status()
}

/// Returns the diff the user has to look at before anything is written.
#[tauri::command]
fn hooks_preview(install: bool) -> Result<HookPreview, String> {
    hooks::preview(install)
}

/// Only ever called from an explicit click in the settings window.
#[tauri::command]
fn hooks_apply(
    app: AppHandle,
    shared: State<Shared>,
    install: bool,
    fingerprint: String,
) -> Result<String, String> {
    // The fingerprint comes from the preview the user actually looked at, so a
    // settings.json that changed in between is refused rather than overwritten.
    let backup = hooks::write(install, &fingerprint)?;
    let updated = {
        let mut current = shared.settings.lock().unwrap();
        current.hooks_installed = install;
        if let Err(err) = settings::save(&current) {
            log::line(format!("could not save settings: {err}"));
        }
        current.clone()
    };
    let _ = app.emit("settings-changed", updated);
    Ok(backup)
}

// ── Other agents' hooks and plugins ──────────────────────────────────────────

#[tauri::command]
fn agent_hooks_list() -> Vec<agents::AgentStatus> {
    agents::list()
}

/// The diff the user has to look at before anything is written.
#[tauri::command]
fn agent_hooks_preview(agent: String, install: bool) -> Result<config_file::Plan, String> {
    agents::preview(&agent, install)
}

/// Only ever called from an explicit click in the settings window, with the
/// fingerprint of the preview the user looked at.
#[tauri::command]
fn agent_hooks_apply(agent: String, install: bool, fingerprint: String) -> Result<String, String> {
    let backups = agents::apply(&agent, install, &fingerprint)?;
    let done = if install { "installed" } else { "removed" };
    log::line(format!("agent hooks {done} for {agent}"));
    Ok(backups)
}

// ── Plan usage ────────────────────────────────────────────────────────────────

/// The diff of putting the plan usage relay into (or taking it out of) the
/// status line, before anything is written.
#[tauri::command]
fn status_line_preview(install: bool) -> Result<HookPreview, String> {
    hooks::status_line_preview(install)
}

/// Only ever called from an explicit click in the settings window.
#[tauri::command]
fn status_line_apply(
    app: AppHandle,
    shared: State<Shared>,
    install: bool,
    fingerprint: String,
) -> Result<String, String> {
    let backup = hooks::status_line_write(install, &fingerprint)?;
    let updated = {
        let mut current = shared.settings.lock().unwrap();
        current.plan_relay_installed = install;
        // As on the Mac: taking the relay out turns the pill off with it.
        if !install {
            current.show_plan_in_notch = false;
            current.show_plan_in_compact_island = false;
        }
        if let Err(err) = settings::save(&current) {
            log::line(format!("could not save settings: {err}"));
        }
        current.clone()
    };
    let _ = app.emit("settings-changed", updated);
    Ok(backup)
}

/// Codex plan usage, asked of the Codex CLI (`codex app-server`) when its pill
/// shows. Off the main thread: it can take a few seconds.
#[tauri::command]
async fn codex_plan_usage() -> Option<serde_json::Value> {
    tauri::async_runtime::spawn_blocking(codex_plan::read).await.ok().flatten()
}

#[tauri::command]
fn approval_decision(app: AppHandle, request_id: String, decision: String) {
    recap::record_decision(&app, &request_id, &decision);
    pipe::answer(&app, &request_id, &decision);
}

/// An option picked on the island for a question Claude Code asked.
#[tauri::command]
fn approval_answer(
    app: AppHandle,
    request_id: String,
    answers: std::collections::HashMap<String, serde_json::Value>,
) {
    // An answered question is not an Allow / Deny: nothing for the recap.
    recap::forget_request(&app, &request_id);
    pipe::answer_question(&app, &request_id, &answers);
}

/// The island has the card on screen, so the long wait for a human may begin.
/// Until this arrives the relay only waits a few hundred milliseconds, which is
/// what stops a paused or unresponsive island from freezing Claude Code.
#[tauri::command]
fn approval_ack(app: AppHandle, request_id: String) {
    pipe::acknowledge(&app, &request_id);
}

/// Nobody can act on this request — the island is paused, or another card is
/// already up. Claude Code falls back to asking in the terminal immediately.
#[tauri::command]
fn approval_decline(app: AppHandle, request_id: String) {
    recap::forget_request(&app, &request_id);
    pipe::decline(&app, &request_id);
}

// ── Chat, files and secrets ───────────────────────────────────────────────────

/// One chat turn with the provider picked in the chat view. API keys and any
/// file bytes stay on the Rust side.
#[tauri::command]
async fn chat_send(
    app: AppHandle,
    shared: State<'_, Shared>,
    chat: State<'_, Chat>,
    query: String,
    context: Option<ChatContext>,
    mail: Option<bool>,
) -> Result<ChatReply, String> {
    let settings = shared.settings.lock().unwrap().clone();
    // The chat's Mail switch: the latest Outlook messages ride under the request, and the
    // system prompt says how to write a plan (mail/plan.rs) that runs only after a click.
    if mail == Some(true) {
        let query = mail::decorate(&query).await;
        mail::MAIL_TURN.store(true, std::sync::atomic::Ordering::Relaxed);
        let reply = chat::send(&app, &chat, &settings, query, context).await;
        mail::MAIL_TURN.store(false, std::sync::atomic::Ordering::Relaxed);
        return reply;
    }
    chat::send(&app, &chat, &settings, query, context).await
}

/// The models a provider offers, for the picker in the chat view. Only asked
/// once the user picked that provider, and only with its key or address.
#[tauri::command]
async fn chat_models(shared: State<'_, Shared>, provider: String) -> Result<Vec<ModelInfo>, String> {
    let settings = shared.settings.lock().unwrap().clone();
    chat::models(&settings, &provider).await
}

/// The Claude API settings use their own key even when chat uses a CLI plan.
#[tauri::command]
async fn claude_api_models() -> Result<Vec<ModelInfo>, String> {
    claude::available_models().await
}

/// Settings → Local models → Connect: does the server answer, and with which models?
#[tauri::command]
async fn local_connect(provider: String, url: String) -> Result<local_chat::Connected, String> {
    local_chat::connect(&provider, &url).await
}

/// Stores the custom server's key for the address typed next to it; it is only
/// ever sent to that address.
#[tauri::command]
fn local_set_key(url: String, key: String) -> Result<(), String> {
    local_chat::set_custom_key(&url, &key)
}

#[tauri::command]
fn chat_reset(chat: State<Chat>) {
    chat.reset();
}

/// Copies a dropped file into the inbox and reports its name back.
#[tauri::command]
fn ingest_file(path: String) -> Result<DroppedFile, String> {
    files::ingest(&path)
}

/// The island may only ask whether a key exists — never read it.
#[tauri::command]
fn secret_present(key: String) -> bool {
    secrets::present(&key)
}

/// Whether Claude can answer: an API key, or else the user's own Claude Code.
#[tauri::command]
fn claude_ready() -> bool {
    claude::ready()
}

/// Settings → Chat → Your AI subscriptions: each provider's switch and
/// whether its terminal tool is installed (looked up again on every call).
#[tauri::command]
fn subscription_status(shared: State<Shared>) -> Vec<cli_relay::Status> {
    let settings = shared.settings.lock().unwrap().clone();
    cli_relay::status(&settings)
}

/// A switch under "Your AI subscriptions" moved: saved, and both windows told.
#[tauri::command]
fn subscription_set(app: AppHandle, shared: State<Shared>, provider: String, on: bool) -> Vec<cli_relay::Status> {
    let settings = {
        let mut current = shared.settings.lock().unwrap();
        cli_relay::set(&mut current, &provider, on);
        current.clone()
    };
    if let Err(err) = settings::save(&settings) {
        log::line(format!("could not save settings: {err}"));
    }
    let status = cli_relay::status(&settings);
    let _ = app.emit("settings-changed", settings);
    status
}

#[tauri::command]
fn secret_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
    // Bound to its server's address: only local_set_key may store it.
    if key == local_chat::CUSTOM_KEY {
        return Err("use local_set_key".into());
    }
    let before = (key == "github-token").then(|| secrets::get(&key));
    secrets::set(&key, &value)?;
    if key == claude::KEY {
        voice::sync(&app);
    }
    if let Some(before) = before {
        if secrets::get(&key) != before {
            integrations::github_token_changed(&app);
        }
    }
    if key == "gitea-token" || key == "gitea-url" {
        integrations::gitea_credentials_changed(&app);
    }
    Ok(())
}

#[tauri::command]
fn secret_clear(app: AppHandle, key: String) -> Result<(), String> {
    let had = key == "github-token" && secrets::present(&key);
    secrets::clear(&key)?;
    if key == claude::KEY {
        voice::sync(&app);
    }
    if had {
        integrations::github_token_changed(&app);
    }
    if key == "gitea-token" || key == "gitea-url" {
        integrations::gitea_credentials_changed(&app);
    }
    Ok(())
}

/// Opens the configured n8n instance — the URL lives in the Credential Manager.
#[tauri::command]
fn open_n8n() {
    if let Some(url) = secrets::get("n8n-url") {
        open_url(url);
    }
}

/// Refresh buttons in the integration cards.
#[tauri::command]
async fn refresh_integration(app: AppHandle, id: String) {
    integrations::poll_once(app, &id).await;
}

/// The GitHub card was opened: refetch its `section` ("pulse" or "activity")
/// if it is stale. The pollers still decline while the pill is off or paused.
#[tauri::command]
fn github_refresh(section: String) {
    integrations::github_refresh_if_stale(&section);
}

/// Lets the island write to the same log as the Rust side.
#[tauri::command]
fn log_line(message: String) {
    log::line(format!("ui  {message}"));
}

// ── Global shortcuts ──────────────────────────────────────────────────────────

/// How each global shortcut went: registered, taken by another app, and so on.
#[tauri::command]
fn shortcuts_status(app: AppHandle) -> shortcuts::Report {
    shortcuts::status(&app)
}

/// Settings is recording a new combination: let go of ours meanwhile, so the
/// keys reach the recorder instead of running an action. `false` takes them back.
#[tauri::command]
fn shortcuts_suspend(app: AppHandle, shared: State<Shared>, suspended: bool) {
    if suspended {
        shortcuts::suspend(&app);
    } else {
        let stored = shared.settings.lock().unwrap().shortcuts.clone();
        shortcuts::apply(&app, &stored);
    }
}

// ── Settings window ───────────────────────────────────────────────────────────

/// WebView2 allows exactly one browser environment per app, and its options are
/// fixed by whichever webview is created first. Every window must therefore ask
/// for the *same* arguments as the island (see `additionalBrowserArgs` in
/// tauri.conf.json) — a mismatch makes the second window come up blank, with no
/// error anywhere.
pub(crate) const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required";

/// In a dev build the pages are served by Vite, so the second window needs the
/// absolute dev URL; a bundled build resolves it inside the app bundle.
fn settings_page_url(app: &AppHandle) -> WebviewUrl {
    #[cfg(all(dev, debug_assertions))]
    if let Some(mut base) = app.config().build.dev_url.clone() {
        base.set_path("/settings.html");
        return WebviewUrl::External(base);
    }
    let _ = app;
    WebviewUrl::App("settings.html".into())
}

/// The Day window (Flow dictation, the Notetaker and every setting of the
/// island), labelled "settings" since it grew out of the settings window.
pub const HUB_LABEL: &str = "settings";

fn startup_trace(message: impl AsRef<str>) {
    let Some(path) = std::env::var_os("DAY_STARTUP_TRACE") else { return };
    let mut options = std::fs::OpenOptions::new();
    options.create(true).append(true);
    if let Ok(mut file) = options.open(path) {
        use std::io::Write as _;
        let _ = writeln!(file, "{}", message.as_ref());
    }
}

/// The Day window is created hidden at launch and only ever shown and
/// hidden afterwards. A WebView2 window created later — on the main thread or
/// not — silently comes up blank in this app, so the window that works is the
/// one that exists before the island's webview does.
fn create_settings_window(app: &AppHandle) {
    let url = settings_page_url(app);
    startup_trace("settings build begin");
    match WebviewWindowBuilder::new(app, HUB_LABEL, url)
        .additional_browser_args(BROWSER_ARGS)
        .title("Day - Settings")
        .inner_size(1100.0, 720.0)
        .min_inner_size(820.0, 560.0)
        .resizable(true)
        .visible(true)
        .center()
        .build()
    {
        Ok(win) => {
            startup_trace("settings build done");
            let this = win.clone();
            win.on_window_event(move |event| match event {
                // Closing it must only hide it, or it could never be reopened.
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = this.hide();
                    set_hub_shown(&this, false);
                    webview_memory::set_low(&this, true);
                }
                // Minimised (a 0×0 resize on Windows) or back from it.
                tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Focused(true) => {
                    let on = this.is_visible().unwrap_or(false) && !this.is_minimized().unwrap_or(false);
                    set_hub_shown(&this, on);
                }
                _ => {}
            });
            webview_memory::set_low(&win, false);
            set_hub_shown(&win, true);
            startup_trace("settings memory target done");
        }
        Err(err) => {
            startup_trace(format!("settings build error: {err}"));
            log::line(format!("Day window failed: {err}"));
        }
    }
}

/// Whether the Day window is on screen (shown and not minimised). Its page
/// animates its canvases only then (hub/hero.ts): WebKitGTK can keep
/// `document.visibilityState` at "visible" for a hidden window, and its
/// animation loop then kept a core busy with the window closed (#792).
static HUB_SHOWN: AtomicBool = AtomicBool::new(false);

fn set_hub_shown(win: &tauri::WebviewWindow, shown: bool) {
    if HUB_SHOWN.swap(shown, Ordering::Relaxed) != shown {
        let _ = win.emit_to(HUB_LABEL, "hub-visible", shown);
    }
}

/// Whether the Day window is on screen, for what only it shows.
pub(crate) fn hub_is_shown() -> bool {
    HUB_SHOWN.load(Ordering::Relaxed)
}

/// The page asks once at load, in case it missed the event.
#[tauri::command]
fn hub_shown() -> bool {
    HUB_SHOWN.load(Ordering::Relaxed)
}

pub fn show_settings_window(app: &AppHandle) {
    show_hub(app, Some("general"));
}

/// Shows the Day window, on `page` when given ("dictation", "notes",
/// "settings", "general", "shortcuts"…).
pub fn show_hub(app: &AppHandle, page: Option<&str>) {
    let Some(win) = app.get_webview_window(HUB_LABEL) else {
        // Creating it at startup can fail on some machines (WebView2
        // 0x80070578, #775): try again now, on the main thread, where
        // window creation can't deadlock a command.
        log::line("Day window missing, creating it again");
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            create_settings_window(&handle);
            if let Some(win) = handle.get_webview_window(HUB_LABEL) {
                webview_memory::set_low(&win, false);
                let _ = win.show();
                let _ = win.set_focus();
                set_hub_shown(&win, true);
            }
        });
        return;
    };
    if let Some(page) = page {
        let _ = win.emit("hub-page", page.to_string());
    }
    webview_memory::set_low(&win, false);
    let _ = win.unminimize();
    let _ = win.show();
    let _ = win.set_focus();
    set_hub_shown(&win, true);
}

/// The argument the login item starts Day with.
const AUTOSTART_ARG: &str = "--autostart";

/// Day started with the computer, not opened by the user: the window stays hidden.
pub fn launched_at_login() -> bool {
    std::env::args().any(|a| a == AUTOSTART_ARG)
}

#[tauri::command]
fn open_settings_window(app: AppHandle, page: Option<String>) {
    show_hub(&app, Some(page.as_deref().unwrap_or("general")));
}

fn start_localhost_server() {
    std::thread::spawn(|| {
        let listener = match std::net::TcpListener::bind("127.0.0.1:1420") {
            Ok(l) => l,
            Err(_) => return, // Port already in use, e.g. Vite dev server is running
        };
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                std::thread::spawn(move || {
                    let mut buffer = [0u8; 2048];
                    use std::io::{Read, Write};
                    if let Ok(n) = stream.read(&mut buffer) {
                        let req = String::from_utf8_lossy(&buffer[..n]);
                        let first_line = req.lines().next().unwrap_or("");
                        let mut parts = first_line.split_whitespace();
                        let _method = parts.next().unwrap_or("");
                        let path = parts.next().unwrap_or("/");

                        let clean_path = path.trim_start_matches('/');
                        let clean_path = clean_path.split('?').next().unwrap_or(clean_path);
                        let subpath = if clean_path.is_empty() || clean_path == "settings" || clean_path == "settings.html" {
                            "settings.html"
                        } else {
                            clean_path
                        };

                        let candidate_dirs = [
                            std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("dist"))),
                            std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("../windows/dist"))),
                            std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("windows/dist"))),
                            std::env::current_dir().ok().map(|d| d.join("windows/dist")),
                            std::env::current_dir().ok().map(|d| d.join("dist")),
                            Some(std::path::PathBuf::from(r"C:\Users\sudhan\Documents\Projects\Day-main\windows\dist")),
                        ];

                        let mut file_bytes = None;
                        let mut resolved_path = None;
                        for cand in candidate_dirs.into_iter().flatten() {
                            let target = cand.join(subpath);
                            if target.exists() && target.is_file() {
                                if let Ok(data) = std::fs::read(&target) {
                                    file_bytes = Some(data);
                                    resolved_path = Some(target);
                                    break;
                                }
                            }
                        }

                        if let (Some(bytes), Some(p)) = (file_bytes, resolved_path) {
                            let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
                            let mime = match ext {
                                "html" => "text/html; charset=utf-8",
                                "js" => "application/javascript; charset=utf-8",
                                "css" => "text/css; charset=utf-8",
                                "svg" => "image/svg+xml",
                                "png" => "image/png",
                                "wav" => "audio/wav",
                                "json" => "application/json",
                                _ => "application/octet-stream",
                            };
                            let response = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
                                mime,
                                bytes.len()
                            );
                            let _ = stream.write_all(response.as_bytes());
                            let _ = stream.write_all(&bytes);
                        } else {
                            let body = b"<h1>404 Not Found</h1>";
                            let response = format!(
                                "HTTP/1.1 404 Not Found\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                                body.len()
                            );
                            let _ = stream.write_all(response.as_bytes());
                            let _ = stream.write_all(body);
                        }
                    }
                });
            }
        }
    });
}

pub fn run() {
    startup_trace("run entry");
    platform::prepare_environment();
    startup_trace("environment prepared");
    let loaded = settings::load();
    startup_trace("settings loaded");
    i18n::set_picked(&loaded.language);
    let gate = Arc::new(PollGate::new());

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // `Day --shortcut <action>`: what a desktop's own keyboard
            // settings run where we can't listen for keys ourselves (Wayland).
            match shortcuts::from_args(&argv) {
                Some(action) => shortcuts::dispatch(app, action),
                // Opening Day again (its shortcut, the Start menu) shows its window.
                None => show_hub(app, None),
            }
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![AUTOSTART_ARG])));
    // Where no global shortcut can work, the plugin isn't even started.
    if platform::global_shortcuts_blocked().is_none() {
        builder = builder.plugin(shortcuts::plugin());
    }
    startup_trace("builder configured");

    builder
        .manage(Shared {
            settings: Mutex::new(loaded.clone()),
            gate: gate.clone(),
        })
        .manage(Pending::default())
        .manage(Chat::default())
        .manage(shortcuts::Registry::default())
        .manage(recap::load())
        .invoke_handler(tauri::generate_handler![
            boot,
            read_clipboard_text,
            get_system_info,
            get_system_metrics,
            open_system_cmd,
            mail::mail_refresh,
            mail::mail_more,
            mail::mail_search,
            mail::mail_detail,
            mail::mail_open,
            mail::mail_act,
            mail::mail_triage,
            mail::mail_triage_set,
            mail::mail_journal_clear,
            mail::mail_undo,
            mail::mail_plan_show,
            mail::mail_plan_test,
            mail::mail_plan_start,
            mail::mail_plan_cancel,
            save_settings,
            set_system_languages,
            set_collapsed,
            set_island_rect,
            focus_window,
            reposition,
            fit_zoom,
            hub_shown,
            list_monitors,
            open_url,
            open_gitlab_url,
            open_gitea,
            open_gitea_url,
            open_in_vscode,
            open_session,
            launch::launch_session,
            launch::pick_folder,
            launch::drop_into_session,
            open_claude_desktop,
            open_file_in_vscode,
            quit_app,
            hooks_status,
            agent_hooks_status,
            hooks_preview,
            hooks_apply,
            agent_hooks_list,
            agent_hooks_preview,
            agent_hooks_apply,
            status_line_preview,
            status_line_apply,
            codex_plan_usage,
            approval_decision,
            approval_answer,
            approval_ack,
            approval_decline,
            agy_approvals::agy_approvals_status,
            agy_approvals::agy_approvals_set_enabled,
            log_line,
            chat_send,
            chat_models,
            claude_api_models,
            local_connect,
            local_set_key,
            chat_reset,
            ingest_file,
            secret_present,
            claude_ready,
            subscription_status,
            subscription_set,
            secret_set,
            secret_clear,
            refresh_integration,
            github_refresh,
            open_n8n,
            open_settings_window,
            set_paused,
            shortcuts_status,
            shortcuts_suspend,
            phone_link::phone_link_status,
            phone_link::phone_link_set_enabled,
            phone_link::phone_link_pairing,
            phone_link::phone_link_new_pairing,
            phone_link::phone_link_publish,
            phone_link::phone_link_publish_question,
            phone_link::phone_link_publish_prefs,
            phone_link::phone_answers_status,
            phone_link::phone_answers_set_enabled,
            phone_link::phone_diffs_status,
            phone_link::phone_diffs_set_enabled,
            phone_link::phone_link_send_diff,
            phone_link::phone_usage_status,
            phone_link::phone_usage_set_enabled,
            phone_link::phone_recap_status,
            phone_link::phone_recap_set_enabled,
            phone_link::phone_relay_status,
            phone_link::phone_relay_set,
            phone_link::phone_relay_set_access,
            phone_link::phone_link_publish_usage,
            phone_link::phone_link_publish_recap,
            phone_link::phone_services_status,
            phone_link::phone_services_set,
            phone_link::phone_link_publish_services,
            phone_link::phone_details_status,
            phone_link::phone_details_set_enabled,
            phone_link::phone_chat_status,
            phone_link::phone_chat_set_enabled,
            phone_link::phone_chat_set_models,
            recap::recap_history,
            recap::recap_prefs,
            recap::recap_set_enabled,
            recap::recap_set_hide_projects,
            recap::recap_mark_shown,
            recap::recap_clear,
            recap::recap_save_png,
            recap::recap_reveal_saved,
            desktop::desktop_Day_info,
            desktop::desktop_Day_pick_up,
            desktop::desktop_Day_carry,
            desktop::desktop_Day_carry_end,
            desktop::desktop_Day_drag_begin,
            desktop::desktop_Day_drag_move,
            desktop::desktop_Day_drag_end,
            desktop::desktop_Day_fly_out,
            desktop::desktop_Day_fly_home,
            desktop::desktop_Day_set_asleep,
            sounds::custom_sounds,
            sounds::custom_sound,
            sounds::reveal_sounds_folder,
            sounds::reload_sounds,
            spotify::spotify_refresh,
            spotify::spotify_control,
            spotify::spotify_open,
            spotify::spotify_installed,
            whatsapp::whatsapp_island,
            whatsapp::whatsapp_open,
            whatsapp::whatsapp_close,
            whatsapp::whatsapp_open_app,
            whatsapp::whatsapp_send,
            whatsapp::whatsapp_ignore,
            whatsapp::whatsapp_unignore,
            whatsapp::whatsapp_settings,
            whatsapp::whatsapp_set_options,
            whatsapp::whatsapp_save_gateway,
            whatsapp::whatsapp_test,
            whatsapp::whatsapp_install,
            flow::flow_status,
            flow::flow_set_prefs,
            flow::flow_history,
            flow::flow_delete,
            flow::flow_clear,
            flow::flow_stats,
            flow::flow_words,
            flow::flow_set_words,
            flow::flow_snippets,
            flow::flow_set_snippets,
            flow::flow_styles,
            flow::flow_set_styles,
            flow::flow_running_apps,
            flow::flow_copy,
            flow::flow_paste_again,
            flow::flow_models_download,
            flow::flow_models_remove,
            flow::pill_state,
            flow::pill_hot,
            flow::pill_hover,
            flow::pill_action,
            notes::notes_state,
            notes::notes_start,
            notes::notes_stop,
            notes::notes_rename,
            notes::notes_rename_speaker,
            notes::notes_toggle_todo,
            notes::notes_delete,
            notes::notes_summarize,
            notes::notes_retry,
            notes::notes_markdown,
            notes::notes_export,
            voice::voice_done,
            voice::voice_say_native,
            update::update_status,
            update::update_set_consent,
            update::update_check,
            update::update_shown,
            update::update_show,
            update::update_later,
            tray::tray_update_hint,
            update::update_dismiss,
            update::update_install,
            update::update_open_page,
        ])
        .setup(move |app| {
            startup_trace("setup enter");
            let handle = app.handle().clone();
            startup_trace("secrets begin");
            secrets::warm_up();
            startup_trace("secrets done");
            app.manage(phone_link::PhoneLink::new(handle.clone()));
            startup_trace("tray begin");
            tray::build(&handle)?;
            startup_trace("tray done");
            // Before the island: see create_settings_window.
            startup_trace("settings begin");
            create_settings_window(&handle);
            start_localhost_server();
            startup_trace("settings done");
            // Same rule for Day's desktop window and the dictation pill.
            startup_trace("desktop begin");
            desktop::setup(&handle);
            startup_trace("desktop done");
            startup_trace("flow begin");
            flow::setup(&handle);
            startup_trace("flow done");
            startup_trace("notes begin");
            notes::setup(&handle);
            startup_trace("notes done");

            startup_trace("island create begin");
            if let Err(err) = island::create_window(&handle) {
                startup_trace(format!("island create error: {err}"));
                log::line(format!("Island window failed: {err}"));
            } else {
                startup_trace("island create done");
            }
            if let Some(win) = island::window(&handle) {
                // Where Tauri takes the drop itself (Linux), its paths are the
                // ones ingest_file may copy (files.rs).
                win.on_window_event(|event| {
                    if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                        files::allow_dropped(paths.iter().map(|p| p.to_string_lossy().to_string()));
                    }
                });
                platform::make_non_activating(&win);
                #[cfg(windows)]
                webview_drop::install(&handle);
                startup_trace("island geometry begin");
                island::apply_geometry(&handle, &loaded.screen, None);
                let _ = win.show();
                startup_trace("island show done");
            }
            gate.collapsed.store(false, Ordering::Relaxed);
            // Nothing drawn yet, so nothing takes the mouse until the page
            // reports the island's shape.
            if !platform::CURSOR_POLL {
                island::refresh_click_through(&handle, &gate);
            }
            gate.set_active(true);
            island::spawn_cursor_poll(handle.clone(), gate.clone());

            log::line(format!("--- Day {} started ---", env!("CARGO_PKG_VERSION")));
            hooks::ensure_hook_exe(&handle);
            pipe::start(handle.clone());
            phone_link::start_if_enabled(&handle);
            integrations::start(handle.clone());
            mail::start(handle.clone());
            spotify::sync(&handle, &loaded.active_integrations);
            // WhatsApp (experimental): nothing runs unless it is turned on and its pill is active.
            whatsapp::start(&handle, &loaded.active_integrations);
            shortcuts::apply(&handle, &loaded.shortcuts);
            // New versions: nothing goes to GitHub until the user agrees (update.rs).
            update::start(handle.clone());
            if loaded.autostart {
                // Login items written before 0.5 start Day without --autostart:
                // writing it again adds it, so the window stays hidden at login.
                let _ = handle.autolaunch().enable();
            }
            let open_window = flow::get(&handle).map(|f| f.store.lock().unwrap().prefs.open_at_launch).unwrap_or(true);
            if open_window && !launched_at_login() {
                let _ = handle.emit_to(island::WINDOW_LABEL, "tray", "open");
            }
            if !launched_at_login() {
                show_hub(&handle, Some("general"));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Day")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
            }
            tauri::RunEvent::Exit => {
                // Withdraw the phone link's announcement on the local network before the process ends.
                phone_link::stop_on_exit(app);
                notes::shutdown(app);
                // GOWA started by Day stops with it; the conversations were only in memory.
                whatsapp::shutdown();
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::{diff_file, is_forge_instance_url};

    #[test]
    fn forge_links_stay_on_the_configured_instance() {
        let instance = reqwest::Url::parse("https://git.example.com/team/").unwrap();
        assert!(is_forge_instance_url(
            &reqwest::Url::parse("https://git.example.com/team/me/project").unwrap(),
            &instance,
        ));
        assert!(!is_forge_instance_url(
            &reqwest::Url::parse("https://git.example.com/other/project").unwrap(),
            &instance,
        ));
        assert!(!is_forge_instance_url(
            &reqwest::Url::parse("https://evil.example/team/me/project").unwrap(),
            &instance,
        ));
    }

    #[test]
    fn only_an_existing_file_by_its_full_path_reaches_the_editor() {
        let dir = std::env::temp_dir().join(format!("Day-diff-file-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("edited.ts");
        std::fs::write(&file, "x").unwrap();

        assert!(diff_file(&file.to_string_lossy()).is_some());
        // A folder, a missing file, a relative path or an option never pass.
        assert!(diff_file(&dir.to_string_lossy()).is_none());
        assert!(diff_file(&dir.join("missing.ts").to_string_lossy()).is_none());
        assert!(diff_file("edited.ts").is_none());
        assert!(diff_file("--help").is_none());
        assert!(diff_file("").is_none());

        let _ = std::fs::remove_dir_all(&dir);
    }
}
