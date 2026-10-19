/* DailyClean: persistent settings, serialized statistics, and runtime policy. */
'use strict';
const LOCAL_DEFAULTS = { enabled: true, autoSkip: true, totalActions: 0 };
const SESSION_DEFAULTS = { sessionActions: 0, tabCounts: {}, frameStatus: {}, reloadTabs: {} };
const RULESET = 'ad_network_rules';
const HOOK_ID = 'dailyclean-page-hook';
let queue = Promise.resolve();
function serialize(task) { const run = queue.then(task, task); queue = run.catch(() => {}); return run; }
const getLocal = () => chrome.storage.local.get(LOCAL_DEFAULTS);
const getSession = () => chrome.storage.session.get(SESSION_DEFAULTS);
function isDailymotion(url) { try { return /(^|\.)dailymotion\.com$/i.test(new URL(url).hostname); } catch { return false; } }

async function configureRuntime(enabled) {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [RULESET] : [], disableRulesetIds: enabled ? [] : [RULESET],
  });
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [HOOK_ID] });
  if (enabled && !scripts.length) {
    await chrome.scripting.registerContentScripts([{
      id: HOOK_ID, matches: ['*://*.dailymotion.com/*'], js: ['page-hook.js'],
      runAt: 'document_start', allFrames: true, world: 'MAIN', persistAcrossSessions: true,
    }]);
  } else if (!enabled && scripts.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [HOOK_ID] });
  }
}
async function setBadge(tabId, count, enabled) {
  const target = tabId == null ? {} : { tabId };
  try {
    await chrome.action.setBadgeBackgroundColor({ ...target, color: enabled ? '#18181b' : '#71717a' });
    await chrome.action.setBadgeText({ ...target, text: enabled ? (count > 0 ? String(count) : '') : 'OFF' });
  } catch { /* The tab may have closed. */ }
}
async function initialize() {
  const local = await getLocal();
  await chrome.storage.local.set(local);
  await configureRuntime(local.enabled);
  await setBadge(null, 0, local.enabled);
}
chrome.runtime.onInstalled.addListener(() => serialize(initialize).catch(console.error));
chrome.runtime.onStartup.addListener(() => serialize(initialize).catch(console.error));
chrome.tabs.onRemoved.addListener(tabId => serialize(async () => {
  const session = await getSession();
  for (const key of ['tabCounts', 'frameStatus', 'reloadTabs']) delete session[key][tabId];
  await chrome.storage.session.set(session);
}).catch(console.error));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status !== 'loading') return;
  serialize(async () => {
    const session = await getSession();
    for (const key of ['tabCounts', 'frameStatus', 'reloadTabs']) delete session[key][tabId];
    await chrome.storage.session.set(session);
    await setBadge(tabId, 0, (await getLocal()).enabled);
  }).catch(console.error);
});
async function handleIncrement(tabId) {
  return serialize(async () => {
    const [local, session] = await Promise.all([getLocal(), getSession()]);
    if (!local.enabled || tabId == null) return { ok: false };
    const total = (Number(local.totalActions) || 0) + 1;
    session.sessionActions = (Number(session.sessionActions) || 0) + 1;
    session.tabCounts[tabId] = (session.tabCounts[tabId] || 0) + 1;
    await chrome.storage.local.set({ totalActions: total });
    await chrome.storage.session.set(session);
    await setBadge(tabId, session.tabCounts[tabId], true);
    return { ok: true };
  });
}
async function reportFrame(sender, status) {
  return serialize(async () => {
    const session = await getSession();
    const frames = session.frameStatus[sender.tab.id] || {};
    frames[sender.frameId] = {
      player: !!status.player, hookReady: !!status.hookReady,
      adVisible: !!status.adVisible, canSkip: !!status.canSkip,
    };
    session.frameStatus[sender.tab.id] = frames;
    await chrome.storage.session.set({ frameStatus: session.frameStatus });
    return { ok: true };
  });
}
async function handleGetStats() {
  const [local, session, tabs, rules] = await Promise.all([
    getLocal(), getSession(), chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.declarativeNetRequest.getEnabledRulesets(),
  ]);
  const tab = tabs[0];
  let frames = [];
  const known = Object.keys(session.frameStatus[tab?.id] || {});
  if (tab) {
    frames = (await Promise.all(known.map(async frameId => {
      try { return await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, { frameId: Number(frameId) }); }
      catch { return null; }
    }))).filter(Boolean);
  }
  return {
    ...local, sessionActions: session.sessionActions, tabActions: session.tabCounts[tab?.id] || 0,
    isDailymotion: isDailymotion(tab?.url) || frames.length > 0,
    connected: frames.length > 0, hookReady: frames.some(x => x.hookReady),
    playerFound: frames.some(x => x.player), canSkip: frames.some(x => x.canSkip),
    networkActive: rules.includes(RULESET), needsReload: !!session.reloadTabs[tab?.id],
  };
}
async function handleToggle(enabled) {
  return serialize(async () => {
    const previous = await getLocal();
    const next = !!enabled;
    try { await configureRuntime(next); }
    catch (error) { await configureRuntime(previous.enabled).catch(() => {}); throw error; }
    await chrome.storage.local.set({ enabled: next });
    const [session, tabs] = await Promise.all([getSession(), chrome.tabs.query({})]);
    await setBadge(null, 0, next);
    for (const tab of tabs) {
      const knownFrames = Object.keys(session.frameStatus[tab.id] || {});
      if (!knownFrames.length && !isDailymotion(tab.url)) continue;
      session.reloadTabs[tab.id] = true;
      try { await chrome.tabs.sendMessage(tab.id, { type: 'SET_SETTINGS', enabled: next, autoSkip: previous.autoSkip }); } catch {}
      await setBadge(tab.id, session.tabCounts[tab.id] || 0, next);
    }
    await chrome.storage.session.set({ reloadTabs: session.reloadTabs });
    return { enabled: next, needsReload: true };
  });
}
async function route(message, sender) {
  const tabId = sender.tab?.id;
  const fromPage = tabId != null && isDailymotion(sender.url);
  const fromPopup = sender.url?.split(/[?#]/)[0] === chrome.runtime.getURL('popup.html');
  if (message?.type === 'REPORT_ACTION' && fromPage) return handleIncrement(tabId);
  if (message?.type === 'FRAME_STATUS' && fromPage) return reportFrame(sender, message);
  if (message?.type === 'SYNC_HOOK' && fromPage) {
    const settings = await getLocal();
    if (settings.enabled) {
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [sender.frameId] }, world: 'MAIN', files: ['page-hook.js'] });
    }
    return settings;
  }
  if (!fromPopup) return { ok: false, error: 'Unsupported sender' };
  if (message.type === 'GET_TAB_STATS') return handleGetStats();
  if (message.type === 'TOGGLE_ENABLED') return handleToggle(message.enabled);
  if (message.type === 'SET_AUTO_SKIP') {
    await serialize(() => chrome.storage.local.set({ autoSkip: !!message.enabled }));
    return { ok: true };
  }
  if (message.type === 'RELOAD_ACTIVE_TAB') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && (isDailymotion(tab.url) || (await getSession()).frameStatus[tab.id])) {
      await chrome.tabs.reload(tab.id); return { ok: true };
    }
  }
  return { ok: false, error: 'Unknown message' };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  route(message, sender).then(respond, error => respond({ ok: false, error: String(error) }));
  return true;
});
