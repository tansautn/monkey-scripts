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
// @name         Markdown Renderer (GitHub-style + Mermaid)
// @namespace    https://zuko.pro
// @version      2.3.2
// @description  Render raw .md files in browser — GitHub-style markdown, Mermaid diagrams, syntax highlight, copy buttons
// @author       Zuko <tansautn@gmail.com>
// @icon         https://cdn.zuko.pro/assets/z-cricle.png
// @updateURL    https://raw.githubusercontent.com/tansautn/monkey-scripts/refs/heads/main/scripts/md-renderer.user.js
// @downloadURL  https://raw.githubusercontent.com/tansautn/monkey-scripts/refs/heads/main/scripts/md-renderer.user.js
// @match        file://*/*.md
// @match        file://*/*.md?*
// @match        file://*/*.markdown
// @match        *://raw.githubusercontent.com/*
// @match        *://gist.githubusercontent.com/*
// @match        *://gist.github.com/*/raw/*
// @match        *://pastebin.com/raw/*
// @match        *://*/*/*.md
// @match        *://*/*/*.md?*
// @match        *://*/*/*.markdown
// @exclude      *://github.com/*
// @exclude      *://gitlab.com/*
// @run-at       document-end
// @require      https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.2/highlight.min.js
// @require      https://cdn.jsdelivr.net/npm/mermaid@10.9.3/dist/mermaid.min.js
// @resource     githubCss https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.9.0/github-markdown.min.css
// @resource     hljsCssLight https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.2/styles/github.min.css
// @resource     hljsCssDark https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.2/styles/github-dark.min.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// ==/UserScript==

(async function () {
  'use strict';

  const LOG_PREFIX = '[md-renderer]';
  const log = {
    info:  (stage, msg, ...args) => console.info(`${LOG_PREFIX}[${stage}]`, msg, ...args),
    warn:  (stage, msg, ...args) => console.warn(`${LOG_PREFIX}[${stage}]`, msg, ...args),
    error: (stage, msg, ...args) => console.error(`${LOG_PREFIX}[${stage}]`, msg, ...args),
    group: (stage, label)        => console.group(`${LOG_PREFIX}[${stage}] ${label}`),
    groupEnd: ()                 => console.groupEnd(),
    time:  (label)               => console.time(`${LOG_PREFIX} ${label}`),
    timeEnd: (label)             => console.timeEnd(`${LOG_PREFIX} ${label}`),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EMOJI — fetch GitHub shortcode map, replace :name: → <img alt="unicode">
  // ═══════════════════════════════════════════════════════════════════════════

  let emojiMap = null;

  function fetchEmojiMap() {
    return new Promise(resolve => {
      if (emojiMap) { resolve(emojiMap); return; }
      GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://api.github.com/emojis',
        onload(resp) {
          try {
            emojiMap = JSON.parse(resp.responseText);
            log.info('emoji', `loaded ${Object.keys(emojiMap).length} emoji(s)`);
          } catch (_) { emojiMap = {}; }
          resolve(emojiMap);
        },
        onerror() { emojiMap = {}; resolve(emojiMap); },
      });
    });
  }

  function replaceEmojiShortcodes(text, map) {
    if (!map || Object.keys(map).length === 0) return text;
    return text.replace(/:([a-z0-9_+-]+):/g, (match, name) => {
      const url = map[name];
      if (!url) return match;
      // Extract unicode emoji from GitHub CDN URL: .../unicode/XXXX-XXXX.png
      const uniMatch = url.match(/\/unicode\/([0-9a-f-]+)\.png/i);
      let alt = name;
      if (uniMatch) {
        try { alt = uniMatch[1].split('-').map(cp => String.fromCodePoint(parseInt(cp, 16))).join(''); } catch (_) {}
      }
      return `<img class="gh-emoji" alt="${alt}" src="${url}" height="20" width="20" align="absmiddle">`;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERER — text-in → html-out
  // Libs loaded via @require → available as globals in userscript scope
  // ═══════════════════════════════════════════════════════════════════════════

  function parseMarkdown(rawText) {
    log.group('renderer', 'parseMarkdown()');
    log.info('renderer', 'INPUT', {
      chars: rawText.length,
      lines: rawText.split('\n').length,
      preview: rawText.slice(0, 120).replace(/\n/g, '↵'),
    });

    if (typeof marked === 'undefined') {
      throw new Error('marked not available — @require may have failed');
    }

    marked.setOptions({ gfm: true, breaks: false, pedantic: false });

    log.time('marked:parse');
    const html = marked.parse(rawText);
    log.timeEnd('marked:parse');

    log.info('renderer', 'OUTPUT', { htmlChars: html.length });
    log.groupEnd();
    return html;
  }

  function highlightCodeBlocks(container) {
    if (typeof hljs === 'undefined') return;
    const blocks = container.querySelectorAll('pre code');
    log.info('highlight', `${blocks.length} code block(s)`);
    blocks.forEach(block => hljs.highlightElement(block));
  }

  async function renderMermaidBlocks(container, darkMode) {
    const blocks = container.querySelectorAll('pre code.language-mermaid');
    if (blocks.length === 0) return;
    log.info('mermaid', `${blocks.length} diagram(s)`);

    mermaid.initialize({
      startOnLoad: false,
      theme: darkMode ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    });

    for (let i = 0; i < blocks.length; i++) {
      const codeEl = blocks[i];
      const preEl = codeEl.parentElement;
      const diagram = codeEl.textContent;
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const { svg } = await mermaid.render(id, diagram);
        const wrapper = createDiagramViewer(svg, i, diagram);
        preEl.replaceWith(wrapper);
      } catch (err) {
        log.error('mermaid', `block[${i}] FAILED`, err.message);
        const errWrap = document.createElement('div');
        errWrap.className = 'mermaid-error-wrap';
        errWrap.innerHTML = `
          <div class="mermaid-error">Mermaid error:\n${escapeHtml(err.message || String(err))}</div>
          <div class="mermaid-error-source-label">Source (raw mermaid):</div>
          <pre><code class="language-mermaid">${escapeHtml(diagram)}</code></pre>
        `;
        preEl.replaceWith(errWrap);
        const srcCode = errWrap.querySelector('pre code');
        if (srcCode && typeof hljs !== 'undefined') { try { hljs.highlightElement(srcCode); } catch (_) {} }
      }
    }
  }

  function createDiagramViewer(svgHtml, index, sourceText) {
    const wrapper = document.createElement('div');
    wrapper.className = 'diagram-viewer';

    const toolbar = document.createElement('div');
    toolbar.className = 'diagram-toolbar';
    toolbar.innerHTML = `
      <button data-action="fit" title="Fit on screen">Fit</button>
      <button data-action="actual" title="100% size">100%</button>
      <button data-action="zoom-out" title="Zoom out (−5%)">−</button>
      <span class="diagram-zoom-label">100%</span>
      <button data-action="zoom-in" title="Zoom in (+5%)">+</button>
      <button data-action="hand" title="Pan mode" class="diagram-hand-btn">☝</button>
      <span class="diagram-sep"></span>
      <button data-action="copy-src" title="Copy mermaid source">⧉ Source</button>
      <button data-action="copy-svg" title="Copy SVG markup">⧉ SVG</button>
      <button data-action="copy-png" title="Copy as PNG image">⧉ PNG</button>
    `;

    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    const content = document.createElement('div');
    content.className = 'diagram-content';
    content.innerHTML = svgHtml;
    viewport.appendChild(content);

    wrapper.appendChild(toolbar);
    wrapper.appendChild(viewport);

    // Extract intrinsic SVG dimensions from viewBox, set as explicit w/h
    const svg = content.querySelector('svg');
    let naturalW = 800, naturalH = 600;
    if (svg) {
      const vb = svg.getAttribute('viewBox');
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4) { naturalW = parts[2]; naturalH = parts[3]; }
      }
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.removeAttribute('style');
      svg.setAttribute('width', naturalW);
      svg.setAttribute('height', naturalH);
    }

    // Compute viewport height: full screen minus source bar (36px) and toolbar (~30px) and margin
    const vpH = window.innerHeight - 36 - 30 - 16;
    viewport.style.height = vpH + 'px';

    let scale = 1;
    let isPanning = false;
    let panActive = false;
    let startX = 0, startY = 0, scrollL = 0, scrollT = 0;
    const zoomLabel = toolbar.querySelector('.diagram-zoom-label');
    const handBtn = toolbar.querySelector('.diagram-hand-btn');

    function setScale(s) {
      scale = Math.max(0.1, Math.min(5, s));
      content.style.transform = `scale(${scale})`;
      content.style.width = (naturalW * scale) + 'px';
      content.style.height = (naturalH * scale) + 'px';
      zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    }

    function fitToViewport() {
      const vw = viewport.clientWidth - 32;
      const vh = viewport.clientHeight - 32;
      if (naturalW && naturalH) setScale(Math.min(vw / naturalW, vh / naturalH));
    }

    // Start at fit-to-viewport
    setTimeout(() => fitToViewport(), 0);

    toolbar.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'fit') fitToViewport();
      else if (action === 'actual') setScale(1);
      else if (action === 'zoom-in') setScale(scale + 0.05);
      else if (action === 'zoom-out') setScale(scale - 0.05);
      else if (action === 'hand') {
        isPanning = !isPanning;
        handBtn.classList.toggle('active', isPanning);
        viewport.style.cursor = isPanning ? 'grab' : '';
      }
      else if (action === 'copy-src') {
        copyText(sourceText || '').then(ok => flashBtn(btn, ok ? '✓ Copied' : '✗ Failed', '⧉ Source'));
      }
      else if (action === 'copy-svg') {
        const svgEl = content.querySelector('svg');
        const svgStr = svgEl ? serializeSvg(svgEl) : '';
        copyText(svgStr).then(ok => flashBtn(btn, ok ? '✓ Copied' : '✗ Failed', '⧉ SVG'));
      }
      else if (action === 'copy-png') {
        const svgEl = content.querySelector('svg');
        if (!svgEl) { flashBtn(btn, '✗ No SVG', '⧉ PNG'); return; }
        svgToPngBlob(svgEl, naturalW, naturalH)
          .then(blob => copyBlob(blob, 'image/png'))
          .then(ok => flashBtn(btn, ok ? '✓ Copied' : '✗ Failed', '⧉ PNG'))
          .catch(err => { log.error('copy-png', err.message); flashBtn(btn, '✗ Failed', '⧉ PNG'); });
      }
    });

    viewport.addEventListener('mousedown', e => {
      if (!isPanning) return;
      panActive = true;
      startX = e.clientX; startY = e.clientY;
      scrollL = viewport.scrollLeft; scrollT = viewport.scrollTop;
      viewport.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!panActive) return;
      viewport.scrollLeft = scrollL - (e.clientX - startX);
      viewport.scrollTop = scrollT - (e.clientY - startY);
    });
    document.addEventListener('mouseup', () => {
      if (!panActive) return;
      panActive = false;
      viewport.style.cursor = isPanning ? 'grab' : '';
    });

    viewport.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale(scale + (e.deltaY < 0 ? 0.05 : -0.05));
      }
    }, { passive: false });

    return wrapper;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORCHESTRATOR
  // ═══════════════════════════════════════════════════════════════════════════

  function shouldAutoRender() {
    if (location.href.startsWith('file://')) return true;
    const rawHosts = ['raw.githubusercontent.com', 'gist.githubusercontent.com'];
    if (rawHosts.some(h => location.hostname === h)) return true;
    if (location.hostname === 'pastebin.com' && location.href.includes('/raw/')) return true;
    if (/\.(md|markdown|mdc)$/i.test(location.pathname)) return true;
    return false;
  }

  function unescapeHTML(str) {
    return str.stripTags().replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  }

  function getRawText() {
    const pre = document.body.querySelector('pre');
    if (pre && document.body.children.length === 1) return pre.innerText;
    if(document.body.children.length > 1) return unescapeHTML(document.body.innerHTML);
    return document.body.innerText;
  }

  async function getRawTextAsync() {
    if (location.protocol !== 'file:') {
      try {
        const resp = await fetch(location.href);
        const text = await resp.text();
        if (text.trim().length > 0 && text.includes('\n')) {
          log.info('orchestrator', 'getRawText via fetch()', { chars: text.length, lines: text.split('\n').length });
          return text;
        }
      } catch (_) { /* fall through to DOM extraction */ }
    }
    return getRawText();
  }

  let viewMode = 'rendered'; // 'rendered' | 'raw'
  let storedRawText = '';
  let storedRenderedHtml = '';

  function toggleRawRendered() {
    const article = document.getElementById('md-article');
    const toggle = document.getElementById('md-raw-link');
    if (!article || !toggle) return;

    if (viewMode === 'rendered') {
      storedRenderedHtml = article.innerHTML;
      article.textContent = storedRawText;
      article.style.whiteSpace = 'pre-wrap';
      article.style.fontFamily = 'monospace';
      article.style.fontSize = '13px';
      toggle.textContent = 'Rendered';
      viewMode = 'raw';
    } else {
      article.innerHTML = storedRenderedHtml;
      article.style.whiteSpace = '';
      article.style.fontFamily = '';
      article.style.fontSize = '';
      toggle.textContent = 'Raw';
      viewMode = 'rendered';
    }
  }

  async function mountRenderedPage(rawText) {
    log.group('orchestrator', 'mountRenderedPage()');
    storedRawText = rawText;
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    injectDepStyles(darkMode);
    injectBaseStyles(darkMode);

    document.body.innerHTML = `
      <div id="md-source-bar">
        <span><img src="https://cdn.zuko.pro/assets/z-cricle.png" alt="Zuko" style="max-height: 12px;"/> MD Renderer</span>
        <span class="sep">·</span>
        <a href="#" id="md-raw-link">Raw</a>
        <span class="sep">·</span>
        <span>${rawText.split('\n').length} lines</span>
        <span class="sep">·</span>
        <span id="md-status">⏳ Rendering…</span>
      </div>
      <article class="markdown-body" id="md-article">
        <p style="color: gray; font-style: italic; padding: 2rem 0;">Loading…</p>
      </article>
    `;
    document.getElementById('md-raw-link').addEventListener('click', e => { e.preventDefault(); toggleRawRendered(); });
    document.documentElement.setAttribute('data-color-mode', darkMode ? 'dark' : 'light');

    try {
      log.time('total:render');
      const article = document.getElementById('md-article');

      // Step 1: parse markdown → plain HTML (no highlighting yet)
      let articleHtml = parseMarkdown(rawText);

      // Step 2: replace GitHub emoji shortcodes → <img alt="unicode">
      const emojiMapData = await fetchEmojiMap();
      articleHtml = replaceEmojiShortcodes(articleHtml, emojiMapData);

      article.innerHTML = articleHtml;
      document.getElementById('md-status').textContent = '⏳ Highlighting…';

      // Step 3: async highlight code blocks already in DOM
      highlightCodeBlocks(article);

      // Step 4: render mermaid diagrams (replaces <pre><code class="language-mermaid">)
      await renderMermaidBlocks(article, darkMode);

      // Step 5: copy buttons on every remaining <pre><code>
      addCopyButtons(article);

      // Step 6: lazyload images — reload with proper attributes
      lazyloadImages(article);

      storedRenderedHtml = article.innerHTML;
      document.getElementById('md-status').textContent = '✓ Done';
      log.timeEnd('total:render');
      log.info('orchestrator', 'COMPLETE');
    } catch (err) {
      log.error('orchestrator', 'FAILED', err);
      const statusEl = document.getElementById('md-status');
      if (statusEl) statusEl.textContent = '❌ Error';
      const articleEl = document.getElementById('md-article');
      if (articleEl) {
        articleEl.innerHTML = `<pre style="color:red;padding:1rem">Render error:\n${err.message}\n\n${err.stack}</pre>`;
      }
    }
    log.groupEnd();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTRY POINTS
  // ═══════════════════════════════════════════════════════════════════════════

  GM_registerMenuCommand('🔄 Force render as Markdown', async () => {
    const raw = await getRawTextAsync();
    if (!raw.trim()) { alert('[md-renderer] No text content found.'); return; }
    await mountRenderedPage(raw);
  });

  log.info('entry', 'script loaded', { url: location.href });

  if (shouldAutoRender()) {
    const raw = await getRawTextAsync();
    if (raw.trim().length > 0) {
      await mountRenderedPage(raw);
    } else {
      log.warn('entry', 'shouldAutoRender=true but empty text');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fall through */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_) { return false; }
  }

  async function copyBlob(blob, mime) {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
        return true;
      }
    } catch (e) { log.warn('copyBlob', e.message); }
    return false;
  }

  function serializeSvg(svgEl) {
    const clone = svgEl.cloneNode(true);
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    return new XMLSerializer().serializeToString(clone);
  }

  function svgToPngBlob(svgEl, w, h) {
    return new Promise((resolve, reject) => {
      const scale = 2; // retina
      const svgStr = serializeSvg(svgEl);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/png');
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG image load failed')); };
      img.src = url;
    });
  }

  function flashBtn(btn, msg, restore) {
    const old = btn.textContent;
    btn.textContent = msg;
    btn.classList.add('flash');
    setTimeout(() => { btn.textContent = restore || old; btn.classList.remove('flash'); }, 1200);
  }

  function addCopyButtons(container) {
    const pres = container.querySelectorAll('pre');
    let n = 0;
    pres.forEach(pre => {
      if (pre.querySelector(':scope > .code-copy-btn')) return;
      const code = pre.querySelector('code');
      if (!code) return;
      pre.classList.add('has-copy-btn');
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.type = 'button';
      btn.title = 'Copy code';
      btn.textContent = '⧉ Copy';
      btn.addEventListener('click', e => {
        e.preventDefault();
        copyText(code.textContent || '').then(ok => flashBtn(btn, ok ? '✓ Copied' : '✗ Failed', '⧉ Copy'));
      });
      pre.appendChild(btn);
      n++;
    });
    if (n > 0) log.info('copy-btn', `${n} block(s) instrumented`);
  }

  function lazyloadImages(container) {
    const imgs = container.querySelectorAll('img');
    if (imgs.length === 0) return;
    log.info('images', `${imgs.length} image(s) — applying lazyload`);
    imgs.forEach(img => {
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      // Force reload: some images fail on raw.githubusercontent.com due to initial CSP
      const src = img.src;
      if (src) { img.src = ''; img.src = src; }
    });
  }

  function injectDepStyles(darkMode) {
    try {
      GM_addStyle(GM_getResourceText('githubCss'));
      GM_addStyle(GM_getResourceText(darkMode ? 'hljsCssDark' : 'hljsCssLight'));
    } catch (e) {
      log.warn('deps', 'GM_getResourceText failed, CSS may be missing', e.message);
    }
  }

  function injectBaseStyles(darkMode) {
    const bg        = darkMode ? '#0d1117' : '#ffffff';
    const barBg     = darkMode ? '#161b22' : '#f6f8fa';
    const border    = darkMode ? '#30363d' : '#d0d7de';
    const mutedText = darkMode ? '#8b949e' : '#57606a';
    const link      = darkMode ? '#58a6ff' : '#0969da';
    const codeBg    = darkMode ? '#161b22' : '#f6f8fa';
    const errBg     = darkMode ? '#3d1111' : '#ffebe9';
    const errBorder = darkMode ? '#7d2a2a' : '#ffb3b0';

    GM_addStyle(`
      html { background: ${bg}; min-height: 100%; }
      body { margin: 0; background: ${bg}; }

      .markdown-body {
        box-sizing: border-box;
        min-width: 200px;
        width: 100%;
        padding: 45px;
      }
      body { padding-top: 41px; }
      @media (max-width: 767px) { .markdown-body { padding: 15px; } body { padding-top: 41px; } }

      #md-source-bar {
        position: fixed;
        top: 0; right: 0; left: 0;
        height: 36px;
        background: ${barBg};
        border-bottom: 1px solid ${border};
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        color: ${mutedText};
        z-index: 9999;
      }
      #md-source-bar .sep { opacity: 0.4; }
      #md-source-bar a { color: ${link}; text-decoration: none; cursor: pointer; }
      #md-source-bar a:hover { text-decoration: underline; }

      .diagram-viewer {
        margin: 16px 0;
        border: 1px solid ${border};
        border-radius: 6px;
        overflow: hidden;
        background: ${codeBg};
      }
      .diagram-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: ${barBg};
        border-bottom: 1px solid ${border};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
      }
      .diagram-toolbar button {
        background: ${codeBg};
        border: 1px solid ${border};
        border-radius: 4px;
        color: ${mutedText};
        cursor: pointer;
        padding: 2px 8px;
        font-size: 12px;
        line-height: 1.5;
      }
      .diagram-toolbar button:hover { color: ${link}; border-color: ${link}; }
      .diagram-toolbar button.active { background: ${link}; color: ${bg}; border-color: ${link}; }
      .diagram-zoom-label {
        min-width: 40px;
        text-align: center;
        color: ${mutedText};
        font-variant-numeric: tabular-nums;
      }
      .diagram-viewport {
        overflow: auto;
        padding: 16px;
      }
      .diagram-content {
        transform-origin: 0 0;
      }
      .diagram-content svg { display: block; }

      .mermaid-error {
        color: #cf222e;
        background: ${errBg};
        border: 1px solid ${errBorder};
        border-radius: 6px;
        padding: 12px 16px;
        font-family: monospace;
        font-size: 12px;
        white-space: pre-wrap;
      }
      .mermaid-error-wrap { margin: 16px 0; }
      .mermaid-error-source-label {
        margin-top: 8px;
        font-size: 12px;
        color: ${mutedText};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .diagram-sep {
        display: inline-block;
        width: 1px;
        height: 16px;
        background: ${border};
        margin: 0 4px;
      }

      pre.has-copy-btn { position: relative; }
      .code-copy-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        background: ${codeBg};
        border: 1px solid ${border};
        border-radius: 4px;
        color: ${mutedText};
        cursor: pointer;
        padding: 2px 8px;
        font-size: 11px;
        line-height: 1.5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        opacity: 0;
        transition: opacity 0.15s;
        z-index: 2;
      }
      pre.has-copy-btn:hover .code-copy-btn,
      .code-copy-btn:focus,
      .code-copy-btn.flash { opacity: 1; }
      .code-copy-btn:hover { color: ${link}; border-color: ${link}; }
      .code-copy-btn.flash { color: ${link}; border-color: ${link}; }
      .diagram-toolbar button.flash { color: ${link}; border-color: ${link}; }

      .task-list-item { list-style: none; margin-left: -20px; }

      ${darkMode ? `pre { background: #161b22 !important; } .hljs { background: #161b22 !important; }` : ''}
    `);
  }

})();
