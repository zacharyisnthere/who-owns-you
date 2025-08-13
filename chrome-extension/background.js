const KEY = "woy_enabled";

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

async function init() {
  const { [KEY]: enabled = false } = await chrome.storage.local.get(KEY);
  setIcon(!!enabled);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY]) {
    setIcon(!!changes[KEY].newValue);
  }
});

function setIcon(on) {
  chrome.action.setIcon({
    path: on
      ? {
          16:  "images/icon-on-16.png",
          32:  "images/icon-on-32.png",
          64:  "images/icon-on-64.png",
          128: "images/icon-on-128.png",
        }
      : {
          16:  "images/icon-off-16.png",
          32:  "images/icon-off-32.png",
          64:  "images/icon-off-64.png",
          128: "images/icon-off-128.png",
        },
  });
}
