# Bifrost — Chrome Extension

A minimal Chrome side-panel chat UI for the [Bifrost AI Gateway](https://bifrost.fabriclab.ca).

## Configuration (first-time setup)

The extension auto-fills its URL and API key from `extension/config.json` on every load.

1. Copy the template:
   ```bash
   cp extension/config.json.tpl extension/config.json
   ```

2. Edit `extension/config.json` with your values:
   ```json
   {
     "bifrost_url": "https://bifrost.fabriclab.ca/anthropic",
     "api_key": "sk-bf-..."
   }
   ```

   These values map to the following variables in `bifrost/.env`:

   | `config.json` key | `.env` variable        |
   |-------------------|------------------------|
   | `bifrost_url`     | `ANTHROPIC_BASE_URL`   |
   | `api_key`         | `BIFROST_VIRTUAL_KEY`  |

> **`config.json` is gitignored** — it will never be committed. Do not commit it manually.

## Install

1. Complete the configuration step above
2. Open `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `extension/` folder
5. Click the ⚡ icon in the toolbar — the side panel opens

On first open the URL and key are auto-filled from `config.json`. The status bar shows `config loaded`.

## Web Search (optional)

Powered by a local [SearXNG](https://docs.searxng.org) container. Requires Docker.

1. Generate the config and start:
   ```bash
   mkdir -p searxng
   sed "s/REPLACE_WITH_RANDOM_SECRET/$(openssl rand -hex 32)/" searxng.settings.yml.tpl > searxng/settings.yml
   docker compose up -d
   ```
2. Search runs automatically when the model needs current information
3. Stop: `docker compose down`

> **`searxng/settings.yml` is gitignored** — the generated secret never leaves your machine.

## Usage

- Type a message and press **Enter** (Shift+Enter for newline)
- Pick model: haiku-4-5 ⚡ / sonnet-4-6 / opus-4-8
- **Read Web Page** — loads the current tab into context so you can ask questions about it
- **TL;DR** — instantly summarizes the current page in bullet points
- **clear** resets the conversation history

The side panel stays open while you browse.

## Security model

| What | Storage | Lifetime |
|------|---------|----------|
| Bifrost URL | `chrome.storage.session` (RAM) | Cleared on Chrome close |
| API key | `chrome.storage.session` (RAM) | Cleared on Chrome close |
| Model choice | `chrome.storage.local` (disk) | Persists (not sensitive) |
| Chat history | JS memory | Cleared on panel close |

**Keys never touch disk after loading.** `config.json` is read once on open; values are held in RAM only for the duration of the Chrome session.

CSP locks outbound connections to `https:` only. No telemetry, no third-party requests.

## Code Security Scan

Scanned with **Lacework FortiCNAPP Code Security** (IaC + SCA/SAST) on 2026-06-22.

| Severity | IaC | SCA | Total |
|----------|-----|-----|-------|
| Critical |  0  |  0  |   0   |
| High     |  0  |  0  |   0   |
| Medium   |  0  |  0  |   0   |
| Low      |  0  |  0  |   0   |

**No findings in project code.** 39 findings in `.venv/` (third-party packages) excluded via `.lacework/codesec.yaml`.

## Files

```
extension/
  manifest.json         Extension config, permissions, CSP
  background.js         Service worker — opens side panel on icon click
  panel.html            Side panel UI
  panel.js              Chat logic, page reader, search, XSS-safe rendering
  config.json           Your credentials — gitignored, never committed
  config.json.tpl       Template for config.json
  icon*.png             16 / 48 / 128 px icons
searxng.settings.yml.tpl  SearXNG config template (safe, no secrets)
docker-compose.yml      Starts local SearXNG search container
bifrost/.env            Source of truth for credentials (not committed)
.lacework/codesec.yaml  SCA scan exclusions
```
