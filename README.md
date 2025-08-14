# Who Owns You - Browser Extension
*Revealing private equity ownership in media.* 
</br>
<sub>*This project was inspired by <a href='https://www.youtube.com/watch?v=hJ-rRXWhElI'>this youtube video.</a>*</sub>
***
## Screenshots
<img src="https://github.com/zacharyisnthere/who-owns-you/blob/main/screenshots/screenshot-4.png" width="480">
<img src="https://github.com/zacharyisnthere/who-owns-you/blob/main/screenshots/screenshot-7.png" width="480">
<img src="https://github.com/zacharyisnthere/who-owns-you/blob/main/screenshots/screenshot-8.png" width="480">

## 🚀Quick start (dev install)
**1. Clone this repo**</br>
```bash
git clone https://github.com/zacharyisnthere/who-owns-you.git
cd who-owns-you
```
**2. Open Chrome/Brave/Edge (Chromium Version)**
- Go to `chrome://extensions/`
- Enable Developer mode
- Load unpacked
- select the repo root

**3. Open a YouTube page**
- Video -> box appears below the player, above the channel bar
- Shorts -> box appears in the top info area
- Channel page -> badge appears above the channel name, underneath the banner

## How It Works
- **Parsing:** content.js parses the URL to determine if you're on a video or short before trying to find a link to the channel page (or just grabbing the URL if you're on a channel page already)
- **Lookup:** The channel URL is trimmed and used to seach channels.json for matching `channel_id`, `channel_name`, or `channel_tag`.
- **Injection:** If a match is found, the data is rendered and injected into the page.

## Permissions & Privacy
- **Manifest V3** with minimal permissions:
  - `activeTab` -> Read the current YouTube DOM
  - `storage`(not currently applicable) -> Store user prefs for badge styling

## Data Model
Each channel entry in `/data/channels.json` follows this schema:
```json
{
  "channel_id": "UCxxxxxxxxxxxxxxxxxxxxxx",
  "channel_name": "Example Channel",
  "channel_tag": "examplehandle",
  "channel_url": "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx",
  "owner": "Example Capital",
  "ownership_type": "Full|Partial|Majority|Minority",
  "acquisition_date": "YYYY-MM-DD",
  "source_url": [
    "https://example.com/source"
  ],
  "notes": "One-sentence summary of ownership."
}
```
***Source requirement:** All entries must include at least one public, verifiable source link (currently in progress)

## Roadmap and Future Plans
This is my first open-source project I've ever attempted, and it's a lot of fun but I'd be lying if I said I wasn't a little out of my depth. My dream for this project is to have easy methods of contribution open to the community, allowing corrections, new data entries, bug fixes, and new features to come from the people that use the app. I have no idea how to build a community or project like that, of course, but every update I put out for this thing comes from that North Star.

Some other future updates will hopefully include:
- Firefox compatibility
- Better stylizing and info communication
- Bigger data set
- Possibly a better method of loading and searching data set
- Easy ways for strangers to contribute to the data set
  - (possibly taking inspiration from projects like wikipedia or other community-driven open-source projects)

## Contributing
If you'd like to contribute, we'd love to have your input! Currently, we're especially accepting PRs for:
- **New data entries or corrections**
- **Bug fixes**
- **Feature enhancements**

### Adding a channel
1. Fork the repo
2. Edit `/data/channels.json` and follow the schema
3. Submit a PR using the **Data addition** template
See CONTRIBUTING.md for details.

### 📦 Releases
- Download `.zip` builds from the [Releases](https://github.com/zacharyisnthere/who-owns-you/releases) tab
- Install via "Load unpacked" in any Chromium-based browser

## ❓ FAQ
- **Q: Why is/isn't ___ channel flagged?**
  - A: The dataset is a work-in-progress, and there are a lot of channels either not in the dataset yet or whose ownership isn't confirmed from public sources. Please contribute via PR!
- **Q: Does this run on Firefox?**
  - A: Not yet, but Firefox is my daily-driver browser, so be ready for a future release soon!
- **Q: How do I verify an ownership claim?**
  - A: All claims should be backed by public sources linked in the dataset, however it's always a good idea to verify information for yourself. DYOR and all that.

## License
[MIT](https://github.com/zacharyisnthere/who-owns-you/blob/main/LICENSE) - free to use, modify, and distribute.
Ownership data is provided for informational purposes only; accuracy is not guaranteed.

## 📌 Disclaimer
This project is not affiliated with YouTube or Google. All trademarks belong to their respective owners. Ownership information is derived from publicly available sources and may not always be current.
