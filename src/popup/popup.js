// popup.js
if (typeof browser === "undefined") { var browser = chrome; }

const KEY = "woy_enabled";
const IMG_ROOT = "images";

const toggleBtn  = document.getElementById("toggleBtn");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const githubLink = document.getElementById("githubLink");
if (githubLink) githubLink.href = "https://github.com/zacharyisnthere/who-owns-you";

document.addEventListener("DOMContentLoaded", renderFromStorage);
toggleBtn?.addEventListener("click", async () => {
  // Ask background to flip; it will persist + set toolbar icon
  await browser.runtime.sendMessage({ type: "TOGGLE_WOY" });

  // Re-read and render current state
  await renderFromStorage();
});

async function renderFromStorage() {
  const { [KEY]: enabled = false } = await browser.storage.local.get(KEY);
  applyUI(Boolean(enabled));
}

function applyUI(isOn) {
  if (toggleBtn) {
    toggleBtn.textContent = isOn ? "ON" : "OFF";
    toggleBtn.classList.toggle("on", isOn);
  }
  if (statusIcon) {
    statusIcon.src = browser.runtime.getURL(
      `${IMG_ROOT}/${isOn ? "toggle-on.png" : "toggle-off.png"}`
    );
  }
  if (statusText) {
    statusText.textContent = isOn ? "Enabled" : "Disabled";
    statusText.style.color = isOn ? "#4caf50" : "#a3a3a3";
  }
}
