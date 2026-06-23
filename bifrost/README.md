# Web AI Agent

Browser-native AI security assistant — Claude chat + live FortiCNAPP cloud security data in a Chrome side panel.

## Architecture

```
Chrome Extension (side panel)
  │
  ├─ Chat ──────────► AI Gateway  (Bifrost / Portkey / LiteLLM / Helicone)
  │                        └──► Claude API
  │
  └─ Security tools ► serve.py  localhost:8765
                           ├──► FortiCNAPP REST API
                           ├──► lacework CLI  (SCA/SAST, SBOM, Compliance PDF)
                           └──► SearXNG       localhost:8080
```

`serve.py` is a zero-dependency Python stdlib HTTP server. It auto-detects `~/.lacework.toml` at startup and exposes `lw_ready` to the extension — security tool buttons are greyed out when credentials are absent.

## Features

| Button | Requires | What it does |
|---|---|---|
| 📄 Read | — | Load current page into chat context |
| TL;DR | — | Summarise page in 3–5 bullets with source links |
| 🛡 Scan | 🔑 FortiCNAPP | SCA + SAST on code found on this page |
| 📋 Compliance | 🔑 FortiCNAPP | Generate + download compliance PDF |
| 🚨 CVE | 🔑 FortiCNAPP | Attack surface: hosts & containers by internet exposure |
| 🔍 LQL | 🔑 FortiCNAPP | Run saved or AI-generated LQL queries |
| ✕ Clear | — | Clear chat history |

## AI Gateway Compatibility

Set your gateway in the config bar — headers are built automatically.

| Gateway | Auth sent | Key format |
|---|---|---|
| ⚡ Bifrost | `x-api-key` | `sk-bf-…` |
| Portkey | `x-portkey-api-key` | `pk-…` |
| LiteLLM | `Authorization: Bearer` | `sk-…` |
| Helicone | `x-api-key` + `helicone-auth: Bearer` | Anthropic key + Helicone key |

Gateway choice and model selection persist across Chrome sessions (`chrome.storage.local`). The API key is kept in session RAM only — cleared on Chrome close.

## Setup

### 1. Credentials

```
# .env  (copy from .env.example)
ANTHROPIC_BASE_URL=https://bifrost.yourhost.com/anthropic
BIFROST_VIRTUAL_KEY=sk-bf-…
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-6
LQL_QUERIES_DIR=/lql_queries
```

FortiCNAPP credentials go in `~/.lacework.toml` (standard `lacework configure` output). The container mounts it read-only.

### 2. Start the backend

```bash
docker compose up -d
```

Two containers start: `bifrost-serve` (port 8765) and `bifrost-search` / SearXNG (port 8080).

Any change to `serve.py` requires a rebuild:
```bash
docker compose up --build -d bifrost
```

### 3. LQL queries (optional)

Pre-built `.yaml` queries are mounted from `~/claude_cnapp/lql/lql_queries/` (see `docker-compose.yml`). The **✨ Generate** tab lets you skip this entirely — describe what you want, Claude writes and runs the query.

### 4. Load the extension

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the `extension/` folder
3. Click the toolbar icon to open the side panel

URL and key auto-fill from `/config` on first open.

## Backend endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/config` | Returns gateway URL, key, `lw_ready` |
| GET | `/search?q=…` | SearXNG proxy (CORS bypass) |
| POST | `/codesec` | lacework SCA + SAST scan |
| POST | `/sbom` | CycloneDX SBOM via lacework |
| POST | `/compliance` | Compliance PDF; cached at `/compliance/latest-text` |
| GET | `/lql/queries` | List `.yaml` files from `LQL_QUERIES_DIR` |
| POST | `/lql/run` | Execute LQL against FortiCNAPP |
| POST | `/lql/cve` | CVE cross-reference: hosts + containers |
| POST | `/lql/generate` | Plain-English → LQL via Claude |

## Files

```
serve.py              Backend — proxy, FortiCNAPP bridge, LQL engine
docker-compose.yml    bifrost-serve + searxng
Dockerfile
extension/
  manifest.json
  panel.html          Side panel UI
  panel.js            Gateway auth, streaming, LQL, CVE, CodeSec logic
  background.js       Service worker — opens side panel on icon click
```
