console.log("'Who Owns You' browser extension is running!");


// Enable/Disable functionality=======
//config / keys
const KEY = "woy_enabled";

//controller state
const WOY = {
  enabled: false,
  observer: null,
  intervals: new Set(),
  cleanups: new Set()
};

//Utility: register a cleanup func to run on disable()
function onCleanup(fn) {
  WOY.cleanups.add(fn); 
  return fn;
}

//clear all timers/obersevers/ui when disabling
function runCleanup() {
  //stop intervals/timeouts
  for (const id of WOY.intervals) clearInterval(id);
  WOY.intervals.clear();

  //disconnect observers
  if (WOY.observer) { 
    WOY.observer.disconnect();
    WOY.observer = null;
  }

  //remove injected UI
  document.querySelectorAll(".woy-badge, .woy-panel").forEach(n => n.remove());

  //run any extra cleanups registered
  for (const fn of WOY.cleanups) {
    try { fn(); } catch{}
  }

  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  WOY.cleanups.clear();
}


//storage helpers
function getEnabled() {
  return new Promise(resolve => {
    chrome.storage.sync.get([KEY], (res) => resolve(Boolean(res?.[KEY])));
  });
}



//==enable/disable==
async function enable() {
  if (WOY.enabled) return;
  WOY.enabled = true;

  // startup logic (load DB, inject UI, etc.)
  await startOwnershipChecks(); 


  //SPA URL-change observer (YouTube navigation)
  let lastUrl = location.href;
  const obs = new MutationObserver(() => {
    if (!WOY.enabled) return;
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log("🔄 URL changed:", currentUrl);
      clearInfoCard();
      waitForChannelElement(); // will be gated
    }
  });
  obs.observe(document, { childList: true, subtree: true });
  WOY.observer = obs;

  // initial pass per current page
  clearInfoCard();
  waitForChannelElement();

  console.log("[WOY] ENABLED");
}

function disable() {
  if (!WOY.enabled) return;
  WOY.enabled = false;
  runCleanup();
  console.log("[WOY] DISABLED");
}


//===wiring to popup toggle====
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "WOY_TOGGLE") {
    msg.enabled ? enable() : disable();
  }
});

// Initial state when the content script loads on a page
(async () => {
  const on = await getEnabled();
  on ? enable() : disable();
})();

//Feature logic TODOOOOO
let recheckTimer = null;
function scheduleRecheck() {
  if (recheckTimer) return;
  recheckTimer = setTimeout(() => {
    recheckTimer = null;
    if (WOY.enabled) checkCurrentChannel();
  }, 1000);
  WOY.intervals.add(recheckTimer);
  onCleanup(() => { clearTimeout(recheckTimer); recheckTimer = null});
}

async function startOwnershipChecks() {
  // Example: load DB once and keep reference, with cleanup if needed
  const abort = new AbortController();
  onCleanup(() => abort.abort());

  await loadChannelDatabase({ signal: abort.signal }); // adapt your loader to accept signal

  // Initial pass
  await checkCurrentChannel();

  // If you have any periodic polling, keep track of it
  // const id = setInterval(() => WOY.enabled && checkCurrentChannel(), 10_000);
  // WOY.intervals.add(id);
}


// Call this with either a matched data object or null/undefined
// e.g. displayData(match)


const CARD_ID = 'woy-info-card';

async function displayData(data) {
  if (!WOY.enabled) return;

  console.log("Displaying info box...")

  // First, check to see if the page is a video, channel page, or short


  // 1) Find insertion point: before the channel row on a watch page

  let container;

  pageType = getPageType();
  if (pageType) console.log("Page type identified:", pageType);

  switch (pageType) {
    case 'video':
      container = document.querySelector('ytd-watch-flexy #above-the-fold');
      break;
    
    case 'short':
      container = document.querySelector('yt-reel-metapanel-view-model');
      break;
    
    case 'channel':
      container = document.querySelector('yt-page-header-renderer');
      break;

    default:
      console.warn("Not on a valid page!");
      return; // not on a standard page yet
  }

  // 2) Avoid duplicates; re-render if it already exists
  // const CARD_ID = 'woy-info-card';
  const existing = container.querySelector('#' + CARD_ID);
  if (existing) existing.remove();

  // 3) Build card container with Shadow DOM (prevents YT CSS conflicts)
  const host = document.createElement('div');
  host.id = CARD_ID;
  host.setAttribute('style', 'display:block;margin:12px 0 16px 0;');
  const shadow = host.attachShadow({ mode: 'open' });

  // 4) Data guards + formatting
  const hasData = !!data && typeof data === 'object';
  const owner = hasData && (data.owner || 'Unknown owner');
  const type = hasData && (data.ownership_type || 'Unknown');
  const acq = hasData && (data.acquisition_date ? formatAcq(data.acquisition_date) : '—');
  const notes = hasData && (data.notes || '');
  const sources = hasData && Array.isArray(data.source_url) ? data.source_url : [];

  // 5) Render
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
      }
      .card {
        display: grid;
        gap: 8px;
        padding: 12px 14px;
        border: 1px solid rgba(140,140,140,.3);
        background: rgba(250,250,250,.9);
        color: #111;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,.06);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .pill {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        font-weight: 600;
        letter-spacing: .2px;
        border: 1px solid rgba(0,0,0,.08);
      }
      .pill.full { background:#e6f5ec; }
      .pill.partial { background:#eef3ff; }
      .pill.unknown { background:#f5f5f5; }
      .owner {
        font-weight: 700;
        font-size: 14px;
      }
      .meta {
        font-size: 12.5px;
        opacity: .8;
      }
      .notes {
        font-size: 13px;
        line-height: 1.35;
      }
      .links a {
        font-size: 12.5px;
        text-decoration: none;
        border-bottom: 1px dotted currentColor;
      }
      .muted { opacity:.7 }
      @media (prefers-color-scheme: dark) {
        .card { background: rgba(28,28,28,.85); color: #f1f1f1; border-color: rgba(255,255,255,.12); }
        .pill { border-color: rgba(255,255,255,.12); }
        .pill.full { background:#133019; }
        .pill.partial { background:#1a253d; }
        .pill.unknown { background:#2a2a2a; }
      }
    </style>

    <div class="card" role="region" aria-label="Channel ownership information">
      <div class="row">
        <span class="pill ${pillClass(type)}">${labelType(type)}</span>
        <span class="owner">${escapeHtml(owner)}</span>
        <span class="meta muted">Acquired: ${escapeHtml(acq)}</span>
      </div>

      <div class="notes">${notes ? escapeHtml(notes) : '<span class="muted">No notes available.</span>'}</div>
    </div>
  `;

  // 6) Insert box as first child of container
  // ownerRow.parentElement.insertBefore(host, ownerRow);
  container.prepend(host);

  console.log("Data displayed: ", host);

  // ---- helpers ----
  function pillClass(t) {
    const k = String(t || '').toLowerCase();
    if (k.includes('full')) return 'full';
    if (k.includes('partial') || k.includes('minority') || k.includes('majority')) return 'partial';
    return 'unknown';
  }
  function labelType(t) {
    return (t && String(t).trim()) ? t : 'Ownership';
  }
  function formatAcq(s) {
    // Accepts "YYYY-MM-DD", "YYYY-MM-00", "YYYY-00-00", "YYYY"
    const parts = String(s).split('-');
    const [y, m, d] = [parts[0], parts[1], parts[2]];
    if (!y || y === '0000') return '—';
    if (!m || m === '00') return y;
    const month = ({
      '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
      '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'
    })[m] || m;
    return `${month} ${y}`;
  }
  function renderSources(urls) {
    if (!urls || !urls.length) return '<span class="muted">No public source listed.</span>';
    return urls.map((u, i) =>
      `<a href="${escapeAttr(u)}" target="_blank" rel="noopener noreferrer">Source ${i+1}</a>`
    ).join(' &middot; ');
  }
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;');
  }
}

function clearInfoCard() {
  const el = document.getElementById(CARD_ID);
  if (el) el.remove();
}

//helper method?
function getPageType(url = location.href) {
  const href = String(url);
  console.log("identifying ", href);

  if (href.includes('/watch?v=')) return 'video';
  if (href.includes('/shorts/')) return 'short';
  if (href.includes('/@') || href.includes('/c/') || href.includes('/channel/')) return 'channel';

  return null;
}



// Load the JSON file
let CHANNEL_DB = null;

async function loadChannelDatabase() {
  console.log("Loading channels.json...");
  if (CHANNEL_DB) return CHANNEL_DB; //don't need to reload channels.json if it's already cached

  const response = await fetch(chrome.runtime.getURL("data/channels.json"));

  if (!response.ok) {
    console.error("Failed to load JSON:", response.statusText);
    return [];
  }

  CHANNEL_DB = await response.json();
  console.log("Loaded channel databse:", CHANNEL_DB);
  return CHANNEL_DB;
}


// Search by channelid or channel name or channel handle (case-insensitive)
async function searchChannelDatabase(query) {
  const db = await loadChannelDatabase();
  const normalized = String(query ?? "").trim().toLowerCase();

  

  // ? operator checks to see if channel_id is null before running .toLowerCase()
  let match = null;
  const fields = ["channel_id", "channel_name", "channel_tag"];

  for (const field of fields) {
    match = db.find(c => { 
      // console.log("checking: ", c[field]?.toLowerCase());
      return String(c?.[field] ?? "").trim().toLowerCase() === normalized;
  });
    if (match) break;
  }

  if (match) {
    console.log("Match found:", match);
    displayData(match);
  } else {
    console.log("No match found for:", query);
    // console.log("Normalized query:", normalized);
  }
}


function getChannelFromURL(url=location.href) {
  console.log("getChannelIdentifier: current URL =", url);

  //match /channel/UC... pattern
  const channelMatch = url.match(/\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelMatch) {
    console.log("Matched /channel/ URL");
    return { type: "id", value: channelMatch[1] };
  }
  // Match @username pattern
  const handleMatch = url.match(/\/@([a-zA-Z0-9_-]+)/);
  if (handleMatch) {
    console.log("Matched @handle URL");
    return { type: "handle", value: handleMatch[1] };
  }
  // Match /c/CustomName
  const customMatch = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (customMatch) {
    console.log("Matched /c/CustomeName URL");
    return { type: "custom", value: customMatch[1] };
  }

  console.log("⚠️ No match found from ", url);
  return null;
}

function getChannelFromShortPage() {
  const channelLink = document.querySelector('yt-reel-channel-bar-view-model a');

  if (channelLink && channelLink.href) {
    const url = channelLink.href;
    console.log("Found channel URL from DOM:", url);
    return getChannelFromURL(url);
  }

  return null;
}

function getChannelFromVideoPage() {
  const channelLink = document.querySelector('ytd-video-owner-renderer a');

  if (channelLink && channelLink.href) {
    const url = channelLink.href;
    console.log("Found channel URL from DOM:", url);

    // Match from the path only
    // const match = url.match(/youtube\.com\/(?:channel\/|@|c\/)([a-zA-Z0-9_-]+)/);
    return getChannelFromURL(url);
  }

  return null;
}


//run the detection and search logic
async function checkCurrentChannel() {
  if (!WOY.enabled) return;

  console.log("Checking for channel info...");
  let pageType = getPageType();
  console.log("Page type identified:", pageType);

  switch (getPageType()){
    case 'video': {
      const id = getChannelFromVideoPage();
      if (id) {
        console.log("✅ Found channel from video page: ", id);
        await searchChannelDatabase(id.value);
      }
      else console.error("⚠️ something went wrong!");
      break;
    }
    case 'short': {
      const id = getChannelFromShortPage();//NOT A THING YET, TODOOO
      if (id) {
        console.log("✅ Found channel from short page: ", id);
        await searchChannelDatabase(id.value);
      }
      else console.error("⚠️ something went wrong!");
      break;
    }
    case 'channel': {
      const id = getChannelFromURL();
      if (id) {
        console.log("✅ Found channel from URL: ", id);
        await searchChannelDatabase(id.value);
      }
      else console.error("⚠️ something went wrong!");
      break;
    }
    default:
      console.log("🚫 Channel data cannot be found from URL or DOM, returned null");
  }
}


//

let polling = false;
let rafId = null;

function waitForChannelElement() {
  if (!WOY.enabled) return;
  if (polling) {
    console.log("new polling attempted, cancelled");
    return;
  }
  polling = true;

  function poll() {
    if (!WOY.enabled) { polling = false; return; }
    const channelLink = document.querySelector('ytd-video-owner-renderer a');
    if (channelLink) {
      polling = false;
      setTimeout(checkCurrentChannel, 3000); // small delay to wait for new DOM
    } else {
      rafId = requestAnimationFrame(poll);
    }
  }

  poll();
}

// initial call on page load
clearInfoCard();
waitForChannelElement();