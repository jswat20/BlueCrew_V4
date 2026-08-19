let deferredSlateInstallPrompt = null;
let installHelperOrigin = null;
let slateInstallAccepted = false;

function isSlateStandalone() {
  return Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);
}

function detectSlateInstallPlatform() {
  const userAgent = String(window.navigator.userAgent || "");
  const platform = String(window.navigator.platform || "");
  const isIPadDesktopMode = platform === "MacIntel" && Number(window.navigator.maxTouchPoints) > 1;
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || isIPadDesktopMode;
  const isAndroid = /Android/i.test(userAgent);
  const isMobile = isIOS || isAndroid || /Mobile|Tablet/i.test(userAgent);
  const isIOSSafari = isIOS && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
  const isChromiumAndroid = isAndroid && /Chrome|Chromium|EdgA|OPR|SamsungBrowser/i.test(userAgent);
  return { isIOS, isAndroid, isMobile, isIOSSafari, isChromiumAndroid };
}

function refreshInstallHelperVisibility() {
  const trigger = document.querySelector("[data-testid='nav-install']");
  if (!trigger) return;
  const { isMobile, isIOS, isChromiumAndroid } = detectSlateInstallPlatform();
  const hasFallback = isIOS || (isMobile && !isChromiumAndroid);
  trigger.hidden = isSlateStandalone() || (!deferredSlateInstallPrompt && !hasFallback);
}

function renderInstallHelperContent() {
  const platform = detectSlateInstallPlatform();
  const directInstall = Boolean(deferredSlateInstallPrompt && !platform.isIOS);
  let instructions = `<p>Open your browser menu, then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>`;
  if (platform.isIOS) {
    instructions = `${platform.isIOSSafari ? "" : "<p>Open The Slate in Safari first.</p>"}<ol><li>Tap the Share button.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol>`;
  } else if (directInstall) {
    instructions = `<p>Your browser can install The Slate directly.</p>`;
  }
  return `
    <article class="install-helper-panel">
      <div><h2 id="install-helper-title">Install The Slate</h2><p>Add The Slate to your Home Screen for quick access.</p></div>
      <div data-testid="install-instructions">${instructions}</div>
      <p class="install-helper-status" role="status" aria-live="polite" data-testid="install-status"></p>
      <div class="install-helper-actions">
        ${directInstall ? `<button type="button" class="button button-primary" data-testid="install-confirm">Install</button>` : ""}
        <button type="button" class="button button-secondary" data-testid="install-close">Close</button>
      </div>
    </article>`;
}

function openInstallHelper() {
  if (isSlateStandalone()) return;
  let dialog = document.querySelector("[data-testid='install-helper-dialog']");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "install-helper-dialog";
    dialog.dataset.testid = "install-helper-dialog";
    dialog.setAttribute("aria-labelledby", "install-helper-title");
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => installHelperOrigin?.focus?.());
    document.body.appendChild(dialog);
  }
  installHelperOrigin = document.activeElement;
  dialog.innerHTML = renderInstallHelperContent();
  dialog.querySelector("[data-testid='install-close']")?.addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-testid='install-confirm']")?.addEventListener("click", requestSlateInstall);
  dialog.showModal();
  dialog.querySelector("button")?.focus();
}

function handleSlateInstallAction() {
  if (isSlateStandalone()) return;
  if (deferredSlateInstallPrompt) {
    requestSlateInstall();
    return;
  }
  openInstallHelper();
}

async function requestSlateInstall() {
  if (!deferredSlateInstallPrompt) return;
  const promptEvent = deferredSlateInstallPrompt;
  deferredSlateInstallPrompt = null;
  let status = document.querySelector("[data-testid='install-status']");
  try {
    await promptEvent.prompt();
  } catch (error) {
    if (status) status.textContent = "The browser could not open the install prompt. Use your browser menu to install The Slate.";
    refreshInstallHelperVisibility();
    return;
  }
  const choice = await promptEvent.userChoice.catch(() => null);
  slateInstallAccepted = choice?.outcome === "accepted";
  if (!slateInstallAccepted && !status) {
    openInstallHelper();
    status = document.querySelector("[data-testid='install-status']");
  }
  if (status) status.textContent = slateInstallAccepted ? "Install accepted. Waiting for your browser to confirm installation." : "Installation was not completed. You can try again when your browser offers Install.";
  refreshInstallHelperVisibility();
}

function registerSlateServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(error => {
    console.warn("The Slate service worker could not be registered.", error);
  });
}

function setupInstallHelper() {
  document.querySelector("[data-testid='nav-install']")?.addEventListener("click", handleSlateInstallAction);
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredSlateInstallPrompt = event;
    slateInstallAccepted = false;
    refreshInstallHelperVisibility();
  });
  window.addEventListener("appinstalled", () => {
    deferredSlateInstallPrompt = null;
    slateInstallAccepted = false;
    const status = document.querySelector("[data-testid='install-status']");
    if (status) status.textContent = "The Slate is installed.";
    setTimeout(() => document.querySelector("[data-testid='install-helper-dialog']")?.close(), 0);
    refreshInstallHelperVisibility();
  });
  registerSlateServiceWorker();
  refreshInstallHelperVisibility();
}
