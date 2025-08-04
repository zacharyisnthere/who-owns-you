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

  // Try id first, the ? operator checks to see if channel_id is null before running .toLowerCase()
  let match = db.find(c => c.channel_id?.toLowerCase() === normalized);
  
  // Then try name
  if (!match) {
    match = db.find(c => c.channel_name?.toLowerCase() === normalized);
  }

  // Then try tag/handle
  if (!match) {
    match = db.find(c => c.channel_tag?.toLowerCase() === normalized);
  }

  if (match) {
    console.log("Match found:", match);
  } else {
    console.log("No match found for:", query);
  }
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


function getChannelIdentifier() {
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

  console.warn("No match found in getChannelIdentifier");
  return null;
}



//run the detection and search logic
async function checkCurrentChannel() {
  console.log("Checking for channel info...");

  const id = getChannelIdentifier();
  if (id) {
    console.log("Found channel from URL: ", id);
    await searchChannelDatabase(id.value);
    return;
  } else {
    console.log("No channel from URL");
  }

  const info = getChannelFromVideoPage();
  if (info) {
    console.log("Found channel from DOM: ", info);
    await searchChannelDatabase(info.name);
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
    setTimeout(checkCurrentChannel, 1000); // small delay to wait for new DOM
  }
});

observer.observe(document, { subtree: true, childList: true });

// Initial run
setTimeout(checkCurrentChannel, 1000); //just waits for 1000ms, could change to polling the DOM but this works for now.