/* Isolated world: scoped ad detection, safe native skip, and page health. */
(function () {
  'use strict';
  if (window.__dailycleanContent) return;
  window.__dailycleanContent = true;
  const state = { enabled: false, autoSkip: true, hookReady: false, video: null, container: null, adVisible: false, canSkip: false };
  const MARKERS = '[data-ad-playing="true"],[data-ad-playing="1"],[data-is-ad="true"],[data-is-ad="1"],[class*="ad-overlay" i],[class*="ad-countdown" i],[class*="ad-badge" i],[class*="ad-playing" i],[class*="ad-timer" i],[data-testid="ad-label"],[data-testid="ad-countdown"]';
  const SKIP = /\b(skip|passer|saltar|salta|pular)\b|überspringen|تخطي|تخطى|تجاوز|スキップ|넘기기/i;
  const NOT_AD = /\b(intro|recap|opening|ending|credits)\b|مقدمة|تلخيص|شارات/i;
  const AD_NAME = /\b(ad|ads|advertisement|publicité|annonce|werbung|pubblicità|anúncio)\b|إعلان|الإعلان|اعلان|الإعلانات|広告|광고/i;
  const AD_LABEL = /^(ad|ads|advertisement|publicité|annonce|werbung|إعلان|الإعلان|広告|광고)(\s+\d+.*)?$/i;
  const actions = new Set();
  let host, shadow, button, label, timer, resizeObserver, observedContainer, lastStatus = '';
  let autoTimer, autoTarget, clicked = new WeakSet(), lastUrl = location.href;
  const send = message => { try { return chrome.runtime.sendMessage(message).catch(() => null); } catch { return Promise.resolve(null); } };
  const postControl = (type, enabled) => window.postMessage({ channel: 'dailyclean::control', type, enabled }, '*');
  function shown(el) {
    if (!el?.isConnected) return false;
    if (el.closest('[hidden], [aria-hidden="true"]')) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    return typeof el.checkVisibility === 'function'
      ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      : el.getClientRects().length > 0;
  }
  function playerContainer(video) {
    // Dailymotion's embed has sibling .video_player and .ad-container sections.
    if (location.hostname === 'geo.dailymotion.com' || /^\/embed\/video\//.test(location.pathname)) {
      const main = video.closest('main');
      if (main) return main;
    }
    let node = video.parentElement;
    let fallback = node;
    for (let i = 0; node && i < 8 && node !== document.body; i++, node = node.parentElement) {
      if (/player|video-container|videocontainer/i.test(node.id + ' ' + node.className)) {
        fallback = node;
        if (node.id === 'player' || node.getAttribute('data-testid') === 'player' || node.querySelector('button,[role="button"]')) return node;
      }
    }
    return fallback;
  }
  function pickVideo() {
    let best = null, area = 0;
    for (const video of document.querySelectorAll('video')) {
      if (!shown(video)) continue;
      const rect = video.getBoundingClientRect(), size = rect.width * rect.height;
      if (size > area) { area = size; best = video; }
    }
    return best;
  }
  function visibleMarker(root) {
    return [root, ...root.querySelectorAll(MARKERS)].some(el => {
      if (!el.matches(MARKERS) || !shown(el)) return false;
      return !el.closest('[data-ad-playing="false"],[data-ad-playing="0"],[data-is-ad="false"],[data-is-ad="0"]');
    });
  }
  function adLabel(root) {
    return Array.from(root.querySelectorAll('span,div,p,label')).slice(0,500).some(el =>
      el.childElementCount === 0 && AD_LABEL.test(el.textContent.trim()) && shown(el));
  }
  function nativeSkip(root, evidence) {
    for (const el of root.querySelectorAll('button,[role="button"],a[class*="skip" i]')) {
      const text = [el.getAttribute('aria-label'), el.title, el.textContent?.trim().slice(0,80)].join(' ');
      if (!SKIP.test(text) || NOT_AD.test(text) || !shown(el)) continue;
      if (el.matches(':disabled,[disabled],[aria-disabled="true"]') || el.closest('[inert],[aria-disabled="true"]')) continue;
      const signature = el.id + ' ' + el.className + ' ' + el.getAttribute('data-testid');
      const explicit = /(?:ad[-_]?skip|skip[-_]?ad)/i.test(signature) || AD_NAME.test(text);
      // A generic "skip" control is only valid beside a visible ad indicator.
      if ((explicit || evidence) && !/skip\s+in\s+\d|passer\s+dans\s+\d|بعد\s+\d/i.test(text)) return el;
    }
    return null;
  }
  function detect() {
    const root = state.container;
    if (!root?.isConnected || !state.video?.isConnected || !shown(state.video)) return { ad: false, skip: null };
    const evidence = visibleMarker(root) || adLabel(root);
    const skip = nativeSkip(root, evidence);
    return { ad: evidence || !!skip, skip };
  }
  function getStatus() {
    const result = state.enabled ? detect() : { ad: false, skip: null };
    return { enabled: state.enabled, hookReady: state.hookReady, player: !!state.video?.isConnected, adVisible: result.ad, canSkip: !!result.skip };
  }
  function reportStatus() {
    const status = getStatus(), key = JSON.stringify(status);
    if (key !== lastStatus) { lastStatus = key; send({ type: 'FRAME_STATUS', ...status }); }
  }
  function createOverlay() {
    if (host?.isConnected) return;
    host = document.createElement('div');
    host.id = 'dailyclean-control';
    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ':host{all:initial;color-scheme:light;direction:rtl}*{box-sizing:border-box}button{pointer-events:auto;display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 11px;border:1px solid #ffffff35;border-radius:8px;background:#fafafa;color:#18181b;font:600 12px/1.3 "Segoe UI",Tahoma,sans-serif;box-shadow:0 2px 10px #0004;cursor:pointer;white-space:nowrap;transition:background .15s}button:hover{background:#e4e4e7}button:focus-visible{outline:2px solid white;outline-offset:3px}button:disabled{background:#18181be8;color:#fafafa;cursor:default;font-weight:400}svg{width:14px;height:14px;flex:none}button:disabled svg{opacity:.6}@media(prefers-reduced-motion:reduce){button{transition:none}}';
    button = document.createElement('button'); button.type = 'button';
    button.setAttribute('aria-label', 'تخطي الإعلان');
    button.title = 'استخدام زر التخطي المتاح في المشغّل';
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','currentColor'); svg.setAttribute('aria-hidden','true');
    const path = document.createElementNS(svg.namespaceURI,'path');
    path.setAttribute('d','M5 4v16l11-8L5 4zm12 0h2v16h-2z'); svg.append(path);
    label = document.createElement('span');
    button.append(svg,label); button.addEventListener('click', () => skipNow(false));
    shadow.append(style,button);
    (document.fullscreenElement || document.body || document.documentElement).append(host);
  }
  function positionOverlay() {
    if (!host || !state.video?.isConnected || !state.enabled || !state.adVisible) { if (host) host.hidden = true; return; }
    const parent = document.fullscreenElement || document.body || document.documentElement;
    if (parent === state.video) { host.hidden = true; return; } // Native video fullscreen cannot contain HTML overlays.
    if (host.parentElement !== parent) parent.append(host);
    const rect = state.video.getBoundingClientRect();
    const width = Math.min(192, Math.max(100, rect.width - 24));
    const visible = rect.bottom > 80 && rect.top < innerHeight - 50 && rect.right > 100 && rect.left < innerWidth - 100;
    host.hidden = !visible;
    host.style.left = Math.max(8, Math.min(rect.right - width - 12, innerWidth - width - 8)) + 'px';
    host.style.top = Math.max(rect.top + 12, Math.min(rect.bottom - 72, innerHeight - 46)) + 'px';
    host.style.width = width + 'px';
  }
  function renderOverlay(result) {
    if (!result.ad || !state.enabled) { if (host) host.hidden = true; return; }
    createOverlay();
    button.disabled = !result.skip;
    label.textContent = result.skip ? 'تخطي الإعلان' : 'بانتظار إتاحة التخطي';
    button.setAttribute('aria-label', label.textContent);
    positionOverlay();
  }
  function skipNow(automatic) {
    if (!state.enabled || (automatic && !state.autoSkip)) return { done: false };
    const result = detect(), skip = result.skip;
    if (!skip || (automatic && clicked.has(skip))) return { done: false };
    clicked.add(skip);
    skip.click();
    // This counter is explicitly "protection actions", not verified ads removed.
    send({ type: 'REPORT_ACTION', kind: 'native-skip' });
    schedule();
    return { done: false, requested: true, method: 'native' };
  }
  function evaluate() {
    timer = null;
    if (!state.enabled) { state.adVisible = false; state.canSkip = false; if (host) host.hidden = true; reportStatus(); return; }
    if (!state.video?.isConnected || !shown(state.video)) discover();
    const result = detect();
    state.adVisible = result.ad; state.canSkip = !!result.skip;
    if (!result.skip) clicked = new WeakSet();
    renderOverlay(result);
    if (!state.autoSkip || !result.skip || clicked.has(result.skip)) {
      clearTimeout(autoTimer); autoTimer = null; autoTarget = null;
    } else if (!autoTimer || autoTarget !== result.skip) {
      clearTimeout(autoTimer); autoTarget = result.skip;
      autoTimer = setTimeout(() => { autoTimer = null; autoTarget = null; skipNow(true); }, 350);
    }
    reportStatus();
  }
  function schedule() { if (!timer) timer = setTimeout(evaluate, 100); }
  const videoEvents = ['loadedmetadata','emptied','playing','pause','durationchange','seeked','resize'];
  const containerObserver = new MutationObserver(schedule);
  function discover() {
    if (lastUrl !== location.href) { lastUrl = location.href; clicked = new WeakSet(); }
    const video = pickVideo();
    const container = video ? playerContainer(video) : null;
    if (state.video === video && observedContainer === container) return;
    if (state.video) for (const event of videoEvents) state.video.removeEventListener(event,schedule);
    containerObserver.disconnect(); resizeObserver?.disconnect();
    state.video = video; state.container = container; observedContainer = container;
    clicked = new WeakSet();
    if (video && container) {
      for (const event of videoEvents) video.addEventListener(event,schedule,{ passive: true });
      containerObserver.observe(container, { childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['class','style','hidden','disabled','aria-disabled','aria-label','aria-hidden','data-ad-playing','data-is-ad','data-testid'] });
      resizeObserver = new ResizeObserver(positionOverlay); resizeObserver.observe(video);
    }
    schedule();
  }
  const documentObserver = new MutationObserver(records => {
    if (!state.video?.isConnected || records.some(r => [...r.addedNodes, ...r.removedNodes].some(n =>
      n.nodeType === 1 && (n.tagName === 'VIDEO' || n.querySelector?.('video'))))) discover();
  });
  function start() {
    documentObserver.observe(document.documentElement, { childList: true, subtree: true });
    discover(); schedule(); postControl('PING');
  }
  async function settings(next) {
    const wasEnabled = state.enabled;
    state.enabled = next.enabled !== false; state.autoSkip = next.autoSkip !== false;
    if (!state.enabled) { state.adVisible = false; state.canSkip = false; clearTimeout(autoTimer); if (host) host.hidden = true; }
    postControl('SET_ENABLED',state.enabled);
    if (state.enabled && !wasEnabled) {
      await send({ type: 'SYNC_HOOK' });
      // The user may have toggled again while injection was in flight.
      postControl('SET_ENABLED',state.enabled);
    }
    schedule();
  }
  window.addEventListener('message', event => {
    if (event.source !== window || event.data?.channel !== 'dailyclean::hook') return;
    const data = event.data;
    if (data.kind === 'hook-ready') { state.hookReady = true; reportStatus(); return; }
    if (!state.enabled || typeof data.id !== 'string' || actions.has(data.id)) return;
    if (!['request-blocked','config-sanitized','ima-neutralized'].includes(data.kind)) return;
    if (actions.size >= 1000) actions.delete(actions.values().next().value);
    actions.add(data.id); send({ type: 'REPORT_ACTION', kind: data.kind });
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === 'GET_STATUS') { respond(getStatus()); return false; }
    if (message?.type === 'SET_SETTINGS') { settings(message).then(() => respond(getStatus())); return true; }
    if (message?.type === 'SKIP_NOW') { respond(skipNow(false)); return false; }
    return false;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || (!changes.enabled && !changes.autoSkip)) return;
    settings({ enabled: changes.enabled?.newValue ?? state.enabled, autoSkip: changes.autoSkip?.newValue ?? state.autoSkip });
  });
  window.addEventListener('scroll',positionOverlay,{ passive:true, capture:true });
  window.addEventListener('resize',() => { discover(); positionOverlay(); },{ passive:true });
  document.addEventListener('fullscreenchange',positionOverlay);
  window.addEventListener('pagehide',() => { documentObserver.disconnect(); containerObserver.disconnect(); resizeObserver?.disconnect(); clearTimeout(timer); timer = null; clearTimeout(autoTimer); if(host)host.hidden=true; });
  window.addEventListener('pageshow',event => { if(event.persisted) { observedContainer=null; start(); chrome.storage.local.get({enabled:true,autoSkip:true}).then(settings); } });
  chrome.storage.local.get({ enabled:true, autoSkip:true }).then(async value => {
    await settings(value);
    if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded',start,{once:true});
  });
})();
