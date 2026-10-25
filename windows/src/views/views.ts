// Island views — DOM ports of IslandViewContent.swift. Paddings, font sizes,
// colours and wording are copied from the Swift views so both platforms read
// identically.

import { h, svg, clear, dot } from "./dom";
import { ICONS } from "./icons";
import { Ticker } from "./ticker";
import { State, type AgentTask } from "../core/state";
import { washRGBA, type IslandViewName, type Wash } from "../core/layout";
import { createMiniBot, pruneMiniBots } from "../day/minibots";
import { buildPrompt } from "./chat";
import { buildChoose, buildUpload, buildUploading } from "./upload";
import { renderIntegrationCard, type IntegrationCardHooks } from "./integrations";
import { highlightRow, listRows, openRow } from "./github";
import { pillDefinition, sessionSubtitle } from "../core/pills";
import {
  PlanCard, buildPlanPill, claudePillVisible, codexPillVisible, planCardOpen, refreshCodexPlanUsage,
} from "./usage";
import { buildDiffCard } from "./diff";
import { lastTextStep } from "../core/diff";
import { Bridge } from "../core/bridge";
import { buildRecap } from "./recap";
import { buildWardrobe } from "./wardrobe";
import { buildSpotifyCard, buildSpotifyPill, type SpotifyPillHost } from "./spotify";
import { SPOTIFY_ID } from "../core/spotify";
import {
  type Outfit, type OutfitSelection, OUTFIT_SELECTIONS, OUTFIT_KEYS, seasonalOutfit, parseOutfit,
} from "../day/wardrobe";
import { drawWardrobeIcon } from "../day/outfits";
import { language, t, tl, type Msg } from "../i18n/i18n";
import type { ViewCommand } from "../island/shortcuts";

export interface ViewActions {
  setView(v: IslandViewName): void;
  /** "Cancel" on a dropped file: forgets it and goes back home. */
  cancelDrop(): void;
  collapse(): void;
  closeToLine?(): void;
  startMoveMode?(): void;
  /** Folds a waiting card to the compact island without answering it. */
  foldApproval(): void;
  setFocus(id: string): void;
  openTerminal(): void;
  /** The ↗ button: opens whatever the focused pill points at. */
  openTarget(): void;
  openUrl(url: string): void;
  decide(d: "allow" | "deny"): void;
  /** Answers the question Claude Code asked: question text → chosen label. */
  answer(answers: Record<string, string | string[]>): void;
  /** Hands the pending request back to the terminal. */
  answerInTerminal(): void;
  toggleSound(): void;
  setVolume(v: number): void;
  setAutoClose(seconds: number): void;
  openSettingsWindow(): void;
  toggleFullSettings?(open?: boolean): void;
  blip(): void;
  /** Wardrobe click: keeps the outfit ("auto" and "none" included). */
  chooseOutfit(selection: OutfitSelection): void;
  /** Wardrobe hover: shows an outfit on Day without keeping it; null ends it. */
  previewOutfit(outfit: Outfit | null): void;
}

export interface ViewHost {
  el: HTMLElement;
  sync(): void;
  /** Called when the view becomes active, for views with a text field. */
  focus?(): void;
  /** Called every frame while the view is on screen. True = needs another frame. */
  tick?(nowMs: number): boolean | void;
  /** Ctrl+O / Ctrl+E while the view is on screen (island/shortcuts.ts). */
  command?(command: ViewCommand): void;
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

function card(wash: Wash, ...children: (Node | string)[]): HTMLElement {
  const el = h("div", { class: wash ? "card wash" : "card" }, ...children);
  if (wash) el.style.setProperty("--wash", washRGBA(wash));
  return el;
}

function btn(
  label: string | Msg,
  kind: "primary" | "secondary",
  onClick: () => void,
  kbd?: string,
): HTMLElement {
  return h(
    "button",
    { class: `btn ${kind}`, onclick: onClick },
    h("span", { text: label }),
    kbd ? h("span", { class: "kbd", text: kbd }) : null,
  );
}

/** AgentWho — coloured dot + task name + grey label. */
function agentWho(task: AgentTask | null, label: string): HTMLElement {
  const row = h("div", { class: "who-row" });
  if (task) {
    row.append(dot(task.color, 8), h("span", { class: "n", text: task.name }));
  }
  row.append(h("span", { text: label }));
  return row;
}

function stack(padLeft: number, padRight: number, ...children: Node[]): HTMLElement {
  const el = h("div", { class: "stack" }, ...children);
  el.style.padding = `4px ${padRight}px 4px ${padLeft}px`;
  return el;
}

// ── Header ────────────────────────────────────────────────────────────────────

export function buildHeader(actions: ViewActions): ViewHost {
  const tabHome = h("button", { class: "tab", title: tl("Overview"), onclick: () => go("overview") }, svg(ICONS.house, 13));
  const tabChat = h("button", { class: "tab", title: tl("Ask"), onclick: () => go("prompt") }, svg(ICONS.bubble, 13));
  const tabDrop = h("button", { class: "tab", title: tl("Drop"), onclick: () => go("upload") }, svg(ICONS.plus, 13));

  const undoBtn = h(
    "button",
    {
      class: "hdr-btn undo-btn",
      title: "Undo",
      onclick: () => {
        actions.blip();
        if (State.pendingApproval) {
          actions.decide("deny");
        } else if (State.view === "prompt" && State.chatHistory.length > 0) {
          State.chatHistory.pop();
          State.notify();
        }
      },
    },
    svg(ICONS.undo, 13),
  );

  const prevBtn = h(
    "button",
    {
      class: "hdr-btn prev-btn",
      title: tl("Previous"),
      onclick: () => {
        actions.blip();
        if (State.view !== "overview" && State.view !== "empty") {
          actions.setView("overview");
        } else {
          const s = State.settings;
          const declared = [s.mainPill, ...(s.activeIntegrations || [])];
          if (declared.length > 1) {
            const curIdx = State.focusId ? declared.indexOf(State.focusId) : -1;
            const prevIdx = (curIdx - 1 + declared.length) % declared.length;
            actions.setFocus(declared[prevIdx]);
          }
        }
      },
    },
    svg(ICONS.chevronLeft, 13),
  );

  let moveTimer: number | null = null;
  const cancelMove = () => {
    if (moveTimer != null) {
      clearTimeout(moveTimer);
      moveTimer = null;
    }
  };

  const moveBtn = h(
    "button",
    {
      class: "hdr-btn move-btn",
      title: "Long press to minimize & move",
      onmousedown: (e: Event) => {
        e.preventDefault();
        cancelMove();
        moveTimer = window.setTimeout(() => {
          moveTimer = null;
          actions.blip();
          if (actions.startMoveMode) {
            actions.startMoveMode();
          } else {
            actions.collapse();
            document.getElementById("island")?.classList.add("is-moving-shake");
            void Bridge.startDragging();
          }
        }, 200);
      },
      onmousemove: () => {
        if (moveTimer != null) {
          cancelMove();
          actions.blip();
          if (actions.startMoveMode) actions.startMoveMode();
        }
      },
      onmouseup: cancelMove,
      onmouseleave: cancelMove,
    },
    svg(ICONS.move, 12),
  );

  const minBtn = h(
    "button",
    {
      class: "hdr-btn min-btn",
      title: "Minimize",
      onclick: () => {
        actions.blip();
        actions.collapse();
      },
    },
    svg(ICONS.minimize, 13),
  );

  const closeBtn = h(
    "button",
    {
      class: "hdr-btn close-btn",
      title: tl("Close"),
      onclick: (e: Event) => {
        e.stopPropagation();
        actions.blip();
        if (actions.closeToLine) {
          actions.closeToLine();
        } else {
          actions.collapse();
        }
      },
    },
    svg(ICONS.xmark, 11),
  );

  const gearBtn = h("button", {
    title: tl("Settings"),
    onclick: () => go("settings"),
  }, svg(ICONS.gear, 14));
  const soundBtn = h("button", { title: tl("Mute"), onclick: () => actions.toggleSound() }, svg(ICONS.speakerOn, 14));
  // Plan usage pills (off by default): before the gear, Claude first, as on the Mac.
  const claudePill = buildPlanPill(false);
  const codexPill = buildPlanPill(true);
  const planPills = h("div", { class: "plan-pills" }, claudePill.el, codexPill.el);
  let codexShown = false;

  function go(v: IslandViewName) {
    actions.blip();
    actions.setView(v);
  }

  const el = h(
    "div",
    { id: "header" },
    h("div", { class: "tabs" }, tabHome, tabChat, tabDrop),
    h("div", { class: "header-actions" }, planPills, moveBtn, undoBtn, prevBtn, minBtn, closeBtn, soundBtn, gearBtn),
  );
  const headerActions = el.lastElementChild as HTMLElement;

  return {
    el,
    sync() {
      const v = State.view;
      tabHome.classList.toggle("on", v === "overview" || v === "empty");
      tabChat.classList.toggle("on", v === "prompt");
      tabDrop.classList.toggle("on", v === "upload");
      gearBtn.classList.toggle("on", v === "settings");
      clear(gearBtn);
      gearBtn.append(svg(v === "settings" ? ICONS.gearFill : ICONS.gear, 14));
      clear(soundBtn);
      soundBtn.append(svg(State.settings.soundEnabled ? ICONS.speakerOn : ICONS.speakerOff, 14));
      const s = State.settings;
      moveBtn.style.display = s.showMoveBtn !== false ? "" : "none";
      undoBtn.style.display = s.showUndoBtn !== false ? "" : "none";
      prevBtn.style.display = s.showPreviousBtn !== false ? "" : "none";
      minBtn.style.display = s.showMinimizeBtn !== false ? "" : "none";
      closeBtn.style.display = s.showCloseBtn !== false ? "" : "none";
      syncPlanPills();
      el.style.opacity = v === "confused" ? "0" : "1";
    },
  };

  function syncPlanPills() {
    const claudeOn = claudePillVisible();
    const codexOn = codexPillVisible();
    claudePill.el.style.display = claudeOn ? "" : "none";
    codexPill.el.style.display = codexOn ? "" : "none";
    planPills.classList.toggle("on", claudeOn || codexOn);
    // Both pills: the right side tightens so it still clears the screen edge.
    headerActions.classList.toggle("both-plans", claudeOn && codexOn);
    if (claudeOn) claudePill.sync();
    if (codexOn) codexPill.sync();
    // Codex is asked when its pill comes into view (stale answers only).
    const shown = codexOn && State.mode === "expanded";
    if (shown && !codexShown) refreshCodexPlanUsage();
    codexShown = shown;
  }
}

// ── Overview ──────────────────────────────────────────────────────────────────

function buildOverview(actions: ViewActions): ViewHost {
  /** The diff open in the left card (a FileDiff id), as activeDiffId on macOS. */
  let activeDiffId: number | null = null;
  const closeDiff = () => {
    if (activeDiffId == null) return;
    activeDiffId = null;
    State.notify();
  };
  const ticker = new Ticker((diffId) => {
    actions.blip();
    activeDiffId = diffId;
    State.notify();
  });
  const who = h("div", { class: "who" });
  const tickerBody = h("div", { class: "card-body" }, who, ticker.el);
  const leftBody = h("div", { class: "left-body" });
  const jump = h(
    "button",
    { class: "icon-btn jump", title: tl("Open"), onclick: () => actions.openTarget() },
    svg(ICONS.arrowUpRight, 8),
  );
  const left = card(null, leftBody, jump);
  const pills = h("div", { class: "pills" });
  // Opened from a plan pill in the header: stands in for the left card.
  const plan = new PlanCard();
  let planTimer: number | null = null;
  // Spotify's card and pill are kept and updated in place: the progress bar
  // runs on, and a slider being dragged must not be rebuilt under the pointer.
  const spotifyCard = buildSpotifyCard();
  let spotifyPill: SpotifyPillHost | null = null;

  const el = h("div", { class: "view overview" },
    h("div", { class: "left" }, left),
  );

  let pillIds = "";
  let detailOpen = false;
  let lastFocus: string | null = null;
  let mode: "ticker" | "card" | "plan" | "diff" | "spotify" | null = null;
  let cardKey = "";
  /** The list row highlighted at the last sync, to scroll only when it moves. */
  let shownSelection: number | null = null;

  // Leaving the overview or folding the island closes the diff, as on macOS.
  State.subscribe(() => {
    if (activeDiffId != null && (State.view !== "overview" || State.mode !== "expanded")) {
      activeDiffId = null;
    }
  });
  // Escape steps back out of the diff before it closes the island.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || activeDiffId == null || State.view !== "overview") return;
      e.stopImmediatePropagation();
      closeDiff();
    },
    true,
  );

  const hooks: IntegrationCardHooks = {
    get detailOpen() {
      return detailOpen;
    },
    openDetail() {
      detailOpen = true;
      cardKey = "";
      State.notify();
    },
    closeDetail() {
      detailOpen = false;
      cardKey = "";
      State.notify();
    },
    openSettings: () => actions.openSettingsWindow(),
  };

  /** The countdowns move every 30 s while a card is open, and only then. */
  function syncPlanTimer(open: boolean) {
    const stop = () => {
      if (planTimer != null) window.clearInterval(planTimer);
      planTimer = null;
    };
    if (!open) return stop();
    if (planTimer != null) return;
    planTimer = window.setInterval(() => {
      if (planCardOpen() && State.mode === "expanded") State.notify();
      else stop();
    }, 30_000);
  }

  return {
    el,
    tick(nowMs: number) {
      if (mode !== "ticker") return false;
      ticker.tick(nowMs);
      return ticker.animating;
    },
    command(command) {
      if (command === "openSelection") {
        // Ctrl+O: what a click on the highlighted row does.
        if (mode !== "card" || State.cardSelection == null) return;
        openRow(listRows(leftBody)[State.cardSelection]);
        return;
      }
      // Ctrl+E (⌘E, islandToggleDiff): closes the diff that is open, else
      // opens the focused pill's latest edit.
      if (activeDiffId != null) {
        closeDiff();
        return;
      }
      const task = State.focusTask;
      const diffs = task ? State.sessionDiffs.get(task.id) : undefined;
      const last = diffs?.[diffs.length - 1];
      if (last?.id == null) return;
      activeDiffId = last.id;
      State.notify();
    },
    sync() {
      const task = State.focusTask;
      if (task?.id !== lastFocus) {
        lastFocus = task?.id ?? null;
        detailOpen = false;
        activeDiffId = null;
        cardKey = "";
        mode = null;
      }

      // A workspace or agent pill with a live session keeps the ticker; every
      // other pill shows its own card, exactly like IntegrationCardView.
      const sessionActive = task != null && hasSessionTicker(task);

      const planOpen = planCardOpen();
      if (mode === "plan" && !planOpen) {
        mode = null;
        cardKey = "";
      }
      syncPlanTimer(planOpen);

      // A diff that has since been dropped (cap, expiry, session end) just closes.
      const diff = task && activeDiffId != null ? State.findDiff(task.id, activeDiffId) : null;
      if (!diff) activeDiffId = null;

      if (planOpen) {
        if (mode !== "plan") {
          clear(leftBody);
          leftBody.append(plan.el);
          mode = "plan";
        }
        plan.sync();
      } else if (task && diff) {
        const key = `diff~${task.id}~${diff.id}`;
        if (key !== cardKey) {
          cardKey = key;
          mode = "diff";
          clear(leftBody);
          leftBody.append(buildDiffCard(diff, {
            dismiss: () => {
              actions.blip();
              closeDiff();
            },
            open: (path) => void Bridge.openFileInVSCode(path),
          }));
        }
      } else if (task && sessionActive) {
        if (mode !== "ticker") {
          clear(leftBody);
          leftBody.append(tickerBody);
          mode = "ticker";
          cardKey = "";
        }
        clear(who);
        // The agent's name is already the pill's: the label says what kind of
        // pill it is, as on the Mac (PillDefinition.sessionSubtitle).
        who.append(
          dot(task.color, 7),
          h("span", { class: "name", text: task.name }),
          h("span", { class: "tool", text: t(sessionSubtitle(task.id)) }),
        );
        if (task.steps.length > 1) {
          who.append(h("span", {
            class: "count",
            text: `${Math.min(task.stepIndex + 1, task.steps.length)}/${task.steps.length}`,
          }));
        }
        ticker.sync(task);
      } else if (task && task.id === SPOTIFY_ID) {
        // Its own card for every state: playing, idle, not installed.
        if (mode !== "spotify") {
          clear(leftBody);
          leftBody.append(spotifyCard.el);
          mode = "spotify";
          cardKey = "";
        }
        spotifyCard.sync();
      } else if (task) {
        const info = State.integrations[task.id];
        const key = [
          language(), task.id, task.color, detailOpen, task.state, task.steps.join("|"),
          info?.loaded, info?.error, info?.configured,
          JSON.stringify(info?.data ?? {}),
        ].join("~");
        if (key !== cardKey) {
          cardKey = key;
          mode = "card";
          clear(leftBody);
          leftBody.append(renderIntegrationCard(task, hooks));
        }
      }

      jump.style.display = detailOpen || mode === "plan" || mode === "diff" || task?.id === "integration_claude" ? "none" : "";

      // Ctrl+↓ Ctrl+↑ walk the open GitHub list (cardItemCount / cardSelection).
      const rows = mode === "card" ? listRows(leftBody) : [];
      State.cardItemCount = rows.length;
      if (State.cardSelection != null && State.cardSelection >= rows.length) State.cardSelection = null;
      highlightRow(rows, State.cardSelection, State.cardSelection !== shownSelection);
      shownSelection = State.cardSelection;

      const others = State.otherTasks.slice(0, 4);
      const pillKey = others.map((t) => `${t.id}:${t.color}:${t.pillBadge ?? ""}`).join("|");
      if (pillKey !== pillIds) {
        pillIds = pillKey;
        clear(pills);
        spotifyPill = null;
        for (const t of others) {
          if (t.id === SPOTIFY_ID) {
            spotifyPill = buildSpotifyPill(t, () => actions.setFocus(t.id));
            pills.append(spotifyPill.el);
          } else {
            pills.append(buildPill(t, actions));
          }
        }
        pruneMiniBots();
      }
      spotifyPill?.sync();
    },
  };
}

/**
 * IntegrationCardView.agentSessionActive: a workspace tool or an agent — or
 * any other tagged agent — with something going on.
 */
export function hasSessionTicker(task: AgentTask): boolean {
  // A pill made for an agent's session (Gemini CLI, Codex… not declared) only
  // exists while that session does: it keeps the ticker from the first event.
  if (task.source === "agent" && !task.isIntegration) return true;
  const category = pillDefinition(task.id)?.category;
  const isSession = category === "workspace" || category === "agent" ||
    (category == null && task.id.startsWith("agent_"));
  return isSession && (task.state !== "idle" || task.steps.length > 0);
}

function buildPill(task: AgentTask, actions: ViewActions): HTMLElement {
  const label = task.id === "integration_claude" ? "Day" : task.name;
  const canvas = createMiniBot(task, 24);
  const pill = h(
    "div",
    { class: "pill", onclick: () => actions.setFocus(task.id) },
    canvas,
    h("span", { class: "lbl", text: label }),
  );
  pill.style.borderColor = `${task.color}24`;
  pill.addEventListener("mouseenter", () => {
    pill.style.background = `${task.color}2e`;
    pill.style.borderColor = `${task.color}8c`;
    pill.style.boxShadow = `0 2px 10px ${task.color}59`;
    (pill.querySelector(".lbl") as HTMLElement).style.color = lighten(task.color, 0.3);
  });
  pill.addEventListener("mouseleave", () => {
    pill.style.background = "";
    pill.style.borderColor = `${task.color}24`;
    pill.style.boxShadow = "";
    (pill.querySelector(".lbl") as HTMLElement).style.color = "";
  });

  if (task.pillBadge) {
    const colors = { approval: "#F5A524", finished: "#22C55E", error: "#F4505E" } as const;
    const icons = { approval: ICONS.bang, finished: ICONS.check, error: ICONS.xmark } as const;
    const inner = h("i", { style: `background:${colors[task.pillBadge]}` }, svg(icons[task.pillBadge], 6, { stroke: task.pillBadge === "finished" ? 3 : 0 }));
    const badge = h("div", { class: "pill-badge" }, inner);
    badge.style.boxShadow = `0 0 4px ${colors[task.pillBadge]}99`;
    pill.append(badge);
  }
  return pill;
}

function lighten(hex: string, amount: number): string {
  const v = parseInt(hex.replace("#", ""), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) =>
    Math.min(255, Math.round(x + amount * 255)),
  );
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ── Empty ─────────────────────────────────────────────────────────────────────

function buildEmpty(actions: ViewActions): ViewHost {
  const body = h(
    "div",
    { class: "stack", style: "padding:0 18px 0 118px;flex-direction:row;align-items:center;gap:16px" },
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:5px" },
      h("div", { class: "title", text: tl("Nothing running right now.") }),
      h("div", { class: "sub", text: tl("Drop a file or window, or ask me anything.") }),
    ),
    h("div", { class: "grow" }),
    btn(tl("Ask Claude"), "primary", () => actions.setView("prompt")),
  );
  return { el: h("div", { class: "view" }, card(null, body)), sync() {} };
}

// ── Approval ──────────────────────────────────────────────────────────────────

/** How long a fresh permission card ignores clicks on its buttons. */
const CLICK_GUARD_MS = 600;

/**
 * The ⌃ in the corner of a waiting card: folds the island to its compact size
 * and leaves the request waiting — nothing is answered (Mac #290). Opening the
 * island again brings the card back.
 */
function foldButton(actions: ViewActions): HTMLElement {
  return h(
    "button",
    { class: "icon-btn fold", title: tl("Later — keep it waiting"), onclick: () => actions.foldApproval() },
    svg(ICONS.chevronUp, 8, { stroke: 2.4 }),
  );
}

function buildApproval(actions: ViewActions): ViewHost {
  const who = h("div");
  const code = h("div", { class: "code" });
  const row = h("div", { class: "actions" });
  const el = h("div", { class: "view" },
    card("amber", stack(116, 16, who, code, row), foldButton(actions)));
  let rowKey = "";
  // The card pops up under a cursor that was busy with something else: a click
  // meant for the window underneath must not land on Allow. Clicks in the first
  // moments after a new request appears are ignored.
  let shownFor: string | null = null;
  let shownAt = 0;
  const guarded = (d: "allow" | "deny") => () => {
    if (performance.now() - shownAt < CLICK_GUARD_MS) return;
    actions.decide(d);
  };
  return {
    el,
    sync() {
      const req = State.pendingApproval?.requestId ?? null;
      if (req !== shownFor) {
        shownFor = req;
        shownAt = performance.now();
      }
      clear(who);
      who.append(agentWho(State.focusTask, t("needs permission")));
      // The whole point of approving here rather than in the terminal: this line
      // is the command, the file path or the URL being authorised, not just the
      // name of the tool asking.
      code.textContent = State.pendingApproval?.command || State.pendingApproval?.tool || "…";
      // Two buttons, built once. Rebuilding them between a mouse-down and a
      // mouse-up would swallow the click, and there is nothing left to vary:
      // "Always" is gone until the remembered-rules list exists to back it.
      if (rowKey === "built") return;
      rowKey = "built";
      clear(row);
      row.append(
        btn(tl("Deny"), "secondary", guarded("deny"), "N"),
        btn(tl("Allow"), "primary", guarded("allow"), "Y"),
      );
    },
  };
}

// ── Question ──────────────────────────────────────────────────────────────────

function buildQuestion(actions: ViewActions): ViewHost {
  const who = h("div");
  const title = h("div", { class: "title question-text" });
  const row = h("div", { class: "actions options" });
  const fold = foldButton(actions);
  const el = h("div", { class: "view" }, card("cyan", stack(116, 16, who, title, row), fold));

  // Where we are in the request on screen: which question, what is answered so
  // far, and what is ticked in a pick-several question.
  let requestId = "";
  let index = 0;
  let answers: Record<string, string | string[]> = {};
  let picked = new Set<string>();
  // The buttons are only rebuilt when what they show changes: rebuilding them
  // between a mouse-down and a mouse-up would swallow the click.
  let rowKey = "";

  const next = (question: string, answer: string | string[], total: number) => {
    answers[question] = answer;
    picked = new Set();
    index += 1;
    if (index >= total) actions.answer(answers);
    else State.notify();
  };

  return {
    el,
    sync() {
      const questions = State.pendingApproval?.questions;
      clear(who);
      // Only a request that is waiting can be folded away and come back.
      fold.style.display = State.pendingApproval ? "" : "none";

      // A question that arrived as a notification has nothing to pick from.
      if (!questions) {
        who.append(agentWho(State.focusTask, t("is asking a question")));
        const task = State.focusTask;
        title.textContent = (task && lastTextStep(task.steps)) ?? t("Claude needs an answer.");
        if (rowKey !== "terminal") {
          rowKey = "terminal";
          clear(row);
          row.append(h("div", { class: "sub", text: tl("Answer it in your terminal.") }));
        }
        return;
      }

      if (State.pendingApproval!.requestId !== requestId) {
        requestId = State.pendingApproval!.requestId;
        index = 0;
        answers = {};
        picked = new Set();
      }
      const q = questions[Math.min(index, questions.length - 1)];
      const asking = questions.length > 1
        ? t("is asking ({index} of {total})", { index: index + 1, total: questions.length })
        : t("is asking");
      who.append(agentWho(State.focusTask, asking));
      title.textContent = q.question;
      title.title = q.question;

      const key = `${requestId}:${index}:${[...picked].join("|")}`;
      if (rowKey === key) return;
      rowKey = key;
      clear(row);
      for (const option of q.options) {
        const on = picked.has(option.label);
        const button = btn(option.label, on ? "primary" : "secondary", () => {
          if (!q.multiSelect) {
            next(q.question, option.label, questions.length);
            return;
          }
          if (on) picked.delete(option.label);
          else picked.add(option.label);
          State.notify();
        });
        if (option.description) button.title = option.description;
        row.append(button);
      }
      if (q.multiSelect) {
        const done = btn(tl("Done"), "primary", () => {
          if (picked.size > 0) next(q.question, [...picked], questions.length);
        });
        if (picked.size === 0) done.classList.add("off");
        row.append(done);
      }
      row.append(
        h("button", {
          class: "link-btn",
          style: "color:#8e939c",
          text: tl("Answer in terminal"),
          onclick: () => actions.answerInTerminal(),
        }),
      );
    },
  };
}

// ── Error ─────────────────────────────────────────────────────────────────────

function buildError(actions: ViewActions): ViewHost {
  const who = h("div");
  const title = h("div", { class: "title" });
  const detail = h("div", { class: "detail" });
  const row = h("div", { class: "actions" },
    btn(tl("Retry"), "primary", () => actions.setView(State.defaultView())),
    btn(tl("Open in n8n"), "secondary", () => actions.openUrl("")),
  );
  const el = h("div", { class: "view" }, card("red", stack(116, 16, who, title, detail, row)));
  return {
    el,
    sync() {
      const task = State.focusTask;
      clear(who);
      // agentWho already shows an agent's name: its label is just the kind.
      const whoLabel = task?.source === "n8n" ? "n8n" : task?.source === "agent" ? t("Agent") : "Claude Code";
      who.append(agentWho(task, whoLabel));
      title.textContent = task?.source === "n8n" ? t("Workflow stopped.") : t("Session stopped on an error.");
      detail.textContent = (task && lastTextStep(task.steps)) ?? t("No detail available.");
    },
  };
}

// ── Finished ──────────────────────────────────────────────────────────────────

function buildFinished(actions: ViewActions): ViewHost {
  const who = h("div");
  const title = h("div", { class: "title one-line" });
  const open = btn(tl("Open terminal"), "primary", () => actions.openTerminal());
  const row = h("div", { class: "actions" },
    open,
    btn(tl("OK"), "secondary", () => actions.collapse()),
  );
  const el = h("div", { class: "view" }, card("green", stack(116, 16, who, title, row)));
  return {
    el,
    sync() {
      clear(who);
      const agent = State.focusTask?.source === "agent";
      who.append(agentWho(State.focusTask, agent ? t("finished") : t("Claude Code finished")));
      // The final message, else the last step that is not a diff (FinishedView).
      const task = State.focusTask;
      title.textContent = task?.finalLine || (task && lastTextStep(task.steps)) || t("Session finished");
      // Sessions from the Claude desktop app live there, not in a terminal.
      const label = task?.id === "agent_claude-desktop" ? t("Open Claude") : t("Open terminal");
      const span = open.firstElementChild as HTMLElement;
      if (span.textContent !== label) span.textContent = label;
    },
  };
}

// ── Confused ──────────────────────────────────────────────────────────────────

function buildConfused(): ViewHost {
  const body = h(
    "div",
    { class: "stack", style: "padding:0 18px 0 128px" },
    h("div", { class: "title", text: tl("Too many hits at once.") }),
    h("div", { class: "sub", text: tl("Give me a sec — back to work in three seconds.") }),
  );
  return { el: h("div", { class: "view" }, card("pink", body)), sync() {} };
}

// ── Note ──────────────────────────────────────────────────────────────────────

function buildNote(): ViewHost {
  const title = h("div", { class: "title" });
  const el = h("div", { class: "view" }, card(null, h("div", { class: "stack", style: "padding:0 18px 0 98px" }, title)));
  return {
    el,
    sync() {
      title.textContent = State.noteMessage ?? "";
    },
  };
}

const AVATAR_COLORS = [
  "#FFFFFF", "#F4505E", "#F29B38", "#FACC15", "#4ADE80",
  "#2DD4BF", "#38BDF8", "#818CF8", "#C084FC", "#E879F9", "#1E2026",
];

function buildSettings(actions: ViewActions): ViewHost {
  // ── Mini Settings Elements ──────────────────────────────────────────────────
  const soundSwitch = h("button", { class: "switch", onclick: () => actions.toggleSound() });
  const volume = h("input", {
    type: "range", min: "0", max: "0.2", step: "0.005",
    oninput: (e: Event) => actions.setVolume(Number((e.target as HTMLInputElement).value)),
  }) as HTMLInputElement;

  const avatarSwatches = AVATAR_COLORS.map((hex) => {
    const btn = h("button", {
      class: "avatar-color-swatch",
      style: `background:${hex};width:15px;height:15px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.25);cursor:pointer;padding:0;transition:all 0.15s ease;`,
      title: hex,
      onclick: () => {
        State.settings.avatarColor = hex;
        void Bridge.saveSettings(State.settings);
        State.notify();
      },
    });
    return btn;
  });

  const miniRows = h(
    "div",
    { class: "settings-rows" },
    h("div", { class: "settings-row" }, soundSwitch, h("span", { text: tl("Sound") }), volume),
    h(
      "div",
      { class: "settings-row", style: "gap:4px;align-items:center;" },
      h("span", { text: "Avatar", style: "font-size:11px;color:#8e939c;margin-right:2px;" }),
      ...avatarSwatches,
    ),
    h(
      "div",
      { class: "settings-row", style: "margin-top:2px;justify-content:flex-end;" },
      h(
        "button",
        {
          class: "btn secondary settings-expand-btn",
          style: "padding:5px 13px;border-radius:14px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.12);",
          onclick: () => actions.toggleFullSettings?.(true),
        },
        svg(ICONS.gearFill, 13),
        h("span", { text: tl("Settings") }),
      ),
    ),
  );

  const miniCard = card(null, h("div", { class: "stack", style: "padding:14px 16px 14px 84px" }, miniRows));

  // ── In-Island Full Settings Elements ───────────────────────────────────────
  let activeTab: "general" | "appearance" | "shortcuts" | "ai" = "general";

  const backBtn = h(
    "button",
    {
      class: "settings-back-btn",
      style: "display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:3px 9px;color:#cbd5e1;font-size:11.5px;font-weight:600;cursor:pointer;transition:all 0.15s ease;",
      onclick: () => actions.toggleFullSettings?.(false),
    },
    svg(ICONS.chevronLeft, 11),
    h("span", { text: tl("Back") }),
  );

  const titleEl = h("span", { text: tl("Settings"), style: "font-size:13px;font-weight:700;color:#fff;" });

  const tabs = [
    { id: "general", label: tl("General") },
    { id: "appearance", label: "Appearance" },
    { id: "shortcuts", label: tl("Shortcuts") },
    { id: "ai", label: "AI & Keys" },
  ] as const;

  const glassSlider = h("div", { class: "glass-tab-slider" });
  const tabContainer = h("div", {
    class: "settings-tab-bar",
  }, glassSlider);

  const tabBtns: HTMLElement[] = [];

  tabs.forEach((tab, index) => {
    const btn = h(
      "button",
      {
        class: "settings-tab-btn" + (index === 0 ? " active" : ""),
        onclick: () => selectTab(index, true),
      },
      tab.label,
    );
    tabBtns.push(btn);
    tabContainer.append(btn);
  });

  const fullHeader = h(
    "div",
    {
      style: "display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);",
    },
    h("div", { style: "display:flex;align-items:center;gap:8px;" }, backBtn, titleEl),
    tabContainer,
  );

  const carousel = h("div", { class: "settings-sections-carousel" });
  const slideGeneral = h("div", { class: "settings-section-slide", "data-tab": "general" });
  const slideAppearance = h("div", { class: "settings-section-slide", "data-tab": "appearance" });
  const slideShortcuts = h("div", { class: "settings-section-slide", "data-tab": "shortcuts" });
  const slideAi = h("div", { class: "settings-section-slide", "data-tab": "ai" });
  const slides = [slideGeneral, slideAppearance, slideShortcuts, slideAi];
  carousel.append(slideGeneral, slideAppearance, slideShortcuts, slideAi);

  function updateGlassSlider(index: number) {
    const activeBtn = tabBtns[index];
    if (activeBtn) {
      glassSlider.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
      glassSlider.style.width = `${activeBtn.offsetWidth}px`;
    }
  }

  function selectTab(index: number, smoothScroll = true) {
    activeTab = tabs[index].id;
    tabBtns.forEach((btn, i) => {
      btn.classList.toggle("active", i === index);
    });
    updateGlassSlider(index);

    if (smoothScroll && slides[index]) {
      carousel.scrollTo({
        left: slides[index].offsetLeft,
        behavior: "smooth",
      });
    }
  }

  let scrollTimeout: any = null;
  carousel.addEventListener("scroll", () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollLeft = carousel.scrollLeft;
      const width = carousel.clientWidth || 1;
      const index = Math.min(tabs.length - 1, Math.max(0, Math.round(scrollLeft / width)));
      if (tabs[index] && tabs[index].id !== activeTab) {
        activeTab = tabs[index].id;
        tabBtns.forEach((btn, i) => btn.classList.toggle("active", i === index));
        updateGlassSlider(index);
      }
    }, 40);
  });

  const fullCardContent = h(
    "div",
    {
      class: "stack",
      style: "display:flex;flex-direction:column;height:100%;padding:12px 18px;box-sizing:border-box;",
    },
    fullHeader,
    carousel,
  );

  const fullCard = card(null, fullCardContent);

  function renderSections() {
    clear(slideGeneral);
    clear(slideAppearance);
    clear(slideShortcuts);
    clear(slideAi);

    const s = State.settings;

    // ── General Slide ────────────────────────────────────────────────────────
    const alwaysSwitch = h("button", {
      class: s.alwaysIsland ? "switch on" : "switch",
      onclick: () => {
        s.alwaysIsland = !s.alwaysIsland;
        void Bridge.saveSettings(s);
        State.notify();
      },
    });

    const autostartSwitch = h("button", {
      class: s.autostart ? "switch on" : "switch",
      onclick: () => {
        s.autostart = !s.autostart;
        void Bridge.saveSettings(s);
        State.notify();
      },
    });

    const langSelect = h(
      "select",
      {
        style: "background:#1e2026;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:3px 8px;font-size:11.5px;",
        onchange: (e: Event) => {
          s.language = (e.target as HTMLSelectElement).value;
          void Bridge.saveSettings(s);
          State.notify();
        },
      },
      h("option", { value: "", text: "System Default", selected: !s.language }),
      h("option", { value: "en", text: "English", selected: s.language === "en" }),
      h("option", { value: "es", text: "Español", selected: s.language === "es" }),
      h("option", { value: "fr", text: "Français", selected: s.language === "fr" }),
      h("option", { value: "de", text: "Deutsch", selected: s.language === "de" }),
      h("option", { value: "zh-Hans", text: "简体中文", selected: s.language === "zh-Hans" }),
      h("option", { value: "ja", text: "日本語", selected: s.language === "ja" }),
    );

    const standaloneBtn = h(
      "button",
      {
        class: "btn secondary",
        style: "padding:4px 10px;font-size:11px;border-radius:10px;gap:5px;",
        onclick: () => actions.openSettingsWindow(),
      },
      svg(ICONS.arrowUpRight, 11),
      h("span", { text: "Open Dedicated Window" }),
    );

    // ── System Permissions ──
    const sysPermMasterSwitch = h("button", {
      class: s.systemPermissions !== false ? "switch on" : "switch",
      onclick: () => {
        s.systemPermissions = !(s.systemPermissions !== false);
        void Bridge.saveSettings(s);
        renderSections();
      },
    });

    const sysPermFilesSwitch = h("button", {
      class: s.systemPermFiles !== false ? "switch on" : "switch",
      onclick: () => {
        s.systemPermFiles = !(s.systemPermFiles !== false);
        void Bridge.saveSettings(s);
        renderSections();
      },
    });

    const sysPermEditorSwitch = h("button", {
      class: s.systemPermEditor !== false ? "switch on" : "switch",
      onclick: () => {
        s.systemPermEditor = !(s.systemPermEditor !== false);
        void Bridge.saveSettings(s);
        renderSections();
      },
    });

    const sysPermQuestionsSwitch = h("button", {
      class: s.systemPermQuestions !== false ? "switch on" : "switch",
      onclick: () => {
        s.systemPermQuestions = !(s.systemPermQuestions !== false);
        void Bridge.saveSettings(s);
        renderSections();
      },
    });

    const permissionsCard = h(
      "div",
      {
        style: "margin-top:8px;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;gap:5px;",
      },
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;" },
        h("div", {},
          h("span", { style: "font-weight:600;font-size:11.5px;color:#fff;", text: "System Permissions" }),
          h("div", { style: "font-size:10px;color:#64748b;margin-top:1px;" }, "Allow open & delete files, open code editor & write code")),
        sysPermMasterSwitch),
      s.systemPermissions !== false
        ? h("div", { style: "display:flex;flex-direction:column;gap:4px;border-top:1px solid rgba(255,255,255,0.06);padding-top:6px;margin-top:2px;" },
            h("div", { class: "settings-row", style: "justify-content:space-between;padding:2px 0;" },
              h("span", { style: "font-size:11px;color:#cbd5e1;", text: "Open & Delete Files" }),
              sysPermFilesSwitch),
            h("div", { class: "settings-row", style: "justify-content:space-between;padding:2px 0;" },
              h("span", { style: "font-size:11px;color:#cbd5e1;", text: "Open Code Editor & Write Code" }),
              sysPermEditorSwitch),
            h("div", { class: "settings-row", style: "justify-content:space-between;padding:2px 0;" },
              h("span", { style: "font-size:11px;color:#cbd5e1;", text: "Interactive Confirmation Questions" }),
              sysPermQuestionsSwitch),
          )
        : null,
    );

    slideGeneral.append(
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
        h("span", { text: "Interface Language" }), langSelect),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
        h("div", {}, h("span", { text: "Always Visible Island" }), h("div", { style: "font-size:10px;color:#64748b;" }, "Keep island enabled from system start")),
        alwaysSwitch),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
        h("div", {}, h("span", { text: "Autostart with Windows" }), h("div", { style: "font-size:10px;color:#64748b;" }, "Launch Day on system startup")),
        autostartSwitch),
      permissionsCard,
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:6px 0;border-top:1px solid rgba(255,255,255,0.06);margin-top:6px;" },
        h("span", { text: "More Preferences", style: "font-size:11.5px;color:#94a3b8;" }), standaloneBtn),
    );

    // ── Appearance Slide ─────────────────────────────────────────────────────
    const appearanceSwatches = AVATAR_COLORS.map((hex) => {
      const isCurrent = (s.avatarColor || "#FFFFFF") === hex;
      return h("button", {
        style: `background:${hex};width:18px;height:18px;border-radius:50%;border:2px solid ${isCurrent ? "#fff" : "rgba(255,255,255,0.2)"};box-shadow:${isCurrent ? `0 0 8px ${hex}` : "none"};cursor:pointer;padding:0;transition:all 0.15s ease;`,
        onclick: () => {
          s.avatarColor = hex;
          void Bridge.saveSettings(s);
          State.notify();
        },
      });
    });

    const season = seasonalOutfit(new Date());
    const outfitCardsRow = h("div", { class: "outfit-visual-row" });
    const outfitCards: { btn: HTMLElement; sel: OutfitSelection }[] = [];

    const updateOutfitCards = () => {
      const cur = parseOutfit(s.dayOutfit);
      outfitCards.forEach(({ btn, sel }) => {
        btn.classList.toggle("active", sel === cur);
      });
    };

    const ICON_SIZE = 26;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    for (const sel of OUTFIT_SELECTIONS) {
      const canvas = h("canvas", {
        width: String(Math.round(ICON_SIZE * dpr)),
        height: String(Math.round(ICON_SIZE * dpr)),
      }) as HTMLCanvasElement;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawWardrobeIcon(ctx, ICON_SIZE, sel, season, "AUTO");
      }

      const label = tl(OUTFIT_KEYS[sel]);
      const btn = h(
        "button",
        {
          type: "button",
          class: "outfit-visual-card",
          title: label,
          onclick: () => {
            actions.chooseOutfit(sel);
            updateOutfitCards();
          },
        },
        canvas,
        h("span", { text: label }),
      );

      outfitCards.push({ btn, sel });
      outfitCardsRow.append(btn);
    }
    updateOutfitCards();

    const tabSoundSwitch = h("button", {
      class: s.soundEnabled ? "switch on" : "switch",
      onclick: () => {
        actions.toggleSound();
        renderSections();
      },
    });

    const tabVolume = h("input", {
      type: "range", min: "0", max: "0.2", step: "0.005", value: String(s.soundVolume),
      oninput: (e: Event) => actions.setVolume(Number((e.target as HTMLInputElement).value)),
    }) as HTMLInputElement;

    const opacityPct = Math.round((s.backgroundOpacity ?? 0.85) * 100);
    const opacityPctText = h("span", { style: "font-size:11px;color:#94a3b8;min-width:32px;text-align:right;", text: `${opacityPct}%` });
    const opacityInput = h("input", {
      type: "range", min: "15", max: "100", step: "1", value: String(opacityPct),
      oninput: (e: Event) => {
        const val = Number((e.target as HTMLInputElement).value);
        opacityPctText.textContent = `${val}%`;
        s.backgroundOpacity = val / 100;
        void Bridge.saveSettings(s);
        State.notify();
      },
    }) as HTMLInputElement;

    const moveSwitch = h("button", {
      class: s.showMoveBtn !== false ? "switch on" : "switch",
      onclick: () => {
        s.showMoveBtn = !(s.showMoveBtn !== false);
        void Bridge.saveSettings(s);
        State.notify();
      },
    });

    const closeSwitch = h("button", {
      class: s.showCloseBtn !== false ? "switch on" : "switch",
      onclick: () => {
        s.showCloseBtn = !(s.showCloseBtn !== false);
        void Bridge.saveSettings(s);
        State.notify();
      },
    });

    const minSwitch = h("button", {
      class: s.showMinimizeBtn !== false ? "switch on" : "switch",
      onclick: () => {
        s.showMinimizeBtn = !(s.showMinimizeBtn !== false);
        void Bridge.saveSettings(s);
        State.notify();
      },
    });

    const prevSwitch = h("button", {
      class: s.showPreviousBtn !== false ? "switch on" : "switch",
      onclick: () => {
        s.showPreviousBtn = !(s.showPreviousBtn !== false);
        void Bridge.saveSettings(s);
        State.notify();
      },
    });

    const undoSwitch = h("button", {
      class: s.showUndoBtn !== false ? "switch on" : "switch",
      onclick: () => {
        s.showUndoBtn = !(s.showUndoBtn !== false);
        void Bridge.saveSettings(s);
        State.notify();
      },
    });

    slideAppearance.append(
      h("div", { class: "settings-row", style: "flex-direction:column;align-items:flex-start;gap:6px;padding:4px 0;" },
        h("span", { text: "Avatar Aura Color" }),
        h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;" }, ...appearanceSwatches)),
      h("div", { class: "settings-row", style: "flex-direction:column;align-items:flex-start;gap:6px;padding:6px 0;margin-top:4px;" },
        h("div", { style: "display:flex;justify-content:space-between;width:100%;align-items:center;" },
          h("span", { text: "Day's Outfit" }),
          h("span", { style: "font-size:10px;color:#94a3b8;", text: "Visual Style" })),
        outfitCardsRow),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:6px 0;" },
        h("div", {},
          h("span", { text: "Move Island" }),
          h("div", { style: "font-size:10px;color:#64748b;" }, "Hold & drag button to move Island on screen")),
        (() => {
          let slideMoveTimer: number | null = null;
          const cancelSlideMove = () => {
            if (slideMoveTimer != null) {
              clearTimeout(slideMoveTimer);
              slideMoveTimer = null;
            }
          };
          return h("div", { style: "display:flex;align-items:center;gap:6px;" },
            h("button", {
              class: "btn secondary",
              style: "display:inline-flex;align-items:center;gap:6px;padding:4px 10px;font-size:11px;cursor:grab;",
              onmousedown: (e: Event) => {
                e.preventDefault();
                cancelSlideMove();
                slideMoveTimer = window.setTimeout(() => {
                  slideMoveTimer = null;
                  actions.blip();
                  if (actions.startMoveMode) actions.startMoveMode();
                }, 200);
              },
              onmousemove: () => {
                if (slideMoveTimer != null) {
                  cancelSlideMove();
                  actions.blip();
                  if (actions.startMoveMode) actions.startMoveMode();
                }
              },
              onmouseup: cancelSlideMove,
              onmouseleave: cancelSlideMove,
            }, svg(ICONS.move, 12), h("span", { text: "Drag to Move" })),
            h("button", {
              class: "btn secondary",
              style: "padding:4px 8px;font-size:11px;color:#94a3b8;",
              onclick: () => {
                s.islandX = null;
                s.islandY = null;
                void Bridge.saveSettings(s);
                State.notify();
              },
            }, "Reset"),
          );
        })(),
      ),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:6px 0;" },
        h("div", {},
          h("span", { text: "Opacity" }),
          h("div", { style: "font-size:10px;color:#64748b;" }, "Overall island transparency")),
        h("div", { style: "display:flex;align-items:center;gap:8px;" }, opacityInput, opacityPctText)),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:6px 0;" },
        h("span", { text: "Sound Effects & Volume" }),
        h("div", { style: "display:flex;align-items:center;gap:8px;" }, tabSoundSwitch, tabVolume)),
      h("div", { style: "border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:6px;" },
        h("div", { style: "font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:4px;" }, "Island Right-Side Action Buttons"),
        h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
          h("span", { text: "Move Button" }), moveSwitch),
        h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
          h("span", { text: "Close Button" }), closeSwitch),
        h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
          h("span", { text: "Minimize Button" }), minSwitch),
        h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
          h("span", { text: "Previous Button" }), prevSwitch),
        h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
          h("span", { text: "Undo Button" }), undoSwitch)),
    );

    // ── Shortcuts Slide ──────────────────────────────────────────────────────
    const kbd = (key: string) => h("span", {
      style: "background:#22252c;border:1px solid rgba(255,255,255,0.18);border-radius:5px;padding:2px 7px;font-size:11px;font-weight:600;color:#e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,0.4);",
    }, key);

    slideShortcuts.append(
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
        h("span", { text: "Toggle / Open Island" }), kbd("Alt + Space")),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
        h("span", { text: "Open Chat Prompt" }), kbd("Ctrl + Shift + C")),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
        h("span", { text: "Day's Wardrobe" }), kbd("Ctrl + Shift + W")),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
        h("span", { text: "Screenshot / Drop" }), kbd("Ctrl + Shift + S")),
      h("div", {
        style: "margin-top:8px;padding:8px 10px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.08);font-size:11px;color:#94a3b8;line-height:1.4;",
      }, "💡 Long press or drag anywhere on the island to move it to your own custom screen position."),
    );

    // ── AI Slide ─────────────────────────────────────────────────────────────
    const providerSelect = h(
      "select",
      {
        style: "background:#1e2026;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:3px 8px;font-size:11.5px;",
        onchange: (e: Event) => {
          s.chatProvider = (e.target as HTMLSelectElement).value as any;
          void Bridge.saveSettings(s);
          State.notify();
        },
      },
      h("option", { value: "anthropic", text: "Anthropic (Claude)", selected: s.chatProvider === "anthropic" }),
      h("option", { value: "openai", text: "OpenAI (GPT-4o)", selected: s.chatProvider === "openai" }),
      h("option", { value: "google", text: "Google (Gemini)", selected: s.chatProvider === "google" }),
      h("option", { value: "ollama", text: "Ollama (Local)", selected: s.chatProvider === "ollama" }),
      h("option", { value: "lmstudio", text: "LM Studio (Local)", selected: s.chatProvider === "lmstudio" }),
      h("option", { value: "custom", text: "Custom Server", selected: s.chatProvider === "custom" }),
    );

    const hookBadge = dot(s.hooksInstalled ? "#22C55E" : "#F4505E", 7);
    const hookText = h("span", { text: s.hooksInstalled ? "Hooks Connected" : "Not Configured" });

    slideAi.append(
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:4px 0;" },
        h("span", { text: "Chat Provider" }), providerSelect),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:6px 0;" },
        h("span", { text: "Claude Code Integration" }),
        h("div", { style: "display:flex;align-items:center;gap:6px;font-size:11.5px;" }, hookBadge, hookText)),
      h("div", { class: "settings-row", style: "justify-content:space-between;padding:6px 0;" },
        h("span", { text: "Manage API Keys" }),
        h("button", {
          class: "btn secondary",
          style: "padding:3px 10px;font-size:11px;border-radius:10px;",
          onclick: () => actions.openSettingsWindow(),
        }, "Configure Keys ↗")),
    );
  }

  renderSections();

  const el = h("div", { class: "view" }, miniCard, fullCard);

  return {
    el,
    sync() {
      const isFull = Boolean(State.fullSettingsOpen);
      miniCard.style.display = isFull ? "none" : "block";
      fullCard.style.display = isFull ? "block" : "none";

      const s = State.settings;
      soundSwitch.classList.toggle("on", s.soundEnabled);
      volume.value = String(s.soundVolume);
      volume.style.opacity = s.soundEnabled ? "1" : "0.4";
      avatarSwatches.forEach((b, i) => {
        const hex = AVATAR_COLORS[i];
        const current = s.avatarColor || "#FFFFFF";
        const isCurrent = current === hex;
        (b as HTMLElement).style.transform = isCurrent ? "scale(1.25)" : "scale(1)";
        (b as HTMLElement).style.borderColor = isCurrent ? "#FFFFFF" : "rgba(255,255,255,0.25)";
        (b as HTMLElement).style.boxShadow = isCurrent ? `0 0 6px ${hex}` : "none";
      });

      if (isFull) {
        renderSections();
        requestAnimationFrame(() => {
          const idx = tabs.findIndex((t) => t.id === activeTab);
          updateGlassSlider(idx >= 0 ? idx : 0);
        });
      }
    },
  };
}

// ── Placeholders filled in later stages ───────────────────────────────────────

function buildPlaceholder(title: Msg, sub: string): ViewHost {
  const body = h(
    "div",
    { class: "stack", style: "padding:0 18px 0 118px" },
    h("div", { class: "title", text: title }),
    h("div", { class: "sub", text: sub }),
  );
  return { el: h("div", { class: "view" }, card(null, body)), sync() {} };
}

// ── Registry ──────────────────────────────────────────────────────────────────

export function buildViews(
  actions: ViewActions,
  onChatHeightChange: () => void,
): Map<IslandViewName, ViewHost> {
  const map = new Map<IslandViewName, ViewHost>();
  map.set("overview", buildOverview(actions));
  map.set("empty", buildEmpty(actions));
  map.set("approval", buildApproval(actions));
  map.set("question", buildQuestion(actions));
  map.set("error", buildError(actions));
  map.set("finished", buildFinished(actions));
  map.set("confused", buildConfused());
  map.set("note", buildNote());
  map.set("settings", buildSettings(actions));
  map.set("prompt", buildPrompt(onChatHeightChange));
  map.set("upload", buildUpload());
  map.set("uploading", buildUploading());
  map.set("choose", buildChoose(actions));
  map.set("recap", buildRecap(actions));
  map.set("wardrobe", buildWardrobe(actions));
  // Not in the Windows v1: sending a file by email, window attach + web result.
  map.set("mail", buildPlaceholder(tl("Sending by email isn't in this version."), ""));
  map.set("searching", buildPlaceholder(tl("Claude is searching…"), ""));
  map.set("result", buildPlaceholder(tl("Result"), ""));
  return map;
}

