// ==UserScript==
// @name         Camper updates
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Automates Lootlink + Work.ink (mobile + desktop supported)
// @match        *://loot-link.com/s*
// @match        *://loot-links.com/s*
// @match        *://lootlink.org/s*
// @match        *://lootlinks.co/s*
// @match        *://lootdest.info/s*
// @match        *://lootdest.org/s*
// @match        *://lootdest.com/s*
// @match        *://links-loot.com/s*
// @match        *://linksloot.net/s*
// @match        *://work.ink/*
// @match        *://*.work.ink/*
// @match        *://lockr.so/*
// @include      *loot*
// @include      *work.ink*
// @run-at       document-idle
// @icon         https://i.pinimg.com/736x/02/72/16/02721647f507c80673b1b8ac20a82de3.jpg
// @grant        none
// ==/UserScript==


/* -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
                                                                  Script 1: Lootlink Auto
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function showPopup(message) {
    if (document.getElementById("autoPopupNotice")) return; // prevent duplicates

    const popup = document.createElement("div");
    popup.id = "autoPopupNotice";
    popup.textContent = message || "⏳ Userscript is running...";

    const style = document.createElement("style");
    style.textContent = `
        #autoPopupNotice {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 22px;
            border-radius: 15px;
            font-family: Arial, sans-serif;
            font-weight: bold;
            font-size: 16px;
            color: yellow;
            text-shadow: 1px 1px 3px black;
            background: linear-gradient(270deg, #4facfe, #00f2fe, #43e97b, #fa709a, #fee140, #330867);
            background-size: 1200% 1200%;
            box-shadow: 0 0 15px rgba(255,255,0,0.6), 0 0 25px rgba(255,255,0,0.3);
            z-index: 999999;
            animation: waveColors 12s ease infinite, pulseGlow 2s ease-in-out infinite;
        }

        @keyframes waveColors {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        @keyframes pulseGlow {
            0% { box-shadow: 0 0 10px rgba(255,255,0,0.3), 0 0 20px rgba(255,255,0,0.2); }
            50% { box-shadow: 0 0 25px rgba(255,255,0,0.8), 0 0 45px rgba(255,255,0,0.4); }
            100% { box-shadow: 0 0 10px rgba(255,255,0,0.3), 0 0 20px rgba(255,255,0,0.2); }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(popup);
}


if (window.location.hostname.includes('lootlink') ||
    window.location.hostname.includes('loot-link') ||
    window.location.hostname.includes('lootdest') ||
    window.location.hostname.includes('linksloot')) {

(function() {
    'use strict';

    // --- Permanent block for window.open ---
    window.open = function(url, name, specs) {
        console.log("Blocked window.open:", url);
        return null;
    };

    // --- Intercept all <a target="_blank"> clicks ---
    document.addEventListener("click", function(e) {
        const el = e.target.closest("a[target='_blank']");
        if (el) {
            e.preventDefault();
            console.log("Blocked <a> click:", el.href);
        }
    }, true);

    const clicked = new WeakSet();

    function simulateMouseMovement(el) {
        const rect = el.getBoundingClientRect();
        const steps = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < steps; i++) {
            const x = rect.left + Math.random() * rect.width;
            const y = rect.top + Math.random() * rect.height;
            el.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                view: window
            }));
        }
    }

    function simulateHumanClick(el) {
        simulateMouseMovement(el);
        const delay = Math.floor(Math.random() * 300) + 100;

        setTimeout(() => {
            const events = [
                "touchstart", "touchend", "click",
                "mouseover", "mouseenter", "mousedown", "mouseup"
            ];
            events.forEach(evt => {
                try {
                    const event = new Event(evt, { bubbles: true, cancelable: true });
                    el.dispatchEvent(event);
                } catch (e) {
                    console.log("Dispatch failed for", evt, e);
                }
            });

            clicked.add(el);
            console.log("Clicked (human-like) without opening tab:", el);
        }, delay);
    }

    function tryClickSequential(selector) {
        const buttons = Array.from(document.querySelectorAll(selector));
        for (const btn of buttons) {
            if (!clicked.has(btn)) {
                const style = window.getComputedStyle(btn);
                if (style.pointerEvents !== "none" && style.opacity !== "0") {
                    setTimeout(() => {
                        if (!clicked.has(btn)) {
                            simulateHumanClick(btn);
                        }
                    }, Math.floor(Math.random() * 1000) + 800);
                    break; // Only one click per run
                }
            }
        }
    }

    // --- Observe DOM mutations and click buttons sequentially ---
    const observer = new MutationObserver(() => {
        tryClickSequential("div.is-success.btn-shadow");
        tryClickSequential("#nextbtn");
        tryClickSequential("div[id][class]");
        tryClickSequential("div[class]");
    });

    showPopup("BYPASSING PLS WAIT..");

    observer.observe(document.body, { childList: true, subtree: true });

})();

}


/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
                                                                           Script 2: Work.ink Auto
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

if (window.location.hostname.includes('work.ink')) {
(function () {
  'use strict';

  const STEP_CONT_SELECTOR = "div.stepcont.svelte-ck84f7";

  // Detect Cloudflare check
  function isWorkInkLoading() {
    return /Checking your browser\. This takes about 5 seconds\./i.test(document.body?.innerText || '');
  }

  // STOP SCRIPT if Cloudflare is active
  if (isWorkInkLoading()) {
    console.log("[work.ink:auto] Cloudflare detected — stopping script until reload.");
    return; // exit the userscript immediately
  }

  // --- STOP SCRIPT if Cloudflare is active ---
  if (isWorkInkLoading()) {
    showPopup("⚠️ Complete Captcha (Cloudflare Check Detected)");
    console.log("[work.ink:auto] Cloudflare detected — stopping script until reload.");
    return; // exit script (it will run again on next page load)
  }

  // Otherwise continue automation
  showPopup("🚀 BYPASSING..");

  // Conditional window.open block with restoration
  let observer = null;
  let originalOpen = null;

  function injectBlock() {
    if (originalOpen) return; // already injected
    originalOpen = window.open; // save original
    window.open = function(url, name, specs) {
      console.log("[work.ink:auto] Blocked window.open ->", url);
      return null;
    };

    document.addEventListener("click", blockLinkClick, true);
    console.log("[work.ink:auto] Block script injected");
  }

  function removeBlock() {
    if (!originalOpen) return;
    window.open = originalOpen; // restore original
    originalOpen = null;

    document.removeEventListener("click", blockLinkClick, true);
    console.log("[work.ink:auto] Block script removed, window.open restored");
  }

  function blockLinkClick(e) {
    let a = e.target.closest("a[target=_blank], a[target=_new]");
    if (a) {
      e.preventDefault();
      console.log("[work.ink:auto] Blocked external link:", a.href);
    }
  }

  function checkStepCont() {
    const exists = !!document.querySelector(STEP_CONT_SELECTOR);
    if (exists) injectBlock();
    else removeBlock();
  }

  // Initial check
  checkStepCont();

  // Observe DOM changes to handle stepcont appear/disappear
  observer = new MutationObserver(checkStepCont);
  observer.observe(document.body, { childList: true, subtree: true });

  // existing selectors
  const STEP1_SELECTOR = "div.button.large.accessBtn.pos-relative.svelte-s4fbka";
  const STEP2_SELECTOR = "button.w-full.bg-primary-500.hover\\:bg-primary-600.active\\:bg-primary-700.text-white.py-4.rounded-full.font-medium.transition-colors.flex.items-center.justify-center.gap-2.shadow-lg.shadow-primary-500\\/20";
  const MODAL_SELECTOR = "div.fixed.inset-0.bg-black\\/50.backdrop-blur-sm.flex.items-center.justify-center.p-4.main-modal.svelte-12h72hl";
  const MODAL_CLOSE_BTN = "button.hover\\:bg-gray-100.p-2.rounded-full.transition-colors";
  const GREEN_BTN_SELECTOR = "button.w-full.h-14.px-6.text-lg.font-semibold.rounded-full.transition-all.duration-200.flex.items-center.justify-center.space-x-3.bg-green-600.text-white.hover\\:bg-green-700.shadow-lg.hover\\:shadow-xl";
  const STEP5_SELECTOR = "button.interestedBtn.button, button.interestedBtn.svelte-3yab7m, .interestedBtn";
  const SKIP_BTN_SELECTOR = "button.skipBtn.svelte-3yab7m, .skipBtn";
  const NEW_BTN_SELECTOR = "button.button.svelte-3ht8ui"; // NEW BUTTON

  function log(...args) { console.log("[work.ink:auto]", ...args); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function waitForElement(selector) {
    return new Promise((resolve) => {
      const found = document.querySelector(selector);
      if (found) return resolve(found);

      const mo = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          mo.disconnect();
          resolve(el);
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    });
  }

  function enableAndClick(el) {
    if (!el) return false;
    try {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      try { el.removeAttribute && el.removeAttribute('disabled'); } catch (_) {}
      try { if (el.style) el.style.pointerEvents = 'auto', el.style.opacity = '1'; } catch (_) {}
      el.click();
      return true;
    } catch (e) {
      log("click failed:", e);
      return false;
    }
  }

  async function pollFor(selector, interval = 500, timeout = 0) {
    const start = Date.now();
    while (true) {
      const el = document.querySelector(selector);
      if (el) return el;
      if (timeout > 0 && (Date.now() - start) > timeout) return null;
      await sleep(interval);
    }
  }

  function accelerateStep2Timer() {
    const interval = setInterval(() => {
      if (window.step2Countdown !== undefined) {
        window.step2Countdown -= 4;
        if (window.step2Countdown <= 0) {
          window.step2Countdown = 0;
          clearInterval(interval);
        }
      }
    }, 1000);
  }

  async function runOnceCycle() {
    log("Waiting for Step 1 element:", STEP1_SELECTOR);
    const step1El = await waitForElement(STEP1_SELECTOR);
    if (!step1El) return log("Step1 not found, aborting.");
    log("Step1 found — clicking");
    enableAndClick(step1El);

    accelerateStep2Timer();

    log("Polling for Step 2 element...");
    const step2El = await pollFor(STEP2_SELECTOR, 500, 0);
    if (step2El) {
      log("Step2 found — clicking");
      enableAndClick(step2El);
    }

    log("Checking for modal...");
    const modal = await pollFor(MODAL_SELECTOR, 500, 15000);
    if (modal) {
      log("Modal appeared — closing");
      const closeBtn = modal.querySelector(MODAL_CLOSE_BTN) || document.querySelector(MODAL_CLOSE_BTN);
      if (closeBtn) {
        enableAndClick(closeBtn);
        await sleep(1000);
        const step1Again = document.querySelector(STEP1_SELECTOR) || await pollFor(STEP1_SELECTOR, 500, 20000);
        if (step1Again) enableAndClick(step1Again);
      }
    }
  }

  (async function main() {
    if (document.readyState !== 'complete') {
      await new Promise(r => window.addEventListener('load', r));
      await sleep(300);
    }

    if (isWorkInkLoading()) {
      log("Work.ink loader detected — stopping script.");
      return;
    }

    try {
      await runOnceCycle();
      log("Flow finished (one cycle).");
    } catch (err) {
      log("Error in flow:", err);
    }
  })();

  // --- Auto-click handlers ---
  let greenClicked = false;
  setInterval(() => {
    if (greenClicked) return;
    const greenBtn = document.querySelector(GREEN_BTN_SELECTOR);
    if (greenBtn) {
      if (enableAndClick(greenBtn)) {
        greenClicked = true;
      }
    }
  }, 500);

  let interestedClicked = false;
  let skipClicked = false;
  const step5Interval = setInterval(() => {
    if (interestedClicked) return;
    const step5Btn = document.querySelector(STEP5_SELECTOR);
    if (step5Btn) {
      if (enableAndClick(step5Btn)) {
        interestedClicked = true;
        log("interestedBtn clicked — will attempt skipBtn in 3s");

        setTimeout(() => {
          if (skipClicked) return;
          const skipBtn = document.querySelector(SKIP_BTN_SELECTOR);
          if (skipBtn) {
            if (enableAndClick(skipBtn)) {
              skipClicked = true;
              log("skipBtn clicked after interestedBtn");
            } else {
              log("skipBtn found but click failed");
            }
          } else {
            log("skipBtn not present at 3s mark (no retry).");
          }
        }, 3000);
      }
    }
  }, 500);

  // --- NEW BUTTON HANDLER ---
  (function () {
    let newBtnClicked = false;
    const newBtnInterval = setInterval(() => {
      if (newBtnClicked) return;
      const btn = document.querySelector(NEW_BTN_SELECTOR);
      if (btn) {
        if (enableAndClick(btn)) {
          newBtnClicked = true;
          console.log("[work.ink:auto] New svelte-3ht8ui button clicked ✅");
          clearInterval(newBtnInterval);
        }
      }
    }, 500);
  })();

  // Auto-click stepcont with modalwrapper handling
  (function () {
    let stepContReady = true;

    function tryClickStepCont() {
      if (!stepContReady) return;
      const stepCont = document.querySelector(STEP_CONT_SELECTOR);
      if (stepCont) {
        if (enableAndClick(stepCont)) {
          log("Clicked stepcont div.");
          stepContReady = false;
        }
      }
    }

    const observerStep = new MutationObserver(() => {
      const modal = document.querySelector("div.modalwrapper");
      if (modal) {
        stepContReady = false;
        return;
      }

      if (!modal && !stepContReady) {
        stepContReady = true;
        tryClickStepCont();
      } else {
        tryClickStepCont();
      }
    });

    observerStep.observe(document.body, { childList: true, subtree: true });
  })();

  // remove modalwrapper UNTIL stepcont completes
  (function () {
    let observerModal = null;

    function startModalWatcher() {
      observerModal = new MutationObserver(() => {
        document.querySelectorAll("div.modalwrapper").forEach(modal => {
          console.log("[work.ink:auto] Removed modalwrapper");
          modal.remove();
        });
      });

      observerModal.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    function stopModalWatcher() {
      if (observerModal) {
        observerModal.disconnect();
        observerModal = null;
        console.log("[work.ink:auto] Modal watcher stopped ✅");
      }
    }

    // Start watching immediately
    startModalWatcher();

    // Stop when stepcont disappears (completed)
    const observerStepDone = new MutationObserver(() => {
      const stepCont = document.querySelector(STEP_CONT_SELECTOR);
      if (!stepCont) {
        stopModalWatcher();
        observerStepDone.disconnect();
      }
    });

    observerStepDone.observe(document.body, { childList: true, subtree: true });
  })();

      // --- NEW BUTTON HANDLER ---
(function () {
  let newBtnClicked = false;
  const newBtnInterval = setInterval(() => {
    if (newBtnClicked) return;
    const btn = document.querySelector(NEW_BTN_SELECTOR);
    if (btn) {
      if (enableAndClick(btn)) {
        newBtnClicked = true;
        console.log("[work.ink:auto] New svelte-3ht8ui button clicked ✅");
        clearInterval(newBtnInterval);

        // 🔴 Force Wave lock released after button click
        console.log("[work.ink:auto] Forcing wave lock released ❌");

        // Override document.hidden and visibilityState
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => true
        });

        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden"
        });

        // Block focus/blur/visibilitychange listeners
        window.addEventListener = new Proxy(window.addEventListener, {
          apply(target, thisArg, args) {
            if (["focus", "blur", "visibilitychange"].includes(args[0])) {
              console.log(`[work.ink:auto] Blocked ${args[0]} listener`);
              return;
            }
            return Reflect.apply(target, thisArg, args);
          }
        });

        // Trigger fake blur + visibilitychange
        setTimeout(() => {
          window.dispatchEvent(new Event("blur"));
          document.dispatchEvent(new Event("visibilitychange"));
        }, 500);
      }
    }
  }, 500);

})();

  
})();

}


/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
                                                                                    LOCKR BYPASS
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

if (window.location.hostname.includes('lockr')) {

(function() {
    'use strict';

    const clicked = new WeakSet();

    // --- Original window.open reference ---
    const originalWindowOpen = window.open;

    // --- Block window.open to prevent new tabs temporarily ---
    function blockWindowOpen() {
        window.open = function(url, name, specs) {
            console.log("Blocked window.open:", url);
            return null;
        };
    }

    // --- Restore original window.open ---
    function restoreWindowOpen() {
        window.open = originalWindowOpen;
        console.log("window.open restored");
    }

    // --- Intercept <a target="_blank"> clicks temporarily ---
    function interceptLinks() {
        document.addEventListener("click", linkInterceptor, true);
    }

    function removeLinkInterceptor() {
        document.removeEventListener("click", linkInterceptor, true);
    }

    function linkInterceptor(e) {
        const el = e.target.closest("a[target='_blank']");
        if (el) {
            e.preventDefault();
            console.log("Blocked <a> click:", el.href);
        }
    }

    function simulateMouseMovement(el) {
        const rect = el.getBoundingClientRect();
        const steps = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < steps; i++) {
            const x = rect.left + Math.random() * rect.width;
            const y = rect.top + Math.random() * rect.height;
            el.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                view: window
            }));
        }
    }

    function simulateHumanClick(el) {
        simulateMouseMovement(el);
        const delay = Math.floor(Math.random() * 300) + 100;

        setTimeout(() => {
            const events = ["mousedown","mouseup","click","mouseover","mouseenter"];
            events.forEach(evt => {
                try {
                    const event = new Event(evt, { bubbles: true, cancelable: true });
                    el.dispatchEvent(event);
                } catch (e) {
                    console.log("Dispatch failed for", evt, e);
                }
            });

            clicked.add(el);
            console.log("Clicked task button safely:", el);

            // If all buttons clicked, restore window.open
            const remaining = Array.from(document.querySelectorAll(".task_wrapper__OLG6f"))
                                   .filter(b => !clicked.has(b));
            if (remaining.length === 0) {
                restoreWindowOpen();
                removeLinkInterceptor();
                console.log("All task buttons clicked. window.open unblocked.");
            }

        }, delay);
    }

   showPopup("Cooking them up");

    function tryClickTaskButton() {
        const buttons = Array.from(document.querySelectorAll(".task_wrapper__OLG6f"));
        for (const btn of buttons) {
            if (!clicked.has(btn)) {
                const style = window.getComputedStyle(btn);
                if (style.pointerEvents !== "none" && style.opacity !== "0") {
                    simulateHumanClick(btn);
                    break; // Only click one button per run
                }
            }
        }
    }

    // --- Start temporary blocking ---
    blockWindowOpen();
    interceptLinks();

    // --- Observe DOM mutations and click task buttons sequentially ---
    const observer = new MutationObserver(() => {
        tryClickTaskButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

})(); }
