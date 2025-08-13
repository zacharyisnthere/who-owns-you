// MV3 popup logic (robust paths)
const KEY = "woy_enabled";
let seq = Date.now();

// ----- Discover actual CS paths from manifest (prevents 'Could not load file' errors)
const manifest = chrome.runtime.getManifest();
const CONTENT_FILES = [...new Set(
  (manifest.content_scripts || []).flatMap(cs => cs.js || [])
)];
// If this ends up empty for some reason, fall back:
if (CONTENT_FILES.length === 0) CONTENT_FILES.push('content.js');

// ----- Configure where your images live:
// If your icons live in /images at the extension root:    'images'
// If they live in /popup/images alongside popup.html:     'popup/images'
const IMG_ROOT = 'images'; // <-- change if needed

// UI elements
const toggleBtn  = document.getElementById("toggleBtn");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const githubLink = document.getElementById("githubLink");

if (githubLink) githubLink.href = "https://github.com/YOUR_ORG/YOUR_REPO";

// Init UI from stored state
document.addEventListener("DOMContentLoaded", async () => {
  const { [KEY]: enabled = false } = await chrome.storage.local.get(KEY);
  applyUI(Boolean(enabled));
});

// Toggle
toggleBtn?.addEventListener('click', onToggleClick);

async function onToggleClick() {
  const { [KEY]: enabled = false } = await chrome.storage.local.get(KEY);
  const next = !enabled;
  await flip(next);
  applyUI(next);
}

async function flip(next) {
  seq = Date.now();
  await chrome.storage.local.set({ [KEY]: next, woy_seq: seq });

  // Active tab: instant flip
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await safeSendToTab(tab, { type: 'woy:setEnabled', value: next, seq });
  }

  // Other YT tabs (storage.onChanged will also cover them)
  const tabs = await chrome.tabs.query({ url: ['*://*.youtube.com/*'] });
  for (const t of tabs) {
    if (t.id !== tab?.id) {
      safeSendToTab(t, { type: 'woy:setEnabled', value: next, seq }).catch(() => {});
    }
  }

  // Optional: update toolbar icon (only if assets exist)
  try { setToolbarIcon(next); } catch (e) { /* silence missing-asset noise */ }
}

async function safeSendToTab(tab, msg) {
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) {
    // Only try programmatic injection on real YouTube pages
    const url = tab.url || '';
    const isYT = /^https?:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(url);
    if (isYT && e?.message?.includes('Receiving end')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: CONTENT_FILES   // use the manifest-discovered paths
        });
        await chrome.tabs.sendMessage(tab.id, msg);
      } catch (e2) {
        console.warn('[WOY] Inject/resend failed:', e2);
      }
    } else {
      // Non-YouTube tab or some other error — safe to ignore
      // console.warn('[WOY] sendMessage failed:', e);
    }
  }
}

// ---- UI helpers
function applyUI(isOn) {
  if (toggleBtn) {
    toggleBtn.textContent = isOn ? "ON" : "OFF";
    toggleBtn.classList.toggle("on", isOn);
  }
  if (statusIcon) {
    // Use runtime URL so it works no matter where popup.html is located
    statusIcon.src = chrome.runtime.getURL(`${IMG_ROOT}/${isOn ? 'toggle-on.png' : 'toggle-off.png'}`);
  }
  if (statusText) {
    statusText.textContent = isOn ? "Enabled" : "Disabled";
    statusText.style.color = isOn ? "#4caf50" : "#a3a3a3";
  }
}

// Action icon (toolbar)
function setToolbarIcon(isOn) {
  // These paths are relative to the EXTENSION ROOT, not the popup location.
  // If your files are under /popup/images, change IMG_ROOT above to 'popup/images'.
  chrome.action.setIcon({
    path: isOn
      ? {
          "16":  `${IMG_ROOT}/icon-on-16.png`,
          "32":  `${IMG_ROOT}/icon-on-32.png`,
          "64":  `${IMG_ROOT}/icon-on-64.png`,
          "128": `${IMG_ROOT}/icon-on-128.png`
        }
      : {
          "16":  `${IMG_ROOT}/icon-off-16.png`,
          "32":  `${IMG_ROOT}/icon-off-32.png`,
          "64":  `${IMG_ROOT}/icon-off-64.png`,
          "128": `${IMG_ROOT}/icon-off-128.png`
        }
  });
}
