// Modern Large Settings Window matching reference layout
import "./large-settings.css";
import { Bridge } from "../core/bridge";
import { DEFAULT_SETTINGS, type Settings } from "../core/state";

let settings: Settings = { ...DEFAULT_SETTINGS };

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const SVG_ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  viewSite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 9h16"/><path d="M9 20V9"/></svg>`,
  externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  posts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  pages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  performance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  tags: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  members: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  appearance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 0 0 0 14v6"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  support: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  burstLogo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
  check: `<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd"/></svg>`,
};

// ── State Variables ───────────────────────────────────────────────────────────

const BRAND_COLORS = [
  "#7C3AED", // Purple
  "#4F46E5", // Indigo
  "#2563EB", // Blue
  "#0EA5E9", // Sky Blue
  "#06B6D4", // Cyan
  "#10B981", // Green
];

let selectedColor = "#2C68F6";
let selectedTheme: "system" | "light" | "dark" = "system";
let transparentSidebar = true;
let selectedTable: "default" | "compact" = "default";
let sidebarFeature = "Recent changes";

// ── Render Function ───────────────────────────────────────────────────────────

function renderSettingsUI() {
  const root = document.getElementById("settings-root") || document.getElementById("hub") || document.body;
  root.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "settings-window-wrap";

  // ── Left Sidebar ────────────────────────────────────────────────────────────
  const sidebar = document.createElement("aside");
  sidebar.className = "settings-sidebar-container";
  sidebar.innerHTML = `
    <div class="sidebar-profile-box">
      <div class="profile-avatar-wrapper">
        <svg viewBox="0 0 36 36" width="34" height="34">
          <circle cx="18" cy="18" r="18" fill="#FBCFE8"/>
          <circle cx="18" cy="14" r="7" fill="#F472B6"/>
          <path d="M7 32c0-6.075 4.925-11 11-11s11 4.925 11 11" fill="#F472B6"/>
        </svg>
      </div>
      <span class="profile-name-text">Mathilde Lewis</span>
      <button class="btn-sidebar-more" title="Profile options">⋮</button>
    </div>

    <nav class="sidebar-menu-list">
      <button class="menu-item-btn" data-page="dashboard">
        <span class="menu-icon">${SVG_ICONS.dashboard}</span>
        <span class="menu-label">Dashboard</span>
      </button>

      <button class="menu-item-btn" data-page="viewSite">
        <span class="menu-icon">${SVG_ICONS.viewSite}</span>
        <span class="menu-label">View site</span>
        <span class="menu-ext-icon">${SVG_ICONS.externalLink}</span>
      </button>

      <div class="menu-section-header">
        <span class="menu-icon">${SVG_ICONS.posts}</span>
        <span class="menu-label">Posts</span>
      </div>
      <div class="menu-sub-list">
        <button class="menu-sub-item">
          <span>Drafts</span>
          <span class="menu-badge">22</span>
        </button>
        <button class="menu-sub-item">
          <span>Scheduled</span>
          <span class="menu-badge">16</span>
        </button>
        <button class="menu-sub-item">
          <span>Published</span>
          <span class="menu-badge">64</span>
        </button>
      </div>

      <button class="menu-item-btn" data-page="pages">
        <span class="menu-icon">${SVG_ICONS.pages}</span>
        <span class="menu-label">Pages</span>
        <span class="menu-add-icon">+</span>
      </button>

      <button class="menu-item-btn" data-page="performance">
        <span class="menu-icon">${SVG_ICONS.performance}</span>
        <span class="menu-label">Performance</span>
      </button>

      <button class="menu-item-btn" data-page="tags">
        <span class="menu-icon">${SVG_ICONS.tags}</span>
        <span class="menu-label">Tags</span>
      </button>

      <button class="menu-item-btn" data-page="members">
        <span class="menu-icon">${SVG_ICONS.members}</span>
        <span class="menu-label">Members</span>
      </button>

      <button class="menu-item-btn active" data-page="appearance">
        <span class="menu-icon">${SVG_ICONS.appearance}</span>
        <span class="menu-label">Appearance</span>
      </button>

      <button class="menu-item-btn" data-page="settings">
        <span class="menu-icon">${SVG_ICONS.settings}</span>
        <span class="menu-label">Settings</span>
      </button>
    </nav>

    <div class="sidebar-bottom-block">
      <button class="menu-item-btn" data-page="support">
        <span class="menu-icon">${SVG_ICONS.support}</span>
        <span class="menu-label">Support</span>
      </button>
      <button class="menu-item-btn" data-page="settings-bottom">
        <span class="menu-icon">${SVG_ICONS.settings}</span>
        <span class="menu-label">Settings</span>
      </button>
    </div>
  `;

  // ── Main Panel ──────────────────────────────────────────────────────────────
  const main = document.createElement("main");
  main.className = "settings-main-panel";

  main.innerHTML = `
    <header class="settings-content-header">
      <h1 class="settings-page-heading">Appearance</h1>
      <button class="btn-header-more" title="More options">⋮</button>
    </header>

    <div class="settings-rows-list">
      <!-- 1. Company logo -->
      <div class="settings-row">
        <div class="row-label-col">
          <h3 class="row-title">Company logo</h3>
          <p class="row-desc">Update your company logo.</p>
        </div>
        <div class="row-control-col">
          <div class="logo-control-wrap">
            <div class="logo-display-box" id="logo-display-box">
              <span class="logo-icon-svg">${SVG_ICONS.burstLogo}</span>
            </div>
            <button class="btn-replace-logo" id="btn-replace-logo">Replace logo</button>
            <button class="btn-remove-logo" id="btn-remove-logo">Remove</button>
          </div>
        </div>
      </div>

      <!-- 2. Brand color -->
      <div class="settings-row">
        <div class="row-label-col">
          <h3 class="row-title">Brand color</h3>
          <p class="row-desc">Select or customize your brand color.</p>
        </div>
        <div class="row-control-col">
          <div class="brand-color-wrap">
            <div class="brand-swatches-row" id="brand-swatches-row"></div>
            <div class="custom-color-control">
              <span class="custom-color-txt">Custom color:</span>
              <input type="text" class="custom-color-input-box" id="custom-color-input" value="${selectedColor}" />
              <div class="custom-color-ring" id="custom-color-ring">
                <span class="custom-color-inner-dot" id="custom-color-inner-dot" style="background:${selectedColor}"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Interface theme -->
      <div class="settings-row">
        <div class="row-label-col">
          <h3 class="row-title">Interface theme</h3>
          <p class="row-desc">Select or customize your UI theme.</p>
        </div>
        <div class="row-control-col">
          <div class="theme-selector-grid">
            <!-- System Preference -->
            <div class="theme-card-option ${selectedTheme === "system" ? "active" : ""}" data-theme="system">
              <div class="theme-preview-card">
                <div class="split-system-box">
                  <div class="split-left-light">
                    <div class="mini-side-bar">
                      <div class="mini-skeleton-line" style="width:70%"></div>
                      <div class="mini-skeleton-line" style="width:85%"></div>
                      <div class="mini-skeleton-line" style="width:60%"></div>
                    </div>
                    <div class="mini-content-area">
                      <div class="mini-skeleton-line" style="width:40%"></div>
                      <div class="mini-skeleton-card"></div>
                    </div>
                  </div>
                  <div class="split-right-dark">
                    <div class="mini-side-bar dark">
                      <div class="mini-skeleton-line dark" style="width:70%"></div>
                      <div class="mini-skeleton-line dark" style="width:85%"></div>
                      <div class="mini-skeleton-line dark" style="width:60%"></div>
                    </div>
                    <div class="mini-content-area">
                      <div class="mini-skeleton-line dark" style="width:40%"></div>
                      <div class="mini-skeleton-card dark"></div>
                    </div>
                  </div>
                </div>
                ${selectedTheme === "system" ? `<span class="theme-check-badge">${SVG_ICONS.check}</span>` : ""}
              </div>
              <span class="theme-option-name">System preference</span>
            </div>

            <!-- Light -->
            <div class="theme-card-option ${selectedTheme === "light" ? "active" : ""}" data-theme="light">
              <div class="theme-preview-card">
                <div class="pure-light-box">
                  <div class="mini-side-bar">
                    <div class="mini-skeleton-line" style="width:70%"></div>
                    <div class="mini-skeleton-line" style="width:85%"></div>
                    <div class="mini-skeleton-line" style="width:60%"></div>
                  </div>
                  <div class="mini-content-area">
                    <div class="mini-skeleton-line" style="width:40%"></div>
                    <div class="mini-skeleton-card"></div>
                  </div>
                </div>
                ${selectedTheme === "light" ? `<span class="theme-check-badge">${SVG_ICONS.check}</span>` : ""}
              </div>
              <span class="theme-option-name">Light</span>
            </div>

            <!-- Dark -->
            <div class="theme-card-option ${selectedTheme === "dark" ? "active" : ""}" data-theme="dark">
              <div class="theme-preview-card">
                <div class="pure-dark-box">
                  <div class="mini-side-bar dark">
                    <div class="mini-skeleton-line dark" style="width:70%"></div>
                    <div class="mini-skeleton-line dark" style="width:85%"></div>
                    <div class="mini-skeleton-line dark" style="width:60%"></div>
                  </div>
                  <div class="mini-content-area">
                    <div class="mini-skeleton-line dark" style="width:40%"></div>
                    <div class="mini-skeleton-card dark"></div>
                  </div>
                </div>
                ${selectedTheme === "dark" ? `<span class="theme-check-badge">${SVG_ICONS.check}</span>` : ""}
              </div>
              <span class="theme-option-name">Dark</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Transparent sidebar -->
      <div class="settings-row">
        <div class="row-label-col">
          <h3 class="row-title">Transparent sidebar</h3>
          <p class="row-desc">Make the desktop sidebar transparent.</p>
        </div>
        <div class="row-control-col">
          <button class="ios-switch-btn ${transparentSidebar ? "on" : ""}" id="toggle-transparent-sidebar">
            <span class="ios-switch-knob"></span>
          </button>
        </div>
      </div>

      <!-- 5. Sidebar feature -->
      <div class="settings-row">
        <div class="row-label-col">
          <h3 class="row-title">Sidebar feature</h3>
          <p class="row-desc">What shows in the desktop sidebar.</p>
        </div>
        <div class="row-control-col">
          <div class="feature-dropdown-box" id="feature-dropdown-box">
            <div class="feature-dropdown-left">
              <span class="status-dot-green"></span>
              <span id="feature-dropdown-text">${sidebarFeature}</span>
            </div>
            <span class="dropdown-chevron-icon">▼</span>
          </div>
        </div>
      </div>

      <!-- 6. Tables view -->
      <div class="settings-row">
        <div class="row-label-col">
          <h3 class="row-title">Tables view</h3>
          <p class="row-desc">How tables are displayed in the app.</p>
        </div>
        <div class="row-control-col">
          <div class="tables-selector-grid">
            <!-- Default -->
            <div class="table-card-option ${selectedTable === "default" ? "active" : ""}" data-table="default">
              <div class="table-preview-card">
                <div class="mini-table-header">Customer</div>
                <div class="mini-table-rows">
                  <div class="mini-t-row"><span class="mini-t-dot"></span><span class="mini-t-bar"></span></div>
                  <div class="mini-t-row"><span class="mini-t-dot"></span><span class="mini-t-bar"></span></div>
                  <div class="mini-t-row"><span class="mini-t-dot"></span><span class="mini-t-bar"></span></div>
                  <div class="mini-t-row"><span class="mini-t-dot"></span><span class="mini-t-bar"></span></div>
                </div>
                ${selectedTable === "default" ? `<span class="theme-check-badge">${SVG_ICONS.check}</span>` : ""}
              </div>
              <span class="table-option-name">Default</span>
            </div>

            <!-- Compact -->
            <div class="table-card-option ${selectedTable === "compact" ? "active" : ""}" data-table="compact">
              <div class="table-preview-card">
                <div class="mini-table-header">Customer</div>
                <div class="mini-table-rows" style="gap:2px">
                  <div class="mini-t-row"><span class="mini-t-dot"></span><span class="mini-t-bar"></span></div>
                  <div class="mini-t-row"><span class="mini-t-dot"></span><span class="mini-t-bar"></span></div>
                  <div class="mini-t-row"><span class="mini-t-dot"></span><span class="mini-t-bar"></span></div>
                  <div class="mini-t-row"><span class="mini-t-dot"></span><span class="mini-t-bar"></span></div>
                  <div class="mini-t-row"><span class="mini-t-dot"></span><span class="mini-t-bar"></span></div>
                </div>
                ${selectedTable === "compact" ? `<span class="theme-check-badge">${SVG_ICONS.check}</span>` : ""}
              </div>
              <span class="table-option-name">Compact</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 7. Footer -->
    <footer class="settings-content-footer">
      <button class="btn-cancel" id="btn-cancel">Cancel</button>
      <button class="btn-save-changes" id="btn-save-changes">Save changes</button>
    </footer>
  `;

  wrap.append(sidebar, main);
  root.append(wrap);

  // ── Wire Interactions ───────────────────────────────────────────────────────

  // 1. Swatches
  const swatchesRow = document.getElementById("brand-swatches-row")!;
  BRAND_COLORS.forEach((hex) => {
    const dot = document.createElement("button");
    dot.className = `brand-swatch-circle ${selectedColor.toLowerCase() === hex.toLowerCase() ? "active" : ""}`;
    dot.style.background = hex;
    dot.addEventListener("click", () => {
      selectedColor = hex;
      updateColor();
    });
    swatchesRow.append(dot);
  });

  const customColorInput = document.getElementById("custom-color-input") as HTMLInputElement;
  const customInnerDot = document.getElementById("custom-color-inner-dot")!;
  const customRing = document.getElementById("custom-color-ring")!;

  function updateColor() {
    customColorInput.value = selectedColor;
    customInnerDot.style.background = selectedColor;
    customRing.style.borderColor = selectedColor;
    document.querySelectorAll(".brand-swatch-circle").forEach((el, idx) => {
      el.classList.toggle("active", BRAND_COLORS[idx].toLowerCase() === selectedColor.toLowerCase());
    });
  }

  customColorInput.addEventListener("input", (e) => {
    const val = (e.target as HTMLInputElement).value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      selectedColor = val;
      customInnerDot.style.background = selectedColor;
      customRing.style.borderColor = selectedColor;
    }
  });

  // 2. Themes
  document.querySelectorAll(".theme-card-option").forEach((card) => {
    card.addEventListener("click", () => {
      selectedTheme = card.getAttribute("data-theme") as "system" | "light" | "dark";
      renderSettingsUI();
    });
  });

  // 3. Transparent Sidebar Toggle
  const toggleBtn = document.getElementById("toggle-transparent-sidebar")!;
  toggleBtn.addEventListener("click", () => {
    transparentSidebar = !transparentSidebar;
    toggleBtn.classList.toggle("on", transparentSidebar);
  });

  // 4. Feature Dropdown
  const featureDropdown = document.getElementById("feature-dropdown-box")!;
  const featureDropdownText = document.getElementById("feature-dropdown-text")!;
  const features = ["Recent changes", "Claude Code sessions", "Island status", "Integrations overview"];
  let featureIdx = 0;
  featureDropdown.addEventListener("click", () => {
    featureIdx = (featureIdx + 1) % features.length;
    sidebarFeature = features[featureIdx];
    featureDropdownText.textContent = sidebarFeature;
  });

  // 5. Tables View
  document.querySelectorAll(".table-card-option").forEach((card) => {
    card.addEventListener("click", () => {
      selectedTable = card.getAttribute("data-table") as "default" | "compact";
      renderSettingsUI();
    });
  });

  // 6. Navigation items
  sidebar.querySelectorAll(".menu-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sidebar.querySelectorAll(".menu-item-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // 7. Save and Cancel
  const saveBtn = document.getElementById("btn-save-changes") as HTMLButtonElement;
  saveBtn.addEventListener("click", async () => {
    saveBtn.textContent = "Saving…";
    settings.alwaysIsland = transparentSidebar;
    await Bridge.saveSettings(settings);
    setTimeout(() => {
      saveBtn.textContent = "✓ Saved";
      setTimeout(() => {
        saveBtn.textContent = "Save changes";
      }, 1500);
    }, 400);
  });

  const cancelBtn = document.getElementById("btn-cancel") as HTMLButtonElement;
  cancelBtn.addEventListener("click", () => {
    window.location.href = "/index.html";
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  const boot = await Bridge.boot();
  if (boot) {
    settings = { ...settings, ...boot.settings };
  }
  renderSettingsUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
