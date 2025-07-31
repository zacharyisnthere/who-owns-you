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

// Search by channelid or channel name (case-insensitive)
async function searchChannelDatabase(query) {
  const db = await loadChannelDatabase();
  const normalized = query.trim().toLowerCase();

  // Try id first, the ? operator checks to see if channel_id is null before running .toLowerCase()
  let match = db.find(c => c.channel_id?.toLowerCase() === normalized);
  
  if (!match) {
    // Then try name
    match = db.find(c => c.channel_name?.toLowerCase() === normalized);
  }

  if (match) {
    console.log("Match found:", match);
  } else {
    console.log("No match found for:", query);
  }
}

// Call the function with a test channel ID or name
searchChannelDatabase("Veritasium"); // or use actual channel ID like "UCHnyfMqiRRG1u-2MsSQLbXA"
