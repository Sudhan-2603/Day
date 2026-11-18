// Dynamic Island System Alerts & Interactive Action Pills
// 1. System Notification Overlay (with detail expansion)
// 2. Device Connection Pill (Wi-Fi & Bluetooth radar animations + success checkmark)
// 3. Clipboard Action Toast Pill (interactive Ask Day / Copy / Dismiss)

import { h, svg, clear } from "./dom";
import { ICONS } from "./icons";
import { SystemAccess, type DeviceAlert, type SystemNotification, type ClipboardItem } from "../island/system-access";
import { tl } from "../i18n/i18n";

/**
 * Builds the Device Connection Notification Overlay (Wi-Fi / Bluetooth)
 * Displays concentric pulsing radar rings, device title, and glowing success badge
 */
export function buildDeviceAlertView(): HTMLElement {
  const iconContainer = h("div", { class: "device-radar-icon" });
  const ring1 = h("div", { class: "radar-ring ring-1" });
  const ring2 = h("div", { class: "radar-ring ring-2" });
  const iconCenter = h("div", { class: "radar-center" });
  iconContainer.append(ring1, ring2, iconCenter);

  const titleEl = h("div", { class: "device-alert-title", text: "Wi-Fi Connected" });
  const subEl = h("div", { class: "device-alert-sub", text: "Fast Internet 5G" });
  const textBox = h("div", { class: "device-alert-text" }, titleEl, subEl);

  const checkBadge = h("div", { class: "device-success-badge" }, svg(ICONS.check, 12, { stroke: 2.2 }));

  const overlay = h(
    "div",
    {
      class: "island-device-alert-pill",
      onclick: () => {
        SystemAccess.triggerDeviceAlert("wifi", "", "disconnected");
      },
    },
    iconContainer,
    textBox,
    checkBadge,
  );

  SystemAccess.onDeviceChange((alert: DeviceAlert | null) => {
    if (!alert) {
      overlay.classList.remove("visible");
      return;
    }

    clear(iconCenter);
    if (alert.type === "wifi") {
      iconCenter.append(svg(ICONS.wifi, 16));
      titleEl.textContent = alert.status === "connected" ? "Wi-Fi Connected" : "Wi-Fi Disconnected";
      subEl.textContent = alert.name || "Local Network (Connected)";
    } else {
      iconCenter.append(svg(ICONS.bluetooth, 16));
      titleEl.textContent = alert.status === "connected" ? "Bluetooth Connected" : "Bluetooth Disconnected";
      subEl.textContent = alert.name || "Accessory Paired";
    }

    checkBadge.style.display = alert.status === "connected" ? "grid" : "none";
    overlay.classList.add("visible");
  });

  return overlay;
}

/**
 * Builds the System Notification Banner Overlay with expandable full details
 */
export function buildNotificationOverlay(onExpand?: () => void): HTMLElement {
  const iconEl = h("div", { class: "notif-app-icon" }, svg(ICONS.bell, 16));
  const appEl = h("span", { class: "notif-app-name", text: tl("System") });
  const timeEl = h("span", { class: "notif-time", text: tl("now") });
  const topRow = h("div", { class: "notif-top" }, appEl, timeEl);

  const titleEl = h("div", { class: "notif-title", text: "Notification" });
  const bodyEl = h("div", { class: "notif-body", text: "" });

  const dismissBtn = h(
    "button",
    {
      class: "notif-btn dismiss",
      title: "Dismiss",
      onclick: (e) => {
        e.stopPropagation();
        SystemAccess.dismissNotification();
      },
    },
    svg(ICONS.xmark, 10),
  );

  const viewDetailsBtn = h(
    "button",
    {
      class: "notif-btn expand-btn",
      text: "View Details",
      onclick: (e) => {
        e.stopPropagation();
        if (overlay.classList.contains("expanded")) {
          overlay.classList.remove("expanded");
        } else {
          overlay.classList.add("expanded");
          onExpand?.();
        }
      },
    },
  );

  const actionsRow = h("div", { class: "notif-actions" }, viewDetailsBtn, dismissBtn);

  const contentCol = h("div", { class: "notif-content" }, topRow, titleEl, bodyEl, actionsRow);

  const overlay = h(
    "div",
    {
      class: "island-notification-overlay",
      onclick: () => {
        overlay.classList.toggle("expanded");
        onExpand?.();
      },
    },
    iconEl,
    contentCol,
  );

  SystemAccess.onNotificationChange((n: SystemNotification | null) => {
    if (!n) {
      overlay.classList.remove("visible", "expanded");
      return;
    }

    appEl.textContent = n.app;
    timeEl.textContent = n.time;
    titleEl.textContent = n.title;
    bodyEl.textContent = n.body;
    overlay.classList.add("visible");
    if (n.expanded) {
      overlay.classList.add("expanded");
    }
  });

  return overlay;
}

/**
 * Builds the Clipboard Action Toast Pill
 * Appears when copy is detected with a preview and quick action buttons
 */
export function buildClipboardActionOverlay(onAskDay: (text: string) => void): HTMLElement {
  const icon = h("span", { class: "clip-icon" }, svg(ICONS.clipboard, 14));
  const label = h("span", { class: "clip-label", text: "Copied:" });
  const preview = h("span", { class: "clip-preview", text: "" });

  const askBtn = h(
    "button",
    {
      class: "clip-btn ask-day-btn",
      title: "Send copied text to Day chat",
      onclick: (e) => {
        e.stopPropagation();
        if (SystemAccess.activeClipboard) {
          onAskDay(SystemAccess.activeClipboard.text);
          SystemAccess.dismissClipboard();
        }
      },
    },
    svg(ICONS.bubbleRound, 12),
    h("span", { text: "Ask Day" }),
  );

  const dismissBtn = h(
    "button",
    {
      class: "clip-btn close-btn",
      title: "Dismiss",
      onclick: (e) => {
        e.stopPropagation();
        SystemAccess.dismissClipboard();
      },
    },
    svg(ICONS.xmark, 10),
  );

  const pill = h(
    "div",
    { class: "island-clipboard-action-pill" },
    icon,
    label,
    preview,
    askBtn,
    dismissBtn,
  );

  SystemAccess.onClipboardChange((item: ClipboardItem | null) => {
    if (!item) {
      pill.classList.remove("visible");
      return;
    }
    const maxLen = 32;
    preview.textContent = item.text.length > maxLen ? `${item.text.slice(0, maxLen)}...` : item.text;
    pill.classList.add("visible");
  });

  return pill;
}
