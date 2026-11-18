// Island views — DOM ports of IslandViewContent.swift. Paddings, font sizes,
// colours and wording are copied from the Swift views so both platforms read
// identically.

import { h, svg, clear, dot } from "./dom";
import { ICONS } from "./icons";
import { Ticker } from "./ticker";
import { State, type AgentTask } from "../core/state";
import { washRGBA, type IslandViewName, type Wash } from "../core/layout";
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
import { buildUpdate } from "./update";
import { buildWhatsNew } from "./whatsnew";
import { buildLaunch } from "./launch";
import { buildSpotifyCard } from "./spotify";
import { SPOTIFY_ID } from "../core/spotify";
import { buildWhatsAppCard } from "./whatsapp";
import { WHATSAPP_ID } from "../core/whatsapp";
import { MAIL_ID } from "../core/mail";
import { buildMailCard } from "./mail";
import { SystemAccess } from "../island/system-access";
import { buildAudioTrackerCard } from "./audio-tracker";
import type { Outfit, OutfitSelection } from "../Day/wardrobe";
import { language, t, tl, type Msg } from "../i18n/i18n";
import type { ViewCommand } from "../island/shortcuts";

export interface ViewActions {
  setView(v: IslandViewName): void;
  /** "Cancel" on a dropped file: forgets it and goes back home. */
  cancelDrop(): void;
  collapse(): void;
  closeIsland(): void;
  toggleExpand(): void;
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
  triggerMoveMode(): void;
  resetIslandPosition(): void;
  blip(): void;
  /** Wardrobe click: keeps the outfit ("auto" and "none" included). */
  chooseOutfit(selection: OutfitSelection): void;
  /** Wardrobe hover: shows an outfit on Day without keeping it; null ends it. */
  previewOutfit(outfit: Outfit | null): void;
  /** The island takes the keyboard (a text field in a card) or gives it back. */
  keyboard(on: boolean): void;
  /** Something is being typed in a card: the island stays open until it is sent or cleared. */
  holdOpen(on: boolean): void;
  /** A Claude Code session was started from the launch card: Day is pleased, the island folds. */
  launched(): void;
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
  // Left corner island icons: Home, Message, Add Files, Live System CMD
  const homeBtn = h("button", { title: "Home", onclick: () => actions.setView("overview") }, svg(ICONS.house, 16));
  const messageBtn = h("button", { title: tl("Message"), onclick: () => actions.setView("prompt") }, svg(ICONS.bubbleRound, 16));
  const addBtn = h("button", { title: "Add Files & Workspace Structure", onclick: () => actions.setView("launch") }, svg(ICONS.plus, 16));
  const cmdBtn = h("button", { title: "Live System CMD", onclick: () => actions.openTerminal() }, svg(ICONS.terminal, 16, { stroke: 1.6 }));
  // Offline status indicator (shown when no internet)
  const offlinePill = h(
    "div",
    { class: "header-offline-pill", title: "You're offline — local features and local models work fine" },
    svg(ICONS.wifiSlash, 12, { stroke: 1.8 }),
    h("span", { text: "Offline" }),
  );
  const headerNav = h("div", { class: "header-nav" }, homeBtn, messageBtn, addBtn, cmdBtn, offlinePill);

  // Settings button flow: first click goes to mini settings, inside mini settings goes to control panel settings
  const gearBtn = h(
    "button",
    {
      title: tl("Settings"),
      onclick: () => {
        if (State.view === "settings") {
          actions.openSettingsWindow();
        } else {
          actions.setView("settings");
        }
      },
    },
    svg(ICONS.gearLine, 18, { stroke: 1.6 }),
  );
  const soundBtn = h("button", { title: tl("Mute"), onclick: () => actions.toggleSound() }, svg(ICONS.speakerLine, 18, { stroke: 1.6 }));
  // Window control buttons in top-right of Island
  const minBtn = h(
    "button",
    { class: "win-btn", title: "Minimize", onclick: () => actions.collapse() },
    svg(ICONS.minus, 14, { stroke: 2 }),
  );
  const maxBtn = h(
    "button",
    { class: "win-btn", title: "Maximize", onclick: () => actions.toggleExpand() },
    svg(ICONS.square, 13, { stroke: 1.6 }),
  );
  // Closes the Island completely and makes it invisible (wake-strip stays to reopen on hover)
  const closeBtn = h(
    "button",
    { class: "close win-btn", title: tl("Close"), onclick: () => actions.closeIsland() },
    svg(ICONS.xmark, 16),
  );
  // Plan usage pills (off by default): before the gear, Claude first, as on the Mac.
  const claudePill = buildPlanPill(false);
  const codexPill = buildPlanPill(true);
  const planPills = h("div", { class: "plan-pills" }, claudePill.el, codexPill.el);
  let codexShown = false;

  const el = h(
    "div",
    { id: "header" },
    headerNav,
    h("div", { class: "header-actions" }, planPills, gearBtn, soundBtn, minBtn, maxBtn, closeBtn),
  );
  const headerActions = el.lastElementChild as HTMLElement;

  return {
    el,
    sync() {
      const v = State.view;
      homeBtn.classList.toggle("on", v === "overview");
      messageBtn.classList.toggle("on", v === "prompt");
      addBtn.classList.toggle("on", v === "launch");
      gearBtn.classList.toggle("on", v === "settings");

      // Offline pill visibility
      offlinePill.style.display = State.isOffline ? "flex" : "none";

      clear(gearBtn);
      gearBtn.append(svg(ICONS.gearLine, 18, { stroke: 1.6 }));
      clear(soundBtn);
      soundBtn.append(svg(State.settings.soundEnabled ? ICONS.speakerLine : ICONS.speakerSlashLine, 18, { stroke: 1.6 }));
      const showControls = State.showIslandWindowControls;
      minBtn.style.display = showControls ? "" : "none";
      maxBtn.style.display = showControls ? "" : "none";
      closeBtn.style.display = State.pendingApproval ? "none" : "";
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
    svg(ICONS.arrowUpRight, 12),
  );
  const left = card(null, leftBody, jump);
  // Opened from a plan pill in the header: stands in for the left card.
  const plan = new PlanCard();
  let planTimer: number | null = null;
  // Spotify's card is kept and updated in place: the progress bar
  // runs on, and a slider being dragged must not be rebuilt under the pointer.
  const spotifyCard = buildSpotifyCard();
  // WhatsApp's card too: its reply field keeps the draft and the keyboard while messages arrive.
  // Mail's card too (classic Outlook): the search field keeps its text and the keyboard.
  const mailCard = buildMailCard({ keyboard: (on) => actions.keyboard(on) });
  const whatsappCard = buildWhatsAppCard({
    openSettings: () => actions.openSettingsWindow(),
    keyboard: (on) => actions.keyboard(on),
    holdOpen: (on) => actions.holdOpen(on),
  });

  const el = h("div", { class: "view overview" },
    h("div", { class: "left" }, left),
  );

  let detailOpen = false;
  let lastFocus: string | null = null;
  let mode: "ticker" | "card" | "plan" | "diff" | "spotify" | "whatsapp" | "mail" | null = null;
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
        if (task.name === "Day - Personal Intelligence" || task.id === "integration_claude") {
          who.append(
            h("span", { class: "name", text: "Day - Personal Intelligence" }),
          );
        } else {
          who.append(
            dot(task.color, 7),
            h("span", { class: "name", text: task.name }),
            h("span", { class: "tool", text: t(sessionSubtitle(task.id)) }),
          );
        }
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
      } else if (task && task.id === MAIL_ID) {
        if (mode !== "mail") {
          clear(leftBody);
          leftBody.append(mailCard.el);
          mode = "mail";
          cardKey = "";
        }
        mailCard.sync();
      } else if (task && task.id === WHATSAPP_ID) {
        // Its own card in every state: not linked, no message, conversations, one open.
        if (mode !== "whatsapp") {
          clear(leftBody);
          leftBody.append(whatsappCard.el);
          mode = "whatsapp";
          cardKey = "";
        }
        whatsappCard.sync();
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

      jump.style.display = detailOpen || mode === "plan" || mode === "diff" ? "none" : "";

      // Ctrl+↓ Ctrl+↑ walk the open GitHub list (cardItemCount / cardSelection).
      const rows = mode === "card" ? listRows(leftBody) : [];
      State.cardItemCount = rows.length;
      if (State.cardSelection != null && State.cardSelection >= rows.length) State.cardSelection = null;
      highlightRow(rows, State.cardSelection, State.cardSelection !== shownSelection);
      shownSelection = State.cardSelection;
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
  return { el: h("div", { class: "view" }, card(null, body)), sync() { } };
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
  const inTerminal = () => {
    if (performance.now() - shownAt < CLICK_GUARD_MS) return;
    actions.answerInTerminal();
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
      // Two buttons, built once per kind of card. Rebuilding them between a
      // mouse-down and a mouse-up would swallow the click. "Always" is gone until
      // the remembered-rules list exists to back it. Antigravity waits on the card:
      // a third button hands the command back to its own prompt in the terminal,
      // where its "Always allow" lives (as on the Mac).
      const agy = State.pendingApproval?.pillId === "agent_antigravity";
      const key = agy ? "agy" : "built";
      if (rowKey === key) return;
      rowKey = key;
      clear(row);
      row.append(
        btn(tl("Deny"), "secondary", guarded("deny"), "N"),
        btn(tl("Allow"), "primary", guarded("allow"), "Y"),
      );
      if (agy) row.append(btn(tl("Reply in terminal"), "secondary", inTerminal));
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
  return { el: h("div", { class: "view" }, card("pink", body)), sync() { } };
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

// ── In-island settings ────────────────────────────────────────────────────────

function buildSettings(actions: ViewActions): ViewHost {
  // ── Sidebar ──
  const tabGeneral = h(
    "button",
    { class: "mini-sidebar-tab active", onclick: () => setTab("general") },
    svg(ICONS.gearLine, 13, { stroke: 1.6 }),
    h("span", { text: tl("General") }),
  );
  const tabAppearance = h(
    "button",
    { class: "mini-sidebar-tab", onclick: () => setTab("appearance") },
    svg(ICONS.palette, 13),
    h("span", { text: "Appearance" }),
  );
  const tabSystem = h(
    "button",
    { class: "mini-sidebar-tab", onclick: () => setTab("system") },
    svg(ICONS.bell, 13),
    h("span", { text: "System Access" }),
  );
  const ctrlBtn = h("button", {
    class: "mini-sidebar-ctrl",
    text: "Control Panel ↗",
    onclick: () => actions.openSettingsWindow(),
  });

  const sidebar = h(
    "div",
    { class: "mini-settings-sidebar" },
    h("div", { class: "mini-sidebar-header", text: tl("Settings") }),
    tabGeneral,
    tabAppearance,
    tabSystem,
    ctrlBtn,
  );

  // ── General Section ──
  // Window controls in toggle style: Minimize, Maximize, Close, Move
  const windowControlsSwitch = h("button", {
    class: "switch",
    title: "Show on Island",
    onclick: () => {
      State.showIslandWindowControls = !State.showIslandWindowControls;
      windowControlsSwitch.classList.toggle("on", State.showIslandWindowControls);
      State.notify();
    },
  });
  const minToggle = h("button", {
    class: "switch",
    title: "Minimize",
    onclick: () => actions.collapse(),
  });
  const maxToggle = h("button", {
    class: "switch on",
    title: "Maximize",
    onclick: () => actions.toggleExpand(),
  });
  const closeToggle = h("button", {
    class: "switch",
    title: tl("Close"),
    onclick: () => actions.closeIsland(),
  });
  let moveActive = false;
  const resetPosBtn = h("button", {
    class: "link-btn",
    style: "font-size:10px;padding:1px 5px;margin-right:6px;color:#a1a1aa",
    text: "Reset",
    title: "Reset Island to default screen top center",
    onclick: (e) => {
      e.stopPropagation();
      actions.resetIslandPosition();
    },
  });
  const moveToggle = h("button", {
    class: "switch",
    title: "Move (Click to vibrate & drag to set static place)",
    onclick: () => {
      moveActive = !moveActive;
      moveToggle.classList.toggle("on", moveActive);
      actions.triggerMoveMode();
    },
  });

  const windowGrid = h(
    "div",
    { class: "mini-toggle-grid" },
    h("div", { class: "mini-toggle-item" }, h("span", { text: "Minimize" }), minToggle),
    h("div", { class: "mini-toggle-item" }, h("span", { text: "Maximize" }), maxToggle),
    h("div", { class: "mini-toggle-item" }, h("span", { text: tl("Close") }), closeToggle),
    h("div", { class: "mini-toggle-item" }, h("span", { text: "Move (Drag)" }), h("div", { style: "display:flex;align-items:center" }, resetPosBtn, moveToggle)),
  );

  // Auto Start (automatically start when system On)
  const autostartSwitch = h("button", {
    class: "switch",
    title: "Auto Start",
    onclick: () => {
      State.settings.autostart = !State.settings.autostart;
      autostartSwitch.classList.toggle("on", State.settings.autostart);
      void Bridge.saveSettings(State.settings);
      State.notify();
    },
  });

  // Sound & Auto-close
  const soundSwitch = h("button", { class: "switch", onclick: () => actions.toggleSound() });
  const volume = h("input", {
    type: "range", min: "0", max: "0.2", step: "0.005",
    oninput: (e: Event) => actions.setVolume(Number((e.target as HTMLInputElement).value)),
  }) as HTMLInputElement;
  const autoLabel = h("span", {});
  const segButtons = [10, 15, 30].map((s) =>
    h("button", { onclick: () => actions.setAutoClose(s) }, `${s}s`),
  );

  const generalSection = h(
    "div",
    { class: "mini-section" },
    h(
      "div",
      { class: "mini-row", style: "margin-bottom:4px" },
      h("span", { class: "mini-section-title", text: "Window Controls", style: "margin-bottom:0" }),
      h("div", { class: "grow" }),
      h("span", { style: "font-size:11px;color:#8e8e93;margin-right:6px", text: "Show on Island" }),
      windowControlsSwitch,
    ),
    windowGrid,
    h(
      "div",
      { class: "mini-row", style: "margin-top:6px" },
      h("span", { text: "Auto Start (start when system boots)" }),
      autostartSwitch,
    ),
    h(
      "div",
      { class: "mini-row", style: "margin-top:4px" },
      h("span", { text: tl("Sound") }),
      volume,
      h("div", { class: "grow" }),
      autoLabel,
      h("div", { class: "seg" }, ...segButtons),
      soundSwitch,
    ),
    h(
      "div",
      { class: "mini-row mini-additional-settings-row", style: "margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);flex-direction:column;gap:6px" },
      h("button", {
        class: "link-btn",
        style: "display:flex;align-items:center;width:100%;justify-content:space-between;padding:4px 0;font-size:12px;color:#fff",
        onclick: () => actions.openSettingsWindow(),
      },
        h("span", { style: "font-weight:500", text: "Additional Settings" }),
        h("span", { style: "font-size:11px;color:#8e8e93", text: "Open Full Settings Window ↗" }),
      ),
      h("button", {
        class: "link-btn",
        style: "display:flex;align-items:center;width:100%;justify-content:space-between;padding:4px 0;font-size:12px;color:#38bdf8",
        onclick: () => {
          void Bridge.openUrl("http://localhost:1420/settings.html");
          if (typeof window !== "undefined" && !(" __TAURI_INTERNALS__" in window)) {
            window.open("http://localhost:1420/settings.html", "_blank");
          }
        },
      },
        h("span", { style: "font-weight:500;display:flex;align-items:center;gap:6px" },
          h("span", { style: "display:inline-block;width:6px;height:6px;border-radius:50%;background:#38bdf8;box-shadow:0 0 6px #38bdf8" }),
          h("span", { text: "Localhost Version" })
        ),
        h("span", { style: "font-size:11px;color:#38bdf8", text: "Open http://localhost:1420 ↗" }),
      ),
    ),
  );

  // ── Appearance Section ──
  // Bot style
  const botStyles: Array<"circle" | "classic" | "minimal"> = ["circle", "classic", "minimal"];
  const botStyleLabels = ["Circle", "Classic", "Minimal"];
  const botStyleBtns = botStyles.map((style, idx) =>
    h(
      "button",
      {
        class: State.botStyle === style ? "on" : "",
        onclick: () => {
          State.botStyle = style;
          botStyleBtns.forEach((b, i) => b.classList.toggle("on", botStyles[i] === style));
          State.notify();
        },
      },
      botStyleLabels[idx],
    ),
  );

  // Color swatches
  const SWATCH_COLORS = ["#ffffff", "#22C55E", "#38BDF8", "#F59E0B", "#A855F7", "#EC4899"];
  const swatchEls = SWATCH_COLORS.map((c) =>
    h("button", {
      class: `mini-swatch${(State.botColor ?? "#ffffff") === c ? " active" : ""}`,
      style: `background:${c}`,
      onclick: () => {
        State.botColor = c;
        swatchEls.forEach((el, i) => el.classList.toggle("active", SWATCH_COLORS[i] === c));
        document.documentElement.style.setProperty("--theme-accent", c);
        State.notify();
      },
    }),
  );

  // Appearance themes
  const themes = ["Dark", "AMOLED", "Glass"];
  const themeBtns = themes.map((name) =>
    h(
      "button",
      {
        onclick: () => {
          themeBtns.forEach((b, i) => b.classList.toggle("on", themes[i] === name));
          const island = document.getElementById("island");
          if (island) {
            if (name === "AMOLED") {
              island.style.background = "#000000";
              island.style.backdropFilter = "none";
            } else if (name === "Glass") {
              island.style.background = "rgba(16, 16, 20, 0.75)";
              island.style.backdropFilter = "blur(20px)";
            } else {
              island.style.background = "#000000";
              island.style.backdropFilter = "none";
            }
          }
        },
      },
      name,
    ),
  );
  themeBtns[0].classList.add("on");

  // Opacity [ linear btn ]
  let currentOpacity = 1.0;
  const opacityVal = h("span", {
    style: "font-variant-numeric:tabular-nums;min-width:32px;text-align:right",
    text: "100%",
  });
  const opacityRange = h("input", {
    type: "range",
    min: "0.25",
    max: "1.0",
    step: "0.05",
    value: "1.0",
    style: "width:80px",
    oninput: (e: Event) => {
      applyOpacity(Number((e.target as HTMLInputElement).value));
    },
  }) as HTMLInputElement;

  const linearPresets = [0.5, 0.75, 0.9, 1.0];
  const linearBtns = ["50%", "75%", "90%", "100%"].map((label, idx) =>
    h(
      "button",
      {
        class: linearPresets[idx] === currentOpacity ? "on" : "",
        onclick: () => applyOpacity(linearPresets[idx]),
      },
      label,
    ),
  );

  function applyOpacity(val: number) {
    currentOpacity = val;
    opacityRange.value = String(val);
    opacityVal.textContent = `${Math.round(val * 100)}%`;
    linearBtns.forEach((b, idx) => b.classList.toggle("on", linearPresets[idx] === val));
    const island = document.getElementById("island");
    if (island) island.style.opacity = String(val);
  }

  const appearanceSection = h(
    "div",
    { class: "mini-section", style: "display:none" },
    h(
      "div",
      { class: "mini-row" },
      h("span", { class: "mini-row-label", text: "Bot Style" }),
      h("div", { class: "seg" }, ...botStyleBtns),
    ),
    h(
      "div",
      { class: "mini-row" },
      h("span", { class: "mini-row-label", text: tl("Color") }),
      h("div", { class: "mini-swatch-list" }, ...swatchEls),
    ),
    h(
      "div",
      { class: "mini-row" },
      h("span", { class: "mini-row-label", text: "Appearance" }),
      h("div", { class: "seg" }, ...themeBtns),
    ),
    h(
      "div",
      { class: "mini-row" },
      h("span", { class: "mini-row-label", text: "Opacity" }),
      h("div", { class: "linear-btn-group" }, ...linearBtns),
      opacityRange,
      opacityVal,
    ),
  );

  // ── System Access Section ──
  // Toggles for each module (ALL RIGHT-ALIGNED)
  const clipSwitch = h("button", {
    class: `switch ${State.systemAccessModules.clipboard ? "on" : ""}`,
    title: "Toggle Clipboard Monitoring",
    onclick: () => {
      State.systemAccessModules.clipboard = !State.systemAccessModules.clipboard;
      clipSwitch.classList.toggle("on", State.systemAccessModules.clipboard);
      State.saveSystemAccessModules();
    },
  });

  const audioSwitch = h("button", {
    class: `switch ${State.systemAccessModules.audio ? "on" : ""}`,
    title: "Toggle Audio Tracker",
    onclick: () => {
      State.systemAccessModules.audio = !State.systemAccessModules.audio;
      audioSwitch.classList.toggle("on", State.systemAccessModules.audio);
      State.saveSystemAccessModules();
    },
  });

  const notifSwitch = h("button", {
    class: `switch ${State.systemAccessModules.notifications ? "on" : ""}`,
    title: "Toggle Notifications",
    onclick: () => {
      State.systemAccessModules.notifications = !State.systemAccessModules.notifications;
      notifSwitch.classList.toggle("on", State.systemAccessModules.notifications);
      State.saveSystemAccessModules();
    },
  });

  const deviceSwitch = h("button", {
    class: `switch ${State.systemAccessModules.deviceAlerts ? "on" : ""}`,
    title: "Toggle Device Alerts",
    onclick: () => {
      State.systemAccessModules.deviceAlerts = !State.systemAccessModules.deviceAlerts;
      deviceSwitch.classList.toggle("on", State.systemAccessModules.deviceAlerts);
      State.saveSystemAccessModules();
    },
  });

  const monitorSwitch = h("button", {
    class: `switch ${State.systemAccessModules.monitoring ? "on" : ""}`,
    title: "Toggle Hardware System Monitoring",
    onclick: () => {
      State.systemAccessModules.monitoring = !State.systemAccessModules.monitoring;
      monitorSwitch.classList.toggle("on", State.systemAccessModules.monitoring);
      State.saveSystemAccessModules();
      monitorDualView.style.display = State.systemAccessModules.monitoring ? "grid" : "none";
    },
  });

  // Real system labels (clean typography without green dots)
  const networkStatusLabel = h("span", { class: "network-status-label", style: "font-weight:500;font-size:12px" });
  const systemDeviceLabel = h("span", { style: "font-size:11px;color:#8e8e93" });
  const realAudioDetail = h("span", { style: "font-size:11px;color:#8e8e93;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px" });
  const realClipDetail = h("span", { style: "font-size:11px;color:#8e8e93;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px" });

  const testCopyBtn = h("button", {
    class: "link-btn",
    text: "Test Copy",
    onclick: () => SystemAccess.recordCopy("https://github.com/Sudhan-2603/Day"),
  });
  const openAudioBtn = h("button", {
    class: "link-btn",
    text: "Audio View ↗",
    onclick: () => actions.setView("audio"),
  });
  const testNotifBtn = h("button", {
    class: "link-btn",
    text: "Test Alert",
    onclick: () => SystemAccess.postNotification({
      app: "Workstation",
      title: "System Access Ready",
      body: "Modules dynamically resize the Island and monitor your device locally.",
      time: t("now"),
    }),
  });
  const testWifiBtn = h("button", {
    class: "link-btn",
    text: "Test Wi-Fi",
    onclick: () => {
      const net = SystemAccess.realSystemInfo?.network_name || "Wi-Fi";
      SystemAccess.triggerDeviceAlert("wifi", net, "connected");
    },
  });
  const testBleBtn = h("button", {
    class: "link-btn",
    text: "Test BT",
    onclick: () => SystemAccess.triggerDeviceAlert("bluetooth", "Bluetooth Audio", "connected"),
  });

  // ── Real Hardware System Monitoring (Dual Sided: Left and Right) ──
  const cpuPercentVal = h("span", { class: "system-monitor-val", text: "Loading..." });
  const cpuFill = h("div", { class: "metric-bar-fill", style: "width:15%" });
  const ramVal = h("span", { class: "system-monitor-val", text: "Loading..." });
  const ramFill = h("div", { class: "metric-bar-fill", style: "width:50%" });
  const storageVal = h("span", { class: "system-monitor-val", text: "Loading..." });
  const storageFill = h("div", { class: "metric-bar-fill", style: "width:65%" });

  const gpuVal = h("span", { class: "system-monitor-val", text: "Detecting..." });
  const networkVal = h("span", { class: "system-monitor-val", text: "Active" });
  const hostVal = h("span", { class: "system-monitor-val", text: "Windows PC" });

  const monitorDualView = h(
    "div",
    { class: "system-monitor-dual" },
    // Left Side View: CPU, RAM, Storage
    h(
      "div",
      { class: "system-monitor-side" },
      h("div", { class: "system-monitor-card" },
        h("div", { class: "system-monitor-title" }, h("span", { text: " CPU Load" }), cpuPercentVal),
        h("div", { class: "metric-bar-bg" }, cpuFill),
      ),
      h("div", { class: "system-monitor-card" },
        h("div", { class: "system-monitor-title" }, h("span", { text: " RAM Memory" }), ramVal),
        h("div", { class: "metric-bar-bg" }, ramFill),
      ),
      h("div", { class: "system-monitor-card" },
        h("div", { class: "system-monitor-title" }, h("span", { text: " Storage (C:)" }), storageVal),
        h("div", { class: "metric-bar-bg" }, storageFill),
      ),
    ),
    // Right Side View: GPU, Network, Workstation Host
    h(
      "div",
      { class: "system-monitor-side" },
      h("div", { class: "system-monitor-card" },
        h("div", { class: "system-monitor-title" }, h("span", { text: " GPU Graphics" })),
        gpuVal,
      ),
      h("div", { class: "system-monitor-card" },
        h("div", { class: "system-monitor-title" }, h("span", { text: " Network Traffic" })),
        networkVal,
      ),
      h("div", { class: "system-monitor-card" },
        h("div", { class: "system-monitor-title" }, h("span", { text: " Workstation Host" })),
        hostVal,
      ),
    ),
  );

  const systemSection = h(
    "div",
    { class: "mini-section", style: "display:none" },
    h(
      "div",
      { class: "mini-row", style: "margin-bottom:6px" },
      h("span", { class: "mini-row-label", text: "System Info" }),
      networkStatusLabel,
      h("div", { class: "grow" }),
      systemDeviceLabel,
    ),
    h(
      "div",
      { class: "mini-row" },
      h("div", { style: "display:flex;align-items:center;gap:6px" },
        h("span", { class: "mini-row-label", text: " Clipboard" }),
        realClipDetail,
      ),
      h("div", { style: "display:flex;align-items:center;gap:8px;margin-left:auto" },
        testCopyBtn,
        clipSwitch,
      ),
    ),
    h(
      "div",
      { class: "mini-row" },
      h("div", { style: "display:flex;align-items:center;gap:6px" },
        h("span", { class: "mini-row-label", text: " Audio Tracker" }),
        realAudioDetail,
      ),
      h("div", { style: "display:flex;align-items:center;gap:8px;margin-left:auto" },
        openAudioBtn,
        audioSwitch,
      ),
    ),
    h(
      "div",
      { class: "mini-row" },
      h("div", { style: "display:flex;align-items:center;gap:6px" },
        h("span", { class: "mini-row-label", text: " Notification" }),
        h("span", { style: "font-size:10.5px;color:#8e8e93", text: "Expands Island" }),
      ),
      h("div", { style: "display:flex;align-items:center;gap:8px;margin-left:auto" },
        testNotifBtn,
        notifSwitch,
      ),
    ),
    h(
      "div",
      { class: "mini-row" },
      h("div", { style: "display:flex;align-items:center;gap:6px" },
        h("span", { class: "mini-row-label", text: " Device Radar" }),
      ),
      h("div", { style: "display:flex;align-items:center;gap:8px;margin-left:auto" },
        testWifiBtn,
        testBleBtn,
        deviceSwitch,
      ),
    ),
    h(
      "div",
      { class: "mini-row", style: "margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06)" },
      h("div", { style: "display:flex;align-items:center;gap:6px" },
        h("span", { class: "mini-row-label", text: " System Monitoring" }),
        h("span", { style: "font-size:10.5px;color:#8e8e93", text: "Real Hardware Telemetry" }),
      ),
      monitorSwitch,
    ),
    monitorDualView,
  );

  function setTab(tab: "general" | "appearance" | "system") {
    tabGeneral.classList.toggle("active", tab === "general");
    tabAppearance.classList.toggle("active", tab === "appearance");
    tabSystem.classList.toggle("active", tab === "system");
    generalSection.style.display = tab === "general" ? "flex" : "none";
    appearanceSection.style.display = tab === "appearance" ? "flex" : "none";
    systemSection.style.display = tab === "system" ? "flex" : "none";
    if (tab === "system") {
      void refreshMetrics();
    }
  }

  let metricsTimer: number | null = null;
  async function refreshMetrics() {
    try {
      const m = await Bridge.getSystemMetrics();
      if (m) {
        cpuPercentVal.textContent = `${m.cpu_percent}%`;
        cpuFill.style.width = `${Math.min(100, Math.max(0, m.cpu_percent))}%`;
        ramVal.textContent = `${m.ram_used_gb} / ${m.ram_total_gb} GB (${m.ram_percent}%)`;
        ramFill.style.width = `${Math.min(100, Math.max(0, m.ram_percent))}%`;
        storageVal.textContent = `${m.storage_used_gb} / ${m.storage_total_gb} GB (${m.storage_percent}%)`;
        storageFill.style.width = `${Math.min(100, Math.max(0, m.storage_percent))}%`;
        gpuVal.textContent = m.gpu_name || "Integrated Graphics";
        networkVal.textContent = `RX: ${m.network_rx_mb} MB | TX: ${m.network_tx_mb} MB`;
        const sys = SystemAccess.realSystemInfo;
        hostVal.textContent = sys?.computer_name
          ? (sys.battery_level != null ? `${sys.computer_name} (${sys.battery_level}% )` : sys.computer_name)
          : "Windows 11 Workstation";
      }
    } catch { }
  }

  const contentArea = h("div", { class: "mini-settings-content" }, generalSection, appearanceSection, systemSection);
  const container = h("div", { class: "mini-settings-container" }, sidebar, contentArea);

  const el = h(
    "div",
    { class: "view" },
    card(null, h("div", { class: "stack", style: "padding:8px 12px 8px 76px;height:100%;box-sizing:border-box" }, container)),
  );

  return {
    el,
    sync() {
      const s = State.settings;
      soundSwitch.classList.toggle("on", s.soundEnabled);
      volume.value = String(s.soundVolume);
      volume.style.opacity = s.soundEnabled ? "1" : "0.4";
      autoLabel.textContent = t("Auto-close · {seconds}s", { seconds: Math.round(s.autoCloseInterval) });
      segButtons.forEach((b, i) => b.classList.toggle("on", s.autoCloseInterval === [10, 15, 30][i]));
      maxToggle.classList.toggle("on", State.mode === "expanded");
      windowControlsSwitch.classList.toggle("on", State.showIslandWindowControls);
      autostartSwitch.classList.toggle("on", s.autostart);
      botStyleBtns.forEach((b, i) => b.classList.toggle("on", botStyles[i] === State.botStyle));
      swatchEls.forEach((el, i) => el.classList.toggle("active", SWATCH_COLORS[i] === (State.botColor ?? "#ffffff")));

      // Sync System Access toggles
      clipSwitch.classList.toggle("on", State.systemAccessModules.clipboard);
      audioSwitch.classList.toggle("on", State.systemAccessModules.audio);
      notifSwitch.classList.toggle("on", State.systemAccessModules.notifications);
      deviceSwitch.classList.toggle("on", State.systemAccessModules.deviceAlerts);
      monitorSwitch.classList.toggle("on", State.systemAccessModules.monitoring);
      monitorDualView.style.display = State.systemAccessModules.monitoring ? "grid" : "none";

      // Real system info text (no green dots!)
      const sys = SystemAccess.realSystemInfo;
      const online = !State.isOffline;
      const netName = sys?.network_name || (online ? "Connected" : "Disconnected");
      const netType = sys?.network_type || (online ? "Network" : "Offline");
      networkStatusLabel.textContent = online ? `${netType}: ${netName}` : "Offline Mode";
      networkStatusLabel.style.color = online ? "#ffffff" : "#f59e0b";

      if (sys?.battery_level != null) {
        systemDeviceLabel.textContent = `${sys.computer_name} • ${sys.battery_level}% 🔋`;
      } else if (sys?.computer_name) {
        systemDeviceLabel.textContent = `${sys.computer_name}`;
      }

      // Real audio track summary
      const track = SystemAccess.audioTrack;
      realAudioDetail.textContent = track.playing
        ? `▶ ${track.title}`
        : track.title && track.title !== "No media playing"
          ? `⏸ ${track.title}`
          : "Idle";

      // Real clipboard summary
      const clip = SystemAccess.activeClipboard;
      realClipDetail.textContent = clip?.text ? `"${clip.text.slice(0, 18)}..."` : "Empty";

      if (systemSection.style.display !== "none" && State.systemAccessModules.monitoring) {
        if (!metricsTimer) {
          void refreshMetrics();
          metricsTimer = window.setInterval(() => void refreshMetrics(), 2500);
        }
      } else if (metricsTimer) {
        window.clearInterval(metricsTimer);
        metricsTimer = null;
      }
    },
  };
}

// ── Audio Tracker View ────────────────────────────────────────────────────────

function buildAudioView(_actions: ViewActions): ViewHost {
  const tracker = buildAudioTrackerCard();
  const el = h(
    "div",
    { class: "view audio" },
    card(null, h("div", { class: "stack", style: "padding:6px 12px 6px 76px;height:100%;box-sizing:border-box" }, tracker.el)),
  );
  return {
    el,
    sync() {
      tracker.sync(SystemAccess.audioTrack);
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
  return { el: h("div", { class: "view" }, card(null, body)), sync() { } };
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
  map.set("update", buildUpdate());
  map.set("whatsNew", buildWhatsNew());
  map.set("launch", buildLaunch(actions));
  map.set("audio", buildAudioView(actions));
  // Not in the Windows v1: sending a file by email, window attach + web result.
  map.set("mail", buildPlaceholder(tl("Sending by email isn't in this version."), ""));
  map.set("searching", buildPlaceholder(tl("Claude is searching…"), ""));
  map.set("result", buildPlaceholder(tl("Result"), ""));
  return map;
}
