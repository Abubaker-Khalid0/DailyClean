/* MAIN world. Registered at document_start only while protection is enabled. */
(function () {
  'use strict';
  if (window.__dailycleanHook?.version === 6) { window.__dailycleanHook.setEnabled(true); return; }
  let enabled = true;
  let sequence = 0;
  const documentId = crypto.randomUUID();
  const CHANNEL = 'dailyclean::hook';
  const report = kind => window.postMessage({ channel: CHANNEL, kind, id: documentId + ':' + (++sequence) }, '*');
  window.__dailycleanHook = {
    version: 6,
    setEnabled(value) { enabled = !!value; report('hook-ready'); },
  };
  window.addEventListener('message', event => {
    if (event.source !== window || event.data?.channel !== 'dailyclean::control') return;
    if (event.data.type === 'SET_ENABLED') window.__dailycleanHook.setEnabled(event.data.enabled);
    if (event.data.type === 'PING') report('hook-ready');
  });
  const isDM = host => host === 'dailymotion.com' || host.endsWith('.dailymotion.com');
  function parseUrl(input) {
    try { return new URL(input instanceof Request ? input.url : String(input), location.href); } catch { return null; }
  }
  function isConfig(url) {
    if (!url || !isDM(url.hostname)) return false;
    return /^\/player\/(metadata\/|config(?:\/|$))/i.test(url.pathname) ||
      /^\/embed\/video\/[^/]+\/config(?:\/|$)/i.test(url.pathname) ||
      url.hostname === 'graphql.api.dailymotion.com' ||
      (url.hostname === 'api.dailymotion.com' && /^\/(video|player)(?:\/|$)/i.test(url.pathname));
  }
  // Only synthesize XML for VAST/VMAP endpoints, never arbitrary JSON or SDK calls.
  function isVast(url) {
    if (!url) return false;
    const adHost = /(^|\.)(doubleclick\.net|dmxleo\.com|spotxchange\.com|springserve\.com)$/.test(url.hostname);
    return (adHost || isDM(url.hostname)) && /\/(vast|vmap)(?:[/.]|$)|\/gampad\/ads(?:\/|$)/i.test(url.pathname);
  }
  const EMPTY_VAST = '<?xml version="1.0" encoding="UTF-8"?><VAST version="4.0"></VAST>';
  const containers = /^(ads|ads_?config|ad_?settings|advertising|ad_?breaks|ad_?slots|midrolls?|prerolls?|postrolls?|ad_?schedule|ad_?rules)$/i;
  const flags = /^(has_?ads|ads?_?enabled|enable_?ads|show_?ads|autoplay_?ads|ima_?enabled|vpaid_?enabled)$/i;
  const endpoints = /^(ad_?tag(?:_?url)?|vast_?url|vmap_?url|vpaid_?url|ad_?url|ad_?server|ad_?endpoint)$/i;
  function sanitize(value, depth = 0, stats = { n: 0 }) {
    if (depth > 12 || !value || typeof value !== 'object') return value;
    for (const key of Object.keys(value)) {
      const current = value[key];
      if (containers.test(key)) {
        if (Array.isArray(current) && current.length) { value[key] = []; stats.n++; }
        else if (current && typeof current === 'object' && Object.keys(current).length) { value[key] = {}; stats.n++; }
        else if (typeof current === 'string' && current) { value[key] = ''; stats.n++; }
      } else if (flags.test(key) && [true, 1, '1', 'true'].includes(current)) {
        value[key] = typeof current === 'string' ? (current === '1' ? '0' : 'false') : typeof current === 'number' ? 0 : false;
        stats.n++;
      } else if (endpoints.test(key) && typeof current === 'string' && current) {
        value[key] = ''; stats.n++;
      } else sanitize(current, depth + 1, stats);
    }
    return value;
  }
  function cleanText(text) {
    if (!enabled || typeof text !== 'string' || !/^[\s]*[\[{]/.test(text)) return text;
    try {
      const stats = { n: 0 };
      const result = sanitize(JSON.parse(text), 0, stats);
      if (!stats.n) return text;
      report('config-sanitized');
      return JSON.stringify(result);
    } catch { return text; }
  }
  function preserveMetadata(response, original) {
    for (const key of ['url', 'redirected', 'type']) Object.defineProperty(response, key, { value: original[key] });
    const clone = response.clone.bind(response);
    Object.defineProperty(response, 'clone', { value: () => preserveMetadata(clone(), original) });
    return response;
  }
  const nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    if (!enabled) return nativeFetch.call(this, input, init);
    const url = parseUrl(input);
    if (isVast(url)) {
      const signal = init?.signal || (input instanceof Request ? input.signal : null);
      if (signal?.aborted) return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      report('request-blocked');
      return Promise.resolve(new Response(EMPTY_VAST, { headers: { 'content-type': 'application/xml' } }));
    }
    const call = nativeFetch.call(this, input, init);
    if (!isConfig(url)) return call;
    return call.then(async response => {
      if (!enabled || !response.ok || !/json|javascript|text\/plain/i.test(response.headers.get('content-type') || '')) return response;
      try {
        const raw = await response.clone().text();
        const clean = cleanText(raw);
        if (clean === raw) return response;
        const headers = new Headers(response.headers);
        headers.delete('content-length'); headers.delete('content-encoding');
        return preserveMetadata(new Response(clean, { status: response.status, statusText: response.statusText, headers }), response);
      } catch { return response; }
    });
  };
  const proto = XMLHttpRequest.prototype;
  const nativeOpen = proto.open;
  const nativeText = Object.getOwnPropertyDescriptor(proto, 'responseText');
  const nativeResponse = Object.getOwnPropertyDescriptor(proto, 'response');
  const patched = new WeakSet();
  proto.open = function (method, input, ...rest) {
    if (patched.has(this)) { delete this.responseText; delete this.response; patched.delete(this); }
    const url = parseUrl(input);
    // DNR owns XHR blocking; retain native CORS, readyState and error behavior.
    const result = nativeOpen.call(this, method, input, ...rest);
    if (!enabled || !isConfig(url) || !nativeText?.get || !nativeResponse?.get) return result;
    let cache;
    const text = () => {
      const raw = nativeText.get.call(this);
      if (!enabled) return raw;
      if (cache?.raw !== raw) cache = { raw, clean: cleanText(raw) };
      return cache.clean;
    };
    let objectCache;
    Object.defineProperties(this, {
      responseText: { configurable: true, get: text },
      response: { configurable: true, get: () => {
        if (!enabled) return nativeResponse.get.call(this);
        if (this.responseType === '' || this.responseType === 'text') return text();
        const raw = nativeResponse.get.call(this);
        if (this.responseType !== 'json' || !raw) return raw;
        if (objectCache?.raw !== raw) objectCache = { raw, clean: JSON.parse(cleanText(JSON.stringify(raw))) };
        return objectCache.clean;
      } },
    });
    patched.add(this);
    return result;
  };
  report('hook-ready');
})();
