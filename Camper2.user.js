// ==UserScript==
// @name         Auto Unlock (Read/Watch/Locked) - Delta iOS
// @namespace    tm-auto
// @version      1.6
// @description  Auto-click buttons on deltaios-executor ads page
// @match        *://deltaios-executor.com/ads.html*
// @include      *://deltaios-executor.com/ads.html*
// @run-at       document-end
// @grant        none
// ==/UserScript==

// Only run on deltaios-executor.com
if (window.location.hostname.includes("deltaios-executor.com")) {

  // --- Redirecting Screen ---
  (function showRedirectingScreen() {
    if (document.getElementById("redirectingScreen")) return;

    const screen = document.createElement("div");
    screen.id = "redirectingScreen";
    screen.innerHTML = `<div class="redirectBox">REDIRECTING<span class="dots"></span></div>`;

    const style = document.createElement("style");
    style.textContent = `
      #redirectingScreen {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: black;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999999;
      }
      .redirectBox {
        font-size: 36px;
        font-weight: bold;
        font-family: Arial, sans-serif;
        background: linear-gradient(270deg, #4facfe, #00f2fe, #43e97b, #fa709a, #fee140, #330867);
        background-size: 1200% 1200%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: waveColors 12s ease infinite;
      }
      .dots::after {
        content: '';
        animation: dots 1.5s steps(3, end) infinite;
      }
      @keyframes waveColors {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes dots {
        0% { content: ''; }
        33% { content: '.'; }
        66% { content: '..'; }
        100% { content: '...'; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(screen);

    // expose remover
    window.removeRedirectingScreen = () => {
      const scr = document.getElementById("redirectingScreen");
      if (scr) scr.remove();
    };
  })();

  // --- run immediately, before site scripts ---
  (function blockNewTabs() {
    let blockerActive = true;
    window.enableBlocker = () => { blockerActive = true; console.log("[TM-auto] blocker enabled"); };
    window.disableBlocker = () => { blockerActive = false; console.log("[TM-auto] blocker disabled"); };

    const noop = (...args) => {
      if (blockerActive) {
        console.log("[TM-auto] Blocked window.open", args);
        return null;
      }
      return window.__realOpen__(...args);
    };

    window.__realOpen__ = window.open.bind(window);
    try {
      window.open = noop;
      Object.defineProperty(window, "open", { value: noop, configurable: true, writable: true });
    } catch (e) {}

    document.addEventListener("click", (e) => {
      if (!blockerActive) return;
      const a = e.target && e.target.closest("a[target]");
      if (a) {
        console.log("[TM-auto] Stripped target from link:", a.href);
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    }, true);

    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (blockerActive && this.target === "_blank") {
        console.log("[TM-auto] Blocked programmatic click to:", this.href);
        this.removeAttribute("target");
      }
      return origClick.apply(this, arguments);
    };

    console.log("[TM-auto] New tab blocking active (early)");
  })();

  // --- automation script ---
  (function () {
    'use strict';
    const log = (...a) => console.log('[TM-auto]', ...a);

    function waitForSelector(sel, { timeout = 60000, interval = 200 } = {}) {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const timer = setInterval(() => {
          const el = document.querySelector(sel);
          if (el) {
            clearInterval(timer);
            resolve(el);
          } else if (Date.now() - start > timeout) {
            clearInterval(timer);
            reject(new Error("Timeout: " + sel));
          }
        }, interval);
      });
    }

    function callHandlerOrClick(button, handlerName, ...args) {
      try {
        if (handlerName && typeof unsafeWindow !== 'undefined' && typeof unsafeWindow[handlerName] === "function") {
          log(`Calling ${handlerName}(${args.join(',')})`);
          unsafeWindow[handlerName](...args);
          return true;
        }
      } catch (e) { log("Handler call failed:", e); }
      if (button) {
        try { button.click(); log("Clicked element directly"); return true; } catch (e) { log("element.click failed:", e); }
      }
      return false;
    }

    function isUnlocked(btn) {
      if (!btn) return false;
      if (!btn.disabled) return true;
      try {
        const txt = getComputedStyle(btn, "::before").content.replace(/(^"|"$)/g, "");
        if (/unlocked/i.test(txt)) return true;
      } catch (e) { }
      try {
        const text = (btn.textContent || btn.innerText || "").trim();
        if (/unlocked/i.test(text)) return true;
        const aria = (btn.getAttribute && (btn.getAttribute('aria-label') || btn.getAttribute('title') || '')) || '';
        if (/unlocked/i.test(aria)) return true;
        const cls = (btn.className || '');
        if (/unlock/i.test(cls)) return true;
      } catch (e) { }
      return false;
    }

    (async function run() {
      const READ_ID = "#readButton";
      const WATCH_ID = "#watchButton";
      const LOCKED_ID = "#lockedButton";

      const readBtn = await waitForSelector(READ_ID).catch(() => null);
      if (readBtn && !readBtn.dataset.tmDone) {
        callHandlerOrClick(readBtn, "handleButtonClick", "read");
        readBtn.dataset.tmDone = "1";
      }

      const watchBtn = await waitForSelector(WATCH_ID).catch(() => null);
      if (watchBtn && !watchBtn.dataset.tmDone) {
        callHandlerOrClick(watchBtn, "handleButtonClick", "watch");
        watchBtn.dataset.tmDone = "1";
      }

      const lockedBtn = await waitForSelector(LOCKED_ID).catch(() => null);
      if (lockedBtn) {
        const check = () => {
          if (isUnlocked(lockedBtn)) {
            if (window.disableBlocker) {
              console.log("[TM-auto] Locked button detected as UNLOCKED -> disabling blocker now");
              window.disableBlocker();
            }
            if (window.removeRedirectingScreen) {
              window.removeRedirectingScreen(); // remove the redirecting screen
            }
            if (!lockedBtn.dataset.tmDone) {
              callHandlerOrClick(lockedBtn, "handleLockedButtonClick");
              lockedBtn.dataset.tmDone = "1";
              return true;
            }
          }
          return false;
        };
        if (!check()) {
          const obs = new MutationObserver(() => { if (check()) obs.disconnect(); });
          obs.observe(lockedBtn, { attributes: true, childList: true, subtree: true });
          const poll = setInterval(() => { if (check()) clearInterval(poll); }, 500);
          setTimeout(() => clearInterval(poll), 120000);
        }
      }
    })();
  })();
} else {
  console.log('[TM-auto] Not on deltaios-executor.com — script skipped.');
}
