# Bifrost Chat — Chrome Extension

A secure AI chat side panel powered by a **Bifrost AI Gateway** and **FortiCNAPP** integrations.

---

## What is this?

A Chrome MV3 side-panel extension for chatting with Claude AI models through a private Bifrost gateway, with built-in FortiCNAPP security tools.

**Capabilities:**
- 💬 Chat with Claude (haiku / sonnet / opus) via your private Bifrost gateway
- 📄 **Read Web Page** — load any tab into AI context and ask questions
- 📋 **TL;DR** — one-click bullet-point summary of the current page
- 🔍 **Web search** — live results via local SearXNG (optional)
- 🛡 **FortiCNAPP CodeSec** — SCA + SAST scan on code found on the current page
- 📋 **FortiCNAPP Compliance** — generate PDF reports for 54 compliance frameworks (CIS, NIST, PCI DSS, SOC 2, HIPAA, ISO 27001…) and ask questions about them

---

## Requirements

- Google Chrome (or Chromium)
- A Bifrost AI Gateway — URL + virtual key (`sk-bf-…`)
- `serve.py` running locally (Python 3.8+) — provides CORS proxy, search, CodeSec, and Compliance endpoints
- (Optional) Docker Desktop — for local SearXNG web search
- (Optional) `lacework` CLI — for CodeSec scanning
- (Optional) `pdftotext` (`poppler-utils`) — for PDF text extraction (Q&A on compliance reports)

---

## Setup

### 1 — Clone

```bash
git clone https://github.com/svuillaume/bifrost_pluggin.git
cd bifrost_pluggin/bifrost
```

### 2 — Configure credentials (one file only)

Copy the template and fill in your values:

```bash
cp .env.tpl .env
```

Edit `.env`:

```
ANTHROPIC_BASE_URL=https://your-bifrost-endpoint/anthropic
BIFROST_VIRTUAL_KEY=sk-bf-your-virtual-key-here
ANTHROPIC_DEFAULT_MODEL=claude-haiku-4-5-20251001
SEARXNG_URL=http://localhost:8080
```

> `.env` is **gitignored** and is the **only file you need to edit**. The extension reads credentials from `serve.py` at startup — no `config.json` editing required.

### 3 — Start serve.py

```bash
python3 -m venv .venv && source .venv/bin/activate
python3 serve.py
```

serve.py provides all local API endpoints on `http://localhost:8765`.

### 4 — Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder
4. The ⚡ **Bifrost Chat** icon appears in your toolbar

### 5 — Open the side panel

Click the ⚡ icon. On first load the URL, API key, and search URL are **auto-filled from `.env`** via `serve.py`. The status bar shows **config loaded**.

---

## Toolbar

### Standard buttons

| Button | What it does |
|--------|-------------|
| **📄 Read Web Page** | Extracts text from current tab (up to 12 000 chars) and loads it as context |
| **TL;DR** | Reads the current page and streams a 3–5 bullet summary |
| **clear** | Wipes conversation history |

### FortiCNAPP group

| Button | What it does |
|--------|-------------|
| **🛡 CodeSec** | Extracts code from the current page and runs FortiCNAPP SCA + SAST scan. Results appear in a drawer with severity breakdown. |
| **📋 Compliance** | Opens a framework picker with 54 compliance frameworks (AWS / Azure / GCP / OCI / Kubernetes), generates a PDF via FortiCNAPP API, and offers a **🔍 Ask about this PDF** button to load the report text into the chat for Q&A. |

---

## Web search (optional)

Run the setup script for an interactive Docker vs Python venv choice:

```bash
chmod +x setup.sh && ./setup.sh   # Mac/Linux
.\setup.ps1                        # Windows (run PowerShell as Administrator)
```

Or manually start SearXNG:

```bash
mkdir -p searxng
sed "s/<INSERT_RANDOM_SECRET_HERE>/$(openssl rand -hex 32)/" searxng.settings.yml.tpl > searxng/settings.yml
docker compose up -d
```

---

## Security model

| What | Where stored | Lifetime |
|------|-------------|----------|
| Bifrost URL | `chrome.storage.session` (RAM) | Cleared when Chrome closes |
| API key | `chrome.storage.session` (RAM) | Cleared when Chrome closes |
| SearXNG URL | `chrome.storage.session` (RAM) | Cleared when Chrome closes |
| Model choice | `chrome.storage.local` (disk) | Persists (not sensitive) |
| Conversation history | JS memory only | Cleared when panel closes |
| Page content | JS memory only | Never persisted |

**The API key is never written to disk after initial load.** `serve.py /config` is called once on panel open; values move immediately to session RAM. `config.json` is a blank fallback and contains no credentials.

**Content Security Policy** blocks inline scripts and external scripts; restricts network to `https:` + `localhost:8765`.

| Concern | How it's handled |
|---------|-----------------|
| API key on disk | `chrome.storage.session` (RAM only — cleared on Chrome close) |
| API key in source | Loaded at runtime from `serve.py /config` — never hardcoded |
| XSS from AI output | Markdown rendered via inert `<template>` — injected scripts never execute |
| Secrets in git | `.env`, `config.json`, `searxng/` all gitignored |

---

## FortiCNAPP Compliance details

The Compliance feature calls the FortiCNAPP API directly:

1. `GET /api/v2/Frameworks` — fetches all 54 available compliance frameworks
2. `POST /api/v2/ReportConfigurations` — creates a temporary report configuration
3. `POST /api/v2/ReportConfigurations/{guid}/generate` — generates the PDF (last 7 days)
4. `DELETE /api/v2/ReportConfigurations/{guid}` — cleans up the temporary config
5. PDF is streamed to the browser via `chrome.downloads.download()`

Credentials are read from `~/.lacework.toml` (set up by `lacework configure`).

**Frameworks available:** AWS (21) · Azure (16) · GCP (13) · OCI (3) · Kubernetes (1)  
Includes CIS, NIST CSF, NIST 800-53, PCI DSS 3.2.1/4.0, SOC 2, HIPAA, ISO 27001/27002, and more.

---

## Code Security scan

Scanned with **FortiCNAPP Code Security** (IaC + SCA/SAST).

| Severity | IaC | SCA | Total |
|----------|-----|-----|-------|
| Critical |  0  |  0  |   0   |
| High     |  0  |  0  |   0   |
| Medium   |  0  |  0  |   0   |
| Low      |  0  |  0  |   0   |

Third-party packages in `.venv/` excluded via `.lacework/codesec.yaml`.

---

## File reference

```
extension/
  manifest.json           Permissions, CSP, extension metadata (MV3)
  background.js           Service worker — opens side panel on icon click
  panel.html              Side panel UI and styles
  panel.js                All logic: chat, streaming, search, CodeSec, Compliance
  config.json             Blank fallback — credentials come from .env via serve.py
  config.json.tpl         Template for config.json
  icon16/48/128.png       Extension icons

serve.py                  Local proxy: CORS, search, CodeSec, SBOM, Compliance endpoints
.env                      Credentials — gitignored, single source of truth
.env.tpl                  Template: copy to .env and fill in values

setup.sh                  Mac/Linux setup (Docker or Python venv)
setup.ps1                 Windows PowerShell setup (same flow)

docker-compose.yml        SearXNG local search container
searxng.settings.yml.tpl  SearXNG config template
searxng/                  Generated at runtime — gitignored

.lacework/codesec.yaml    CodeSec scan exceptions config
```
