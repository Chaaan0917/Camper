// ==UserScript==
// @name         api test
// @namespace    http://tampermonkey.net/
// @version      4.3
// @author       CAMPER
// @description  Work.ink bypass based on IHaxU and Dyrian
// @match        *://work.ink/*
// @match        *://rekonise.com/*
// @match        *://link-unlock*
// @match        *://linkvertise.com/*/*
// @match        *://key.volcano.wtf/*
// @match        *://loot-link.com/s?*
// @match        *://loot-links.com/s?*
// @match        *://lootlink.org/s?*
// @match        *://lootlinks.co/s?*
// @match        *://lootdest.info/s?*
// @match        *://lootdest.org/s?*
// @match        *://lootdest.com/s?*
// @match        *://links-loot.com/s?*
// @match        *://linksloot.net/s?*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      afklol-api.vercel.app
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  if (!location.hostname.includes("work.ink")) return;

  const debug = true; // debug logging

  const oldLog = window.console.log;
  const oldWarn = window.console.warn;
  const oldError = window.console.error;

  function log(...args) { if (debug) oldLog("[UnShortener]", ...args); }
  function warn(...args) { if (debug) oldWarn("[UnShortener]", ...args); }
  function error(...args) { if (debug) oldError("[UnShortener]", ...args); }


  const container = window.document.createElement("div");
    container.style.position = "fixed";
    container.style.bottom = "10px";
    container.style.left = "10px";
    container.style.zIndex = 999999;

    const shadow = container.attachShadow({ mode: "closed" });

    const hint = window.document.createElement("div");
    hint.textContent = "Please solve captcha to continue!";

    Object.assign(hint.style, {
        whiteSpace: "pre-line",
        position: "fixed",
        bottom: "50px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "linear-gradient(180deg, #3a0ca3, #240046)",
        color: "#ffffff",
        padding: "14px 20px",
        borderRadius: "10px",
        fontSize: "15px",
        fontFamily: "Poppins, sans-serif",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.4)",
        textAlign: "Left",
        pointerEvents: "none",
        zIndex: "9999",
        borderTop: "3px solid #7b2cbf",
        transition: "all 0.3s ease",
    });

    shadow.appendChild(hint);
    window.document.documentElement.appendChild(container);

    const map = {
      onLI: ["onLinkInfo"],
      onLD: ["onLinkDestination"]
    };

    const startTime = Date.now();
    let sessionController = undefined;
    let sendMessage = undefined;
    let onLinkInfo = undefined;
    let linkInfo = undefined;
    let onLinkDestination = undefined;
    let bypassTriggered = false;
    let destinationReceived = false;
    let bypassStartTime = 0;
    let maxBypassWaitTime = 30000; // 30 seconds timeout
    let urlCheckInterval = null;
    let captchaFailureDetected = false;
    let redirectCountdown = null;
    let redirectAttempts = 0;
    let lastRedirectUrl = null;
    let pageLoadStartTime = 0;

    function resolveName(obj, candidates) {
      if (!obj || typeof obj !== "object") {
        return { fn: null, index: -1, name: null };
      }

      for (let i = 0; i < candidates.length; i++) {
        const name = candidates[i];
        if (typeof obj[name] === "function") {
          return { fn: obj[name], index: i, name };
        }
      }
      return { fn: null, index: -1, name: null };
    }

    function resolveWriteFunction(obj) {
        if (!obj || typeof obj !== "object") {
            return { fn: null, index: -1, name: null };
        }

        for (let i in obj) {
            if (typeof obj[i] === "function" && obj[i].length === 2) {
                return { fn: obj[i], name: i };
            }
        }
        return { fn: null, index: -1, name: null };
    }

    const types = {
        an: 'c_announce',
        mo: 'c_monetization',
        ss: 'c_social_started',
        rr: 'c_recaptcha_response',
        hr: 'c_hcaptcha_response',
        tr: 'c_turnstile_response',
        ad: 'c_adblocker_detected',
        fl: 'c_focus_lost',
        os: 'c_offers_skipped',
        ok: 'c_offer_skipped',
        fo: 'c_focus',
        wp: 'c_workink_pass_available',
        wu: 'c_workink_pass_use',
        pi: 'c_ping',
        kk: 'c_keyapp_key'
    };

    function startUrlMonitoring() {
      let checkCount = 0;
      const maxChecks = 40; // Check for 20 seconds after bypass (500ms intervals = 40 checks)

      urlCheckInterval = setInterval(() => {
        checkCount++;
        
        if (destinationReceived) {
          if (debug) log('URL detected, stopping monitoring');
          clearInterval(urlCheckInterval);
          return;
        }

        if (checkCount >= maxChecks) {
          clearInterval(urlCheckInterval);
          if (debug) log('No URL detected after 10 seconds, reloading...');
          hint.textContent = "No URL found! Reloading...";
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }, 500); // Check every 500ms instead of 1000ms
    }

    function detectCaptchaFailure() {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              const errorSelectors = [
                '.cf-error-title',
                '[data-translate="error"]',
                '.error-message',
                '#cf-error-details'
              ];
              
              for (const selector of errorSelectors) {
                if (node.matches?.(selector) || node.querySelector?.(selector)) {
                  if (!captchaFailureDetected) {
                    captchaFailureDetected = true;
                    if (debug) log('Captcha failure detected, reloading...');
                    hint.textContent = "Captcha failed! Reloading...";
                    setTimeout(() => {
                      window.location.reload();
                    }, 2000);
                  }
                  return;
                }
              }

              const turnstileError = node.querySelector?.('[id^="cf-turnstile"] iframe');
              if (turnstileError) {
                const iframeDoc = turnstileError.contentDocument;
                if (iframeDoc?.body?.textContent?.toLowerCase().includes('error')) {
                  if (!captchaFailureDetected) {
                    captchaFailureDetected = true;
                    if (debug) log('Turnstile error detected, reloading...');
                    hint.textContent = "Turnstile failed! Reloading...";
                    setTimeout(() => {
                      window.location.reload();
                    }, 2000);
                  }
                }
              }
            }
          }
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    function startBypassTimeout() {
      bypassStartTime = Date.now();
      
      const timeoutChecker = setInterval(() => {
        if (destinationReceived) {
          clearInterval(timeoutChecker);
          return;
        }
        
        const elapsedTime = Date.now() - bypassStartTime;
        const remainingTime = Math.ceil((maxBypassWaitTime - elapsedTime) / 1000);
        
        if (elapsedTime >= maxBypassWaitTime) {
          clearInterval(timeoutChecker);
          if (debug) log('Bypass timeout reached, reloading page...');
          hint.textContent = "Timeout! Reloading...";
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else if (remainingTime <= 5) {
          hint.textContent = `Wait... (${remainingTime}s)`;
        }
      }, 1000);
    }

    function triggerBypass(reason) {
      if (bypassTriggered) {
        if (debug) log('Bypass skipped')
          return;
      }

      if(debug) {
        log('WebSocket status:', {
          exists: !!sessionController?.websocket,
          readyState: sessionController?.websocket?.readyState,
          url: sessionController?.websocket?.url
        });
      }

      bypassTriggered = true;
      if (debug) log('Bypass:', reason);
      hint.textContent = "Captcha Solved! Bypassing...";

      startBypassTimeout();
      startUrlMonitoring();

      let retryCount = 0;
      const maxRetries = 30; // Increased from 10
      
      function keepSpoofing() {
        if (destinationReceived) {
          if (debug) log('Destination received after', retryCount, 'attempts');
          return;
        }
        
        retryCount++;
        if (debug) log(`Spoof attempt #${retryCount}`);
        
        if (retryCount >= maxRetries) {
          if (debug) log('Max retries reached without URL, reloading...');
          hint.textContent = "Failed to get URL! Reloading...";
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          return;
        }
        
        spoofWorkink();
        setTimeout(keepSpoofing, 500); // Reduced from 3000ms to 500ms for faster retries
      }
      
      keepSpoofing();
      if (debug) log('Waiting for server to send data.');
    }

    function spoofWorkink(){
      if (!linkInfo) {
        if (debug) log('skipped - no linkInfo');
        return;
      }
      if (debug) log ('starting, linkInfo:', linkInfo);

      const socials = linkInfo.socials || [];
      if (debug) log('Total socials:', socials.length);

      if (socials.length > 0) {
    hint.textContent = "Bypassing socials...";

    (async () => {
      for (let i = 0; i < socials.length; i++) {
        const soc = socials[i];
        hint.textContent = `Bypassing socials.. ${i+1}/${socials.length}`;
        try {
          if (sendMessage && sessionController) {
            const payload = { url: soc.url };

            if (sessionController.websocket && sessionController.websocket.readyState === WebSocket.OPEN) {
              if (debug) log(`websocket open, sending social [${i+1}/${socials.length}]`);

              sendMessage.call(sessionController, types.ss, payload);

              if (debug) log(`Social [${i+1}/${socials.length}] sent successfully`);

              // ADD THIS: Wait between each social send
              await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay

            } else {
              if (debug) error(`websocket not ready! State:`, sessionController.websocket?.readyState);
              await new Promise(resolve => setTimeout(resolve, 1000));
              i--;
              continue;
            }
          } else {
            if (debug) warn(`sendMessage or sessionController is null`, {sendMessage, sessionController});
          }
        } catch (e) {
          if (debug) error(`error sending social [${i+1}/${socials.length}]:`, e);
        }
      }

      if (debug) log('all socials sent, waiting before reload...');
      // INCREASE THIS: Wait longer before reloading
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds
      if(debug) log('reloading page after socials...');
      window.location.reload();
    })();
    } else {
          if (debug) log('No socials to send, processing monetizations...');
          handleMonetizations(); 
      }
      
      async function handleMonetizations() {
          const monetizations = sessionController?.monetizations || [];
          if (debug) log('Total monetizations:', monetizations.length);

          for (let i = 0; i < monetizations.length; i++) {
            const monetization = monetizations[i];
            if (debug) log(`Processing monetization [${i+1}/${monetizations.length}]:`, monetization);
            const monetizationId = monetization.id;
            const monetizationSendMessage = monetization.sendMessage;

            if (!monetizationSendMessage) {
              if (debug) log(`Skipping monetization [${i+1}/${monetizations.length}]: no sendMessage function`);
              continue;
            }

            try {
              switch (monetizationId) {
                case 22: {
                  monetizationSendMessage.call(monetization, { event: 'read' });
                  break;
                }
                case 25: {
                  monetizationSendMessage.call(monetization, { event: 'start' });
                  monetizationSendMessage.call(monetization, { event: 'installedClicked' });
                  fetch('/_api/v2/affiliate/operaGX', {method: 'GET', mode: 'no-cors' });
                  setTimeout(() => {
                    fetch('https://work.ink/_api/v2/callback/operaGX', {
                      method: 'POST',
                      mode: 'no-cors',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        'noteligible': true
                      })
                    });
                  }, 5000);
                  break;
                }
                case 34: {
                  monetizationSendMessage.call(monetization, { event: 'start' });
                  monetizationSendMessage.call(monetization, { event: 'installedClicked' });
                  break;
                }
                case 71: {
                  monetizationSendMessage.call(monetization, { event: 'start' });
                  monetizationSendMessage.call(monetization, { event: 'installed' });
                  break;
                }
                case 45: {
                  monetizationSendMessage.call(monetization, { event: 'installed' });
                  break;
                }
                case 57: {
                  monetizationSendMessage.call(monetization, { event: 'installed' });
                  break;
                }
                default: {
                  break;
                }
              }
            } catch (e) {
              if (debug) error(`Error monetization [${i+1}/${monetizations.length}]:`, monetization, e);
            }
          }

          if (debug) log('Workink processing completed');
        }
      }

      function createSendMessageProxy () {
        return function (...args) {
          const pt = args[0];
          const pd = args[1];

          if (pt !== types.pi) {
            if (debug) log('Message send:', pt, pd);
          }

          if (pt === types.tr || pt === types.rr || pt === types.hr) {
            if (debug) log('Captcha response detected');
            triggerBypass('captcha_solved');
          }

          return sendMessage ? sendMessage.apply(this, args) : undefined;
        };
      }

      function createLinkInfoProxy() {
        return function(...args) {
          const info = args[0];
          linkInfo = info;
          if (debug) log('Link info received:', info);
          spoofWorkink();
          try {
            Object.defineProperty(info, 'isAdblockEnabled', {
              get: () => false,
              set: () => {},
              configurable: false,
              enumerable: true
            });
            if (debug) log('Adblock disabled in linkInfo');
          } catch (e) {
            if (debug) warn('Define Property failed:', e);
          }
          return onLinkInfo ? onLinkInfo.apply(this, args): undefined;
        };
      }

      function performRedirect(targetUrl) {
        redirectAttempts++;
        
        if (redirectAttempts > 5) {
          if (debug) log('Max redirect attempts reached, reloading page...');
          hint.textContent = "Failed to redirect! Reloading...";
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          return;
        }
        
        if (debug) log(`Redirect attempt #${redirectAttempts}:`, targetUrl);
        hint.textContent = "Redirecting...";
        
        const redirectStartTime = Date.now();
        const loadCheckInterval = setInterval(() => {
          const elapsedTime = Date.now() - redirectStartTime;
          
          if (elapsedTime >= 20000) {
            clearInterval(loadCheckInterval);
            
            if (document.readyState === 'loading' || document.readyState === 'interactive') {
              if (debug) log('Page still loading after 10s, attempting redirect again...');
              hint.textContent = `Stuck redirect! Retry #${redirectAttempts}...`;
              setTimeout(() => {
                performRedirect(targetUrl);
              }, 1000);
              return;
            }
          }
        }, 1000);
        
        window.location.href = targetUrl;
        

        setTimeout(() => {
          clearInterval(loadCheckInterval);
          if (window.location.href === targetUrl) {
            if (debug) log('Redirect successful');
          } else if (redirectAttempts < 5) {
            if (debug) log('First redirect attempt failed, retrying...');
            hint.textContent = "First attempt failed, retrying...";
            setTimeout(() => {
              performRedirect(targetUrl);
            }, 1500);
          }
        }, 8000);
      }

      function startCountdownWithStuckDetection(url, waitLeft) {
        if (debug) log('startCountdown: started with', waitLeft, 'seconds');
        hint.textContent = `Redirecting in ${Math.ceil(waitLeft)}s...`;
        pageLoadStartTime = Date.now();
        
        let lastCountdownValue = Math.ceil(waitLeft);
        let stuckCounter = 0;
        
        if (redirectCountdown) clearInterval(redirectCountdown);
        
        redirectCountdown = setInterval(() => {
          waitLeft -= 1;
          const currentValue = Math.ceil(waitLeft);
          
          // If countdown value hasn't changed for 3 seconds, it's stuck
          if (currentValue === lastCountdownValue) {
            stuckCounter++;
            if (debug) log('Stuck counter:', stuckCounter);
          } else {
            stuckCounter = 0;
          }
          
          if (waitLeft > 0) {
            if (debug) log('startCountdown: Time remaining:', waitLeft);
            hint.textContent = `Redirecting in ${currentValue}s...`;
            lastCountdownValue = currentValue;
            
            // If stuck for 8+ seconds during countdown, force redirect
            if (stuckCounter >= 8) {
              if (debug) log('Countdown stuck detected, forcing redirect...');
              clearInterval(redirectCountdown);
              hint.textContent = "Stuck! Redirecting now...";
              setTimeout(() => {
                performRedirect(url);
              }, 500);
            }
          } else {
            clearInterval(redirectCountdown);
            performRedirect(url);
          }
        }, 1000);
      }

      function createDestinationProxy() {
        return function(...args) {
          const data = args[0];
          
          // Check if URL is valid
          if (!data || !data.url || data.url.trim() === '') {
            if (debug) log('Invalid or empty URL received, reloading...');
            hint.textContent = "Invalid URL! Reloading...";
            setTimeout(() => {
              window.location.reload();
            }, 2000);
            return;
          }
          
          const secondsPassed = (Date.now() - startTime) / 1000;
          destinationReceived = true;
          lastRedirectUrl = data.url;
          redirectAttempts = 0;
          
          // Clear monitoring intervals
          if (urlCheckInterval) {
            clearInterval(urlCheckInterval);
          }
          
          if (debug) log('Destination URL received:', data.url);

          let waitTimeSeconds = 5;
          const url = location.href;
          if (url.includes('42rk6hcq') || url.includes('ito4wckq') || url.includes('pzarvhq1') || url.includes('4pczrjbt') || url.includes('NULLFIRE')) {
            waitTimeSeconds = 36;
          }

          if (secondsPassed >= waitTimeSeconds) {
            hint.textContent = "Redirecting...";
            performRedirect(data.url);
          } else {
            startCountdownWithStuckDetection(data.url, waitTimeSeconds - secondsPassed);
          }
          return onLinkDestination ? onLinkDestination.apply(this, args): undefined;
        };
      }

      function setupProxies() {
        const send = resolveWriteFunction(sessionController);
        const info = resolveName(sessionController, map.onLI);
        const dest = resolveName(sessionController, map.onLD);

        sendMessage = send.fn;
        onLinkInfo = info.fn;
        onLinkDestination = dest.fn;

        const sendMessageProxy = createSendMessageProxy();
        const onLinkInfoProxy = createLinkInfoProxy();
        const onDestinationProxy = createDestinationProxy();

        Object.defineProperty(sessionController, send.name, {
          get() { return sendMessageProxy },
          set(v) { sendMessage = v },
          configurable: false,
          enumerable: true
        });

        Object.defineProperty(sessionController, info.name, {
          get() { return onLinkInfoProxy },
          set(v) { onLinkInfo = v },
          configurable: false,
          enumerable: true
        });

        Object.defineProperty(sessionController, dest.name, {
          get() { return onDestinationProxy },
          set(v) { onLinkDestination = v },
          configurable: false,
          enumerable: true
        });

        if (debug) log(`setupProxies: installed ${send.name}, ${info.name}, ${dest.name}`);
      }

      function checkController(target, prop, value, receiver) {
        if (debug) log('Checking prop:', prop, typeof value);
        if (value && 
          typeof value === 'object' &&
          resolveWriteFunction(value).fn &&
          resolveName(value, map.onLI).fn &&
          resolveName(value, map.onLD).fn &&
          !sessionController) {
            sessionController = value;
            if (debug) log('Controller detected:', sessionController);
            setupProxies();
          } else {
            if (debug) log('checkController: No controller found for prop:', prop);
          }
          return Reflect.set(target, prop, value, receiver);
      }

      function createComponentProxy(comp) {
        return new Proxy(comp, {
          construct(target, args) {
            const instance = Reflect.construct(target, args);
            if (instance.$$.ctx) {
              instance.$$.ctx = new Proxy(instance.$$.ctx, { set: checkController});
            }
            return instance;
          }
        });
      }

      function createNodeResultProxy(result) {
        return new Proxy(result, {
          get: (target, prop, receiver) => {
            if (prop === 'component') {
              return createComponentProxy(target.component);
            }
            return Reflect.get(target, prop, receiver);
          }
        });
      }

      function createNodeProxy(oldNode) {
        return async (...args) => {
          const result = await oldNode(...args);
          return createNodeResultProxy(result);
        }
      }

      function createKitProxy(kit) {
        if (!kit?.start) return [false, kit];

        return [
          true,
          new Proxy(kit, {
            get(target, prop, receiver) {
              if (prop === 'start') {
                return function(...args) {
                  const appModule = args[0];
                  const options = args[2];

                  if (
                      typeof appModule === 'object' &&
                      typeof appModule.nodes === 'object' &&
                      typeof options === 'object' &&
                      typeof options.node_ids === 'object'
                  ) {
                      const nodeIndex = options.node_ids[1];
                      const oldNode = appModule.nodes[nodeIndex];
                      appModule.nodes[nodeIndex] = createNodeProxy(oldNode);
                  }

                  if (debug) log('kit.start intercepted!', options);
                  return kit.start.apply(this, args);
                };
              }
              return Reflect.get(target, prop, receiver);
            }
          })
        ];
      }

      function setupInterception() {
        const origPromiseAll = Promise.all;
        let intercepted = false;

        Promise.all = async function(promises) {
          const result = origPromiseAll.call(this, promises);
          if (!intercepted) {
            intercepted = true;
            return await new Promise((resolve) => {
              result.then(([kit, app, ...args]) => {
                if (debug) log('Set up Interception!');

                const [success, created] = createKitProxy(kit);
                if (success) {
                  Promise.all = origPromiseAll;
                  if (debug) log('Kit ready', created, app);
                }
                resolve([created, app, ...args]);
              });
            });
          }
          return await result;
        };
      }

      window.googletag = {cmd: [], _loaded_: true};
      
      const blockedClasses = [
        "adsbygoogle",
        "adsense-wrapper",
        "inline-ad",
        "gpt-billboard-container"
    ];

    const blockedIds = [
        "billboard-1",
        "billboard-2",
        "billboard-3",
        "sidebar-ad-1",
        "skyscraper-ad-1"
    ];

    setupInterception();
    detectCaptchaFailure();

    const ob = new MutationObserver(mutations => {
      for(const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            blockedClasses.forEach((cls) => {
              if (node.classList?.contains(cls)) {
                node.remove();
                if (debug) log('Removed ad by class:', cls, node);
              }
              node.querySelectorAll?.(`.${cls}`).forEach((el) => {
                el.remove();
                if (debug) log('Removed nested ad by class:', cls, el);
              });
            });

            blockedIds.forEach((id) => {
              if (node.id === id) {
                node.remove();
                if(debug) log('Removed by id:', id, node);
              }
              node.querySelectorAll?.(`#${id}`).forEach((el) => {
                el.remove();
                if (debug) log('Removed nested by id', id, el);
              });
            });

            if (node.matches('.button.large.accessBtn.pos-relative') && node.textContent.includes('Go To Destination')) {
              if (debug) log('GTD button detected');

              if (!bypassTriggered) {
                if (debug) log('Waiting for linkInfo...');

                let gtdRetryCount = 0;

                function checkAndTriggerGTD() {
                  const ctrl = sessionController;
                  const dest = resolveName(ctrl, map.onLD);

                  if (ctrl && linkInfo && dest.fn) {
                    triggerBypass('gtd_button');
                    if (debug) log('Captcha bypass triggered after', gtdRetryCount, 'seconds');
                  } else {
                    gtdRetryCount++;
                    if (debug) log(`GTD retry ${gtdRetryCount}s: still waiting...`);
                    
                    if (gtdRetryCount >= 10) {
                      hint.textContent = "Failed to load! Reloading...";
                      if (debug) log('GTD check timeout, reloading...');
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                      return;
                    }
                    
                    hint.textContent = "Loading... Please wait...";
                    setTimeout(checkAndTriggerGTD, 1000);
                  }
                }

                checkAndTriggerGTD();
              } else {
                if (debug) log('Bypass already triggered');
              }
            }
          }
        }
      }
    });
    ob.observe(document.documentElement, { childList: true, subtree: true });
})();

(function () {
    'use strict';

    if (!location.hostname.includes("key.volcano.wtf")) return;

    const container = window.document.createElement("div");
    container.style.position = "fixed";
    container.style.bottom = "10px";
    container.style.left = "10px";
    container.style.zIndex = 999999;

    const shadow = container.attachShadow({ mode: "closed" });

    const hint = window.document.createElement("div");
    hint.textContent = "Please solve captcha to continue!";

    Object.assign(hint.style, {
        whiteSpace: "pre-line",
        position: "fixed",
        bottom: "50px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "linear-gradient(180deg, #3a0ca3, #240046)",
        color: "#ffffff",
        padding: "14px 20px",
        borderRadius: "10px",
        fontSize: "15px",
        fontFamily: "Poppins, sans-serif",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.4)",
        textAlign: "Left",
        pointerEvents: "none",
        zIndex: "9999",
        borderTop: "3px solid #7b2cbf",
        transition: "all 0.3s ease",
    });

    shadow.appendChild(hint);
    window.document.documentElement.appendChild(container);

    function handleVolcano() {
        let alreadyDoneContinue = false;
        let alreadyDoneCopy = false;

        function actOnCheckpoint(node) {
            if (!alreadyDoneContinue) {
                const buttons = node && node.nodeType === 1
                    ? node.matches('#primaryButton[type="submit"], button[type="submit"], a, input[type=button], input[type=submit]')
                        ? [node]
                        : node.querySelectorAll('#primaryButton[type="submit"], button[type="submit"], a, input[type=button], input[type=submit]')
                    : document.querySelectorAll('#primaryButton[type="submit"], button[type="submit"], a, input[type=button], input[type=submit]');

                for (const btn of buttons) {
                    const text = (btn.innerText || btn.value || "").trim().toLowerCase();
                    if ((text.includes("continue") || text.includes("next step")) && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
                        alreadyDoneContinue = true;
                        setTimeout(() => {
                            try {
                                btn.click();
                            } catch (err) {}
                        }, 300);
                        return true;
                    }
                }
            }

            if (!alreadyDoneCopy) {
                const copyBtn = node && node.nodeType === 1
                    ? node.matches("#copy-key-btn, .copy-btn, [aria-label='Copy']")
                        ? node
                        : node.querySelector("#copy-key-btn, .copy-btn, [aria-label='Copy']")
                    : document.querySelector("#copy-key-btn, .copy-btn, [aria-label='Copy']");

                if (copyBtn) {
                    alreadyDoneCopy = true;
                    setInterval(() => {
                        try {
                            copyBtn.click();
                            hint.textContent = "Bypass Completed"
                        } catch (err) {}
                    }, 500);
                    return true;
                }
            }
            return false;
        }

        const mo = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && actOnCheckpoint(node)) {
                            if (alreadyDoneCopy) {
                                mo.disconnect();
                                return;
                            }
                        }
                    }
                }
                if (mutation.type === 'attributes' && mutation.target.nodeType === 1) {
                    if (actOnCheckpoint(mutation.target)) {
                        if (alreadyDoneCopy) {
                            mo.disconnect();
                            return;
                        }
                    }
                }
            }
        });

        mo.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'aria-disabled']
        });

        if (actOnCheckpoint()) {
            if (alreadyDoneCopy) {
                mo.disconnect();
            }
        }
    }

    function waitForCloudflare(resolve) {
        const interval = setInterval(() => {
            const cfChallenge = document.querySelector("#cf-challenge-running, .ray-id, .cf-spinner, .cf-browser-verification, #challenge-running");
            const cfTitle = document.title.toLowerCase();
            const stillChecking =
                cfChallenge ||
                cfTitle.includes("checking your browser") ||
                cfTitle.includes("just a moment");
            if (!stillChecking) {
                clearInterval(interval);
                resolve();
            }
        }, 1000);
    }

    new Promise(waitForCloudflare).then(handleVolcano);
})();

(function() {
    'use strict';

    // ----- LOOT SECTION -----
    (function() {
        if (!location.hostname.includes("loot")) return;

        // ========= Helper: Wait for document.body =========
        function waitForBody() {
            return new Promise(resolve => {
                if (document.body) return resolve(document.body);
                const obs = new MutationObserver(() => {
                    if (document.body) {
                        obs.disconnect();
                        resolve(document.body);
                    }
                });
                obs.observe(document.documentElement, {childList: true});
            });
        }

        // ========= Helper: Safe Click Simulation =========
        function dispatchHumanEvents(el) {
            const opts = { bubbles: true, cancelable: true, view: window };
            el.dispatchEvent(new MouseEvent('mouseover', opts));
            el.dispatchEvent(new MouseEvent('mousemove', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            setTimeout(() => {
                el.dispatchEvent(new MouseEvent('mouseup', opts));
                el.dispatchEvent(new MouseEvent('click', opts));
            }, 80);
        }

        function isVisible(el) {
            if (!el) return false;
            const s = getComputedStyle(el);
            if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0" || s.pointerEvents === "none") return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        }

        const clicked = new WeakSet();
        function safeHumanClick(el) {
          if (!el || clicked.has(el) || !isVisible(el)) return;
            clicked.add(el);

            const delay = 300 + Math.random() * 1000;

            setTimeout(() => {
                const anchor = el.closest("a");

                // --- HARD BLOCK NAVIGATION ---
                let oldHref;
                if (anchor) {
                    oldHref = anchor.getAttribute("href");
                    anchor.removeAttribute("href");
                    anchor.style.pointerEvents = "none";
                }

                try {
                    el.scrollIntoView({ block: "center" });
                } catch {}

                el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

                // --- RESTORE AFTER JS HANDLER RUNS ---
                setTimeout(() => {
                    if (anchor && oldHref) {
                        anchor.setAttribute("href", oldHref);
                        anchor.style.pointerEvents = "";
                    }
                }, 500);

            }, delay);
        }


        function scanAndClick() {
            // Generic divs with id & class
            document.querySelectorAll("div[id][class]").forEach(div => safeHumanClick(div));

            // Specific selectors you had
            document.querySelectorAll("div.is-success.btn-shadow, .btn-shadow").forEach(div => safeHumanClick(div));

            // Try buttons and anchors too (some sites use <button> or <a>)
            document.querySelectorAll("button, a[href]").forEach(el => safeHumanClick(el));
        }

        waitForBody().then(() => {
            const frame = document.createElement("div");
            frame.id = "lootlink-timer-frame";
            Object.assign(frame.style, {
                position: "fixed",
                top: "10px",
                right: "10px",
                zIndex: "999999",
                padding: "10px 15px",
                background: "linear-gradient(135deg,#6a11cb,#2575fc)",
                color: "white",
                fontSize: "16px",
                fontWeight: "bold",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                fontFamily: "Arial,sans-serif"
            });
            frame.textContent = "⏳ wait for: --";
            document.body.appendChild(frame);

            function updateHighestTimer() {
                const spans = Array.from(document.querySelectorAll("span._fhsdfs"));
                let maxTimer = 0;
                spans.forEach(span => {
                    const val = parseInt(span.textContent.trim(), 10);
                    if (!isNaN(val) && val > maxTimer) maxTimer = val;
                });
                frame.textContent = `⏳ wait for: ${maxTimer > 0 ? maxTimer : "--"}`;
            }

            // Interval and observer start once DOM exists
            setInterval(updateHighestTimer, 1000);
            scanAndClick();

            // MutationObserver plus periodic scan for elements that appear gradually
            const observer = new MutationObserver(scanAndClick);
            observer.observe(document.body, { childList: true, subtree: true });

            // Extra periodic scans (helps if elements show later)
            setInterval(scanAndClick, 1500);
        });
    })();


    // ----- BYPASS/API SECTION -----
    (function() {
        // IMPORTANT: never run the API logic for 'loot' pages
        if (location.hostname.includes("loot")) {
            // Do not run API on loot pages
            return;
        }

        const SUPPORTED_HOSTS = [
            "rekonise",
            "linkvertise",
            "link-unlock"
        ];

        const host = (location.hostname || '').toLowerCase().trim();
        if (!SUPPORTED_HOSTS.some(f => f && host.includes(f))) return;

        // ----- UI -----
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.bottom = "10px";
        container.style.left = "10px";
        container.style.zIndex = 999999;

        const shadow = container.attachShadow({ mode: "closed" });

        const hint = document.createElement("div");
        hint.textContent = "Bypassing…";

        Object.assign(hint.style, {
            whiteSpace: "pre-line",
            position: "fixed",
            bottom: "50px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(180deg, #3a0ca3, #240046)",
            color: "#ffffff",
            padding: "14px 20px",
            borderRadius: "10px",
            fontSize: "15px",
            fontFamily: "Poppins, sans-serif",
            boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
            textAlign: "left",
            pointerEvents: "none",
            zIndex: "9999",
            borderTop: "3px solid #7b2cbf",
            transition: "all 0.3s ease"
        });

        shadow.appendChild(hint);
        document.documentElement.appendChild(container);

        // ----- API -----
        const apiUrl =
            "https://afklol-api.vercel.app/bypass?url=" +
            encodeURIComponent(location.href);

        // Defer and use GM_xmlhttpRequest (userscript-safe)
        setTimeout(() => {
            try {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: apiUrl,
                    timeout: 10000,

                    onload: res => {
                        let json;
                        try {
                            json = JSON.parse(res.responseText);
                        } catch {
                            console.error("Vortex Bypass: Invalid JSON");
                            return;
                        }

                        const result = json && json.result;
                        if (!result) return;

                        if (/^https?:\/\//i.test(result)) {
                            location.replace(result);
                            return;
                        }

                        if (
                            /^\s*<(!doctype|html|body|div|script)/i.test(result) ||
                            result.includes("<html")
                        ) {
                            document.open();
                            document.write(result);
                            document.close();
                            return;
                        }

                        document.documentElement.innerHTML = result;
                    },

                    onerror: err => {
                        console.error("Vortex Bypass: API error", err);
                    },

                    ontimeout: () => {
                        console.warn("Vortex Bypass: API timeout");
                    }
                });
            } catch (e) {
                console.error("GM_xmlhttpRequest failed:", e);
            }
        }, 0);
    })();

})();

