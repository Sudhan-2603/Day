// System Accesses & Dynamic Island Integrations:
// 1. Clipboard Copy-Paste Detection & Action Pill
// 2. Background Audio Tracker (Play/Pause, Forward, Reverse, Scrubber, Equalizer Waveform)
// 3. System Notification Expansion (Full details, rich cards)
// 4. Device Connection Animations (Wi-Fi & Bluetooth animated radar pulses + success badge)

import { Bridge, type RealSystemInfo } from "../core/bridge";
import { Sound } from "../core/sound";
import { Spotify } from "../core/spotify";
import { State } from "../core/state";
import { t } from "../i18n/i18n";

export interface ClipboardItem {
  text: string;
  timestamp: number;
  type: "text" | "link" | "code";
}

export interface AudioTrack {
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  position: number; // in seconds
  playing: boolean;
  artwork?: string;
  volume: number; // 0..100
}

export interface SystemNotification {
  id: string;
  app: string;
  title: string;
  body: string;
  time: string;
  icon?: string;
  expanded?: boolean;
}

export interface DeviceAlert {
  type: "wifi" | "bluetooth";
  name: string;
  status: "connected" | "disconnected";
  timestamp: number;
}

class SystemAccessService {
  private lastCopiedText = "";
  public clipboardCheckTimer: number | null = null;
  public audioTimer: number | null = null;
  public realSystemInfo: RealSystemInfo | null = null;

  // Active track state (synced with Windows System Media Controls)
  public audioTrack: AudioTrack = {
    title: "No media playing",
    artist: "System Audio Idle",
    album: "",
    duration: 0,
    position: 0,
    playing: false,
    volume: 75,
  };

  public activeClipboard: ClipboardItem | null = null;
  public activeNotification: SystemNotification | null = null;
  public activeDeviceAlert: DeviceAlert | null = null;

  // Listeners
  private clipboardListeners: ((item: ClipboardItem | null) => void)[] = [];
  private audioListeners: ((track: AudioTrack) => void)[] = [];
  private notificationListeners: ((notification: SystemNotification | null) => void)[] = [];
  private deviceListeners: ((alert: DeviceAlert | null) => void)[] = [];

  constructor() {
    this.initAudioSync();
    this.initClipboardWatcher();
    this.initNetworkWatcher();
    void this.refreshRealSystemInfo();
  }

  // ── Clipboard Monitoring ──────────────────────────────────────────────────

  public onClipboardChange(listener: (item: ClipboardItem | null) => void): () => void {
    this.clipboardListeners.push(listener);
    return () => {
      this.clipboardListeners = this.clipboardListeners.filter((l) => l !== listener);
    };
  }

  private notifyClipboard(item: ClipboardItem | null) {
    this.activeClipboard = item;
    for (const l of this.clipboardListeners) l(item);
  }

  public dismissClipboard() {
    this.notifyClipboard(null);
  }

  public recordCopy(text: string) {
    if (!State.systemAccessModules.clipboard) return;
    const trimmed = text.trim();
    if (!trimmed || trimmed === this.lastCopiedText) return;
    this.lastCopiedText = trimmed;
    const isLink = /^https?:\/\//i.test(trimmed);
    const isCode = trimmed.includes("\n") || /[{}();=>]/.test(trimmed);
    const item: ClipboardItem = {
      text: trimmed,
      timestamp: Date.now(),
      type: isLink ? "link" : isCode ? "code" : "text",
    };
    Sound.play("tap");
    this.notifyClipboard(item);

    // Auto-dismiss toast after 6 seconds unless user interacted
    window.setTimeout(() => {
      if (this.activeClipboard === item) {
        this.notifyClipboard(null);
      }
    }, 6000);
  }

  private initClipboardWatcher() {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;

    // Listen to window copy/cut events
    window.addEventListener("copy", () => {
      try {
        const text = window.getSelection()?.toString();
        if (text) this.recordCopy(text);
      } catch {}
    });

    // Check clipboard on window focus
    window.addEventListener("focus", () => {
      void this.checkSystemClipboard();
    });

    // Periodic check (every 1.5s when active)
    this.clipboardCheckTimer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hasFocus && document.hasFocus()) {
        void this.checkSystemClipboard();
      }
    }, 1500);
  }

  private async checkSystemClipboard() {
    try {
      // 1. Native desktop OS clipboard via Tauri command (no browser permission prompt)
      const nativeText = await Bridge.readClipboardText();
      if (typeof nativeText === "string") {
        if (nativeText && nativeText.trim() && nativeText.trim() !== this.lastCopiedText) {
          this.recordCopy(nativeText);
        }
        return;
      }
    } catch {
      // Ignore
    }

    // 2. Fallback only when not running inside Tauri (e.g. browser dev)
    try {
      const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
      if (!isTauri && typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim() && text.trim() !== this.lastCopiedText) {
          this.recordCopy(text);
        }
      }
    } catch {
      // Permission might be denied in some webview contexts, which is normal
    }
  }

  // ── Background Audio Tracker ──────────────────────────────────────────────

  public onAudioChange(listener: (track: AudioTrack) => void): () => void {
    this.audioListeners.push(listener);
    listener(this.audioTrack);
    return () => {
      this.audioListeners = this.audioListeners.filter((l) => l !== listener);
    };
  }

  private notifyAudio() {
    for (const l of this.audioListeners) l(this.audioTrack);
  }

  public togglePlayPause() {
    if (Spotify.state.running && Spotify.state.track) {
      void Bridge.spotifyControl("playPause");
      this.audioTrack.playing = !Spotify.state.playing;
    } else {
      this.audioTrack.playing = !this.audioTrack.playing;
      if (this.audioTrack.playing) {
        Sound.play("tap");
        this.startAudioProgress();
      } else {
        this.stopAudioProgress();
      }
    }
    this.notifyAudio();
  }

  public forward() {
    if (Spotify.state.running && Spotify.state.track) {
      void Bridge.spotifyControl("next");
    } else {
      Sound.play("pop");
      this.audioTrack.position = Math.min(this.audioTrack.duration, this.audioTrack.position + 15);
      this.notifyAudio();
    }
  }

  public reverse() {
    if (Spotify.state.running && Spotify.state.track) {
      void Bridge.spotifyControl("previous");
    } else {
      Sound.play("pop");
      this.audioTrack.position = Math.max(0, this.audioTrack.position - 15);
      this.notifyAudio();
    }
  }

  public seek(fraction: number) {
    const target = Math.min(Math.max(0, fraction * this.audioTrack.duration), this.audioTrack.duration);
    this.audioTrack.position = target;
    if (Spotify.state.running && Spotify.state.track) {
      void Bridge.spotifyControl("seek", target);
    }
    this.notifyAudio();
  }

  private startAudioProgress() {
    if (this.audioTimer != null) return;
    this.audioTimer = window.setInterval(() => {
      if (!this.audioTrack.playing) {
        this.stopAudioProgress();
        return;
      }
      this.audioTrack.position += 1;
      if (this.audioTrack.position >= this.audioTrack.duration) {
        this.audioTrack.position = 0;
      }
      this.notifyAudio();
    }, 1000);
  }

  private stopAudioProgress() {
    if (this.audioTimer != null) {
      window.clearInterval(this.audioTimer);
      this.audioTimer = null;
    }
  }

  private initAudioSync() {
    // Sync with Spotify / Windows media when active
    State.subscribe(() => {
      const s = Spotify.state;
      if (s.running && s.track) {
        this.audioTrack = {
          title: s.track.title || "Unknown Track",
          artist: s.track.artist || "Unknown Artist",
          album: s.track.album || "",
          duration: s.track.duration || 200,
          position: s.position || 0,
          playing: s.playing,
          volume: s.volume ?? 75,
        };
        this.notifyAudio();
      }
    });
  }

  // ── System Notification Center ────────────────────────────────────────────

  public onNotificationChange(listener: (notification: SystemNotification | null) => void): () => void {
    this.notificationListeners.push(listener);
    return () => {
      this.notificationListeners = this.notificationListeners.filter((l) => l !== listener);
    };
  }

  private notifyNotification(n: SystemNotification | null) {
    this.activeNotification = n;
    for (const l of this.notificationListeners) l(n);
  }

  public postNotification(n: Partial<SystemNotification>) {
    if (!State.systemAccessModules.notifications) return;
    const notification: SystemNotification = {
      id: n.id || `notif-${Date.now()}`,
      app: n.app || t("System"),
      title: n.title || "System Notification",
      body: n.body || "New event occurred on your workstation.",
      time: n.time || t("now"),
      icon: n.icon || "bell",
      expanded: true,
    };
    Sound.play("pop");
    this.notifyNotification(notification);

    // Expand Island to show all details if collapsed
    if (State.mode !== "expanded") {
      State.isPinned = true;
    }

    // Auto-dismiss after 8 seconds
    window.setTimeout(() => {
      if (this.activeNotification === notification) {
        this.notifyNotification(null);
      }
    }, 8000);
  }

  public dismissNotification() {
    this.notifyNotification(null);
  }

  // ── Device Connection Alerts (Wi-Fi & Bluetooth) ──────────────────────────

  public onDeviceChange(listener: (alert: DeviceAlert | null) => void): () => void {
    this.deviceListeners.push(listener);
    return () => {
      this.deviceListeners = this.deviceListeners.filter((l) => l !== listener);
    };
  }

  private notifyDevice(alert: DeviceAlert | null) {
    this.activeDeviceAlert = alert;
    for (const l of this.deviceListeners) l(alert);
  }

  public triggerDeviceAlert(type: "wifi" | "bluetooth", name: string, status: "connected" | "disconnected" = "connected") {
    if (!State.systemAccessModules.deviceAlerts) return;
    const alert: DeviceAlert = {
      type,
      name,
      status,
      timestamp: Date.now(),
    };
    Sound.play("happy");
    this.notifyDevice(alert);

    // Dynamic Island connection pill stays for 4.5 seconds then smoothly folds back
    window.setTimeout(() => {
      if (this.activeDeviceAlert === alert) {
        this.notifyDevice(null);
      }
    }, 4500);
  }

  public async refreshRealSystemInfo() {
    try {
      const info = await Bridge.getSystemInfo();
      if (info) {
        this.realSystemInfo = info;
        State.isOffline = !info.online;
        State.notify();
      }
    } catch {}
  }

  private initNetworkWatcher() {
    // Sync initial state
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      State.isOffline = !navigator.onLine;
    }

    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;

    window.addEventListener("online", () => {
      State.isOffline = false;
      State.notify();
      void this.refreshRealSystemInfo().then(() => {
        const netName = this.realSystemInfo?.network_name || "Wi-Fi";
        this.triggerDeviceAlert("wifi", `${netName} Connected`, "connected");
      });
    });
    window.addEventListener("offline", () => {
      State.isOffline = true;
      State.notify();
      const netName = this.realSystemInfo?.network_name || "Wi-Fi";
      this.triggerDeviceAlert("wifi", `${netName} Disconnected`, "disconnected");
    });

    // Periodic connectivity & real system check (every 10s)
    window.setInterval(() => {
      void this.refreshRealSystemInfo();
    }, 10_000);
  }
}

export const SystemAccess = new SystemAccessService();
