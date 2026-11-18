// Dynamic Island Audio Tracker Card & Player View
// Inspired by Apple's Dynamic Island Now Playing treatment with:
// - Album art thumbnail with subtle ambient glow
// - Track title & artist
// - Animated sound equalizer bars that bounce while playing
// - Audio Tracker / scrubber with elapsed time and remaining time
// - Reverse, Play/Pause, Forward buttons

import { h, svg, clear } from "./dom";
import { ICONS } from "./icons";
import { SystemAccess, type AudioTrack } from "../island/system-access";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export interface AudioTrackerViewHost {
  el: HTMLElement;
  sync(track: AudioTrack): void;
}

export function buildAudioTrackerCard(): AudioTrackerViewHost {
  // 1. Artwork container
  const art = h("div", { class: "audio-art" }, svg(ICONS.musicNote, 22));

  // 2. Track & Artist text
  const titleEl = h("div", { class: "audio-title", text: "Glow" });
  const artistEl = h("div", { class: "audio-artist", text: "Echo" });
  const metaBox = h("div", { class: "audio-meta" }, titleEl, artistEl);

  // 3. Sound equalizer bars (animated waveform)
  const bar1 = h("i", { class: "eq-bar bar-1" });
  const bar2 = h("i", { class: "eq-bar bar-2" });
  const bar3 = h("i", { class: "eq-bar bar-3" });
  const bar4 = h("i", { class: "eq-bar bar-4" });
  const bar5 = h("i", { class: "eq-bar bar-5" });
  const eqWave = h("div", { class: "audio-waveform" }, bar1, bar2, bar3, bar4, bar5);

  const topRow = h("div", { class: "audio-top-row" }, art, metaBox, eqWave);

  // 4. Audio tracker scrubber line with times
  const elapsedEl = h("span", { class: "audio-time elapsed", text: "1:20" });
  const remainingEl = h("span", { class: "audio-time remaining", text: "-2:15" });

  const progressFill = h("div", { class: "audio-tracker-fill" });
  const progressKnob = h("div", { class: "audio-tracker-knob" });
  const progressBar = h("div", { class: "audio-tracker-bar" }, progressFill, progressKnob);

  let isDragging = false;
  progressBar.addEventListener("pointerdown", (e) => {
    isDragging = true;
    try {
      progressBar.setPointerCapture(e.pointerId);
    } catch {}
    handleSeek(e);
  });
  progressBar.addEventListener("pointermove", (e) => {
    if (isDragging) handleSeek(e);
  });
  const stopDrag = () => {
    isDragging = false;
  };
  progressBar.addEventListener("pointerup", stopDrag);
  progressBar.addEventListener("pointercancel", stopDrag);

  function handleSeek(e: PointerEvent) {
    const rect = progressBar.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    SystemAccess.seek(frac);
  }

  const trackerRow = h("div", { class: "audio-tracker-row" }, elapsedEl, progressBar, remainingEl);

  // 5. Control buttons (Reverse, Play/Pause, Forward)
  const reverseBtn = h(
    "button",
    { class: "audio-ctrl-btn rev-btn", title: "Reverse 15s / Previous", onclick: () => SystemAccess.reverse() },
    svg(ICONS.backward, 16),
  );

  const playIcon = svg(ICONS.play, 18);
  const playPauseBtn = h(
    "button",
    { class: "audio-ctrl-btn play-pause-btn", title: "Play / Pause", onclick: () => SystemAccess.togglePlayPause() },
    playIcon,
  );

  const forwardBtn = h(
    "button",
    { class: "audio-ctrl-btn fwd-btn", title: "Forward 15s / Next", onclick: () => SystemAccess.forward() },
    svg(ICONS.forward, 16),
  );

  const speakerBtn = h(
    "button",
    { class: "audio-ctrl-btn speaker-btn", title: "Audio Output", onclick: () => {} },
    svg(ICONS.speakerOn, 14),
  );

  const controlsRow = h("div", { class: "audio-controls-row" }, reverseBtn, playPauseBtn, forwardBtn, speakerBtn);

  const el = h("div", { class: "audio-tracker-card" }, topRow, trackerRow, controlsRow);

  const sync = (track: AudioTrack) => {
    titleEl.textContent = track.title || "Glow";
    artistEl.textContent = track.artist || "Echo";

    const pos = Math.min(track.position, track.duration);
    const dur = Math.max(track.duration, 1);
    const pct = `${(pos / dur) * 100}%`;

    progressFill.style.width = pct;
    progressKnob.style.left = `clamp(0px, calc(${pct} - 5px), calc(100% - 10px))`;

    elapsedEl.textContent = formatDuration(pos);
    remainingEl.textContent = `-${formatDuration(Math.max(0, dur - pos))}`;

    // Play/Pause icon state
    clear(playPauseBtn);
    playPauseBtn.append(svg(track.playing ? ICONS.pause : ICONS.play, 18));
    playPauseBtn.classList.toggle("is-playing", track.playing);

    // Waveform active state
    eqWave.classList.toggle("playing", track.playing);
  };

  sync(SystemAccess.audioTrack);
  SystemAccess.onAudioChange((t) => sync(t));

  return { el, sync };
}

/** Builds the compact pill audio waveform & title for the compact island */
export function buildCompactAudioPill(): HTMLElement {
  const noteIcon = h("span", { class: "compact-audio-icon" }, svg(ICONS.musicNote, 12));
  const wave1 = h("i", { class: "mini-wave wave-1" });
  const wave2 = h("i", { class: "mini-wave wave-2" });
  const wave3 = h("i", { class: "mini-wave wave-3" });
  const waveEl = h("div", { class: "compact-audio-wave" }, wave1, wave2, wave3);

  const titleEl = h("span", { class: "compact-audio-title", text: "Glow" });

  const pill = h(
    "div",
    {
      class: "compact-audio-pill",
      title: "Audio Playing — Click to expand",
      onclick: (e) => {
        e.stopPropagation();
        SystemAccess.togglePlayPause();
      },
    },
    noteIcon,
    titleEl,
    waveEl,
  );

  SystemAccess.onAudioChange((track) => {
    pill.classList.toggle("active", track.playing);
    titleEl.textContent = track.title;
    waveEl.classList.toggle("playing", track.playing);
  });

  return pill;
}
