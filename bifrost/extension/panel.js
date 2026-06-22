'use strict';

const MAX_TOKENS = 512;
const SYSTEM_PROMPT = 'Be concise. Answer in 1-3 sentences unless more detail is clearly needed. No filler phrases.';

const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: 'Search the web for current information, recent events, or live data.',
  input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
};

const history = [];
let busy = false;

const el = id => document.getElementById(id);
const setStatus = (text, state = '') => { el('status').textContent = text; el('status').className = state; };

// ── Storage ───────────────────────────────────────────────────────────────
const urlInput    = el('url-input');
const keyInput    = el('key-input');
const searchInput = el('search-input');

chrome.storage.session.get(['bf_url', 'bf_key', 'bf_search'], ({ bf_url, bf_key, bf_search }) => {
  if (bf_url)    urlInput.value    = bf_url;
  if (bf_key)    keyInput.value    = bf_key;
  if (bf_search) { searchInput.value = bf_search; updateSearchDot(); }
  if (!bf_url || !bf_key) autoFillFromConfig();
});
chrome.storage.local.get('bf_model', ({ bf_model }) => { if (bf_model) el('model').value = bf_model; });

async function autoFillFromConfig() {
  try {
    const res = await fetch(chrome.runtime.getURL('config.json'));
    if (!res.ok) return;
    const { bifrost_url, api_key, searxng_url } = await res.json();
    if (bifrost_url && !urlInput.value) {
      urlInput.value = bifrost_url;
      chrome.storage.session.set({ bf_url: bifrost_url });
    }
    if (api_key && !keyInput.value) {
      keyInput.value = api_key;
      chrome.storage.session.set({ bf_key: api_key });
    }
    if (searxng_url && !searchInput.value) {
      searchInput.value = searxng_url;
      chrome.storage.session.set({ bf_search: searxng_url });
      updateSearchDot();
    }
    if (bifrost_url || api_key) setStatus('config loaded', 'ok');
  } catch { /* no config.json — silently ignore */ }
}

urlInput.addEventListener('change', () => {
  const v = urlInput.value.trim();
  v ? chrome.storage.session.set({ bf_url: v }) : chrome.storage.session.remove('bf_url');
});
keyInput.addEventListener('change', () => {
  const v = keyInput.value.trim();
  v ? chrome.storage.session.set({ bf_key: v }) : chrome.storage.session.remove('bf_key');
});
function updateSearchDot() {
  el('search-dot').classList.toggle('on', !!searchInput.value.trim());
}
searchInput.addEventListener('input',  updateSearchDot);
searchInput.addEventListener('change', () => {
  const v = searchInput.value.trim();
  v ? chrome.storage.session.set({ bf_search: v }) : chrome.storage.session.remove('bf_search');
  updateSearchDot();
});
el('model').addEventListener('change', () => chrome.storage.local.set({ bf_model: el('model').value }));

// ── SearXNG search ────────────────────────────────────────────────────────
async function webSearch(query) {
  const base = searchInput.value.trim().replace(/\/+$/, '');
  if (!base) return 'Web search not configured.';
  const res = await fetch(`${base}/search?q=${encodeURIComponent(query)}&format=json&language=en`,
    { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Search ${res.status}`);
  const data = await res.json();
  const hits = (data.results || []).slice(0, 5);
  if (!hits.length) return 'No results found.';
  return hits.map((r, i) => `[${i+1}] ${r.title}\n${r.url}\n${r.content||''}`).join('\n\n');
}

// ── Markdown renderer ─────────────────────────────────────────────────────
// Escape full string FIRST, then apply transforms — prevents XSS from AI responses
function renderMarkdown(text) {
  const esc  = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const link = (href, label) => {
    const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
    return `<a class="ext-link" data-href="${url}">${label}</a>`;
  };
  return text.split(/(```[\s\S]*?```)/g).map((part, i) => {
    if (i % 2 === 1) {
      const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
      return `<pre><code>${esc(code.trimEnd())}</code></pre>`;
    }
    let s = esc(part);
    s = s.replace(/`([^`\n]+)`/g,     '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // [label](url) markdown links
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, href) => link(href, label));
    // bare https?:// URLs
    s = s.replace(/(?<!data-href=")(https?:\/\/[^\s<>"]+)/g, url => link(url, url));
    // bare www. domains without scheme (e.g. www.foodnetwork.com)
    s = s.replace(/(?<![/"'>])(www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s<>"]*)/g, url => link(url, url));
    return s;
  }).join('');
}

// Safe DOM injection: parse via inert <template> — scripts never execute
function setRendered(node, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  node.replaceChildren(tpl.content.cloneNode(true));
}

// ── DOM helpers ───────────────────────────────────────────────────────────
function appendTurn(role, text = '') {
  const turn  = document.createElement('div');
  turn.className = 'turn';

  const label = document.createElement('div');
  label.className = `role ${role}`;
  label.textContent = { user: 'you ›', ai: 'ai ›', system: 'sys ›' }[role] ?? role;

  const body = document.createElement('div');
  body.className = 'content';
  if (text) {
    if (role === 'ai') setRendered(body, renderMarkdown(text));
    else               body.textContent = text;
  }

  turn.append(label, body);
  el('log').appendChild(turn);
  scrollLog();
  return body;
}

function scrollLog() {
  const log = el('log');
  log.scrollTop = log.scrollHeight;
}

function resizePrompt() {
  const p = el('prompt');
  p.style.height = 'auto';
  p.style.height = Math.min(p.scrollHeight, 180) + 'px';
}

// ── Clear ─────────────────────────────────────────────────────────────────
el('clear').addEventListener('click', () => {
  history.length = 0;
  el('log').innerHTML = '';
  el('token-info').textContent = '';
  el('read-page').classList.remove('active');
  setStatus('—');
});

// ── Page reading ──────────────────────────────────────────────────────────
async function readCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const clone = document.cloneNode(true);
      clone.querySelectorAll('script,style,noscript,nav,footer,aside,iframe').forEach(n => n.remove());
      const text = (clone.body?.innerText || clone.body?.textContent || '').replace(/\s{3,}/g, '\n\n').trim();
      return { title: document.title, url: location.href, text: text.slice(0, 12000) };
    },
  });
  return result;
}

el('read-page').addEventListener('click', async () => {
  const btn = el('read-page');
  btn.disabled = true;
  setStatus('reading page…', 'busy');
  try {
    const page = await readCurrentPage();
    history.push({ role: 'user',      content: `[Page context]\nTitle: ${page.title}\nURL: ${page.url}\n\n${page.text}` });
    history.push({ role: 'assistant', content: 'Page loaded. Ask me anything about it.' });
    appendTurn('system', `📄 "${page.title}"`);
    appendTurn('ai', 'Page loaded. Ask me anything about it.');
    btn.classList.add('active');
    setStatus('page loaded', 'ok');
  } catch (e) {
    appendTurn('system', `Could not read page: ${e.message}`);
    setStatus('error', 'err');
  } finally { btn.disabled = false; }
});

el('tldr').addEventListener('click', async () => {
  const btn = el('tldr');
  btn.disabled = true;
  setStatus('reading page…', 'busy');
  try {
    const page = await readCurrentPage();
    // Push page as user context then immediately ask for summary
    history.push({ role: 'user', content: `[Page context]\nTitle: ${page.title}\nURL: ${page.url}\n\n${page.text}` });
    history.push({ role: 'assistant', content: 'Page loaded.' });
    history.push({ role: 'user', content: 'Give me a TL;DR summary of this page in 3-5 bullet points.' });
    appendTurn('system', `📄 TL;DR — "${page.title}"`);
    el('read-page').classList.add('active');
    await send(true);   // history already set, skip prompt handling
  } catch (e) {
    appendTurn('system', `Could not read page: ${e.message}`);
    setStatus('error', 'err');
  } finally { btn.disabled = false; }
});

// ── SSE stream parser ─────────────────────────────────────────────────────
async function readStream(res, bubble, cursor) {
  const reader = res.body.getReader();
  const dec    = new TextDecoder();
  let buf = '', out = '', inputTk = 0, outputTk = 0, stopReason = null;
  const toolCalls = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') break;
      let ev; try { ev = JSON.parse(raw); } catch { continue; }

      if (ev.type === 'message_start')
        inputTk = ev.message?.usage?.input_tokens ?? 0;
      if (ev.type === 'message_delta') {
        outputTk   = ev.usage?.output_tokens ?? outputTk;
        stopReason = ev.delta?.stop_reason ?? stopReason;
      }
      if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use')
        toolCalls[ev.index] = { id: ev.content_block.id, name: ev.content_block.name, input_json: '' };
      if (ev.type === 'content_block_delta') {
        if (ev.delta?.type === 'text_delta') {
          out += ev.delta.text;
          setRendered(bubble, renderMarkdown(out));
          bubble.appendChild(cursor);
          scrollLog();
        }
        if (ev.delta?.type === 'input_json_delta' && toolCalls[ev.index])
          toolCalls[ev.index].input_json += ev.delta.partial_json;
      }
    }
  }
  return { out, inputTk, outputTk, stopReason, toolCalls: Object.values(toolCalls) };
}

// ── Send ──────────────────────────────────────────────────────────────────
// silentMode: true = history already has the user turn pushed, skip prompt handling
async function send(silentMode = false) {
  if (busy) return;

  const baseUrl   = urlInput.value.trim().replace(/\/+$/, '');
  const key       = keyInput.value.trim();
  const hasSearch = !!searchInput.value.trim();

  if (!baseUrl) { appendTurn('system', 'No endpoint URL — enter the Bifrost base URL above.'); return; }
  if (!key)     { appendTurn('system', 'No key — enter your sk-bf-… key above.'); return; }

  if (!silentMode) {
    const text = el('prompt').value.trim();
    if (!text) return;
    history.push({ role: 'user', content: text });
    appendTurn('user', text);
    el('prompt').value = '';
    el('prompt').style.height = 'auto';
  }

  const bubble = appendTurn('ai');
  const cursor = Object.assign(document.createElement('span'), { className: 'cursor' });
  bubble.appendChild(cursor);

  busy = true;
  el('send').disabled = true;

  const headers = {
    'Content-Type':      'application/json',
    'x-api-key':         key,
    'anthropic-version': '2023-06-01',
  };

  let inputTk = 0, outputTk = 0;

  try {
    while (true) {
      setStatus('streaming…', 'busy');

      const body = {
        model: el('model').value, max_tokens: MAX_TOKENS, stream: true,
        system: SYSTEM_PROMPT, messages: history,
      };
      if (hasSearch) body.tools = [WEB_SEARCH_TOOL];

      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);

      const { out, inputTk: iTk, outputTk: oTk, stopReason, toolCalls } = await readStream(res, bubble, cursor);
      inputTk += iTk; outputTk += oTk;

      if (hasSearch && stopReason === 'tool_use' && toolCalls.length) {
        const asst = [];
        if (out) asst.push({ type: 'text', text: out });
        for (const tc of toolCalls) {
          let input; try { input = JSON.parse(tc.input_json); } catch { input = {}; }
          asst.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
        }
        history.push({ role: 'assistant', content: asst });

        const results = [];
        for (const tc of toolCalls) {
          let input; try { input = JSON.parse(tc.input_json); } catch { input = {}; }
          setStatus(`searching: ${input.query}…`, 'busy');
          let result;
          try   { result = await webSearch(input.query); }
          catch (e) { result = `Search error: ${e.message}`; }
          results.push({ type: 'tool_result', tool_use_id: tc.id, content: result });
        }
        history.push({ role: 'user', content: results });
        bubble.innerHTML = '';
        bubble.appendChild(cursor);
        continue;
      }

      cursor.remove();
      setRendered(bubble, renderMarkdown(out));
      history.push({ role: 'assistant', content: out });
      setStatus('ok', 'ok');
      el('token-info').textContent = `in:${inputTk} out:${outputTk}`;
      break;
    }

  } catch (err) {
    cursor.remove();
    bubble.textContent = `Error: ${err.message}`;
    history.pop();
    setStatus('error', 'err');
  } finally {
    busy = false;
    el('send').disabled = false;
    scrollLog();
  }
}

// Open ext-link clicks in a new tab (target="_blank" is blocked in MV3 side panels)
el('log').addEventListener('click', e => {
  const a = e.target.closest('a.ext-link');
  if (!a) return;
  e.preventDefault();
  chrome.tabs.create({ url: a.dataset.href });
});

el('prompt').addEventListener('input',   resizePrompt);
el('prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
el('send').addEventListener('click',     send);

el('prompt').focus();
