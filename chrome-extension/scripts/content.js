console.log("'Who Owns You' browser extension is running!");

// ===== Enable/Disable infrastructure =====
const KEY = "woy_enabled"; // storage key

const WOY = {
  enabled: false,
  lastSeq: 0,
  observer: null,          // legacy single observer slot (safe to keep)
  observers: new Set(),    // track all observers we create
  intervals: new Set(),
  timeouts: new Set(),
  cleanups: new Set()
};

// Register a cleanup fn to run on disable()
function onCleanup(fn) {
  WOY.cleanups.add(fn);
  return fn;
}

// Clear all timers/observers/UI when disabling
function runCleanup() {
  // stop intervals/timeouts
  for (const id of WOY.intervals) clearInterval(id);
  WOY.intervals.clear();

  for (const id of WOY.timeouts) clearTimeout(id);
  WOY.timeouts.clear();

  // disconnect observers
  if (WOY.observer) {
    WOY.observer.disconnect();
    WOY.observer = null;
  }
  for (const mo of WOY.observers) {
    try { mo.disconnect?.(); } catch (_) {}
  }
  WOY.observers.clear();

  // remove injected UI
  document.getElementById('woy-badge')?.remove();

  // run custom cleanups
  for (const fn of WOY.cleanups) {
    try { fn(); } catch (e) { console.warn('[WOY] cleanup error', e); }
  }
  WOY.cleanups.clear();
}

// ===== Boot =====
init().catch(console.error);

async function init() {
  const { [KEY]: enabled = false, woy_seq = 0 } = await chrome.storage.local.get([KEY, 'woy_seq']);
  applyEnabled(!!enabled, Number(woy_seq) || 0, 'init');

  // Instant flip for the active tab
  chrome.runtime.onMessage.addListener((m) => {
    if (m?.type === 'woy:setEnabled') {
      applyEnabled(!!m.value, Number(m.seq) || 0, 'message');
    }
  });

  // Cross-tab/state sync
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const has = Object.prototype.hasOwnProperty.bind(changes);
    if (has(KEY) || has('woy_seq')) {
      const next = has(KEY) ? !!changes[KEY].newValue : WOY.enabled;
      const seq  = has('woy_seq') ? Number(changes.woy_seq.newValue) : WOY.lastSeq;
      applyEnabled(next, seq, 'storage');
    }
  });
}

function applyEnabled(next, seq, source) {
  // Ignore stale events (e.g., ON then OFF fast)
  if (seq < WOY.lastSeq) return;
  WOY.lastSeq = seq;

  // No-op if state unchanged
  if (next === WOY.enabled) return;
  WOY.enabled = next;

  if (next) enable();
  else disable();
}

function enable() {
  // Always start from a clean slate
  runCleanup();

  // Start SPA hooks and do first injection + data check
  startSpaHooks();
  maybeInjectForCurrentPage();
  checkCurrentChannel();

  console.log("[WOY] ENABLED");
}

function disable() {
  runCleanup();
  console.log("[WOY] DISABLED");
}

// ===== YouTube SPA handling =====
function startSpaHooks() {
  const recheck = debounce(() => {
    if (!WOY.enabled) return;
    // remove stale UI (idempotent) then reinject & refresh data
    document.getElementById('woy-badge')?.remove();
    maybeInjectForCurrentPage();
    checkCurrentChannel();
  }, 200);

  // YouTube events (best if present)
  const onNav = () => recheck();
  document.addEventListener('yt-navigate-finish', onNav, true);
  document.addEventListener('yt-page-data-updated', onNav, true);
  onCleanup(() => {
    document.removeEventListener('yt-navigate-finish', onNav, true);
    document.removeEventListener('yt-page-data-updated', onNav, true);
  });

  // Fallback: URL-compare MutationObserver
  let lastHref = location.href;
  const mo = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      recheck();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  WOY.observers.add(mo);
  onCleanup(() => { try { mo.disconnect(); } catch(_){} WOY.observers.delete(mo); });

  // Wake up when tab becomes visible (BFCache, detach/attach)
  const onVis = () => { if (!document.hidden) recheck(); };
  document.addEventListener('visibilitychange', onVis, true);
  onCleanup(() => document.removeEventListener('visibilitychange', onVis, true));
}

// ===== Page type & placement =====
function getPageType() {
  const p = location.pathname;
  if (p.startsWith('/watch')) return 'watch';
  if (p.startsWith('/shorts/')) return 'shorts';
  if (p.startsWith('/@') || p.startsWith('/c/') || p.startsWith('/channel/')) return 'channel';
  return 'other';
}

function maybeInjectForCurrentPage() {
  const type = getPageType();
  if (type !== 'watch') {
    document.getElementById('woy-badge')?.remove();
    return;
  }

  waitForElement('#above-the-fold', 5000)
    .then(container => {
      document.getElementById('woy-badge')?.remove(); // prevent dupes
      injectBadge(container);
    })
    .catch(() => {
      // No target yet; harmless—SPA hooks will retry on next nav/dom change
    });
}

function waitForElement(selector, timeout = 5000) {
  const el = document.querySelector(selector);
  if (el) return Promise.resolve(el);

  return new Promise((resolve, reject) => {
    const mo = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { mo.disconnect(); resolve(found); }
    });
    mo.observe(document, { childList: true, subtree: true });

    const to = setTimeout(() => { mo.disconnect(); reject(new Error('timeout')); }, timeout);
    WOY.timeouts.add(to);
    onCleanup(() => clearTimeout(to));
  });
}

function debounce(fn, ms) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
}

// ===== Data loading & search =====
let CHANNEL_DB = null;

async function loadChannelDatabase() {
  // IMPORTANT: if your file lives at project root, change to "channels.json"
  const url = chrome.runtime.getURL("data/channels.json");
  console.log("[WOY] Loading channels:", url);

  if (CHANNEL_DB) return CHANNEL_DB;

  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    console.error("[WOY] Fetch failed:", e);
    return (CHANNEL_DB = []);
  }

  if (!response.ok) {
    console.error("[WOY] Failed to load channels.json:", response.status, response.statusText);
    return (CHANNEL_DB = []);
  }

  CHANNEL_DB = await response.json();
  console.log("[WOY] Loaded channel database:", CHANNEL_DB?.length ?? 0, "records");
  return CHANNEL_DB;
}

// Search by channel_id, channel_name, or channel_tag (case-insensitive)
async function searchChannelDatabase(query) {
  const db = await loadChannelDatabase();
  const normalized = String(query ?? "").trim().toLowerCase();

  let match = null;
  const fields = ["channel_id", "channel_name", "channel_tag"];

  for (const field of fields) {
    match = db.find(c => String(c?.[field] ?? "").trim().toLowerCase() === normalized);
    if (match) break;
  }

  if (match) {
    console.log("[WOY] Match found:", match);
    renderBadgeContent(match);
  } else {
    console.log("[WOY] No match found for:", query);
    renderBadgeContent(null);
  }
}

// ===== Channel identification helpers =====
function getChannelFromURL(url = location.href) {
  // /channel/UC...
  const channelMatch = url.match(/\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelMatch) return { type: "id", value: channelMatch[1] };

  // /@handle
  const handleMatch = url.match(/\/@([a-zA-Z0-9_-]+)/);
  if (handleMatch) return { type: "handle", value: handleMatch[1] };

  // /c/CustomName
  const customMatch = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (customMatch) return { type: "custom", value: customMatch[1] };

  return null;
}

function getChannelFromShortPage() {
  const channelLink = document.querySelector('yt-reel-channel-bar-view-model a');
  if (channelLink && channelLink.href) return getChannelFromURL(channelLink.href);
  return null;
}

function getChannelFromVideoPage() {
  const channelLink = document.querySelector('ytd-video-owner-renderer a');
  if (channelLink && channelLink.href) return getChannelFromURL(channelLink.href);
  return null;
}

// Run detection + search based on current page
async function checkCurrentChannel() {
  if (!WOY.enabled) return;

  const pageType = getPageType();
  switch (pageType) {
    case 'watch': {
      const id = getChannelFromVideoPage();
      if (id) await searchChannelDatabase(id.value);
      break;
    }
    case 'shorts': {
      const id = getChannelFromShortPage();
      if (id) await searchChannelDatabase(id.value);
      break;
    }
    case 'channel': {
      const id = getChannelFromURL();
      if (id) await searchChannelDatabase(id.value);
      break;
    }
    default:
      // Not a supported page; ensure UI is absent
      document.getElementById('woy-badge')?.remove();
  }
}

// ===== UI injection & rendering =====
function injectBadge(container) {
  const el = document.createElement('div');
  el.id = 'woy-badge';
  el.style.cssText = [
    'margin:12px 0',
    'padding:12px',
    'border-radius:12px',
    'background:#1c1c1c',
    'color:#fafafa',
    'font: 500 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans'
  ].join(';');
  el.textContent = 'Who Owns You — loading…';
  container.prepend(el);
}

function renderBadgeContent(data) {
  const el = document.getElementById('woy-badge');
  if (!el) return;

  if (!data || typeof data !== 'object') {
    el.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">Who Owns You</div>
      <div style="opacity:.7">No ownership match found for this channel.</div>
    `;
    return;
  }

  const owner = data.owner || 'Unknown owner';
  const type  = data.ownership_type || 'Unknown';
  const acq   = data.acquisition_date ? formatAcq(data.acquisition_date) : '—';
  const notes = data.notes || '';
  const sources = Array.isArray(data.source_url) ? data.source_url : [];

  el.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px">Who Owns You</div>
    <div>${escapeHtml(owner)} <span style="opacity:.75">(${escapeHtml(type)})</span></div>
    <div style="opacity:.8">Acquired: ${escapeHtml(acq)}</div>
    <div style="margin-top:6px">${notes ? escapeHtml(notes) : '<span style="opacity:.6">No notes.</span>'}</div>
    <div style="margin-top:6px;opacity:.85">${renderSources(sources)}</div>
  `;
}

function formatAcq(s) {
  const parts = String(s).split('-');
  const [y, m] = [parts[0], parts[1]];
  if (!y || y === '0000') return '—';
  if (!m || m === '00') return y;
  const month = {
    '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
    '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'
  }[m] || m;
  return `${month} ${y}`;
}

function renderSources(urls) {
  if (!urls || !urls.length) return 'No public source listed.';
  return urls.map((u,i) =>
    `<a href="${escapeAttr(u)}" target="_blank" rel="noopener noreferrer">Source ${i+1}</a>`
  ).join(' · ');
}

function escapeHtml(str='') {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
function escapeAttr(str='') {
  return String(str).replace(/"/g,'&quot;');
}
