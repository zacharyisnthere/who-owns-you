console.log("'Who Owns You' browser extension is running!");


// Call this with either a matched data object or null/undefined
// e.g. displayData(match)


const CARD_ID = 'woy-info-card';

async function displayData(data) {
  console.log("Displaying info box...")

  // 1) Find insertion point: before the channel row on a watch page
  const container = document.querySelector('ytd-watch-flexy #above-the-fold');
  if (!container) return; // not on a standard watch page yet

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

      <div class="links">
        ${renderSources(sources)}
      </div>
    </div>
  `;

  // 6) Insert as the first child of #above-the-fold
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



// Load the JSON file
async function loadChannelDatabase() {
  console.log("Loading channels.json...");
  const response = await fetch(chrome.runtime.getURL("data/channels.json"));

  if (!response.ok) {
    console.error("Failed to load JSON:", response.statusText);
    return [];
  }

  const data = await response.json();
  console.log("Loaded channel database:", data);
  return data;
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


function getChannelFromURL(url) {
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
  console.log("Checking for channel info...");

  //check via url
  const id = getChannelFromURL(window.location.href);
  if (id) {
    console.log("✅ Found channel from URL: ", id);
    await searchChannelDatabase(id.value);
    return;
  } else {
    console.log("⚠️ No channel from URL");
  }

  //check via dom
  const id2 = getChannelFromVideoPage();
  if (id2) {
    console.log("✅ Found channel from DOM: ", id2);
    await searchChannelDatabase(id2.value);
    return;
  } else {
    console.log("⚠️ No channel from DOM");
  }

  console.log("🚫 Channel data not found from URL or DOM, returned null");
}


// MutationObserver for single-page app navigation
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log("🔄 URL changed:", currentUrl);
    clearInfoCard();
    waitForChannelElement();
  }
});

observer.observe(document, { subtree: true, childList: true }); 


//

let polling = false;

function waitForChannelElement() {
  if (polling) {
    console.log("new polling attempted, cancelled");
    return;
  }
    polling = true;

  function poll() {
    const channelLink = document.querySelector('ytd-video-owner-renderer a');
    if (channelLink) {
      polling = false;
      setTimeout(checkCurrentChannel, 4000); // small delay to wait for new DOM
    } else {
      requestAnimationFrame(poll);
    }
  }

  poll();
}

// initial call on page load
clearInfoCard();
waitForChannelElement();


// setTimeout(checkCurrentChannel, 1000); //just waits for 1000ms, could change to polling the DOM but this works for now.
/*In fact, I need to change this to polling to the dom.
* There's a bug right now where the search fails if I open a video from the search page, but still works on reloading or opening it from a different page. 
* Theory rn is that the load times from the search page are longer than 1000, so when checkCurrentChannel is called it fails.
*/