// background.js
if (typeof browser === "undefined") { var browser = chrome; }

const KEY = "woy_enabled";

// Build absolute URLs; include 48px for Firefox
function iconPaths(state /* "on" | "off" */) {
  const base = `images/icon-${state}-`; // <-- backticks (fixed)
  return {
    16:  browser.runtime.getURL(base + "16.png"),
    32:  browser.runtime.getURL(base + "32.png"),
    48:  browser.runtime.getURL(base + "48.png"),
    64:  browser.runtime.getURL(base + "64.png"),
    128: browser.runtime.getURL(base + "128.png"),
  };
}

async function applyUiState(enabled) {
  const state = enabled ? "on" : "off";
  await browser.action.setIcon({ path: iconPaths(state) });
  await browser.action.setTitle({
    title: enabled ? "Who Owns You — ON" : "Who Owns You — OFF"
  });
}

// Single source of truth: flip + persist + apply
async function flipEnabled() {
  const { [KEY]: enabled = false } = await browser.storage.local.get(KEY);
  const next = !enabled;
  await browser.storage.local.set({ [KEY]: next });
  await applyUiState(next);
}

// Handle popup toggle
browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "TOGGLE_WOY") {
    flipEnabled();
  }
});

// Initialize icon on startup/install
browser.runtime.onStartup?.addListener(async () => {
  const { [KEY]: enabled = false } = await browser.storage.local.get(KEY);
  await applyUiState(enabled);
});
browser.runtime.onInstalled?.addListener(async () => {
  const { [KEY]: enabled = false } = await browser.storage.local.get(KEY);
  await applyUiState(enabled);
});
