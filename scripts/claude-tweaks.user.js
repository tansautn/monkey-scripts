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
// @name         Claude.ai Tweaks
// @namespace    https://zuko.pro
// @version      1.4.1
// @description  Full-wide (chat + code), sticky sidebar, sidebar links same-tab, Code titlebar tweaks, GitHub menu enhancements with OS-level default browser open
// @author       Zuko <tansautn@gmail.com>
// @match        https://claude.ai/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=claude.ai
// @updateURL    https://raw.githubusercontent.com/tansautn/monkey-scripts/refs/heads/main/scripts/claude-tweaks.user.js
// @downloadURL  https://raw.githubusercontent.com/tansautn/monkey-scripts/refs/heads/main/scripts/claude-tweaks.user.js
// ==/UserScript==

// -:- -:- -:-   C H A N G E   L O G   -:- -:- -:-
// 1.4.1: Menu command to download Windows .reg installer for openwith:// handler
// 1.4.0: OS-level default browser open via custom protocol handler
// 1.3.0: Full-wide /code page + GitHub menu enhancements
// 1.2.0: Fix titlebar link click
// -:- -:- -:- -:- -:- -:- -:- -:- -:- -:- -:- -:-
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────
  const DEFAULT_PROTOCOL = 'openwith://';
  const REG_SCRIPT_URL   = 'https://raw.githubusercontent.com/tansautn/monkey-scripts/refs/heads/main/miscs/shell_register_openwith_proto.win64.reg';
  let openProtocol = GM_getValue('openProtocol', DEFAULT_PROTOCOL);

  GM_registerMenuCommand('Set open-with protocol', () => {
    const next = prompt(
      'Protocol prefix for opening in default browser.\n' +
      'Examples: openwith://  |  microsoft-edge:  |  browseropen://\n' +
      'Leave empty to disable (fallback to window.open).',
      openProtocol
    );
    if (next !== null) {
      openProtocol = next.trim();
      GM_setValue('openProtocol', openProtocol);
      alert(`Saved: "${openProtocol || '(disabled)'}"`);
    }
  });

  GM_registerMenuCommand('Download openwith:// setup (.reg for Windows)', () => {
    // Trigger download via anchor with `download` attr — same-origin not required
    // for cross-origin downloads if server sends proper headers; GitHub raw does.
    const a = document.createElement('a');
    a.href = REG_SCRIPT_URL;
    a.download = 'shell_register_openwith_proto.win64.reg';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      alert(
        'Downloaded: shell_register_openwith_proto.win64.reg\n\n' +
        'Setup steps:\n' +
        '  1. Double-click the .reg file → confirm UAC/Registry prompt.\n' +
        '  2. Reload claude.ai (no browser restart needed).\n' +
        '  3. Click any GitHub link → check "Always allow" on the first prompt.\n\n' +
        'The handler routes openwith://<url> to your OS default browser via `cmd /c start`.'
      );
    }, 300);
  });

  // ── Styles ──────────────────────────────────────────────────────────────
  GM_addStyle(`
        /* Full-wide conversation (chat page) */
        [data-autoscroll-container] .mx-auto.flex.w-full.flex-1.flex-col,
        [data-autoscroll-container] .flex-1.flex.flex-col.px-4.mx-auto.w-full {
            max-width: 100% !important;
        }

        /* Sidebar shell: always visible */
        .shrink-0:has(> div > nav[aria-label="Sidebar"]) {
            width: 18rem !important;
            opacity: 1 !important;
            flex-shrink: 0 !important;
        }

        /* Full-wide /code page */
        .epitaxy-composer-width {
            max-width: none !important;
            width: 100% !important;
        }
    `);

  // ── Open URL in OS default browser via registered protocol handler ─────
  function openExternal(url) {
    if (openProtocol) {
      const a = document.createElement('a');
      a.href = openProtocol + encodeURIComponent(url);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ── Chat page ────────────────────────────────────────────────────────────
  function fixSidebarLinks() {
    document
      .querySelector('nav[aria-label="Sidebar"]')
      ?.querySelectorAll('a[target="_blank"]')
      .forEach(a => a.removeAttribute('target'));
  }

  function pinSidebar() {
    const btn = document.querySelector('[data-testid="pin-sidebar-toggle"]');
    if (!btn) return;
    if ((btn.getAttribute('aria-label') ?? '').toLowerCase().includes('open')) {
      btn.click();
    }
  }

  // ── Claude Code titlebar ────────────────────────────────────────────────
  function fixCodeTitlebar() {
    const logo = document.querySelector('.df-titlebar a[aria-label="Claude Code"]');
    if (logo && !logo.dataset.tweaked) {
      logo.dataset.tweaked = '1';
      logo.addEventListener('click', e => {
        e.stopImmediatePropagation();
        e.preventDefault();
        location.href = new URL(location.href).origin;
      }, true);
    }

    const badge = document.querySelector('.df-titlebar [data-alpine-devtools-right-click]');
    if (badge && !badge.closest('a[href]')) {
      const a = document.createElement('a');
      a.href = '/code';
      a.style.cssText = 'text-decoration:none;display:contents';
      badge.replaceWith(a);
      a.appendChild(badge);
    }
  }

  // ── GitHub menu ─────────────────────────────────────────────────────────
  function enhanceGithubMenu() {
    document.querySelectorAll('a[href*="://github.com/"]:not([data-gh-tweaked])').forEach(a => {
      a.dataset.ghTweaked = '1';
      a.addEventListener('click', e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        openExternal(a.href);
      }, true);
    });

    document.querySelectorAll('[role="menuitem"]').forEach(item => {
      if (item.nextElementSibling?.dataset.ghCopyClone === '1') return;
      const label = (item.textContent || '').trim().toLowerCase();
      if (label !== 'copy branch name') return;

      const menu = item.closest('[role="menu"]');
      const ghUrl = menu?.querySelector('a[href*="://github.com/"]')?.href;
      if (!ghUrl) return;

      const clone = item.cloneNode(true);
      clone.dataset.ghCopyClone = '1';
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (/copy branch name/i.test(n.nodeValue)) {
          n.nodeValue = n.nodeValue.replace(/copy branch name/i, 'Copy GitHub branch URL');
          break;
        }
      }
      clone.addEventListener('click', e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        navigator.clipboard.writeText(ghUrl).catch(() => {});
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }, true);
      item.insertAdjacentElement('afterend', clone);
    });
  }

  // ── Boot ────────────────────────────────────────────────────────────────
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fixSidebarLinks();
      pinSidebar();
      fixCodeTitlebar();
      enhanceGithubMenu();
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    fixSidebarLinks();
    pinSidebar();
    fixCodeTitlebar();
    enhanceGithubMenu();
  }, 1200);
})();
