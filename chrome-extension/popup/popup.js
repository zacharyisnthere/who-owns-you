// MV3 popup logic
const KEY = "woy_enabled"; // storage key

const toggleBtn = document.getElementById("toggleBtn");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const githubLink = document.getElementById("githubLink");

// optional: set your repo once here so you don't forget later
githubLink.href = "https://github.com/YOUR_ORG/YOUR_REPO";

document.addEventListener("DOMContentLoaded", async () => {
  const enabled = await getEnabled();
  applyUI(enabled);
  toggleBtn.addEventListener("click", async () => {
    const next = !(await getEnabled());
    await setEnabled(next);
    applyUI(next);

    chrome.tabs.query({ url: "*//*.youtube.com/*" }, (tabs) => {
        for (const t of tabs) {
            chrome.tabs.sendMessage(t.id, { type: "WOY_TOGGLE", enabled: next });
        }
    });
    
    setToolbarIcon(next);  // update toolbar icon if you have on/off icon assets
  });
});

function applyUI(isOn) {
  toggleBtn.textContent = isOn ? "ON" : "OFF";
  toggleBtn.classList.toggle("on", isOn);
  statusIcon.src = isOn ? "images/toggle-on.png" : "images/toggle-off.png";
  statusText.textContent = isOn ? "Enabled" : "Disabled";
  statusText.style.color = isOn ? "#4caf50" : "#a3a3a3";
}

// storage helper
const api = globalThis.chrome?.storage ?? globalThis.browser?.storage;
const area = api?.sync ?? api?.local; // prefer sync, fallback to local

function getEnabled() {
  return new Promise((resolve) => {
    if (!area) return resolve(false);
    area.get([KEY], (res) => resolve(Boolean(res?.[KEY])));
  });
}

function setEnabled(value) {
  return new Promise((resolve) => {
    if (!area) return resolve();
    area.set({ [KEY]: Boolean(value) }, resolve);
  });
}

function notifyActiveTab(isOn) {
  // fire-and-forget; content.js should react if it’s listening
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs?.[0]?.id;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: "WOY_TOGGLE", enabled: isOn });
    }
  });
}

function setToolbarIcon(isOn) {
  // Provide both sets of icons to use this feature; otherwise remove this function.
  chrome.action.setIcon({
    path: isOn
      ? {
          "16": "images/icon-on-16.png",
          "32": "images/icon-on-32.png",
          "64": "images/icon-on-64.png",
          "128": "images/icon-on-128.png"
        }
      : {
          "16": "images/icon-off-16.png",
          "32": "images/icon-off-32.png",
          "64": "images/icon-off-64.png",
          "128": "images/icon-off-128.png"
        }
  });
}
