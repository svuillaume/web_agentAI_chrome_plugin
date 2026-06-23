# Web AI Agent — Chrome Extension

Claude chat side panel with live FortiCNAPP security tools, LQL query runner, and AI gateway compatibility.

## Install

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this `extension/` folder
3. Click the toolbar icon to open the side panel

Requires the Docker backend running on `localhost:8765` (see root `README.md`).

## Config bar

| Field | Purpose |
|---|---|
| Gateway | AI gateway type — sets auth headers automatically |
| url | Gateway base URL |
| key | API key for the selected gateway |
| model | Claude model |

**Gateway → header mapping:**

| Gateway | Header |
|---|---|
| ⚡ Bifrost | `x-api-key: sk-bf-…` |
| Portkey | `x-portkey-api-key: pk-…` |
| LiteLLM | `Authorization: Bearer sk-…` |
| Helicone | `x-api-key` (Anthropic) + `helicone-auth: Bearer` (Helicone) |

Gateway choice and model persist across Chrome sessions. The API key is session-RAM only.

## Security tools

Buttons greyed out when `~/.lacework.toml` credentials are not detected by the backend.

| Button | What it does |
|---|---|
| 🛡 Scan | FortiCNAPP SCA + SAST on code found on this page |
| 📋 Compliance | Generate + download compliance PDF |
| 🚨 CVE | Attack surface: search a CVE across hosts & containers by internet exposure |
| 🔍 LQL | Run saved or AI-generated LQL queries |

## LQL drawer

**Saved queries** — pick a `.yaml` from the dropdown, click ▶ Run.

**✨ Generate** — type a plain-English objective, press **Build**. Claude writes the LQL and shows it for review. Click ▶ Run to execute.

## Files

```
manifest.json   MV3 config, permissions, CSP
background.js   Service worker — opens side panel on icon click
panel.html      UI: config bar, chip buttons, chat log, LQL drawer
panel.js        All logic: gateway headers, streaming, LQL, CVE, CodeSec
```
