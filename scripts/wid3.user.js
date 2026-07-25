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
// @version      2.0
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
    
    const BUILT_IN_RULE = `
        width: 100vw !important;
        max-width: 100vw !important;
        margin-left: calc(50% - 50vw) !important;
        margin-right: calc(50% - 50vw) !important;
        padding-left: 20px !important; 
        padding-right: 20px !important;
        box-sizing: border-box !important;
    `;

    const DEFAULT_CONFIG = {
        enabled: false,
        mainSelector: "main, #main-content, .main-container",
        useMainRule: false,
        mainCss: "width: 100% !important; max-width: none !important;",
        elementRules: {}
    };

    // ==========================================
    // 1. ENGINE STORAGE & REGEX MATCHING
    // ==========================================
    // Cấu trúc Data: { ".*\\.google\\.com": {enabled: true, ...}, "github\\.com": {...} }
    let allConfigs = GM_getValue('FW_GLOBAL_CONFIGS', {});
    let activePattern = null;
    let siteConfig = null;

    // Tìm xem Host hiện tại có khớp với Regex Pattern nào trong DB không
    for (const pattern of Object.keys(allConfigs)) {
        try {
            const regex = new RegExp(pattern);
            if (regex.test(CURRENT_HOST)) {
                activePattern = pattern;
                siteConfig = allConfigs[pattern];
                break; // Ưu tiên pattern đầu tiên match được
            }
        } catch (e) {
            console.error(`[Fullwide Patcher] Invalid Regex Pattern in storage: ${pattern}`);
        }
    }

    // Nếu không khớp pattern nào, lấy hostname hiện tại làm pattern mặc định
    if (!activePattern) {
        activePattern = CURRENT_HOST.replace(/\./g, '\\.'); // Escape dấu chấm chuẩn regex
        siteConfig = Object.assign({}, DEFAULT_CONFIG);
    }

    // ==========================================
    // 2. ENGINE APPLY CSS
    // ==========================================
    function applyPatch() {
        if (!siteConfig.enabled) return;

        let cssText = '';
        if (siteConfig.mainSelector) {
            const ruleToUse = siteConfig.useMainRule ? siteConfig.mainCss : BUILT_IN_RULE;
            cssText += `\n${siteConfig.mainSelector} { ${ruleToUse} }\n`;
        }

        if (siteConfig.elementRules && typeof siteConfig.elementRules === 'object') {
            for (const [selector, css] of Object.entries(siteConfig.elementRules)) {
                cssText += `${selector} { ${css} }\n`;
            }
        }

        let styleEl = document.getElementById('fw-patcher-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'fw-patcher-style';
            if (document.head) document.head.appendChild(styleEl);
            else document.documentElement.appendChild(styleEl); 
        }
        styleEl.textContent = cssText;
    }

    // ==========================================
    // 3. UI CẤU HÌNH & EVENT HANDLER
    // ==========================================
    function createUI() {
        if (document.getElementById('fw-panel')) return; // Tránh tạo 2 lần

        // Nút Trigger nhỏ ở góc (như cũ)
        const trigger = document.createElement('div');
        trigger.innerHTML = '⚙';
        trigger.style.cssText = `
            position: fixed; top: 20px; left: 0; width: 8px; height: 30px;
            background: rgba(0,0,0,0.45); color: transparent; z-index: 2147483646;
            cursor: pointer; transition: all 0.2s ease; overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            border-top-right-radius: 5px; border-bottom-right-radius: 5px;
        `;
        trigger.addEventListener('mouseenter', () => { trigger.style.width = '30px'; trigger.style.color = '#fff'; trigger.style.background = 'rgba(0,0,0,0.8)'; });
        trigger.addEventListener('mouseleave', () => { trigger.style.width = '8px'; trigger.style.color = 'transparent'; trigger.style.background = 'rgba(0,0,0,0.45)'; });

        // Popup Panel
        const panel = document.createElement('div');
        panel.id = 'fw-panel';
        panel.style.cssText = `
            position: fixed; top: 60px; left: 10px; width: 25vw; min-width: 320px;
            background: #1e1e1e; color: #ccc; z-index: 2147483647; padding: 15px;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.8); display: none;
            font-family: monospace; border: 1px solid #444;
        `;

        // Chú ý tôi thêm Input để cấu hình Regex
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
                <b style="color:#fff; font-size: 14px;">🛠 Fullwide Patcher</b>
                <button id="fw-close" style="background:none; border:none; color:red; cursor:pointer;">✖</button>
            </div>
            
            <label style="display: block; margin-bottom: 8px; font-size: 12px; color: #aaa;">
                Domain Regex Pattern:<br>
                <input type="text" id="fw-pattern" value="${activePattern}" style="width:100%; margin-top:4px; padding:4px; background:#333; color:#fff; border:1px solid #555; box-sizing:border-box;">
            </label>

            <label style="display: block; margin-bottom: 10px;">
                <input type="checkbox" id="fw-enable" ${siteConfig.enabled ? 'checked' : ''}> Enable patch for this pattern
            </label>
            
            <div style="font-size: 11px; margin-bottom: 5px; color:#888;">JSON Settings:</div>
            <textarea id="fw-json" style="width: 100%; height: 200px; background: #2d2d2d; color: #4af626; border: 1px solid #555; padding: 5px; box-sizing: border-box; font-family: monospace;">${JSON.stringify({
                mainSelector: siteConfig.mainSelector,
                useMainRule: siteConfig.useMainRule,
                mainCss: siteConfig.mainCss,
                elementRules: siteConfig.elementRules
            }, null, 2)}</textarea>
            
            <button id="fw-save" style="margin-top: 10px; width: 100%; padding: 8px; background: #0078d7; color: white; border: none; border-radius: 4px; cursor:pointer; font-weight: bold;">Save & Reload</button>
        `;

        trigger.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        document.body.appendChild(trigger);
        document.body.appendChild(panel);

        document.getElementById('fw-close').addEventListener('click', () => panel.style.display = 'none');
        
        // Handle Logic lưu Regex mới
        document.getElementById('fw-save').addEventListener('click', () => {
            try {
                const rawJson = document.getElementById('fw-json').value;
                const newConfigData = JSON.parse(rawJson);
                const isEnabled = document.getElementById('fw-enable').checked;
                const newPattern = document.getElementById('fw-pattern').value.trim();

                // Test thử Regex xem có lỗi cú pháp không trước khi lưu
                new RegExp(newPattern);

                // Gộp data
                const finalConfig = { enabled: isEnabled, ...newConfigData };

                // Logic thay đổi Pattern Key
                if (newPattern !== activePattern) {
                    delete allConfigs[activePattern]; // Xoá key cũ
                }
                allConfigs[newPattern] = finalConfig; // Cập nhật key mới

                GM_setValue('FW_GLOBAL_CONFIGS', allConfigs);
                alert('Saved successfully!');
                location.reload();
            } catch (e) {
                alert('Error! Check JSON syntax or Regex validity.\n\n' + e.message);
            }
        });
    }

    // ==========================================
    // 4. API BỔ SUNG VÀO MENU TAMPERMONKEY
    // ==========================================
    GM_registerMenuCommand("🚀 Đè cô này (Config Page)", () => {
        let panel = document.getElementById('fw-panel');
        if (panel) {
            panel.style.display = 'block'; // Mở popup lên
        } else {
            alert('Trang chưa load xong UI, vui lòng thử lại sau!');
        }
    });

    // INIT
    applyPatch();
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', createUI); }
    else { createUI(); }

})();
