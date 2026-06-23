# Web AI Agent — Chrome Extension

> **License**: Apache 2.0 — see [LICENSE](LICENSE) | **Status**: BETA — new features and integrations welcome

A browser-based AI security agent that integrates with any AI Gateway (LLMlite, Portkey, Helicone, …) and any CNAPP platform via the Lacework CLI. Runs as a Chrome side panel — ask questions about any webpage, scan code for vulnerabilities, run cloud security queries, and generate LQL from plain English without leaving your browser.

> Works with FortiCNAPP (Lacework), or any CNAPP that supports the Lacework CLI and LQL.

---

## What it does

**Chat & research** — works on any webpage:
- Ask the AI anything — it automatically searches the web when needed
- **Read** — loads the page you're on so you can ask questions about it
- **TL;DR** — gives a plain-English summary of any page in seconds
- **FortiGuard** — opens the FortiGuard Labs threat intelligence feed; the button flashes red when there are active outbreak alerts

**FortiCNAPP security tools** — click the 🔰 FortiCNAPP button:

| Tool | What it does |
|---|---|
| 🛡 **Scan Code** | Scans code on the current page or a GitHub repo for vulnerabilities and secrets |
| 📋 **Compliance Report** | Downloads a compliance PDF (CIS, NIST, PCI-DSS, SOC 2, HIPAA, and 50+ more) |
| 📊 **Advanced Analytics** | Runs saved LQL security queries against your FortiCNAPP account — or describe what you want in plain English and it writes the query for you |
| 🔬 **Attack Threat Surface** | Look up any CVE and see exactly which servers and containers in your environment are exposed |
| 💬 **Community Feed** | Opens the FortiCNAPP community blog and articles |

> Greyed-out buttons have a tooltip explaining what's needed to enable them.

---

## Before you start — what you need

| What | Where to get it |
|---|---|
| **Google Chrome** | [chrome.google.com](https://chrome.google.com) |
| **Python 3** | [python.org](https://python.org) — already installed on most Macs |
| **AI Gateway URL + key** | Provided by your IT team or Fortinet contact (starts with `sk-bf-…`) |
| **FortiCNAPP credentials** | Found in FortiCNAPP under **Settings → API Keys** |

You do not need Docker. You do not need to be a developer.

---

## Setup — 4 steps

### Step 1 — Download the extension

**Option A — Git clone (recommended):**
```bash
git clone https://github.com/svuillaume/webaiagent.git
cd webaiagent
```

**Option B — Download ZIP:**
1. Go to [github.com/svuillaume/webaiagent](https://github.com/svuillaume/webaiagent)
2. Click **Code → Download ZIP**
3. Unzip the downloaded file and open a terminal in the extracted folder

---

### Step 2 — Run the setup script

Open **Terminal** (macOS/Linux) or **PowerShell** (Windows) in the folder you just downloaded, then run:

**macOS / Linux:**
```
./setup.sh
```

**Windows:**
```
.\setup.ps1
```

The script asks you 3 questions:

1. **Gateway URL** — paste the URL your IT team gave you (e.g. `https://bifrost.yourcompany.com/anthropic`)
2. **Gateway key** — paste your API key (starts with `sk-bf-…`)
3. **FortiCNAPP credentials** — answer **y** to set these up now (you'll need your account name, API Key, and API Secret from FortiCNAPP → Settings → API Keys)

When you see ✔ at the end, the server is running and you're ready for Step 3.

---

### Step 3 — Load the extension in Chrome

1. Open Chrome and go to: **`chrome://extensions`**
2. Turn on **Developer mode** — toggle in the top-right corner
3. Click **Load unpacked**
4. Select the **`extension`** folder inside the folder you downloaded
5. The Web AI Agent icon (🔰) appears in your Chrome toolbar

---

### Step 4 — Start using it

Click the 🔰 icon in the Chrome toolbar — the side panel opens.
Type anything to start chatting, or use the toolbar buttons.

✅ **Check:** The status dot in the top-right of the panel should be green. If it's grey, the server isn't running — go back to Step 2.

---

## Stopping and restarting

The server runs quietly in the background.

**To stop:**
- macOS/Linux: `kill $(cat .serve.pid)`
- Windows: `Stop-Process -Id (Get-Content .serve.pid)`

**To restart:** run `./setup.sh` (or `.\setup.ps1`) again.

---

## Troubleshooting

**Panel shows "not connected" or status dot is grey**
→ The server isn't running. Open Terminal in the extension folder and run `./setup.sh` again.
→ Check it's running: open `http://localhost:45321` in Chrome — you should see a chat page.

**"Cannot scan a Github web page" when clicking Scan Code**
→ Navigate to a GitHub repository page first, then click Scan Code.

**Scan runs but finds nothing**
→ The page needs visible code — GitHub repository pages work best. On a GitHub repo, it fetches the actual source files automatically.

**LQL / CVE / Compliance buttons are greyed out**
→ Your FortiCNAPP credentials aren't configured. Run `./setup.sh` and answer **y** when asked about FortiCNAPP.

**Scan Code is greyed out but other buttons work**
→ The lacework CLI is not installed. Run `./setup.sh` and answer **y** when asked to install it.

**FortiGuard button is flashing red**
→ There is an active outbreak alert from the last 5 days. Click the button to open FortiGuard Labs — the flashing stops once you've checked it.

---

## Privacy & security

Your keys and credentials stay on your machine — nothing is stored in the cloud.

| Data | Where it's stored | When it's cleared |
|---|---|---|
| Gateway URL + API key | Browser memory only | When you close Chrome |
| Chat history | Browser memory only | When you close the side panel |
| Page content you read | Browser memory only | Never written to disk |
| FortiCNAPP credentials | Your machine only (`~/.lacework.toml`) | You control this |

The local server (`serve.py`) only listens on `localhost` — nothing is reachable from outside your machine.

---

## Technical reference

<details>
<summary>Manual configuration, environment variables, API endpoints</summary>

### Manual start (no setup script)

```bash
cp .env.tpl .env        # copy the template
# edit .env and fill in ANTHROPIC_BASE_URL and BIFROST_VIRTUAL_KEY
python3 serve.py        # starts on http://localhost:45321
```

### Environment variables (`.env`)

| Variable | Description |
|---|---|
| `ANTHROPIC_BASE_URL` | AI gateway endpoint URL |
| `BIFROST_VIRTUAL_KEY` | Gateway virtual key (`sk-bf-…`) |
| `ANTHROPIC_DEFAULT_MODEL` | Model used for chat and LQL Generate (default: `claude-haiku-4-5`) |
| `LQL_QUERIES_DIR` | Path to folder containing `.yaml` LQL query files |

FortiCNAPP credentials come from `~/.lacework.toml` (created by `lacework configure`).

### Backend API endpoints (served on `localhost:45321`)

| Method | Path | Description |
|---|---|---|
| GET | `/config` | Returns gateway URL, key, and feature-availability flags |
| POST | `/proxy/v1/*` | Proxies streaming requests to the AI gateway |
| POST | `/codesec` | SCA + SAST scan via lacework CLI |
| POST | `/sbom` | CycloneDX SBOM via lacework CLI |
| POST | `/compliance` | Generate compliance PDF report |
| GET | `/compliance/list` | List available compliance frameworks |
| GET | `/lql/queries` | List saved `.yaml` LQL query files |
| POST | `/lql/run` | Execute an LQL query against FortiCNAPP |
| POST | `/lql/cve` | CVE attack surface: affected hosts and containers |
| POST | `/lql/generate` | Convert plain-English objective to LQL via Claude |
| GET | `/fortiguard/outbreaks` | Proxies FortiGuard outbreak alert RSS feed |

### How LQL Generator works

The **✨ Generator** tab in the LQL panel converts plain-English security objectives into validated LQL queries using a three-step pipeline in `serve.py`:

```
User types objective
  → POST /lql/generate
    → serve.py sends objective + LQL system prompt to Claude (via AI gateway)
      → Claude returns a JSON { queryId, queryText }
        → serve.py validates the query with: lacework query run --validate_only
          → if validation fails: error is sent back to Claude with "fix this"
            → Claude returns corrected query (up to 3 retries)
              → validated query returned to the extension
```

**What's in the system prompt**: `serve.py` embeds a detailed LQL reference directly into every generation request — datasource names, field syntax rules (`RESOURCE_CONFIG:field::String`), valid operators, timestamp patterns, and working example queries. This gives Claude the context it needs to generate correct LQL without hallucinating non-existent functions or field names.

**Validate-then-fix loop**: the lacework CLI validates each generated query before it reaches the user. If the query fails (wrong field name, invalid operator, type mismatch), the error message is fed back to Claude automatically. This catches and corrects syntax errors without any user intervention — typically resolved in one retry.

**Supported datasources**: AWS config (`LW_CFG_AWS_*`), workload/agent (`LW_HE_*`, `LW_HA_*`), CloudTrail (`CloudTrailRawEvents`), entitlements (`LW_CE_*`), and attack paths (`LW_APA_*`).

### Docker (self-contained, for teams)

```bash
docker compose up -d          # first run
docker compose up --build -d  # after changes to serve.py
docker compose down
```

Requires `~/claude_cnapp/lql/lql_queries` for LQL files and `~/.lacework.toml` for credentials — both mounted read-only into the container.

</details>
