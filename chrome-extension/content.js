console.log("Is content.js running?");

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
  const normalized = query.trim().toLowerCase();

  

  // ? operator checks to see if channel_id is null before running .toLowerCase()
  const fields = ["channel_id", "channel_name", "channel_tag"];
  let match = null;

  for (const field of fields) {
    match = db.find(c => c[field]?.toLowerCase() === normalized);
    if (match) break;
  }

  if (match) {
    console.log("Match found:", match);
  } else {
    console.warn("No match found for:", query);
  }
}


function getChannelFromURL() {
  const url = window.location.href;
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

  console.log("No match found in getChannelIdentifier");
  return null;
}

function getChannelFromVideoPage() {
  const channelLink = document.querySelector('ytd-video-owner-renderer a');

  if (channelLink && channelLink.href) {
    const url = channelLink.href;
    console.log("Found channel URL from DOM:", url);

    // Match from the path only
    const match = url.match(/youtube\.com\/(?:channel\/|@|c\/)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return { name: match[1], url };
    }
  }

  return null;
}


//run the detection and search logic
async function checkCurrentChannel() {
  console.log("Checking for channel info...");

  //check via url
  const id = getChannelFromURL();
  if (id) {
    console.log("Found channel from URL: ", id);
    await searchChannelDatabase(id.value);
    return;
  } else {
    console.log("No channel from URL");
  }

  //check via dom
  const id2 = getChannelFromVideoPage();
  if (id2) {
    console.log("Found channel from DOM: ", id2);
    await searchChannelDatabase(id2.name);
    return;
  } else {
    console.log("No channel from DOM");
  }

  console.warn("Channel data not found from URL or DOM, returned null");
}


// MutationObserver for single-page app navigation
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log("🔄 URL changed:", currentUrl);
    waitForChannelElement(); // small delay to wait for new DOM
  }
});

observer.observe(document, { subtree: true, childList: true }); 


//

let polling = false;

function waitForChannelElement() {
  if (polling) return;
  polling = true;

  function poll() {
    const channelLink = document.querySelector('ytd-video-owner-renderer a');
    if (channelLink) {
      polling = false;
      checkCurrentChannel();
    } else {
      requestAnimationFrame(poll);
    }
  }

  poll();
}

// initial call on page load
waitForChannelElement();


// setTimeout(checkCurrentChannel, 1000); //just waits for 1000ms, could change to polling the DOM but this works for now.
/*In fact, I need to change this to polling to the dom.
* There's a bug right now where the search fails if I open a video from the search page, but still works on reloading or opening it from a different page. 
* Theory rn is that the load times from the search page are longer than 1000, so when checkCurrentChannel is called it fails.
*/