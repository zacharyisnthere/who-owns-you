if (typeof browser === "undefined") { var browser = chrome; }


const KEY = "woy_enabled";

browser.runtime.onInstalled.addListener(init);
browser.runtime.onStartup.addListener(init);

async function init() {
  const { [KEY]: enabled = false } = await browser.storage.local.get(KEY);
  setIcon(!!enabled);
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY]) {
    setIcon(!!changes[KEY].newValue);
  }
});

function setIcon(on) {
  browser.action.setIcon({
    path: on
      ? {
          16:  "images/icon-on-16.png",
          32:  "images/icon-on-32.png",
          48:  "images/icon-on-48.png",
          64:  "images/icon-on-64.png",
          128: "images/icon-on-128.png",
        }
      : {
          16:  "images/icon-off-16.png",
          32:  "images/icon-off-32.png",
          48:  "images/icon-off-48.png",
          64:  "images/icon-off-64.png",
          128: "images/icon-off-128.png",
        },
  });
}
