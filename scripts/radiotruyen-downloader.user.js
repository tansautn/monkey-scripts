/*
 *             M""""""""`M            dP
 *             Mmmmmm   .M            88
 *             MMMMP  .MMM  dP    dP  88  .dP   .d8888b.
 *             MMP  .MMMMM  88    88  88888"    88'  `88
 *             M' .MMMMMMM  88.  .88  88  `8b.  88.  .88
 *             M         M  `88888P'  dP   `YP  `88888P'
 *             MMMMMMMMMMM    -*-  Created by Zuko  -*-
 *
 *             * * * * * * * * * * * * * * * * * * * * *
 *             * -    - -   F.R.E.E.M.I.N.D   - -    - *
 *             * -  Copyright © 2025 (Z) Programing  - *
 *             *    -  -  All Rights Reserved  -  -    *
 *             * * * * * * * * * * * * * * * * * * * * *
 */
// ==UserScript==
// @name         RadioTruyen Batch Downloader
// @namespace    https://zuko.pro
// @version      1.1.0
// @description  Collect all episode MP3 URLs from radiotruyen player and batch download
// @author       Zuko <tansautn@gmail.com>
// @icon         https://cdn.zuko.pro/assets/z-cricle.png
// @match        https://radiotruyen.info/*
// @match        https://radiotruyen.me/*
// @match        https://radiotruyen.online/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  const collectedUrls = new Map(); // token → { url, title, index }
  let panelInjected = false;
  let collecting = false;

  // ─── Intercept XHR ────────────────────────────────────────────────────────
  const _origXHROpen = XMLHttpRequest.prototype.open;
  const _origXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._rtUrl = url;
    return _origXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        if (!this._rtUrl) return;
        scanResponseText(this.responseText, this._rtUrl);
        backfillTitles();
      } catch (_) {}
    });
    return _origXHRSend.apply(this, args);
  };

  // ─── Intercept fetch ──────────────────────────────────────────────────────
  const _origFetch = window.fetch;
  window.fetch = function (...args) {
    const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    return _origFetch.apply(this, args).then(async (response) => {
      try {
        const clone = response.clone();
        const text = await clone.text();
        scanResponseText(text, reqUrl);
      } catch (_) {}
      return response;
    });
  };

  // ─── Scan response for MP3 URLs ───────────────────────────────────────────
  function scanResponseText(text, sourceUrl) {
    if (!text || text.length > 5_000_000) return; // skip huge blobs

    // Match files.radiotruyen.online URLs (encoded or not)
    const urlPattern = /https?:\/\/files\.radiotruyen\.online\/[^\s"'<>]+\.mp3/g;
    const matches = text.match(urlPattern);

    if (matches && matches.length > 0) {
      matches.forEach((rawUrl) => {
        const url = rawUrl.replace(/\\u003D/g, '=').replace(/\\u002B/g, '+');
        const token = extractToken(url);
        if (token && !collectedUrls.has(token)) {
          collectedUrls.set(token, { url, title: null, index: collectedUrls.size + 1 });
          console.log(`[RT-DL] Found #${collectedUrls.size}: ${url}`);
          updatePanel();
        }
      });
    }

    // Also try JSON parse for structured playlist data
    tryParseJson(text);
  }

  function tryParseJson(text) {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return;
    try {
      const data = JSON.parse(trimmed);
      walkObject(data);
    } catch (_) {}
  }

  function walkObject(obj, depth = 0) {
    if (depth > 10 || !obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string' && val.includes('files.radiotruyen') && val.endsWith('.mp3')) {
        const token = extractToken(val);
        if (token && !collectedUrls.has(token)) {
          const title = obj.title || obj.name || obj.ep_name || null;
          collectedUrls.set(token, {
            url: val,
            title,
            index: collectedUrls.size + 1
          });
          updatePanel();
        }
      } else if (typeof val === 'object') {
        walkObject(val, depth + 1);
      }
    }
  }

  function backfillTitles() {
    const current = document.querySelector('.jp-playlist-item.jp-playlist-current');
    if (!current) return;
    const title = current.textContent.trim();
    if (!title) return;
    for (const entry of collectedUrls.values()) {
      if (!entry.title) { entry.title = title; break; }
    }
  }

  function extractToken(url) {
    try {
      return new URL(url).pathname.split('/').pop();
    } catch (_) {
      return url;
    }
  }

  // ─── DOM Observer — catch data attributes on episode <li> ─────────────────
  function startDOMObserver() {
    const observer = new MutationObserver(() => {
      // Pattern 1: <li data-file="...mp3"> hoặc data-src, data-url
      document.querySelectorAll('[data-file], [data-src], [data-url], [data-audio]').forEach((el) => {
        const attrs = ['data-file', 'data-src', 'data-url', 'data-audio'];
        attrs.forEach((attr) => {
          const val = el.getAttribute(attr);
          if (val && val.includes('.mp3') && val.includes('radiotruyen')) {
            const token = extractToken(val);
            if (token && !collectedUrls.has(token)) {
              const title = el.getAttribute('data-title') || el.textContent.trim() || null;
              collectedUrls.set(token, { url: val, title, index: collectedUrls.size + 1 });
              updatePanel();
            }
          }
        });
      });

      // Pattern 2: <source src="...mp3"> trong shadowDOM hoặc hidden player
      document.querySelectorAll('source[src*=".mp3"], audio[src*=".mp3"]').forEach((el) => {
        const val = el.src || el.getAttribute('src');
        if (val && val.includes('radiotruyen')) {
          const token = extractToken(val);
          if (token && !collectedUrls.has(token)) {
            collectedUrls.set(token, { url: val, title: null, index: collectedUrls.size + 1 });
            updatePanel();
          }
        }
      });

      // Pattern 3: inline script tags chứa playlist array
      document.querySelectorAll('script:not([src])').forEach((el) => {
        if (el._rtScanned) return;
        el._rtScanned = true;
        if (el.textContent.includes('radiotruyen') && el.textContent.includes('.mp3')) {
          scanResponseText(el.textContent, 'inline-script');
        }
      });

      if (!panelInjected && document.body) {
        injectPanel();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-file', 'data-src', 'data-url', 'data-audio', 'src']
    });
  }

  // ─── UI Panel ─────────────────────────────────────────────────────────────
  GM_addStyle(`
        #rt-dl-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            background: #1a1a2e;
            color: #e0e0e0;
            border: 1px solid #4a4a8a;
            border-radius: 10px;
            padding: 12px 16px;
            font-family: monospace;
            font-size: 13px;
            min-width: 220px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
        }
        #rt-dl-panel h4 {
            margin: 0 0 8px 0;
            font-size: 13px;
            color: #a0a0ff;
            letter-spacing: 0.5px;
        }
        #rt-dl-panel .rt-count {
            font-size: 22px;
            font-weight: bold;
            color: #7fff7f;
        }
        #rt-dl-panel .rt-label {
            font-size: 11px;
            color: #888;
            margin-bottom: 10px;
        }
        #rt-dl-btn {
            display: block;
            width: 100%;
            margin-top: 8px;
            padding: 8px;
            background: #3a3a8a;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-family: monospace;
            transition: background 0.2s;
        }
        #rt-dl-btn:hover { background: #5a5abb; }
        #rt-dl-btn:disabled { background: #333; color: #666; cursor: not-allowed; }
        #rt-copy-btn {
            display: block;
            width: 100%;
            margin-top: 6px;
            padding: 7px;
            background: #1a3a1a;
            color: #7fff7f;
            border: 1px solid #3a8a3a;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-family: monospace;
        }
        #rt-copy-btn:hover { background: #2a5a2a; }
        #rt-collect-btn {
            display: block;
            width: 100%;
            margin-top: 6px;
            padding: 8px;
            background: #8a3a1a;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-family: monospace;
            transition: background 0.2s;
        }
        #rt-collect-btn:hover { background: #bb5a2a; }
        #rt-collect-btn:disabled { background: #333; color: #666; cursor: not-allowed; }
        #rt-progress {
            margin-top: 6px;
            height: 4px;
            background: #333;
            border-radius: 2px;
            overflow: hidden;
            display: none;
        }
        #rt-progress-bar {
            height: 100%;
            background: #7fff7f;
            width: 0%;
            transition: width 0.3s;
        }
        #rt-dl-status {
            margin-top: 8px;
            font-size: 11px;
            color: #aaa;
            min-height: 16px;
        }
        #rt-toggle-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999998;
            background: #3a3a8a;
            color: #fff;
            border: none;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            font-size: 18px;
            cursor: pointer;
            display: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
        }
    `);

  function injectPanel() {
    if (panelInjected || !document.body) return;
    panelInjected = true;

    const panel = document.createElement('div');
    panel.id = 'rt-dl-panel';
    panel.innerHTML = `
            <h4>📻 RT Batch Downloader</h4>
            <div class="rt-count" id="rt-ep-count">0</div>
            <div class="rt-label">episodes collected</div>
            <button id="rt-collect-btn">🔄 Collect All Episodes</button>
            <div id="rt-progress"><div id="rt-progress-bar"></div></div>
            <button id="rt-dl-btn" disabled>📥 Download All (.txt)</button>
            <button id="rt-copy-btn">📋 Copy URLs</button>
            <div id="rt-dl-status">Waiting for player to load…</div>
        `;
    document.body.appendChild(panel);

    // Toggle collapse
    panel.addEventListener('dblclick', () => {
      panel.style.display = 'none';
      toggleBtn.style.display = 'block';
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'rt-toggle-panel';
    toggleBtn.textContent = '📻';
    toggleBtn.title = 'Show RT Downloader';
    toggleBtn.addEventListener('click', () => {
      panel.style.display = 'block';
      toggleBtn.style.display = 'none';
    });
    document.body.appendChild(toggleBtn);

    document.getElementById('rt-collect-btn').addEventListener('click', collectAllEpisodes);
    document.getElementById('rt-dl-btn').addEventListener('click', downloadTxt);
    document.getElementById('rt-copy-btn').addEventListener('click', copyUrls);
  }

  async function collectAllEpisodes() {
    const items = document.querySelectorAll('.jp-playlist-item:not(.jp-playlist-item-remove)');
    if (!items.length) {
      document.getElementById('rt-dl-status').textContent = '⚠️ No playlist found!';
      return;
    }
    if (collecting) return;
    collecting = true;

    const btn = document.getElementById('rt-collect-btn');
    const progress = document.getElementById('rt-progress');
    const bar = document.getElementById('rt-progress-bar');
    const status = document.getElementById('rt-dl-status');
    btn.disabled = true;
    btn.textContent = '⏳ Collecting…';
    progress.style.display = 'block';

    const total = items.length;
    const sizeBefore = collectedUrls.size;

    for (let i = 0; i < total; i++) {
      items[i].click();
      bar.style.width = `${((i + 1) / total * 100).toFixed(1)}%`;
      status.textContent = `Clicking ${i + 1}/${total}… (${collectedUrls.size} URLs found)`;
      // wait for XHR to fire and respond
      await new Promise(r => setTimeout(r, 1500));
    }

    const newFound = collectedUrls.size - sizeBefore;
    status.textContent = `✅ Done! Found ${newFound} new URLs (${collectedUrls.size} total)`;
    btn.textContent = '🔄 Collect All Episodes';
    btn.disabled = false;
    collecting = false;
    updatePanel();
  }

  function updatePanel() {
    if (!panelInjected) {
      if (document.body) injectPanel();
      return;
    }
    const count = collectedUrls.size;
    const countEl = document.getElementById('rt-ep-count');
    const dlBtn = document.getElementById('rt-dl-btn');
    const status = document.getElementById('rt-dl-status');

    if (countEl) countEl.textContent = count;
    if (dlBtn) dlBtn.disabled = count === 0;
    if (status) status.textContent = count > 0
                                     ? `✅ ${count} URL(s) ready — double-click panel to hide`
                                     : 'Waiting for player to load…';
  }

  function getSortedEntries() {
    return [...collectedUrls.values()].sort((a, b) => a.index - b.index);
  }

  function downloadTxt() {
    const entries = getSortedEntries();
    if (!entries.length) return;

    const lines = entries.map((e, i) =>
    `# EP ${String(i + 1).padStart(2, '0')}${e.title ? ' — ' + e.title : ''}\n${e.url}`
    ).join('\n\n');

    const blob = new Blob([lines], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `radiotruyen-playlist-${Date.now()}.txt`;
    a.click();

    document.getElementById('rt-dl-status').textContent = `✅ Downloaded ${entries.length} URLs!`;
  }

  function copyUrls() {
    const entries = getSortedEntries();
    if (!entries.length) {
      document.getElementById('rt-dl-status').textContent = '⚠️ No URLs yet!';
      return;
    }
    const text = entries.map(e => e.url).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      document.getElementById('rt-dl-status').textContent = `✅ Copied ${entries.length} URLs!`;
    }).catch(() => {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      document.getElementById('rt-dl-status').textContent = `✅ Copied ${entries.length} URLs!`;
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  startDOMObserver();

  // Panel inject khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) injectPanel();
    });
  } else {
    if (document.body) injectPanel();
  }

})();