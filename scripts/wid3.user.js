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
// @name         Wid3 (Fullwide web pages patcher) | by Zuko®
// @namespace    https://zuko.pro
// @version      3.0
// @description  Force fullwide layout using Regex Matching & UI Popup
// @author       Zuko <tansautn@gmail.com>
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @icon         https://cdn.zuko.pro/assets/z-cricle.png
// @updateURL    https://raw.githubusercontent.com/tansautn/monkey-scripts/refs/heads/main/scripts/wid3.user.js
// @downloadURL  https://raw.githubusercontent.com/tansautn/monkey-scripts/refs/heads/main/scripts/wid3.user.js
// ==/UserScript==

(function() {
    'use strict';

    const CURRENT_HOST = location.hostname;

    const TACTIC_BREAKOUT = `
        width: 100vw !important; max-width: 100vw !important;
        margin-left: calc(50% - 50vw) !important; margin-right: calc(50% - 50vw) !important;
        padding-left: 25px !important; padding-right: 25px !important; box-sizing: border-box !important;
    `;

    const TACTIC_FLUID = `
        width: 100% !important; max-width: none !important; box-sizing: border-box !important;
    `;

    const DEFAULT_CONFIG = {
        enabled: false,
        mainSelector: "main, article, #main-content",
        patchMode: "fluid", // 'fluid' | 'breakout' | 'custom'
        customCss: "width: 100% !important; max-width: none !important;",
        elementRules: {}
    };


    let allConfigs = GM_getValue('WID3_GLOBAL_CONFIGS', {});
    let activePattern = null;
    let siteConfig = null;

    for (const pattern of Object.keys(allConfigs)) {
        try { if (new RegExp(pattern).test(CURRENT_HOST)) { activePattern = pattern; siteConfig = allConfigs[pattern]; break; } }
        catch (e) {}
    }
    if (!activePattern) { activePattern = CURRENT_HOST.replace(/\./g, '\\.'); siteConfig = Object.assign({}, DEFAULT_CONFIG); }

    // ==========================================
    // ENGINE APPLY CSS & INJECT SNIPER CSS
    // ==========================================
    function applyPatch() {
        let cssText = `
            /* Sniper Mode Hover Style */
            .fw-sniper-target {
                outline: 3px solid #e74c3c !important;
                background: rgba(231, 76, 60, 0.2) !important;
                cursor: crosshair !important;
                transition: outline 0.1s ease-in-out !important;
            }
        `;

        if (siteConfig.enabled && siteConfig.mainSelector) {
            let ruleToUse = siteConfig.customCss; // Default is custom
            if (siteConfig.patchMode === 'breakout') ruleToUse = TACTIC_BREAKOUT;
            if (siteConfig.patchMode === 'fluid') ruleToUse = TACTIC_FLUID;

            cssText += `\n${siteConfig.mainSelector} { ${ruleToUse} }\n`;
        }

        if (siteConfig.enabled && siteConfig.elementRules) {
            for (const [selector, css] of Object.entries(siteConfig.elementRules)) cssText += `${selector} { ${css} }\n`;
        }

        let styleEl = document.getElementById('fw-patcher-style');
        if (!styleEl) {
            styleEl = document.createElement('style'); styleEl.id = 'fw-patcher-style';
            if (document.head) document.head.appendChild(styleEl); else document.documentElement.appendChild(styleEl);
        }
        styleEl.textContent = cssText;
    }

    // ==========================================
    // UI CẤU HÌNH & SNIPER LOGIC
    // ==========================================
    function createUI() {
        if (document.getElementById('fw-panel')) return;

        const trigger = document.createElement('div'); trigger.innerHTML = '⚙';
        trigger.style.cssText = `position: fixed; top: 20px; left: 0; width: 8px; height: 30px; background: rgba(0,0,0,0.45); color: transparent; z-index: 2147483646; cursor: pointer; transition: all 0.2s ease; overflow: hidden; display: flex; align-items: center; justify-content: center; border-top-right-radius: 5px; border-bottom-right-radius: 5px;`;
        trigger.addEventListener('mouseenter', () => { trigger.style.width = '30px'; trigger.style.color = '#fff'; trigger.style.background = 'rgba(0,0,0,0.8)'; });
        trigger.addEventListener('mouseleave', () => { trigger.style.width = '8px'; trigger.style.color = 'transparent'; trigger.style.background = 'rgba(0,0,0,0.45)'; });

        const panel = document.createElement('div'); panel.id = 'fw-panel';
        panel.style.cssText = `position: fixed; top: 60px; left: 10px; width: 25vw; min-width: 320px; background: #1e1e1e; color: #ccc; z-index: 2147483647; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.9); display: none; font-family: monospace; border: 1px solid #444;`;

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
                <b style="color:#fff; font-size: 14px;">🛠 Fullwide Patcher V3</b>
                <button id="fw-close" style="background:none; border:none; color:red; cursor:pointer;">✖</button>
            </div>

            <label style="display: block; margin-bottom: 8px; font-size: 12px; color: #aaa;">
                Domain Regex Pattern:<br>
                <input type="text" id="fw-pattern" value="${activePattern}" style="width:100%; margin-top:4px; padding:4px; background:#333; color:#fff; border:1px solid #555; box-sizing:border-box;">
            </label>

            <label style="display: block; margin-bottom: 10px;">
                <input type="checkbox" id="fw-enable" ${siteConfig.enabled ? 'checked' : ''}> Enable patch for this pattern
            </label>

            <label style="display: block; margin-bottom: 10px; font-size: 12px; color: #aaa;">
                Patch Tactic (Chiến thuật):<br>
                <select id="fw-mode" style="width:100%; margin-top:4px; padding:6px; background:#333; color:#4af626; border:1px solid #555; font-weight:bold;">
                    <option value="fluid" ${siteConfig.patchMode === 'fluid' ? 'selected' : ''}>🌊 Fluid (Auto fill - for UI using Sidebar/Grid)</option>
                    <option value="breakout" ${siteConfig.patchMode === 'breakout' ? 'selected' : ''}>💥 Breakout (Usually for single column UI)</option>
                    <option value="custom" ${siteConfig.patchMode === 'custom' ? 'selected' : ''}>🔧 Custom Rules</option>
                </select>
            </label>

            <!-- Simple Selector Input Area -->
            <div id="fw-simple-area" style="margin-bottom: 5px;">
                <div style="font-size: 11px; color:#888;">Main Element Selector:</div>
                <div style="display:flex; gap: 5px; margin-top: 4px;">
                    <input type="text" id="fw-simple-selector" placeholder="e.g. main, .container, #content" style="flex: 1; padding: 6px; background: #333; color: #fff; border: 1px solid #555; box-sizing: border-box; font-family: monospace;">
                    <button id="fw-sniper" title="Pick an element on page" style="background: #e74c3c; color: #fff; border: none; padding: 0 10px; border-radius: 4px; cursor: pointer; font-size: 16px;">🎯</button>
                </div>
            </div>

            <!-- Custom JSON Area -->
            <div id="fw-json-area">
                <div style="font-size: 11px; margin-bottom: 5px; color:#888;">Rules & Element CSS (JSON):</div>
                <textarea id="fw-json" style="width: 100%; height: 130px; background: #2d2d2d; color: #4af626; border: 1px solid #555; padding: 5px; box-sizing: border-box; font-family: monospace;">${JSON.stringify({
                    mainSelector: siteConfig.mainSelector,
                    customCss: siteConfig.customCss,
                    elementRules: siteConfig.elementRules
                }, null, 2)}</textarea>
            </div>

            <button id="fw-save" style="margin-top: 10px; width: 100%; padding: 8px; background: #0078d7; color: white; border: none; border-radius: 4px; cursor:pointer; font-weight: bold;">Save & Reload</button>
        `;

        trigger.addEventListener('click', () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none');
        document.body.appendChild(trigger); document.body.appendChild(panel);
        document.getElementById('fw-close').addEventListener('click', () => panel.style.display = 'none');

        // --- View Toggling & Syncing Logic ---
        const modeSelect = document.getElementById('fw-mode');
        const simpleArea = document.getElementById('fw-simple-area');
        const jsonArea = document.getElementById('fw-json-area');
        const simpleInput = document.getElementById('fw-simple-selector');
        const jsonInput = document.getElementById('fw-json');

        const updateView = () => {
            if (modeSelect.value === 'custom') {
                simpleArea.style.display = 'none';
                jsonArea.style.display = 'block';
            } else {
                simpleArea.style.display = 'block';
                jsonArea.style.display = 'none';
                // Sync from JSON to Simple Input when switching back
                try {
                    const data = JSON.parse(jsonInput.value);
                    simpleInput.value = data.mainSelector || '';
                } catch(e) {}
            }
        };

        modeSelect.addEventListener('change', updateView);
        updateView(); // Initial state setup

        // Sync Simple Input changes -> JSON
        simpleInput.addEventListener('input', () => {
            try {
                const data = JSON.parse(jsonInput.value);
                data.mainSelector = simpleInput.value.trim();
                jsonInput.value = JSON.stringify(data, null, 2);
            } catch (e) {}
        });

        // --- Sniper Logic (Element Picker) ---
        const sniperBtn = document.getElementById('fw-sniper');
        let isSniperActive = false;
        let lastTarget = null;

        const stopSniper = () => {
            isSniperActive = false;
            if (lastTarget) {
                lastTarget.classList.remove('fw-sniper-target');
                lastTarget = null;
            }
            document.removeEventListener('mouseover', sniperHover, true);
            document.removeEventListener('click', sniperClick, true);
            document.body.style.cursor = 'default';
        };

        const sniperHover = (e) => {
            if (!isSniperActive) return;
            if (lastTarget) lastTarget.classList.remove('fw-sniper-target');
            // Đừng highlight chính cái popup cấu hình
            if (panel.contains(e.target) || trigger.contains(e.target)) return; 
            
            lastTarget = e.target;
            lastTarget.classList.add('fw-sniper-target');
        };

        const sniperClick = (e) => {
            if (!isSniperActive) return;
            // Cho phép click vào trong panel cấu hình để hủy tắt
            if (panel.contains(e.target) || trigger.contains(e.target)) return;

            e.preventDefault();
            e.stopPropagation();

            let target = e.target;
            let selector = target.tagName.toLowerCase();
            
            // Xây dựng selector thông minh
            if (target.id) {
                selector = `#${target.id}`;
            } else if (target.className && typeof target.className === 'string') {
                // Lọc bỏ những class động, quá dài hoặc cái class của chính sniper
                const validClasses = target.className.split(/\s+/).filter(c => c && c !== 'fw-sniper-target' && !c.includes(':'));
                if (validClasses.length > 0) {
                    selector += `.${validClasses.join('.')}`;
                }
            }

            simpleInput.value = selector;
            simpleInput.dispatchEvent(new Event('input')); // Force sync qua JSON
            stopSniper();
            panel.style.display = 'block'; // Mở lại panel nếu đã lỡ thu gọn
        };

        sniperBtn.addEventListener('click', (e) => {
            if (isSniperActive) {
                stopSniper();
                return;
            }
            isSniperActive = true;
            document.body.style.cursor = 'crosshair';
            document.addEventListener('mouseover', sniperHover, true); // true = Use Capture mode (chặn event gốc)
            document.addEventListener('click', sniperClick, true);
        });

        // --- Save & Reload Logic ---
        document.getElementById('fw-save').addEventListener('click', () => {
            try {
                const rawJson = document.getElementById('fw-json').value;
                const newConfigData = JSON.parse(rawJson);
                const isEnabled = document.getElementById('fw-enable').checked;
                const selectedMode = document.getElementById('fw-mode').value;
                const newPattern = document.getElementById('fw-pattern').value.trim();

                new RegExp(newPattern); // Test Regex
                const finalConfig = { enabled: isEnabled, patchMode: selectedMode, ...newConfigData };

                if (newPattern !== activePattern) delete allConfigs[activePattern];
                allConfigs[newPattern] = finalConfig;

                GM_setValue('FW_GLOBAL_CONFIGS', allConfigs);
                alert('Saved successfully!'); location.reload();
            } catch (e) { alert('Lỗi cú pháp JSON hoặc Regex.\n\n' + e.message); }
        });
    }

    GM_registerMenuCommand("🚀 Đè \"cô\" này [Enable patch]", () => {
        let panel = document.getElementById('fw-panel');
        if (panel) panel.style.display = 'block'; else alert('Trang chưa load xong UI!');
    });

    applyPatch();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createUI); else createUI();
})();
