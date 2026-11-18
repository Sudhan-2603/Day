// The island's "New Claude Code session" card — port of LaunchView in
// SessionLauncher.swift: Day on the left, the project, what Claude should do.
// Rust opens the terminal (src-tauri/src/launch.rs); the session then shows in
// the island through the hooks like any other.
//
// The Mac's project menu is a native menu; the island is a fixed-height
// webview, so here the projects open in the card itself, in place of the text
// field, the way the chat's model picker opens in the chat.

import { h, svg, clear } from "./dom";
import { ICONS } from "./icons";
import { Bridge } from "../core/bridge";
import { Launch, projectName } from "../core/launch";
import { Sound } from "../core/sound";
import { State } from "../core/state";
import { washRGBA } from "../core/layout";
import type { ViewActions, ViewHost } from "./views";
import { t } from "../i18n/i18n";

export function buildLaunch(actions: ViewActions): ViewHost {
  const title = h("div", { class: "launch-title", text: "Add Files & Workspace Structure" });
  const projectLabel = h("span", { class: "launch-project-name" });
  const projectBtn = h(
    "button",
    { class: "launch-project" },
    svg(ICONS.folder, 10),
    projectLabel,
    svg(ICONS.chevronDown, 8, { stroke: 2.4 }),
  );

  // File structure tree representation
  const fileItems = [
    { name: "src/ (Frontend TypeScript & Island UI)", isDir: true },
    { name: "src-tauri/ (Rust Core & Offline Telemetry)", isDir: true },
    { name: "release_bin/ (Standalone Day.exe)", isDir: true },
    { name: "dist/ (Offline embedded web assets)", isDir: true },
    { name: "package.json", isDir: false },
    { name: "Cargo.toml", isDir: false },
    { name: "README.md", isDir: false },
  ];

  const treeEl = h("div", { class: "add-files-tree" });
  fileItems.forEach((item) => {
    const row = h(
      "div",
      { class: "add-files-item" },
      svg(item.isDir ? ICONS.folder : ICONS.doc, 12, { stroke: 1.6 }),
      h("span", { text: item.name }),
    );
    row.addEventListener("click", () => {
      input.value = `Inspect and process ${item.name}`;
      input.focus();
    });
    treeEl.append(row);
  });

  const input = h("input", {
    type: "text",
    class: "chat-input",
    placeholder: "Ask Day about selected files or attach...",
    spellcheck: "false",
  }) as HTMLInputElement;

  const browseBtn = h("button", {
    class: "link-btn",
    style: "font-size:11px;color:#a5b4fc;margin-right:6px",
    text: "Browse Folder 📁",
    onclick: () => void chooseFolder(),
  });

  const cmdRunBtn = h("button", {
    class: "link-btn",
    style: "font-size:11px;color:#86efac",
    text: "Open CMD ⚡",
    onclick: () => void Bridge.openSystemCmd(),
  });

  const send = h("button", { class: "send-btn launch-send", title: "Submit" }, svg(ICONS.arrowUp, 11)) as HTMLButtonElement;
  const bar = h("div", { class: "chat-bar launch-bar" }, input, send);
  const hint = h("div", { class: "launch-hint" });
  const menu = h("div", { class: "launch-menu picker-list" });
  const actionsRow = h("div", { style: "display:flex;align-items:center;padding:2px 4px 6px" }, browseBtn, cmdRunBtn);

  const body = h(
    "div",
    { class: "stack launch-body" },
    h("div", { class: "launch-head" }, title, projectBtn),
    actionsRow,
    treeEl,
    bar,
    hint,
    menu,
  );
  const card = h("div", { class: "card wash launch-card" }, body);
  card.style.setProperty("--wash", washRGBA("indigo"));
  const el = h("div", { class: "view" }, card);

  let failed = false;
  let menuOpen = false;
  let busy = false;

  function setMenu(open: boolean) {
    menuOpen = open;
    body.classList.toggle("choosing", open);
    if (open) drawMenu();
    else window.setTimeout(() => input.focus(), 0);
    sync();
  }

  function drawMenu() {
    clear(menu);
    for (const path of Launch.projects) {
      const on = path === Launch.folder;
      const row = h(
        "button",
        { class: on ? "picker-model on" : "picker-model", style: "--accent:#818CF8", title: path },
        h("span", { class: "picker-model-name", text: projectName(path) }),
        on ? svg(ICONS.check, 11, { stroke: 2.2 }) : null,
      );
      row.addEventListener("click", () => {
        Launch.choose(path);
        Sound.play("blip");
        setMenu(false);
      });
      menu.append(row);
    }
    if (Launch.projects.length > 0) menu.append(h("div", { class: "picker-rule" }));
    const other = h("button", { class: "picker-model" }, h("span", { class: "picker-model-name", text: t("Choose a folder…") }));
    other.addEventListener("click", () => void chooseFolder());
    menu.append(other);
  }

  /** Another folder, in the system's picker. The island stays open meanwhile. */
  async function chooseFolder() {
    if (menuOpen) setMenu(false);
    actions.holdOpen(true);
    const picked = await Bridge.pickFolder(Launch.folder);
    actions.holdOpen(input.value.trim().length > 0);
    if (picked) Launch.choose(picked);
    failed = false;
    sync();
    if (State.view === "launch") {
      actions.keyboard(true);
      window.setTimeout(() => input.focus(), 80);
    }
  }

  async function start() {
    if (busy) return;
    const folder = Launch.folder;
    if (!folder) {
      void chooseFolder();
      return;
    }
    busy = true;
    const ok = await Bridge.launchSession(folder, input.value);
    busy = false;
    if (!ok) {
      failed = true;
      Sound.play("error");
      sync();
      return;
    }
    input.value = "";
    failed = false;
    actions.holdOpen(false);
    actions.launched();
  }

  projectBtn.addEventListener("click", () => {
    actions.blip();
    setMenu(!menuOpen);
  });
  send.addEventListener("click", () => void start());
  input.addEventListener("input", () => actions.holdOpen(input.value.trim().length > 0));
  input.addEventListener("keydown", (e) => {
    const key = (e as KeyboardEvent).key;
    if (key === "Enter") {
      e.preventDefault();
      void start();
    }
    e.stopPropagation(); // Escape closes the island, not the card
  });

  function sync() {
    const folder = Launch.folder;
    projectLabel.textContent = folder ? projectName(folder) : t("Choose a project");
    projectBtn.title = folder ?? "";
    projectBtn.classList.toggle("open", menuOpen);
    send.disabled = folder == null;
    hint.textContent = failed ? t("Couldn't open the terminal in this folder.") : t("Opens your terminal in the project, with Claude Code and your words.");
    hint.classList.toggle("is-failed", failed);
  }

  return {
    el,
    sync,
    // The island calls it each time the card comes up: a fresh hint, the
    // field and not the menu.
    focus() {
      failed = false;
      if (menuOpen) {
        menuOpen = false;
        body.classList.remove("choosing");
      }
      sync();
      input.focus();
    },
  };
}
