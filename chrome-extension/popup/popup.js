// MV3 popup logic (clean + instant toggle)
const KEY = "woy_enabled"; // storage key
let seq = Date.now();      // monotonically increasing tag

// UI elements (optional ones may be null depending on your HTML)
const toggleBtn  = document.getElementById("toggleBtn");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const githubLink = document.getElementById("githubLink");

// Set your repo if you want a quick link
if (githubLink) githubLink.href = "https://github.com/YOUR_ORG/YOUR_REPO";

// Initialize UI state
document.addEventListener("DOMContentLoaded", async () => {
  const { [KEY]: enabled = false } = await chrome.storage.local.get(KEY);
  applyUI(Boolean(enabled));
});

// Toggle click -> persist + message active tab + nudge others
toggleBtn?.addEventListener('click', onToggleClick);

async function onToggleClick() {
  const { [KEY]: enabled = false } = await chrome.storage.local.get(KEY);
  const next = !enabled;
  await flip(next);
  applyUI(next);
}

async function flip(next) {
  seq = Date.now(); // tag the change
  await chrome.storage.local.set({ [KEY]: next, woy_seq: seq });

  // Notify the active tab immediately (zero-lag UX)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await safeSendToTab(tab.id, { type: 'woy:setEnabled', value: next, seq });
  }

  // Nudge all other YouTube tabs (storage.onChanged will also reach them)
  const tabs = await chrome.tabs.query({ url: ['*://*.youtube.com/*'] });
  for (const t of tabs) {
    if (t.id !== tab?.id) {
      safeSendToTab(t.id, { type: 'woy:setEnabled', value: next, seq }).catch(() => {});
    }
  }

  // Optional: toolbar icon, if you have on/off assets
  setToolbarIcon(next);
}

async function safeSendToTab(tabId, msg) {
  try {
    await chrome.tabs.sendMessage(tabId, msg);
  } catch (e) {
    // If content script isn't ready, inject it and retry (needs "scripting" + host perms)
    if (e?.message?.includes('Receiving end')) {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await chrome.tabs.sendMessage(tabId, msg);
      } catch (e2) {
        console.warn('[WOY] Inject/resend failed:', e2);
      }
    } else {
      console.warn('[WOY] sendMessage failed:', e);
    }
  }
}

// ---- UI helpers ----
function applyUI(isOn) {
  if (toggleBtn) {
    toggleBtn.textContent = isOn ? "ON" : "OFF";
    toggleBtn.classList.toggle("on", isOn);
  }
  if (statusIcon) {
    statusIcon.src = isOn ? "images/toggle-on.png" : "images/toggle-off.png";
  }
  if (statusText) {
    statusText.textContent = isOn ? "Enabled" : "Disabled";
    statusText.style.color = isOn ? "#4caf50" : "#a3a3a3";
  }
}

function setToolbarIcon(isOn) {
  // Provide images/icon-on-*.png and images/icon-off-*.png or remove this
  chrome.action.setIcon({
    path: isOn
      ? { "16":"images/icon-on-16.png","32":"images/icon-on-32.png","64":"images/icon-on-64.png","128":"images/icon-on-128.png" }
      : { "16":"images/icon-off-16.png","32":"images/icon-off-32.png","64":"images/icon-off-64.png","128":"images/icon-off-128.png" }
  });
}
