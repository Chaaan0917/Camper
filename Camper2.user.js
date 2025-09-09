// ==UserScript==
// @name         Auto Unlock (Read/Watch/Locked) - Delta iOS
// @namespace    tm-auto
// @version      1.6
// @description  Auto-click buttons on deltaios-executor ads page
// @match        *://deltaios-executor.com/ads.html*
// @include      *://deltaios-executor.com/ads.html*
// @run-at       document-end
// @grant       none
// ==/UserScript==

// Only run on deltaios-executor.com
if (window.location.hostname.includes("deltaios-executor.com")) {

  // --- run immediately, before site scripts ---
  (function blockNewTabs() {
    let blockerActive = true;
    // expose control functions on window (these close over blockerActive)
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

    // Block <a target="_blank"> before click
    document.addEventListener("click", (e) => {
      if (!blockerActive) return;
      const a = e.target && e.target.closest("a[target]");
      if (a) {
        console.log("[TM-auto] Stripped target from link:", a.href);
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    }, true);

    // Block programmatic anchor.click()
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
      // if the button becomes enabled (not disabled) treat as unlocked
      if (!btn.disabled) return true;
      try {
        // first, check the ::before pseudo content (your original approach)
        const txt = getComputedStyle(btn, "::before").content.replace(/(^"|"$)/g, "");
        if (/unlocked/i.test(txt)) return true;
      } catch (e) { /* ignore */ }

      // Additional checks (in case site updates text/aria/class instead of ::before)
      try {
        const text = (btn.textContent || btn.innerText || "").trim();
        if (/unlocked/i.test(text)) return true;
        const aria = (btn.getAttribute && (btn.getAttribute('aria-label') || btn.getAttribute('title') || '')) || '';
        if (/unlocked/i.test(aria)) return true;
        const cls = (btn.className || '');
        if (/unlock/i.test(cls)) return true;
      } catch (e) { /* ignore */ }

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
              // <<< MINIMAL, CRITICAL CHANGE: call the function off window to hit the closure
              console.log("[TM-auto] Locked button detected as UNLOCKED -> disabling blocker now");
              window.disableBlocker();   // only change
            } else {
              console.log("[TM-auto] window.disableBlocker not found");
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
