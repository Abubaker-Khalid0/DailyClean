/**
 * DailyClean — Google IMA SDK Stub (noop implementation)
 *
 * WHY THIS EXISTS
 * ---------------
 * Blocking `imasdk.googleapis.com/js/sdkloader/ima3.js` outright makes the
 * Dailymotion player wait forever for `window.google.ima` to appear, which
 * results in a hung player, a black frame, or an anti-adblock trigger.
 *
 * Instead, a declarativeNetRequest `redirect` rule serves this file in place of
 * the real SDK. It implements the full public API surface the player expects,
 * but `AdsLoader.requestAds()` synthesises an `AD_ERROR` event asynchronously.
 * Every IMA integration treats `AD_ERROR` as "no ads available, play the
 * content" — so playback starts immediately with no ad and no skip button.
 *
 * Runs in the page (MAIN) world as a classic script. No extension APIs here.
 */

(function () {
  'use strict';

  if (window.google && window.google.ima && window.google.ima.__dailyclean) return;

  const VERSION = '3.694.0';

  /* ── Minimal event dispatcher shared by loader / manager ───────────────── */

  class Emitter {
    constructor() {
      this._listeners = Object.create(null);
    }
    addEventListener(type, fn, capture, scope) {
      if (typeof fn !== 'function' && !(fn && typeof fn.handleEvent === 'function')) return;
      (this._listeners[type] || (this._listeners[type] = [])).push({ fn, scope });
    }
    removeEventListener(type, fn) {
      const list = this._listeners[type];
      if (!list) return;
      const i = list.findIndex(listener => listener.fn === fn);
      if (i !== -1) list.splice(i, 1);
    }
    _emit(type, event) {
      const list = this._listeners[type];
      if (!list || !list.length) return;
      for (const { fn, scope } of list.slice()) {
        try {
          if (typeof fn === 'function') fn.call(scope, event);
          else fn.handleEvent(event);
        } catch (e) {
          /* never let a page handler break the stub */
        }
      }
    }
  }

  /* ── Errors ────────────────────────────────────────────────────────────── */

  class AdError {
    constructor(message, code, type, vastCode) {
      this._m = message || 'The VAST response document is empty.';
      this._c = code === undefined ? 1009 : code;
      this._t = type || 'adLoadError';
      this._v = vastCode === undefined ? 303 : vastCode;
    }
    getErrorCode() { return this._c; }
    getInnerError() { return null; }
    getMessage() { return this._m; }
    getType() { return this._t; }
    getVastErrorCode() { return this._v; }
    toString() { return 'AdError ' + this._c + ': ' + this._m; }
  }

  class AdErrorEvent {
    constructor(error, context) {
      this.type = 'adError';
      this._e = error;
      this._ctx = context === undefined ? null : context;
    }
    getError() { return this._e; }
    getUserRequestContext() { return this._ctx; }
  }
  AdErrorEvent.Type = { AD_ERROR: 'adError' };

  /* ── Settings ──────────────────────────────────────────────────────────── */

  class ImaSdkSettings {
    constructor() {
      this._v = {
        autoPlayAdBreaks: true,
        cookiesEnabled: true,
        disableCustomPlaybackForIOS10Plus: false,
        ffmpegVideoMimeType: '',
        locale: 'en',
        numRedirects: 4,
        playerType: '',
        playerVersion: '',
        ppid: '',
        restrictToCustomPlayback: false,
        sessionId: '',
        vpaidMode: 1,
      };
    }
    getCompanionBackfill() { return 'always'; }
    getDisableCustomPlaybackForIOS10Plus() { return this._v.disableCustomPlaybackForIOS10Plus; }
    getFeatureFlags() { return {}; }
    getLocale() { return this._v.locale; }
    getNumRedirects() { return this._v.numRedirects; }
    getPlayerType() { return this._v.playerType; }
    getPlayerVersion() { return this._v.playerVersion; }
    getPpid() { return this._v.ppid; }
    getVpaidMode() { return this._v.vpaidMode; }
    isCookiesEnabled() { return this._v.cookiesEnabled; }
    isVpaidAdapter() { return false; }
    setAutoPlayAdBreaks(v) { this._v.autoPlayAdBreaks = v; }
    setCompanionBackfill() {}
    setCookiesEnabled(v) { this._v.cookiesEnabled = v; }
    setDisableCustomPlaybackForIOS10Plus(v) { this._v.disableCustomPlaybackForIOS10Plus = v; }
    setDisableFlashAds() {}
    setFeatureFlags() {}
    setFfmpegVideoMimeType(v) { this._v.ffmpegVideoMimeType = v; }
    setIsVpaidAdapter() {}
    setLocale(v) { this._v.locale = v; }
    setMaxRedirects(v) { this._v.numRedirects = v; }
    setNumRedirects(v) { this._v.numRedirects = v; }
    setPageCorrelator() {}
    setPlayerType(v) { this._v.playerType = v; }
    setPlayerVersion(v) { this._v.playerVersion = v; }
    setPpid(v) { this._v.ppid = v; }
    setRestrictToCustomPlayback(v) { this._v.restrictToCustomPlayback = v; }
    setSessionId(v) { this._v.sessionId = v; }
    setStreamCorrelator() {}
    setVpaidAllowed() {}
    setVpaidMode(v) { this._v.vpaidMode = v; }
  }
  ImaSdkSettings.CompanionBackfillMode = { ALWAYS: 'always', ON_MASTER_AD: 'on_master_ad' };
  ImaSdkSettings.VpaidMode = { DISABLED: 0, ENABLED: 1, INSECURE: 2 };

  /* ── Containers & requests ─────────────────────────────────────────────── */

  class AdDisplayContainer {
    constructor(container, video, clickTrackingElement) {
      this._container = container || null;
      this._video = video || null;
      this._click = clickTrackingElement || null;
    }
    initialize() {}
    destroy() {}
  }

  class AdsRequest {
    constructor() {
      this.adTagUrl = '';
      this.adsResponse = null;
      this.contentDuration = null;
      this.contentKeywords = null;
      this.contentTitle = null;
      this.forceNonLinearFullSlot = false;
      this.linearAdSlotHeight = 0;
      this.linearAdSlotWidth = 0;
      this.liveStreamPrefetchSeconds = 0;
      this.nonLinearAdSlotHeight = 0;
      this.nonLinearAdSlotWidth = 0;
      this.omidAccessModeRules = {};
      this.pageUrl = '';
      this.vastLoadTimeout = 5000;
    }
    setAdWillAutoPlay() {}
    setAdWillPlayMuted() {}
    setContinuousPlayback() {}
  }

  class AdsRenderingSettings {
    constructor() {
      this.autoAlign = true;
      this.bitrate = -1;
      this.enablePreloading = false;
      this.loadVideoTimeout = 8000;
      this.mimeTypes = null;
      this.playAdsAfterTime = -1;
      this.restoreCustomPlaybackStateOnAdBreakComplete = false;
      this.uiElements = null;
      this.useStyledLinearAds = false;
      this.useStyledNonLinearAds = true;
    }
  }

  /* ── Ad / AdsManager (defensive: normally never reached) ───────────────── */

  const EMPTY_AD_POD = {
    getAdPosition: () => 1,
    getIsBumper: () => false,
    getMaxDuration: () => -1,
    getPodIndex: () => -1,
    getTimeOffset: () => 0,
    getTotalAds: () => 1,
  };

  const EMPTY_AD = {
    getAdId: () => '',
    getAdPodInfo: () => EMPTY_AD_POD,
    getAdSystem: () => '',
    getAdvertiserName: () => '',
    getApiFramework: () => null,
    getCompanionAds: () => [],
    getContentType: () => '',
    getCreativeAdId: () => '',
    getCreativeId: () => '',
    getDealId: () => '',
    getDescription: () => '',
    getDuration: () => 0,
    getHeight: () => 0,
    getMediaUrl: () => null,
    getMinSuggestedDuration: () => -2,
    getSkipTimeOffset: () => -1,
    getSurveyUrl: () => null,
    getTitle: () => '',
    getTraffickingParameters: () => ({}),
    getTraffickingParametersString: () => '',
    getUiElements: () => [],
    getUniversalAdIdRegistry: () => 'unknown',
    getUniversalAdIdValue: () => 'unknown',
    getUniversalAdIds: () => [],
    getVastMediaBitrate: () => 0,
    getVastMediaHeight: () => 0,
    getVastMediaWidth: () => 0,
    getWidth: () => 0,
    getWrapperAdIds: () => [''],
    getWrapperAdSystems: () => [''],
    getWrapperCreativeIds: () => [''],
    isLinear: () => true,
    isSkippable: () => true,
  };

  class AdsManager extends Emitter {
    constructor() {
      super();
      this._volume = 1;
    }
    collapse() {}
    configureAdsManager() {}
    destroy() {}
    discardAdBreak() {}
    expand() {}
    focus() {}
    getAdSkippableState() { return false; }
    getCuePoints() { return []; }
    getCurrentAd() { return null; }
    getCurrentAdCuePoints() { return []; }
    getRemainingTime() { return 0; }
    getVolume() { return this._volume; }
    init() {}
    isCustomClickTrackingUsed() { return false; }
    isCustomPlaybackUsed() { return false; }
    pause() {}
    requestNextAdBreak() {}
    resize() {}
    resume() {}
    setVolume(v) { this._volume = v; }
    skip() {}
    start() {
      // Nothing to play: tell the host every break is done so content resumes.
      setTimeout(() => {
        this._emit('allAdsCompleted', { type: 'allAdsCompleted', getAd: () => null, getAdData: () => ({}) });
      }, 0);
    }
    stop() {}
    updateAdsRenderingSettings() {}
  }

  class AdsManagerLoadedEvent {
    constructor(manager) {
      this.type = 'adsManagerLoaded';
      this._m = manager;
    }
    getAdsManager() { return this._m; }
    getUserRequestContext() { return null; }
  }
  AdsManagerLoadedEvent.Type = { ADS_MANAGER_LOADED: 'adsManagerLoaded' };

  /* ── AdsLoader: the piece that actually matters ────────────────────────── */

  class AdsLoader extends Emitter {
    constructor(adDisplayContainer) {
      super();
      this._container = adDisplayContainer || null;
      this._settings = new ImaSdkSettings();
      this._destroyed = false;
    }
    contentComplete() {}
    destroy() { this._destroyed = true; this._listeners = Object.create(null); }
    getSettings() { return this._settings; }
    getVersion() { return VERSION; }
    requestAds(adsRequest, userRequestContext) {
      if (this._destroyed) return;
      const ctx = userRequestContext === undefined ? null : userRequestContext;

      // Asynchronous, exactly like a real network failure. Every IMA host
      // reacts to AD_ERROR by starting/resuming the actual content.
      setTimeout(() => {
        if (this._destroyed) return;
        const err = new AdError(
          'The VAST response document is empty.',
          1009,
          AdError.Type.AD_LOAD,
          303
        );
        this._emit('adError', new AdErrorEvent(err, ctx));
        window.postMessage({ channel: 'dailyclean::hook', kind: 'ima-neutralized', id: crypto.randomUUID() }, '*');
      }, 0);
    }
  }

  /* ── Enums ─────────────────────────────────────────────────────────────── */

  AdError.ErrorCode = {
    ADS_REQUEST_NETWORK_ERROR: 1012,
    API_ERROR: 900,
    AUTOPLAY_DISALLOWED: 1205,
    BUMPER_AD_LOADING_FAILED: 1802,
    COMPANION_AD_LOADING_FAILED: 603,
    COMPANION_REQUIRED_ERROR: 602,
    CONTENT_PLAYHEAD_MISSING: 400,
    FAILED_TO_REQUEST_ADS: 1005,
    INTERNAL_ERROR: 900,
    INVALID_ADX_EXTENSION: 1105,
    INVALID_ARGUMENTS: 1101,
    INVALID_AD_TAG: 1013,
    NONLINEAR_DIMENSIONS_ERROR: 501,
    OVERLAY_AD_LOADING_FAILED: 500,
    OVERLAY_AD_PLAYING_FAILED: 502,
    REQUIRED_LISTENERS_NOT_ADDED: 900,
    STREAM_INITIALIZATION_FAILED: 1701,
    UNEXPECTED_ADS_LOADED_EVENT: 1204,
    UNKNOWN_AD_RESPONSE: 1010,
    UNKNOWN_ERROR: 900,
    UNSUPPORTED_LOCALE: 1011,
    VAST_ASSET_MISMATCH: 403,
    VAST_ASSET_NOT_FOUND: 1007,
    VAST_EMPTY_RESPONSE: 1009,
    VAST_LINEAR_ASSET_MISMATCH: 403,
    VAST_LOAD_TIMEOUT: 301,
    VAST_MALFORMED_RESPONSE: 100,
    VAST_MEDIA_ERROR: 1006,
    VAST_MEDIA_LOAD_TIMEOUT: 402,
    VAST_NONLINEAR_ASSET_MISMATCH: 503,
    VAST_NO_ADS_AFTER_WRAPPER: 302,
    VAST_PROBLEM: 1004,
    VAST_SCHEMA_VALIDATION_ERROR: 101,
    VAST_TOO_MANY_REDIRECTS: 302,
    VAST_TRAFFICKING_ERROR: 200,
    VAST_UNEXPECTED_DURATION: 202,
    VAST_UNEXPECTED_LINEARITY: 201,
    VAST_UNSUPPORTED_VERSION: 102,
    VAST_WRAPPER_ERROR: 300,
    VIDEO_ELEMENT_USED: -1,
    VIDEO_ELEMENT_REQUIRED: -1,
    VIDEO_PLAY_ERROR: 400,
  };
  AdError.Type = { AD_LOAD: 'adLoadError', AD_PLAY: 'adPlayError' };

  const AdEvent = function (type) { this.type = type; };
  AdEvent.prototype.getAd = function () { return null; };
  AdEvent.prototype.getAdData = function () { return {}; };
  AdEvent.Type = {
    AD_BREAK_READY: 'adBreakReady',
    AD_BUFFERING: 'adBuffering',
    AD_CAN_PLAY: 'adCanPlay',
    AD_METADATA: 'adMetadata',
    AD_PROGRESS: 'adProgress',
    ALL_ADS_COMPLETED: 'allAdsCompleted',
    CLICK: 'click',
    COMPLETE: 'complete',
    CONTENT_PAUSE_REQUESTED: 'contentPauseRequested',
    CONTENT_RESUME_REQUESTED: 'contentResumeRequested',
    DURATION_CHANGE: 'durationChange',
    EXPANDED_CHANGED: 'expandedChanged',
    FIRST_QUARTILE: 'firstQuartile',
    IMPRESSION: 'impression',
    INTERACTION: 'interaction',
    LINEAR_CHANGE: 'linearChange',
    LINEAR_CHANGED: 'linearChanged',
    LOADED: 'loaded',
    LOG: 'log',
    MIDPOINT: 'midpoint',
    PAUSED: 'pause',
    RESUMED: 'resume',
    SKIPPABLE_STATE_CHANGED: 'skippableStateChanged',
    SKIPPED: 'skip',
    STARTED: 'start',
    THIRD_QUARTILE: 'thirdQuartile',
    USER_CLOSE: 'userClose',
    VIDEO_CLICKED: 'videoClicked',
    VIDEO_ICON_CLICKED: 'videoIconClicked',
    VIEWABLE_IMPRESSION: 'viewable_impression',
    VOLUME_CHANGED: 'volumeChange',
    VOLUME_MUTED: 'mute',
  };

  class CompanionAdSelectionSettings {
    constructor() {
      this.adSlotHeight = 0;
      this.adSlotWidth = 0;
      this.creativeType = 'All';
      this.resourceType = 'All';
      this.sizeCriteria = 'SelectNearMatch';
    }
  }
  CompanionAdSelectionSettings.CreativeType = { ALL: 'All', FLASH: 'Flash', IMAGE: 'Image' };
  CompanionAdSelectionSettings.ResourceType = { ALL: 'All', HTML: 'Html', IFRAME: 'IFrame', STATIC: 'Static' };
  CompanionAdSelectionSettings.SizeCriteria = {
    IGNORE: 'IgnoreSize',
    SELECT_EXACT_MATCH: 'SelectExactMatch',
    SELECT_NEAR_MATCH: 'SelectNearMatch',
  };

  /* ── Assemble the namespace ────────────────────────────────────────────── */

  const ima = {
    __dailyclean: true,
    VERSION,
    AdDisplayContainer,
    AdError,
    AdErrorEvent,
    AdEvent,
    AdsLoader,
    AdsManager,
    AdsManagerLoadedEvent,
    AdsRenderingSettings,
    AdsRequest,
    CompanionAd: function () {},
    CompanionAdSelectionSettings,
    ImaSdkSettings,
    UiElements: { AD_ATTRIBUTION: 'adAttribution', COUNTDOWN: 'countdown' },
    ViewMode: { FULLSCREEN: 'fullscreen', NORMAL: 'normal' },
    OmidAccessMode: { CREATIVE: 'creative', DOMAIN: 'domain', FULL: 'full', LIMITED: 'limited' },
    OmidVerificationVendor: {
      1: 'OTHER', 2: 'MOAT', 3: 'DOUBLEVERIFY', 4: 'INTEGRAL_AD_SCIENCE',
      5: 'PIXELATE', 6: 'NIELSEN', 7: 'COMSCORE', 8: 'MEETRICS', 9: 'GOOGLE',
      OTHER: 1, MOAT: 2, DOUBLEVERIFY: 3, INTEGRAL_AD_SCIENCE: 4,
      PIXELATE: 5, NIELSEN: 6, COMSCORE: 7, MEETRICS: 8, GOOGLE: 9,
    },
    settings: new ImaSdkSettings(),
  };

  // Dynamic Ad Insertion namespace — a few players probe it before use.
  class StreamManager extends Emitter {
    constructor() { super(); }
    contentTimeForStreamTime(t) { return t; }
    streamTimeForContentTime(t) { return t; }
    previousCuePointForStreamTime() { return null; }
    processMetadata() {}
    replaceAdTagParameters() {}
    requestStream() {
      setTimeout(() => {
        this._emit('adError', new AdErrorEvent(
          new AdError('Stream initialization failed.', 1701, AdError.Type.AD_LOAD, 303)
        ));
      }, 0);
    }
    reset() {}
    onTimedMetadata() {}
    loadThirdPartyStream() {}
    setClickElement() {}
  }

  ima.dai = {
    api: {
      StreamManager,
      StreamRequest: function () { this.adTagParameters = {}; this.apiKey = ''; this.format = 'hls'; },
      VODStreamRequest: function () { this.contentSourceId = ''; this.videoId = ''; },
      LiveStreamRequest: function () { this.assetKey = ''; },
      StreamEvent: { Type: Object.assign({ STREAM_INITIALIZED: 'streamInitialized' }, AdEvent.Type) },
      StreamData: function () {},
      CuePoint: function () {},
      AdProgressData: function () {},
    },
  };

  const google = window.google || (window.google = {});
  google.ima = ima;

  // Some integrations poll for these loader callbacks.
  if (typeof window.__iasPET === 'undefined') window.__iasPET = { queue: [], sessionId: '' };

  try {
    window.dispatchEvent(new Event('dailyclean:ima-ready'));
  } catch (e) {}
})();
