(async function () {
  const ROOT_ID = "sf-job-monitor-root";
  const LAUNCHER_ID = "sf-job-monitor-launcher";
  const STYLE_ID = "sf-job-monitor-launcher-style";
  const OVERLAY_ID = "sf-job-monitor-overlay";
  const PANEL_ID = "sf-job-monitor-panel";
  const IFRAME_ID = "sf-job-monitor-frame";
  const MENU_ID = "sf-job-monitor-menu";
  const POSITION_KEY = "sf-job-monitor-launcher-position-v3";

  if (window.top !== window || document.getElementById(ROOT_ID)) {
    return;
  }

  const host = window.location.hostname;
  const isSupportedSalesforceHost = SalesforceHostSupport.isSupportedHost(host);
  const isSchedulerHost = SalesforceHostSupport.isSchedulerHost(host);
  const salesforceCronPage = "cron-maker.html?mode=salesforce";
  const genericCronPage = "cron-maker.html?mode=generic";
  const cronBuilderPage = isSupportedSalesforceHost ? salesforceCronPage : genericCronPage;
  const cronBuilderText = isSupportedSalesforceHost
    ? "Build Salesforce cron expressions for hourly, daily, weekly, monthly, and yearly schedules."
    : "Create cron expressions for minute, hourly, daily, weekly, monthly, or yearly schedules.";
  const launcherIconUrl = chrome.runtime.getURL("icons/icon128.png");

  const isLoginPage =
    host.startsWith("login.")
    || window.location.pathname.toLowerCase().includes("login");

  if (isSupportedSalesforceHost && isLoginPage) {
    return;
  }

  const isLoggedIn = await hasSalesforceSession(window.location.href);
  if (!isLoggedIn) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      pointer-events: none;
    }

    #${LAUNCHER_ID} {
      position: fixed;
      right: max(24px, calc(env(safe-area-inset-right, 0px) + 24px));
      bottom: max(24px, calc(env(safe-area-inset-bottom, 0px) + 24px));
      z-index: 2;
      pointer-events: auto;
      display: inline-grid;
      place-items: center;
      width: clamp(52px, 5vw, 60px);
      height: clamp(52px, 5vw, 60px);
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      cursor: grab;
      user-select: none;
      touch-action: none;
      opacity: 1;
      will-change: transform, opacity;
      transition: transform 180ms ease, opacity 180ms ease;
    }

    #${LAUNCHER_ID}:hover,
    #${LAUNCHER_ID}:focus-visible {
      opacity: 1;
      transform: translateY(-3px) scale(1.03);
    }

    #${LAUNCHER_ID}:active {
      cursor: grabbing;
      transform: translateY(0) scale(0.98);
    }

    #${LAUNCHER_ID}.is-dragging {
      cursor: grabbing;
    }

    #${LAUNCHER_ID} .sfjm-launcher-icon {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
      filter: drop-shadow(0 10px 18px rgba(3, 45, 96, 0.2));
      transition: transform 180ms ease, filter 180ms ease;
    }

    #${LAUNCHER_ID}:hover .sfjm-launcher-icon,
    #${LAUNCHER_ID}:focus-visible .sfjm-launcher-icon {
      transform: scale(1.04);
      filter: drop-shadow(0 12px 22px rgba(3, 45, 96, 0.24));
    }

    #${OVERLAY_ID} {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: auto;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 28px;
      background: rgba(3, 45, 96, 0.34);
      backdrop-filter: blur(4px);
    }

    #${OVERLAY_ID}.is-open {
      display: flex;
    }

    #${PANEL_ID} {
      width: min(1180px, calc(100vw - 48px));
      height: min(860px, calc(100vh - 48px));
      border-radius: 18px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 24px 60px rgba(3, 45, 96, 0.28);
      border: 1px solid rgba(11, 92, 171, 0.18);
      display: grid;
      grid-template-rows: 52px 1fr;
    }

    .sfjm-panel-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px 0 18px;
      background: linear-gradient(180deg, #f8fbff, #eef4fb);
      border-bottom: 1px solid rgba(11, 92, 171, 0.12);
      color: #032d60;
      font: 700 13px/1 "Segoe UI", Arial, sans-serif;
    }

    .sfjm-panel-bar-left {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .sfjm-panel-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sfjm-panel-back {
      display: none;
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #032d60;
      cursor: pointer;
      font: 700 18px/1 Arial, sans-serif;
    }

    .sfjm-panel-back.is-visible {
      display: inline-grid;
      place-items: center;
    }

    .sfjm-panel-back:hover {
      background: rgba(11, 92, 171, 0.08);
    }

    .sfjm-panel-close {
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #032d60;
      font: 700 20px/1 Arial, sans-serif;
      cursor: pointer;
    }

    .sfjm-panel-close:hover {
      background: rgba(11, 92, 171, 0.08);
    }

    #${IFRAME_ID} {
      width: 100%;
      height: 100%;
      border: 0;
      background: #ffffff;
    }

    #${MENU_ID} {
      display: grid;
      align-content: center;
      gap: 18px;
      padding: 28px;
      background:
        radial-gradient(circle at top right, rgba(27,150,255,0.12), transparent 24%),
        linear-gradient(180deg, #f7fbff 0%, #eef4fb 100%);
    }

    .sfjm-menu-copy {
      max-width: 520px;
    }

    .sfjm-menu-label {
      margin: 0 0 8px;
      color: #0b5cab;
      font: 700 11px/1 "Segoe UI", Arial, sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sfjm-menu-title {
      margin: 0 0 8px;
      color: #032d60;
      font: 700 28px/1.1 "Segoe UI", Arial, sans-serif;
    }

    .sfjm-menu-text {
      margin: 0;
      color: #44576d;
      font: 500 14px/1.5 "Segoe UI", Arial, sans-serif;
    }

    .sfjm-menu-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .sfjm-menu-support {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 18px;
      border: 1px solid rgba(11, 92, 171, 0.12);
      border-radius: 16px;
      background: rgba(255,255,255,0.82);
      box-shadow: 0 8px 18px rgba(36, 56, 99, 0.06);
    }

    .sfjm-menu-support-copy {
      margin: 0;
      color: #52606d;
      font: 500 13px/1.5 "Segoe UI", Arial, sans-serif;
    }

    .sfjm-menu-support-copy a,
    .sfjm-menu-support-link {
      color: #0b5cab;
      font-weight: 700;
      text-decoration: none;
    }

    .sfjm-menu-support-copy a:hover,
    .sfjm-menu-support-link:hover {
      text-decoration: underline;
    }

    .sfjm-menu-support-link {
      white-space: nowrap;
    }

    .sfjm-menu-card {
      width: 100%;
      padding: 18px;
      border: 1px solid rgba(11, 92, 171, 0.14);
      border-radius: 18px;
      text-align: left;
      background: rgba(255,255,255,0.92);
      box-shadow: 0 14px 28px rgba(3,45,96,0.1);
      cursor: pointer;
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }

    .sfjm-menu-card:hover {
      transform: translateY(-2px);
      border-color: rgba(11, 92, 171, 0.28);
      box-shadow: 0 18px 34px rgba(3,45,96,0.14);
    }

    .sfjm-menu-card-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .sfjm-menu-icon {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: inline-grid;
      place-items: center;
      background: linear-gradient(135deg, #1b96ff, #0b5cab);
    }

    .sfjm-menu-icon.orange {
      background: linear-gradient(135deg, #ffb75d, #dd7a01);
    }

    .sfjm-menu-icon svg {
      width: 20px;
      height: 20px;
    }

    .sfjm-menu-icon path,
    .sfjm-menu-icon rect,
    .sfjm-menu-icon circle {
      fill: none;
      stroke: #ffffff;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .sfjm-menu-card-title {
      margin: 0 0 6px;
      color: #032d60;
      font: 700 17px/1.2 "Segoe UI", Arial, sans-serif;
    }

    .sfjm-menu-card-text {
      margin: 0;
      color: #52606d;
      font: 500 13px/1.5 "Segoe UI", Arial, sans-serif;
    }

    @media (max-width: 900px) {
      #${PANEL_ID} {
        width: min(1180px, calc(100vw - 24px));
        height: min(860px, calc(100vh - 24px));
      }

      #${MENU_ID} {
        padding: 20px;
      }
    }

    @media (max-width: 640px) {
      #${LAUNCHER_ID} {
        right: max(16px, calc(env(safe-area-inset-right, 0px) + 16px));
        bottom: max(16px, calc(env(safe-area-inset-bottom, 0px) + 16px));
      }

      #${OVERLAY_ID} {
        padding: 12px;
      }

      #${PANEL_ID} {
        width: calc(100vw - 12px);
        height: calc(100vh - 12px);
        border-radius: 16px;
      }

      .sfjm-menu-grid {
        grid-template-columns: 1fr;
      }

      .sfjm-menu-title {
        font-size: 22px;
      }

      .sfjm-menu-support {
        flex-direction: column;
        align-items: flex-start;
      }

      .sfjm-menu-support-link {
        white-space: normal;
      }
    }
  `;

  const launcher = document.createElement("button");
  launcher.id = LAUNCHER_ID;
  launcher.type = "button";
  launcher.draggable = false;
  launcher.classList.toggle("is-salesforce-host", isSchedulerHost);
  const launcherAriaLabel = isSchedulerHost
    ? "Open Salesforce Scheduler Inspector & Cron Builder"
    : "Open Cron Builder";
  launcher.setAttribute("aria-label", launcherAriaLabel);
  launcher.innerHTML = `<img class="sfjm-launcher-icon" src="${launcherIconUrl}" alt="" aria-hidden="true">`;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  const root = document.createElement("div");
  root.id = ROOT_ID;
  const menuCards = isSchedulerHost
    ? `
        <button type="button" class="sfjm-menu-card" data-page="popup.html" data-title="Scheduler Inspector">
          <div class="sfjm-menu-card-top">
            <span class="sfjm-menu-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="4" y="5" width="16" height="14" rx="4"></rect>
                <path d="M8 10h8M8 14h8"></path>
              </svg>
            </span>
            <div>
              <h3 class="sfjm-menu-card-title">Scheduler Inspector</h3>
              <p class="sfjm-menu-card-text">Inspect Scheduled Apex jobs, today's runs, and upcoming triggers.</p>
            </div>
          </div>
        </button>
        <button type="button" class="sfjm-menu-card" data-page="${salesforceCronPage}" data-title="Cron Builder">
          <div class="sfjm-menu-card-top">
            <span class="sfjm-menu-icon orange" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8"></circle>
                <path d="M12 8v4l3 2"></path>
              </svg>
            </span>
            <div>
              <h3 class="sfjm-menu-card-title">Cron Builder</h3>
              <p class="sfjm-menu-card-text">${cronBuilderText}</p>
            </div>
          </div>
        </button>
      `
    : `
        <button type="button" class="sfjm-menu-card" data-page="${cronBuilderPage}" data-title="Cron Builder">
          <div class="sfjm-menu-card-top">
            <span class="sfjm-menu-icon orange" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8"></circle>
                <path d="M12 8v4l3 2"></path>
              </svg>
            </span>
            <div>
              <h3 class="sfjm-menu-card-title">Cron Builder</h3>
              <p class="sfjm-menu-card-text">${cronBuilderText}</p>
            </div>
          </div>
        </button>
      `;

  overlay.innerHTML = `
    <div id="${PANEL_ID}" role="dialog" aria-modal="true" aria-label="${isSchedulerHost ? "Salesforce Scheduler Inspector & Cron Builder" : "Cron Builder"}">
      <div class="sfjm-panel-bar">
        <div class="sfjm-panel-bar-left">
          <button type="button" class="sfjm-panel-back" aria-label="Back to tools">&#8249;</button>
          <span class="sfjm-panel-title">${isSchedulerHost ? "Salesforce Scheduler Inspector & Cron Builder" : "Cron Builder"}</span>
        </div>
        <button type="button" class="sfjm-panel-close" aria-label="Close panel">&times;</button>
      </div>
      <div id="${MENU_ID}">
        <div class="sfjm-menu-copy">
          <p class="sfjm-menu-label">${isSchedulerHost ? "Extension" : (isSupportedSalesforceHost ? "Salesforce" : "Builder")}</p>
          <h2 class="sfjm-menu-title">${isSchedulerHost ? "Salesforce Scheduler Inspector & Cron Builder" : "Cron Builder"}</h2>
          <p class="sfjm-menu-text">${isSchedulerHost ? "Open the scheduler inspector or build a cron expression without leaving the current Salesforce page." : (isSupportedSalesforceHost ? "Build Salesforce cron expressions without leaving the current page." : "Build cron expressions without leaving your current tab.")}</p>
        </div>
        <div class="sfjm-menu-grid">
          ${menuCards}
        </div>
        <div class="sfjm-menu-support" aria-label="Support and feedback">
          <p class="sfjm-menu-support-copy">Email: <a href="mailto:rj.sfdccloud@gmail.com">rj.sfdccloud@gmail.com</a></p>
          <a class="sfjm-menu-support-link" href="https://forms.gle/exWd91UqZVh8v9oFA" target="_blank" rel="noreferrer">Report issue / Feedback</a>
        </div>
      </div>
      <iframe id="${IFRAME_ID}" title="${isSchedulerHost ? "Salesforce Scheduler Inspector & Cron Builder" : "Cron Builder"}"></iframe>
    </div>
  `;

  const iframe = overlay.querySelector(`#${IFRAME_ID}`);
  const closeButton = overlay.querySelector(".sfjm-panel-close");
  const backButton = overlay.querySelector(".sfjm-panel-back");
  const menu = overlay.querySelector(`#${MENU_ID}`);
  const title = overlay.querySelector(".sfjm-panel-title");
  const menuButtons = overlay.querySelectorAll(".sfjm-menu-card");
  const defaultPosition = { right: 24, bottom: 24 };
  const dragState = {
    active: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originLeft: 0,
    originTop: 0
  };

  function showMenu() {
    iframe.removeAttribute("src");
    iframe.style.display = "none";
    menu.style.display = "grid";
    if (isSchedulerHost) {
      backButton.classList.remove("is-visible");
      title.textContent = "Salesforce Scheduler Inspector & Cron Builder";
    }
    else {
      backButton.classList.remove("is-visible");
      title.textContent = "Cron Builder";
    }
  }

  function openTool(page, panelTitle) {
    iframe.src = chrome.runtime.getURL(page);
    iframe.style.display = "block";
    menu.style.display = "none";
    backButton.classList.add("is-visible");
    title.textContent = panelTitle;
  }

  function openOverlay() {
    if (dragState.moved) {
      return;
    }

    if (isSchedulerHost) {
      showMenu();
    }
    else {
      openTool(cronBuilderPage, "Cron Builder");
    }
    overlay.classList.add("is-open");
  }

  function closeOverlay() {
    overlay.classList.remove("is-open");
  }

  launcher.addEventListener("click", () => {
    openOverlay();
  });

  launcher.addEventListener("dragstart", event => {
    event.preventDefault();
  });

  launcher.addEventListener("pointerdown", event => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragState.active = true;
    dragState.moved = false;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;

    const rect = launcher.getBoundingClientRect();
    dragState.originLeft = rect.left;
    dragState.originTop = rect.top;

    launcher.setPointerCapture(event.pointerId);
    launcher.classList.add("is-dragging");
    launcher.style.transition = "none";
  });

  launcher.addEventListener("pointermove", event => {
    if (!dragState.active || event.pointerId !== dragState.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (!dragState.moved && Math.hypot(deltaX, deltaY) > 6) {
      dragState.moved = true;
    }

    if (!dragState.moved) {
      return;
    }

    const rect = launcher.getBoundingClientRect();
    const maxLeft = Math.max(12, window.innerWidth - rect.width - 12);
    const maxTop = Math.max(12, window.innerHeight - rect.height - 12);
    const nextLeft = clamp(dragState.originLeft + deltaX, 12, maxLeft);
    const nextTop = clamp(dragState.originTop + deltaY, 12, maxTop);

    setLauncherPosition(nextLeft, nextTop);
  });

  launcher.addEventListener("pointerup", event => {
    endDrag(event.pointerId);
  });

  launcher.addEventListener("pointercancel", event => {
    endDrag(event.pointerId);
  });

  menuButtons.forEach(button => {
    button.addEventListener("click", () => {
      openTool(button.dataset.page, button.dataset.title);
    });
  });

  backButton.addEventListener("click", showMenu);
  closeButton.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) {
      closeOverlay();
    }

  });

  window.addEventListener("resize", () => {
    keepLauncherInViewport();
  });

  document.documentElement.appendChild(style);
  root.appendChild(launcher);
  root.appendChild(overlay);
  document.body.appendChild(root);

  applyStoredPosition();

  function endDrag(pointerId) {
    if (!dragState.active || pointerId !== dragState.pointerId) {
      return;
    }

    dragState.active = false;
    launcher.classList.remove("is-dragging");
    launcher.style.transition = "";
    launcher.releasePointerCapture(pointerId);

    window.setTimeout(() => {
      dragState.moved = false;
    }, 0);
  }

  async function applyStoredPosition() {
    const stored = await readStoredPosition();

    if (stored) {
      setLauncherPosition(stored.left, stored.top, false);
      keepLauncherInViewport(false);
      return;
    }

    await resetLauncherPosition(false);
  }

  function keepLauncherInViewport(persist = false) {
    const rect = launcher.getBoundingClientRect();
    const maxLeft = Math.max(12, window.innerWidth - rect.width - 12);
    const maxTop = Math.max(12, window.innerHeight - rect.height - 12);
    const nextLeft = clamp(rect.left, 12, maxLeft);
    const nextTop = clamp(rect.top, 12, maxTop);

    setLauncherPosition(nextLeft, nextTop, persist);
  }

  function setLauncherPosition(left, top, persist = true) {
    launcher.style.left = `${Math.round(left)}px`;
    launcher.style.top = `${Math.round(top)}px`;
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";

    if (persist) {
      storePosition({ left: Math.round(left), top: Math.round(top) });
    }
  }

  async function resetLauncherPosition(persist = true) {
    const rect = launcher.getBoundingClientRect();
    const fallbackLeft = Math.max(12, window.innerWidth - rect.width - defaultPosition.right);
    const fallbackTop = Math.max(12, window.innerHeight - rect.height - defaultPosition.bottom);

    setLauncherPosition(fallbackLeft, fallbackTop, false);

    if (persist) {
      await removePosition();
    }
  }

  async function readStoredPosition() {
    try {
      const parsed = await storageGet(POSITION_KEY);

      if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
        return parsed;
      }
    }
    catch (error) {
      return null;
    }

    return null;
  }

  function storePosition(position) {
    storageSet(POSITION_KEY, position);
  }

  function removePosition() {
    return storageRemove(POSITION_KEY);
  }

  function storageGet(key) {
    return new Promise(resolve => {
      chrome.storage.local.get([key], result => {
        resolve(result?.[key] || null);
      });
    });
  }

  function storageSet(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }

  function storageRemove(key) {
    return new Promise(resolve => {
      chrome.storage.local.remove(key, () => resolve());
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function hasSalesforceSession(tabUrl) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ type: "CHECK_SALESFORCE_SESSION", tabUrl }, response => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }

          resolve(Boolean(response?.isLoggedIn));
        });
      }
      catch (error) {
        resolve(false);
      }
    });
  }
})();
