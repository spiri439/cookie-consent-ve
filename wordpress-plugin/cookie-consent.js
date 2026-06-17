/**
 * Cookie Consent Standalone - GDPR Compliant Cookie Manager
 * 
 * Standalone, embeddable cookie consent solution
 * Usage: Include this script in <head> of your website
 * 
 * @example
 * <head>
 *   <script src="cookie-consent-standalone.js"></script>
 *   <script>
 *     CookieConsent.init({
 *       categories: {
 *         necessary: { enabled: true, readOnly: true },
 *         analytics: { enabled: false },
 *         marketing: { enabled: false }
 *       }
 *     });
 *   </script>
 * </head>
 */

(function(window, document) {
  'use strict';

  // ============================================================================
  // CONFIGURATION & STATE
  // ============================================================================
  
  const DEFAULTS = {
    cookieName: 'cc_cookie',
    cookieExpiry: 365, // days
    autoShow: true,
    position: 'bottom-right', // bottom-left, bottom-right, top-left, top-right, bottom-center
    theme: 'light', // light, dark
    // All user-facing text. Any of these can be overridden via the config.
    text: {
      title: '🍪 Cookie Preferences',
      description: 'We use cookies to enhance your browsing experience and analyze our traffic. Click "Accept All" to consent to our use of cookies or "Settings" to manage your preferences.',
      acceptAll: 'Accept All',
      rejectAll: 'Reject All',
      settings: 'Settings',
      modalTitle: 'Cookie Preferences',
      save: 'Save Preferences',
      cancel: 'Cancel',
      tableCookie: 'Cookie',
      tablePurpose: 'Purpose',
      tableDuration: 'Duration',
      tableStatus: 'Status',
      statusStored: 'Stored now',
      statusIfAccepted: 'Blocked until you accept',
      noCookies: 'No cookies stored, and no matching services were detected on this page.'
    },
    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
        name: 'Necessary',
        description: 'Essential cookies required for the website to function properly.'
      },
      analytics: {
        enabled: false,
        name: 'Analytics',
        description: 'Help us understand how visitors interact with our website.'
      },
      marketing: {
        enabled: false,
        name: 'Marketing',
        description: 'Used to deliver personalized content and ads.'
      }
    }
  };

  // Known-cookie registry: describes auto-detected cookies. Each entry matches
  // a cookie name by regex and provides a friendly label, purpose and duration.
  // Order matters — more specific patterns must come before broader ones.
  const COOKIE_REGISTRY = [
    { match: /^cc_cookie$/, category: 'necessary', label: 'cc_cookie', description: 'Stores your cookie consent choices.', duration: '1 year' },
    { match: /^_ga$/,       category: 'analytics', label: '_ga',       description: 'Google Analytics – distinguishes unique visitors.', duration: '2 years' },
    { match: /^_ga_/,       category: 'analytics', label: '_ga_*',     description: 'Google Analytics 4 – persists the session state.', duration: '2 years' },
    { match: /^_gid$/,      category: 'analytics', label: '_gid',      description: 'Google Analytics – distinguishes unique visitors.', duration: '24 hours' },
    { match: /^_gat/,       category: 'analytics', label: '_gat*',     description: 'Google Analytics – throttles the request rate.', duration: '1 minute' },
    { match: /^_gcl_au$/,   category: 'marketing', label: '_gcl_au',   description: 'Google Ads – stores ad-click conversion info.', duration: '90 days' },
    { match: /^__utm/,      category: 'analytics', label: '__utm*',    description: 'Legacy Universal Analytics visitor/session data.', duration: 'up to 2 years' },
    { match: /^_uet/,       category: 'analytics', label: '_uet*',     description: 'Microsoft/Bing Ads – analytics & conversion.', duration: 'varies' },
    { match: /^_vwo/,       category: 'analytics', label: '_vwo*',     description: 'Visual Website Optimizer – A/B testing.', duration: 'varies' },
    { match: /^trafic_mon/, category: 'analytics', label: 'trafic_mon', description: 'Site traffic monitoring / visit statistics.', duration: 'varies' },
    { match: /^_fbp$/,      category: 'marketing', label: '_fbp',      description: 'Meta (Facebook) Pixel – identifies browsers for ad delivery.', duration: '90 days' },
    { match: /^fr$/,        category: 'marketing', label: 'fr',        description: 'Meta (Facebook) – ad delivery and measurement.', duration: '90 days' },
    { match: /^fbc$/,       category: 'marketing', label: 'fbc',       description: 'Meta (Facebook) – stores the last ad click.', duration: 'varies' },
    { match: /^hubspotutk$/,category: 'marketing', label: 'hubspotutk',description: 'HubSpot – tracks visitor identity for marketing.', duration: '6 months' },
    { match: /^(li_at|_li|_linkedin)/, category: 'marketing', label: 'li_at / _linkedin_*', description: 'LinkedIn – ad targeting and tracking.', duration: 'varies' },
    { match: /^_pin/,       category: 'marketing', label: '_pin*',     description: 'Pinterest – advertising audiences.', duration: 'varies' },
    { match: /^_adroll/,    category: 'marketing', label: '_adroll',   description: 'AdRoll – advertising audiences.', duration: 'varies' },
    { match: /^_scid/,      category: 'marketing', label: '_scid',     description: 'Advertising – campaign/click attribution.', duration: 'varies' }
  ];

  // Broad fallback patterns for classifying cookies that aren't in the registry.
  const ANALYTICS_PATTERNS = [/^_ga/, /^_gid/, /^_gat/, /^__utm/, /^_uet/, /^_dc_gtm/, /^_gtm/, /^ga_/, /^AMP_TOKEN/, /^_vwo/, /^trafic_mon/];
  const MARKETING_PATTERNS = [/^_fbp/, /^fr$/, /^fbc$/, /^_gcl_au/, /^_gac_/, /^hubspotutk$/, /^intercom/, /^tawk/, /^datadog/, /^_pin/, /^_adroll/, /^_ad/, /^_scid/, /^li_at/, /^_li/, /^_linkedin/, /^tracking/, /^clickid/, /^affiliate/];

  // Tracking services we can recognise on the page. `match` is tested against
  // each script's src + (gated/inline) content; `cookies` are the cookies that
  // service is known to set. This drives the "will be stored" list from what is
  // ACTUALLY embedded on the page, instead of guessing a generic list.
  const SERVICE_SIGNATURES = [
    {
      id: 'ga', category: 'analytics', name: 'Google Analytics',
      match: [/googletagmanager\.com\/gtag\/js/, /google-analytics\.com/, /\bgtag\s*\(/, /analytics\.js/, /\bga\s*\(\s*['"]/],
      cookies: [
        { name: '_ga',    description: 'Google Analytics – distinguishes unique visitors.', duration: '2 years' },
        { name: '_ga_*',  description: 'Google Analytics 4 – persists the session state.', duration: '2 years' }
      ]
    },
    {
      id: 'gtm', category: 'analytics', name: 'Google Tag Manager',
      match: [/googletagmanager\.com\/gtm\.js/],
      cookies: [
        { name: '_dc_gtm_*', description: 'Google Tag Manager – throttles request rate.', duration: '1 minute' }
      ]
    },
    {
      id: 'gads', category: 'marketing', name: 'Google Ads',
      match: [/googleadservices\.com/, /googlesyndication\.com/, /\/pagead\//],
      cookies: [
        { name: '_gcl_au', description: 'Google Ads – stores ad-click conversion info.', duration: '90 days' }
      ]
    },
    {
      id: 'meta', category: 'marketing', name: 'Meta (Facebook) Pixel',
      match: [/connect\.facebook\.net/, /fbevents\.js/, /\bfbq\s*\(/],
      cookies: [
        { name: '_fbp', description: 'Meta Pixel – identifies browsers for ad delivery.', duration: '90 days' },
        { name: 'fr',   description: 'Meta – ad delivery and measurement.', duration: '90 days' }
      ]
    },
    {
      id: 'hotjar', category: 'analytics', name: 'Hotjar',
      match: [/static\.hotjar\.com/, /\bhj\s*\(/],
      cookies: [
        { name: '_hj*', description: 'Hotjar – behaviour analytics and session sampling.', duration: 'varies' }
      ]
    },
    {
      id: 'clarity', category: 'analytics', name: 'Microsoft Clarity',
      match: [/clarity\.ms/, /\bclarity\s*\(/],
      cookies: [
        { name: '_clck / _clsk', description: 'Microsoft Clarity – session analytics.', duration: '1 year' }
      ]
    },
    {
      id: 'linkedin', category: 'marketing', name: 'LinkedIn Insight',
      match: [/snap\.licdn\.com/, /linkedin\.com\/insight/],
      cookies: [
        { name: 'li_*', description: 'LinkedIn – ad targeting and conversion tracking.', duration: 'varies' }
      ]
    },
    {
      id: 'hubspot', category: 'marketing', name: 'HubSpot',
      match: [/js\.hs-scripts\.com/, /js\.hsforms\.net/, /\.hubspot\.com/],
      cookies: [
        { name: 'hubspotutk', description: 'HubSpot – tracks visitor identity for marketing.', duration: '6 months' }
      ]
    },
    {
      id: 'tiktok', category: 'marketing', name: 'TikTok Pixel',
      match: [/analytics\.tiktok\.com/, /\bttq\b/],
      cookies: [
        { name: '_ttp', description: 'TikTok – ad measurement and targeting.', duration: '13 months' }
      ]
    }
  ];

  // Scripts that are part of this consent tool — never scan them for trackers,
  // otherwise our own pattern strings would self-match.
  const SELF_MARKERS = /CookieConsent|cc_cookie|deleteBlockedCookies|cc-main|COOKIE_REGISTRY/;

  function lookupCookie(name) {
    for (let i = 0; i < COOKIE_REGISTRY.length; i++) {
      if (COOKIE_REGISTRY[i].match.test(name)) return COOKIE_REGISTRY[i];
    }
    return null;
  }

  // Classify a single cookie name into a category with display info.
  function classifyCookie(name) {
    // The consent cookie itself — match the configured name so it always shows
    // (and is never mislabelled), even if renamed in settings.
    const consentName = (STATE.config && STATE.config.cookieName) || 'cc_cookie';
    if (name === consentName) {
      return { label: name, category: 'necessary', description: 'Stores your cookie consent choices.', duration: '1 year' };
    }
    const known = lookupCookie(name);
    if (known) return { label: known.label, category: known.category, description: known.description, duration: known.duration };
    if (ANALYTICS_PATTERNS.some(p => p.test(name))) return { label: name, category: 'analytics', description: 'Analytics / statistics cookie.', duration: 'varies' };
    if (MARKETING_PATTERNS.some(p => p.test(name))) return { label: name, category: 'marketing', description: 'Marketing / advertising cookie.', duration: 'varies' };
    // Unknown cookie: do NOT claim it is "required". Mark it unclassified so the
    // site owner can categorise it instead of it silently passing as necessary.
    return { label: name, category: 'necessary', description: 'Unclassified — not recognized by the cookie manager.', duration: 'unknown' };
  }

  // WordPress admin/login cookies — present only for logged-in users, never for
  // visitors, so they are not shown in the modal.
  const WP_ADMIN_COOKIES = /^(wordpress_|wp-settings)/;

  // Auto-detect the cookies currently set in the browser, grouped by category.
  function detectCookiesByCategory() {
    const groups = {};
    getAllCookies().forEach(name => {
      if (!name || WP_ADMIN_COOKIES.test(name)) return;
      const info = classifyCookie(name);
      (groups[info.category] = groups[info.category] || []).push(info);
    });
    return groups;
  }

  // Detect which tracking services are actually embedded on the page by reading
  // the script tags that are present (including the gated/blocked ones that have
  // not run yet). Our own consent scripts are skipped. Returns a deduped list of
  // matched SERVICE_SIGNATURES.
  function detectServices() {
    const found = [];
    const ids = {};
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i];
      const src = s.src || '';
      const content = s.textContent || '';
      // Skip this tool's own scripts so their pattern strings don't self-match.
      if (src.indexOf('cookie-consent') !== -1) continue;
      if (content && SELF_MARKERS.test(content)) continue;
      const haystack = src + '\n' + content;
      for (let j = 0; j < SERVICE_SIGNATURES.length; j++) {
        const sig = SERVICE_SIGNATURES[j];
        if (ids[sig.id]) continue;
        if (sig.match.some(re => re.test(haystack))) {
          ids[sig.id] = 1;
          found.push(sig);
        }
      }
    }
    return found;
  }

  // Cookies to display for a category. Each entry is flagged with `stored`:
  //   true  -> the cookie is currently set in the browser ("Stored now")
  //   false -> a cookie that WILL be set by a tracking service detected on this
  //            page, once the category is accepted ("Stored if accepted")
  // The "will be stored" rows come from services actually found in the page's
  // scripts — not a generic guess — so a service that isn't present is never
  // listed.
  // Cookies shown for a category, detected automatically from the page:
  //   stored:true  -> the cookie is set in the browser now ("Stored now")
  //   stored:false -> a cookie a tracking script on the page will set, currently
  //                   blocked until consent ("Blocked until you accept")
  function getCategoryCookies(categoryKey) {
    const seen = {};
    const list = [];

    // 1) Cookies actually set in the browser right now.
    (detectCookiesByCategory()[categoryKey] || []).forEach(c => {
      if (!seen[c.label]) {
        seen[c.label] = 1;
        list.push({ name: c.label, description: c.description, duration: c.duration, stored: true });
      }
    });

    // 1b) Always disclose this tool's own consent cookie in its category, even
    //     before a choice is made (it's set the moment the visitor accepts/denies).
    const consentName = (STATE.config && STATE.config.cookieName) || 'cc_cookie';
    const consentInfo = classifyCookie(consentName);
    if (consentInfo.category === categoryKey && !seen[consentName]) {
      seen[consentName] = 1;
      list.push({ name: consentName, description: consentInfo.description, duration: consentInfo.duration, stored: true });
    }

    // 2) Cookies that tracking scripts present on the page will set once the
    //    category is accepted (they are blocked until then). Only while the
    //    category is not yet accepted.
    const accepted = !!(STATE.preferences && STATE.preferences.categories &&
                        STATE.preferences.categories.indexOf(categoryKey) !== -1);
    if (!accepted) {
      detectServices().forEach(svc => {
        if (svc.category !== categoryKey) return;
        svc.cookies.forEach(ck => {
          if (!seen[ck.name]) {
            seen[ck.name] = 1;
            list.push({ name: ck.name, description: ck.description, duration: ck.duration, stored: false });
          }
        });
      });
    }
    return list;
  }

  // Build the cookie-table HTML for one category. Extracted so it can be
  // re-rendered after the modal opens (cookies set asynchronously by scripts/
  // server show up without needing a full page reload).
  function buildCookieTableHtml(categoryKey) {
    const category = (STATE.config.categories && STATE.config.categories[categoryKey]) || {};
    const cookieList = (category.cookies && category.cookies.length)
      ? category.cookies
      : getCategoryCookies(categoryKey);
    const tx = STATE.config.text;
    const statusCell = (c) => {
      if (c.stored === true) return `<span class="cc-cookie-status cc-cookie-status--on">${tx.statusStored}</span>`;
      if (c.stored === false) return `<span class="cc-cookie-status">${tx.statusIfAccepted}</span>`;
      return '';
    };
    return cookieList.length ? `
            <table class="cc-cookie-table">
              <thead><tr><th>${tx.tableCookie}</th><th>${tx.tablePurpose}</th><th>${tx.tableDuration}</th><th>${tx.tableStatus}</th></tr></thead>
              <tbody>
                ${cookieList.map(c => `<tr><td><code>${c.name || c.label}</code></td><td>${c.description || ''}</td><td>${c.duration || ''}</td><td>${statusCell(c)}</td></tr>`).join('')}
              </tbody>
            </table>` : `<div class="cc-cookie-empty">${tx.noCookies}</div>`;
  }

  // Re-scan cookies and refresh just the cookie tables in the open modal,
  // without touching the category toggles the user may have changed.
  function refreshCookieTables() {
    if (!STATE.modalElement) return;
    const wraps = STATE.modalElement.querySelectorAll('[data-cc-cat]');
    for (let i = 0; i < wraps.length; i++) {
      wraps[i].innerHTML = buildCookieTableHtml(wraps[i].getAttribute('data-cc-cat'));
    }
  }

  const STATE = {
    config: null,
    preferences: null,
    modalShown: false,
    cookieGuardInstalled: false,
    scriptInterceptorInstalled: false,
    bypassInterceptor: false,
    pendingScripts: []
  };

  // ============================================================================
  // CORE UTILITIES
  // ============================================================================

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
  }

  function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
  }

  function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }

  function getAllCookies() {
    if (!document.cookie) return [];
    return document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean);
  }

  function deleteCookiesByPattern(patterns) {
    const cookies = getAllCookies();
    cookies.forEach(cookieName => {
      if (patterns.some(pattern => pattern.test(cookieName))) {
        deleteCookie(cookieName);
        // Also try with domain variations
        const domain = window.location.hostname;
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.${domain}`;
      }
    });
  }

  function loadPreferences() {
    const cookieData = getCookie(STATE.config.cookieName);
    if (!cookieData) return null;
    try {
      return JSON.parse(cookieData);
    } catch (e) {
      return null;
    }
  }

  function savePreferences(prefs) {
    setCookie(STATE.config.cookieName, JSON.stringify(prefs), STATE.config.cookieExpiry);
    STATE.preferences = prefs;
    enforcePreferences();
  }

  // ============================================================================
  // SCRIPT & COOKIE MANAGEMENT
  // ============================================================================

  function installScriptInterceptor() {
    if (STATE.scriptInterceptorInstalled) return;
    
    try {
      // Store original appendChild methods
      const originalAppendChild = Node.prototype.appendChild;
      const originalInsertBefore = Node.prototype.insertBefore;
      
      // Flag to bypass our own DOM operations
      STATE.bypassInterceptor = false;
      
      // Intercept script insertion
      Node.prototype.appendChild = function(child) {
        // Bypass for our own DOM operations
        if (STATE.bypassInterceptor) {
          return originalAppendChild.call(this, child);
        }
        
        if (shouldBlockScript(child)) {
          // Clear script content to prevent any execution
          if (child.textContent) {
            child.textContent = '';
          }
          // Return a dummy element instead to prevent any issues
          const dummy = document.createElement('div');
          dummy.style.display = 'none';
          return dummy; // Return dummy instead of script
        }
        return originalAppendChild.call(this, child);
      };
      
      Node.prototype.insertBefore = function(newNode, referenceNode) {
        // Bypass for our own DOM operations
        if (STATE.bypassInterceptor) {
          return originalInsertBefore.call(this, newNode, referenceNode);
        }
        
        if (shouldBlockScript(newNode)) {
          // Clear script content to prevent any execution
          if (newNode.textContent) {
            newNode.textContent = '';
          }
          // Return a dummy element instead
          const dummy = document.createElement('div');
          dummy.style.display = 'none';
          return dummy;
        }
        return originalInsertBefore.call(this, newNode, referenceNode);
      };
      
      STATE.scriptInterceptorInstalled = true;
    } catch (e) {
      // Silent failure
    }
  }
  
  function shouldBlockScript(script) {
    // Only block script elements
    if (script.tagName !== 'SCRIPT') return false;
    
    // Never block our own script or scripts with data-cc-allow attribute
    if (script.hasAttribute('data-cc-allow') || 
        script.src && script.src.includes('cookie-consent-standalone.js')) {
      return false;
    }
    
    // If script has data-category, let the normal flow handle it
    if (script.hasAttribute('data-category') && script.getAttribute('type') === 'text/plain') {
      return false;
    }
    
    // Check if we should block based on consent
    if (!STATE.preferences) {
      // No consent yet - check if this looks like analytics/marketing
      return isAnalyticsOrMarketingScript(script);
    }
    
    // We have preferences - check if script should be blocked
    const accepted = new Set(STATE.preferences.categories || []);
    const isAnalytics = isAnalyticsScript(script);
    const isMarketing = isMarketingScript(script);
    
    if (isAnalytics && !accepted.has('analytics')) return true;
    if (isMarketing && !accepted.has('marketing')) return true;
    
    return false;
  }
  
  function isAnalyticsOrMarketingScript(script) {
    return isAnalyticsScript(script) || isMarketingScript(script);
  }
  
  function isAnalyticsScript(script) {
    const analyticsDomains = [
      'google-analytics.com',
      'googletagmanager.com',
      'googleapis.com/analytics',
      'analytics.google.com',
      'analytics.js',
      'gtag.js',
      'ga.js'
    ];
    
    if (script.src) {
      return analyticsDomains.some(domain => script.src.includes(domain));
    }
    
    // Check inline content for analytics code
    if (script.textContent) {
      const content = script.textContent.toLowerCase();
      return content.includes('gtag(') || 
             content.includes('google-analytics') ||
             content.includes('analytics.js') ||
             content.includes('ga(');
    }
    
    return false;
  }
  
  function isMarketingScript(script) {
    const marketingDomains = [
      'facebook.com/tr',
      'facebook.net/connect',
      'facebook.com/connect',
      'facebook.net/js/sdk',
      'connect.facebook.net',
      'pixel.facebook.com',
      'fbevents.js',
      'facebook-analytics'
    ];
    
    if (script.src) {
      return marketingDomains.some(domain => script.src.includes(domain));
    }
    
    // Check inline content for marketing code
    if (script.textContent) {
      const content = script.textContent.toLowerCase();
      return content.includes('fbq(') || 
             content.includes('facebook pixel') ||
             content.includes('_fbp') ||
             content.includes('fbevents.js');
    }
    
    return false;
  }

  function installCookieGuard() {
    if (STATE.cookieGuardInstalled) return;

    // The guard runs at script load, BEFORE init() loads preferences. Read any
    // existing consent from the cookie first, so previously-accepted analytics/
    // marketing cookies are NOT wiped on every page load. (Without this, a
    // returning visitor who accepted everything would have those cookies deleted
    // on load and they'd only reappear after the server/scripts re-set them.)
    if (!STATE.preferences) {
      try {
        const parts = ('; ' + document.cookie).split('; cc_cookie=');
        if (parts.length === 2) {
          STATE.preferences = JSON.parse(decodeURIComponent(parts.pop().split(';').shift()));
        }
      } catch (e) {}
    }

    try {
      // First, delete any existing analytics/marketing cookies that shouldn't be there
      function deleteBlockedCookies() {
        if (!document.cookie) return;
        
        const analyticsPatterns = [
          /^_ga/, /^_gid$/, /^_gat/, /^_gcl_au$/, /^__utm/, /^_uet/, 
          /^_dc_gtm/, /^_gac_/, /^_gtm/, /^analytics/, /^ga_/, /^gid_/,
          /^collect$/, /^_gat_gtag/, /^_ga_/, /^AMP_TOKEN/, /^_vwo/, /^trafic_mon/
        ];
        
        const marketingPatterns = [
          /^_fbp$/, /^fr$/, /^hubspotutk$/, /^intercom/, /^tawk/, /^datadog/,
          /^_fbp_/, /^fbc$/, /^sb$/, /^wd$/, /^xs$/, /^c_user$/, /^presence$/,
          /^act$/, /^m_pixel_ratio$/, /^spin$/, /^locale$/, /^datr$/,
          /^_pin/, /^_pinterest/, /^_ads/, /^_ad/, /^_adroll/, /^_scid/,
          /^li_at/, /^_li/, /^_linkedin/, /^tracking/, /^clickid/, /^affiliate/
        ];
        
        const allCookies = document.cookie.split('; ');
        const consentCookieName = (STATE.config && STATE.config.cookieName) || 'cc_cookie';
        
        allCookies.forEach(cookieStr => {
          const cookieName = cookieStr.split('=')[0].trim();
          if (cookieName === consentCookieName) return; // Keep our consent cookie
          
          const isAnalytics = analyticsPatterns.some(pattern => pattern.test(cookieName));
          const isMarketing = marketingPatterns.some(pattern => pattern.test(cookieName));
          
          if (isAnalytics || isMarketing) {
            // Check if we should allow this cookie based on preferences
            if (STATE.preferences && STATE.preferences.categories) {
              const accepted = new Set(STATE.preferences.categories || []);
              if ((isAnalytics && accepted.has('analytics')) || 
                  (isMarketing && accepted.has('marketing'))) {
                return; // Keep it if category is accepted
              }
            }
            
            // Delete the cookie
            const domain = window.location.hostname;
            // Try multiple deletion methods
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${domain}`;
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.${domain}`;
          }
        });
      }
      
      // Delete blocked cookies immediately and then set up periodic deletion
      deleteBlockedCookies();
      // Delete more aggressively - every 500ms
      setInterval(deleteBlockedCookies, 500);
      // Also try immediate deletion on page visibility change
      if (document.addEventListener) {
        document.addEventListener('visibilitychange', deleteBlockedCookies);
        window.addEventListener('focus', deleteBlockedCookies);
      }
      
      // Intercept document.cookie setter to block analytics/marketing cookies
      const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || 
                                Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
      
      if (!cookieDescriptor || !cookieDescriptor.set) {
        // Fallback: try direct property descriptor
        deleteBlockedCookies();
        setInterval(deleteBlockedCookies, 500);
        STATE.cookieGuardInstalled = true;
        return;
      }
      
      const nativeCookieSetter = cookieDescriptor.set.bind(document);
      
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: cookieDescriptor.get.bind(document),
        set: function(value) {
          // Extract cookie name from "name=value; attributes..."
          const cookieName = String(value).split('=')[0].trim();
          
          // Always allow our own consent cookie (check config or use default)
          const consentCookieName = (STATE.config && STATE.config.cookieName) || 'cc_cookie';
          if (cookieName === consentCookieName) {
            nativeCookieSetter(value);
            return;
          }
          
          // Comprehensive patterns for analytics cookies
          const analyticsPatterns = [
            /^_ga/, /^_gid$/, /^_gat/, /^_gcl_au$/, /^__utm/, /^_uet/, 
            /^_dc_gtm/, /^_gac_/, /^_gtm/, /^analytics/, /^ga_/, /^gid_/,
            /^collect$/, /^_gat_gtag/, /^_ga_/, /^AMP_TOKEN/, /^_vwo/, /^trafic_mon/
          ];
          
          // Comprehensive patterns for marketing cookies
          const marketingPatterns = [
            /^_fbp$/, /^fr$/, /^hubspotutk$/, /^intercom/, /^tawk/, /^datadog/,
            /^_fbp_/, /^fbc$/, /^sb$/, /^wd$/, /^xs$/, /^c_user$/, /^presence$/,
            /^act$/, /^m_pixel_ratio$/, /^spin$/, /^locale$/, /^datr$/,
            /^_pin/, /^_pinterest/, /^_ads/, /^_ad/, /^_adroll/, /^_scid/,
            /^li_at/, /^_li/, /^_linkedin/, /^tracking/, /^clickid/, /^affiliate/
          ];
          
          const isAnalytics = analyticsPatterns.some(pattern => pattern.test(cookieName));
          const isMarketing = marketingPatterns.some(pattern => pattern.test(cookieName));
          
          // If no preferences yet, block ALL analytics/marketing cookies
          if (!STATE.preferences || !STATE.preferences.categories) {
            if (isAnalytics || isMarketing) {
              // DO NOT SET THE COOKIE - just return
              return;
            }
            // Allow other cookies (necessary ones) when no preferences
            nativeCookieSetter(value);
            return;
          }
          
          // If we have preferences, check them
          const accepted = new Set(STATE.preferences.categories || []);
          
          if ((isAnalytics && !accepted.has('analytics')) || 
              (isMarketing && !accepted.has('marketing'))) {
            // DO NOT SET THE COOKIE - just return
            return;
          }
          
          // All checks passed, allow the cookie
          nativeCookieSetter(value);
        }
      });
      
      STATE.cookieGuardInstalled = true;
    } catch (e) {
      // Even if interceptor fails, use deletion as fallback
      try {
        function deleteBlockedCookies() {
          if (!document.cookie) return;
          
          // Check preferences first - only delete if NOT accepted
          const accepted = STATE.preferences && STATE.preferences.categories ? 
                          new Set(STATE.preferences.categories) : new Set();
          const analyticsAccepted = accepted.has('analytics');
          const marketingAccepted = accepted.has('marketing');
          
          // If both accepted, skip deletion
          if (analyticsAccepted && marketingAccepted) return;
          
          const cookies = document.cookie.split('; ');
          const consentCookieName = (STATE.config && STATE.config.cookieName) || 'cc_cookie';
          const analyticsPatterns = [/^_ga/, /^_gid/, /^_gat/, /^__utm/, /^trafic_mon/];
          const marketingPatterns = [/^_fbp/, /^fr$/, /^sb$/, /^wd$/];
          
          cookies.forEach(cookieStr => {
            const cookieName = cookieStr.split('=')[0].trim();
            if (cookieName === consentCookieName) return;
            
            const isAnalytics = analyticsPatterns.some(p => p.test(cookieName));
            const isMarketing = marketingPatterns.some(p => p.test(cookieName));
            
            // Only delete if category is NOT accepted
            const shouldDelete = (isAnalytics && !analyticsAccepted) || 
                                (isMarketing && !marketingAccepted);
            
            if (shouldDelete) {
              document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
              document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname}`;
            }
          });
        }
        deleteBlockedCookies();
        setInterval(deleteBlockedCookies, 500);
      } catch (e2) {}
      // Silent failure - no console spam
    }
  }

  function enforcePreferences() {
    if (!STATE.preferences) return;
    
    const accepted = new Set(STATE.preferences.categories || []);
    
    // Analytics cookies
    const analyticsPatterns = [
      /^_ga/, /^_gid$/, /^_gat_/, /^_gcl_au$/, /^__utm/, /^_uet/, /^_fbp$/, /^trafic_mon/
    ];
    
    // Marketing cookies
    const marketingPatterns = [
      /^_fbp$/, /^fr$/, /^hubspotutk$/, /^intercom-session/, /^tawk/, /^datadog/
    ];
    
    if (!accepted.has('analytics')) {
      deleteCookiesByPattern(analyticsPatterns);
    }
    if (!accepted.has('marketing')) {
      deleteCookiesByPattern(marketingPatterns);
    }
  }

  function initializeScripts() {
    const scripts = document.querySelectorAll('script[data-category]');
    
    scripts.forEach(script => {
      const category = script.getAttribute('data-category');
      const isAccepted = STATE.preferences && 
                         STATE.preferences.categories && 
                         STATE.preferences.categories.includes(category);
      
      if (isAccepted) {
        const newScript = document.createElement('script');
        
        // Copy all attributes
        Array.from(script.attributes).forEach(attr => {
          if (attr.name !== 'data-category') {
            newScript.setAttribute(attr.name, attr.value);
          }
        });
        
        // Handle inline or external scripts
        if (script.src) {
          newScript.src = script.src;
          newScript.onload = () => script.remove();
        } else {
          newScript.textContent = script.textContent;
          script.remove();
        }
        
        document.head.appendChild(newScript);
      }
    });
  }

  // ============================================================================
  // UI GENERATION
  // ============================================================================

  function createStyles() {
    const styles = document.createElement('style');
    styles.textContent = `
      .cc-main { position: fixed !important; z-index: 999999 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; pointer-events: none !important; }
      .cc-main * { box-sizing: border-box !important; }
      .cc-main > * { pointer-events: auto !important; }
      
      /* Banner */
      .cc-banner { background: #fff !important; border: 1px solid #e5e7eb !important; border-radius: 12px !important; box-shadow: 0 10px 40px rgba(0,0,0,0.15) !important; padding: 24px !important; max-width: 520px !important; display: block !important; visibility: visible !important; opacity: 1 !important; position: fixed !important; z-index: 999999 !important; }
      .cc-theme-dark .cc-banner { background: #1a1a1a; border-color: #333; color: #fff; }
      
      .cc-banner__title { font-size: 18px; font-weight: 600; margin: 0 0 12px; color: #111; }
      .cc-theme-dark .cc-banner__title { color: #fff; }
      
      .cc-banner__text { font-size: 14px; line-height: 1.6; margin: 0 0 20px; color: #555; }
      .cc-theme-dark .cc-banner__text { color: #ccc; }
      
      .cc-banner__actions { display: flex; gap: 12px; flex-wrap: wrap; }
      .cc-banner__btn { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #d1d5db; transition: all 0.2s; pointer-events: auto; position: relative; z-index: 10; }
      .cc-banner__btn--primary { background: #2563eb; color: #fff; border-color: #2563eb; }
      .cc-banner__btn--primary:hover { background: #1d4ed8; }
      .cc-banner__btn--secondary { background: #f3f4f6; color: #333; }
      .cc-banner__btn--secondary:hover { background: #e5e7eb; }
      .cc-theme-dark .cc-banner__btn--secondary { background: #2a2a2a; color: #fff; border-color: #444; }
      .cc-theme-dark .cc-banner__btn--secondary:hover { background: #3a3a3a; }
      
      /* Overlay */
      .cc-overlay { position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0,0,0,0.5); z-index: 2147483646 !important; display: none; pointer-events: auto !important; padding: 16px; }
      .cc-overlay.show { display: flex !important; align-items: center; justify-content: center; }
      .cc-theme-dark .cc-overlay { background: rgba(0,0,0,0.75); }
      
      /* Modal */
      .cc-modal { background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; }
      .cc-theme-dark .cc-modal { background: #1a1a1a; border: 1px solid #333; }
      
      .cc-modal__header { padding: 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
      .cc-theme-dark .cc-modal__header { border-color: #333; }
      
      .cc-modal__title { font-size: 20px; font-weight: 600; margin: 0; color: #111; }
      .cc-theme-dark .cc-modal__title { color: #fff; }
      
      .cc-modal__close { background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: #666; }
      .cc-theme-dark .cc-modal__close { color: #999; }
      
      .cc-modal__body { padding: 24px; }
      
      .cc-category { padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; }
      .cc-theme-dark .cc-category { border-color: #333; background: #222; }
      
      .cc-category__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      
      .cc-category__title { font-size: 16px; font-weight: 600; color: #111; }
      .cc-theme-dark .cc-category__title { color: #fff; }
      
      .cc-category__desc { font-size: 13px; color: #666; line-height: 1.5; }
      .cc-theme-dark .cc-category__desc { color: #999; }

      .cc-cookie-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .cc-cookie-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
      .cc-cookie-table th, .cc-cookie-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
      .cc-cookie-table th { color: #666; font-weight: 600; }
      .cc-cookie-table td { color: #444; }
      .cc-cookie-table code { background: #f4f4f4; padding: 1px 5px; border-radius: 4px; font-size: 11px; white-space: nowrap; }
      .cc-theme-dark .cc-cookie-table th, .cc-theme-dark .cc-cookie-table td { border-color: #333; color: #bbb; }
      .cc-theme-dark .cc-cookie-table code { background: #2a2a2a; color: #eee; }
      .cc-cookie-empty { margin-top: 12px; font-size: 12px; font-style: italic; color: #888; }
      .cc-theme-dark .cc-cookie-empty { color: #888; }
      .cc-cookie-status { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; white-space: nowrap; background: #e5e7eb; color: #555; }
      .cc-cookie-status--on { background: #dcfce7; color: #15803d; }
      .cc-theme-dark .cc-cookie-status { background: #333; color: #bbb; }
      .cc-theme-dark .cc-cookie-status--on { background: #14532d; color: #86efac; }
      
      .cc-toggle { position: relative; display: inline-block; width: 50px; height: 28px; cursor: pointer; }
      .cc-toggle input { position: absolute; opacity: 0; width: 50px; height: 28px; margin: 0; padding: 0; cursor: pointer; z-index: 10; pointer-events: auto; top: 0; left: 0; }
      .cc-toggle__slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.3s; border-radius: 28px; pointer-events: none; z-index: 1; }
      .cc-toggle__slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: 0.3s; border-radius: 50%; }
      .cc-toggle input:checked + .cc-toggle__slider { background-color: #2563eb; }
      .cc-toggle input:checked + .cc-toggle__slider:before { transform: translateX(22px); }
      .cc-toggle input:disabled + .cc-toggle__slider { background-color: #d1d5db; cursor: not-allowed; opacity: 0.6; }
      .cc-toggle input:checked:disabled + .cc-toggle__slider { background-color: #94a3b8; }
      .cc-toggle:not(input:disabled) { cursor: pointer; }
      
      .cc-modal__footer { padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end; }
      .cc-theme-dark .cc-modal__footer { border-color: #333; }
      .cc-modal__footer button, .cc-banner__btn { pointer-events: auto !important; z-index: 10 !important; cursor: pointer !important; }
      
      /* Responsive Design */
      @media (max-width: 768px) {
        .cc-main { width: 100% !important; z-index: 999999 !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; pointer-events: none !important; }
        .cc-banner { max-width: calc(100% - 20px) !important; padding: 20px !important; margin: 0 !important; width: calc(100% - 20px) !important; display: block !important; visibility: visible !important; opacity: 1 !important; position: fixed !important; z-index: 999999 !important; }
        .cc-banner__title { font-size: 16px !important; }
        .cc-banner__text { font-size: 13px !important; margin-bottom: 16px !important; }
        .cc-banner__actions { flex-direction: column !important; }
        .cc-banner__btn { width: 100% !important; text-align: center !important; pointer-events: auto !important; z-index: 1000000 !important; }
        .cc-modal { width: 95% !important; max-width: none !important; margin: 10px !important; }
        .cc-modal__header { padding: 20px !important; }
        .cc-modal__title { font-size: 18px !important; }
        .cc-modal__body { padding: 20px !important; }
        .cc-modal__footer { padding: 16px 20px !important; flex-direction: column-reverse !important; }
        .cc-modal__footer button { width: 100% !important; }
        .cc-category { padding: 12px !important; }
        .cc-category__header { flex-wrap: wrap !important; gap: 12px !important; }
        .cc-category__title { font-size: 15px !important; }
        .cc-category__desc { font-size: 12px !important; }
        .cc-position-bottom-right { bottom: 10px !important; right: 10px !important; left: auto !important; top: auto !important; }
        .cc-position-bottom-left { bottom: 10px !important; left: 10px !important; right: auto !important; top: auto !important; }
        .cc-position-bottom-center { bottom: 10px !important; left: 50% !important; right: auto !important; top: auto !important; transform: translateX(-50%) !important; width: calc(100% - 20px) !important; max-width: calc(100% - 20px) !important; }
        .cc-position-top-right { top: 10px !important; right: 10px !important; left: auto !important; bottom: auto !important; }
        .cc-position-top-left { top: 10px !important; left: 10px !important; right: auto !important; bottom: auto !important; }
        .cc-position-top-center { top: 10px !important; left: 50% !important; right: auto !important; bottom: auto !important; transform: translateX(-50%) !important; width: calc(100% - 20px) !important; max-width: calc(100% - 20px) !important; }
      }
      
      @media (max-width: 480px), (pointer: coarse) and (max-width: 768px) {
        .cc-main { width: 100% !important; z-index: 999999 !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; pointer-events: none !important; display: block !important; visibility: visible !important; opacity: 1 !important; }
        .cc-banner { padding: 16px !important; width: calc(100% - 20px) !important; max-width: calc(100% - 20px) !important; display: block !important; visibility: visible !important; opacity: 1 !important; position: fixed !important; z-index: 999999 !important; background: #fff !important; }
        .cc-banner__title { font-size: 15px !important; margin-bottom: 10px !important; }
        .cc-banner__text { font-size: 12px !important; margin-bottom: 14px !important; }
        .cc-banner__btn { padding: 10px 16px !important; font-size: 13px !important; pointer-events: auto !important; z-index: 1000000 !important; }
        .cc-modal__header { padding: 16px !important; }
        .cc-modal__title { font-size: 16px !important; }
        .cc-modal__body { padding: 16px !important; }
        .cc-modal__close { width: 28px !important; height: 28px !important; font-size: 20px !important; }
        .cc-category { padding: 10px !important; }
        .cc-toggle { width: 44px !important; height: 24px !important; }
        .cc-toggle input { width: 44px !important; height: 24px !important; }
        .cc-toggle__slider:before { height: 18px !important; width: 18px !important; left: 3px !important; bottom: 3px !important; }
        .cc-toggle input:checked + .cc-toggle__slider:before { transform: translateX(20px) !important; }
      }
      
      /* Position variants */
      .cc-position-bottom-right { bottom: 20px !important; right: 20px !important; left: auto !important; top: auto !important; }
      .cc-position-bottom-left { bottom: 20px !important; left: 20px !important; right: auto !important; top: auto !important; }
      .cc-position-bottom-center { bottom: 20px !important; left: 50% !important; right: auto !important; top: auto !important; transform: translateX(-50%) !important; }
      .cc-position-top-right { top: 20px !important; right: 20px !important; left: auto !important; bottom: auto !important; }
      .cc-position-top-left { top: 20px !important; left: 20px !important; right: auto !important; bottom: auto !important; }
      .cc-position-top-center { top: 20px !important; left: 50% !important; right: auto !important; bottom: auto !important; transform: translateX(-50%) !important; }
      
      @media (max-width: 640px) {
        .cc-banner { max-width: calc(100vw - 40px); }
        .cc-modal { width: 95%; }
      }
    `;
    document.head.appendChild(styles);
  }

  function createBanner() {
    // Ensure body exists
    if (!document.body) {
      console.error('CookieConsent: document.body not ready. Please initialize after DOMContentLoaded.');
      return null;
    }
    
    // Create main container if it doesn't exist
    let mainContainer = document.getElementById('cc-main');
    if (!mainContainer) {
      STATE.bypassInterceptor = true;
      mainContainer = document.createElement('div');
      mainContainer.id = 'cc-main';
      mainContainer.className = 'cc-main';
      // Force visibility with inline styles for mobile
      mainContainer.style.cssText = 'position: fixed !important; z-index: 999999 !important; pointer-events: none !important; display: block !important; visibility: visible !important; opacity: 1 !important;';
      document.body.appendChild(mainContainer);
      STATE.bypassInterceptor = false;
    } else {
      // Ensure existing container is visible
      mainContainer.style.cssText = 'position: fixed !important; z-index: 999999 !important; pointer-events: none !important; display: block !important; visibility: visible !important; opacity: 1 !important;';
    }
    
    // Create banner
    STATE.bypassInterceptor = true;
    const banner = document.createElement('div');
    banner.className = `cc-banner cc-position-${STATE.config.position}`;
    // Force visibility with inline styles for mobile
    banner.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; position: fixed !important; z-index: 999999 !important;';
    const t = STATE.config.text;
    banner.innerHTML = `
      <div class="cc-banner__title">${t.title}</div>
      <div class="cc-banner__text">${t.description}</div>
      <div class="cc-banner__actions">
        <button class="cc-banner__btn cc-banner__btn--secondary" data-cc-action="reject">${t.rejectAll}</button>
        <button class="cc-banner__btn cc-banner__btn--secondary" data-cc-action="settings">${t.settings}</button>
        <button class="cc-banner__btn cc-banner__btn--primary" data-cc-action="accept">${t.acceptAll}</button>
      </div>
    `;
    
    mainContainer.appendChild(banner);
    STATE.bypassInterceptor = false;
    
    // Add event listeners - use direct assignment instead of cloneNode
    banner.querySelectorAll('[data-cc-action]').forEach(btn => {
      const action = btn.getAttribute('data-cc-action');
      
      // Remove all existing event listeners by replacing the button
      const newBtn = document.createElement('button');
      newBtn.className = btn.className;
      newBtn.setAttribute('data-cc-action', action);
      newBtn.textContent = btn.textContent;
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Add onclick as primary handler (works even if other scripts interfere)
      newBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const btnAction = this.getAttribute('data-cc-action');
        
        if (btnAction === 'accept') {
          if (typeof acceptAll === 'function') {
            acceptAll();
          } else if (typeof CookieConsent !== 'undefined' && typeof CookieConsent.acceptAll === 'function') {
            CookieConsent.acceptAll();
          }
        } else if (btnAction === 'reject') {
          if (typeof rejectAll === 'function') {
            rejectAll();
          } else if (typeof CookieConsent !== 'undefined' && typeof CookieConsent.rejectAll === 'function') {
            CookieConsent.rejectAll();
          }
        } else if (btnAction === 'settings') {
          if (typeof showModal === 'function') {
            showModal();
          } else if (typeof CookieConsent !== 'undefined' && typeof CookieConsent.showPreferences === 'function') {
            CookieConsent.showPreferences();
          }
        }
        
        return false;
      };
      
      // Also add addEventListener as backup
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const btnAction = this.getAttribute('data-cc-action');
        if (btnAction === 'accept' && typeof CookieConsent !== 'undefined' && typeof CookieConsent.acceptAll === 'function') {
          CookieConsent.acceptAll();
        } else if (btnAction === 'reject' && typeof CookieConsent !== 'undefined' && typeof CookieConsent.rejectAll === 'function') {
          CookieConsent.rejectAll();
        } else if (btnAction === 'settings' && typeof CookieConsent !== 'undefined' && typeof CookieConsent.showPreferences === 'function') {
          CookieConsent.showPreferences();
        }
      }, true);
    });
    
    return banner;
  }

  function createModal() {
    if (!document.body) {
      console.error('CookieConsent: document.body not ready. Please call after DOMContentLoaded.');
      return null;
    }
    
    STATE.bypassInterceptor = true;
    
    // Create or get main container
    let mainContainer = document.getElementById('cc-main');
    if (!mainContainer) {
      mainContainer = document.createElement('div');
      mainContainer.id = 'cc-main';
      mainContainer.className = 'cc-main';
      document.body.appendChild(mainContainer);
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'cc-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'cc-modal';
    
    const categories = Object.keys(STATE.config.categories);
    const currentPrefs = STATE.preferences && STATE.preferences.categories || [];
    
    let categoriesHtml = categories.map(categoryKey => {
      const category = STATE.config.categories[categoryKey];
      
      // For readOnly categories, always check them (they're always enabled)
      let isChecked;
      if (category.readOnly) {
        isChecked = true; // ReadOnly categories are always enabled
      } else {
        isChecked = currentPrefs.includes(categoryKey);
      }
      
      const isDisabled = category.readOnly;

      return `
        <div class="cc-category">
          <div class="cc-category__header">
            <div>
              <div class="cc-category__title">${category.name}</div>
              <div class="cc-category__desc">${category.description}</div>
            </div>
            <label class="cc-toggle" ${isDisabled ? 'style="cursor: not-allowed;"' : 'style="cursor: pointer;"'}>
              <input type="checkbox" data-category="${categoryKey}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} id="cc-toggle-${categoryKey}">
              <span class="cc-toggle__slider"></span>
            </label>
          </div>
          <div class="cc-cookie-wrap" data-cc-cat="${categoryKey}">${buildCookieTableHtml(categoryKey)}</div>
        </div>
      `;
    }).join('');
    
    const t = STATE.config.text;
    modal.innerHTML = `
      <div class="cc-modal__header">
        <h2 class="cc-modal__title">${t.modalTitle}</h2>
        <button class="cc-modal__close" data-cc-action="close">&times;</button>
      </div>
      <div class="cc-modal__body">
        ${categoriesHtml}
      </div>
      <div class="cc-modal__footer">
        <button class="cc-banner__btn cc-banner__btn--secondary" data-cc-action="cancel">${t.cancel}</button>
        <button class="cc-banner__btn cc-banner__btn--primary" data-cc-action="save">${t.save}</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    mainContainer.appendChild(overlay);
    STATE.bypassInterceptor = false;
    
    // Event listeners for buttons
    modal.querySelectorAll('[data-cc-action]').forEach(btn => {
      // Remove any existing listeners
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const action = this.getAttribute('data-cc-action');
        
        try {
          if (action === 'close' || action === 'cancel') {
            hideModal();
          } else if (action === 'save') {
            saveFromModal();
          }
        } catch (error) {
          // Silent error handling
        }
        
        return false;
      }, true);
      
      // Backup with mouseup
      newBtn.addEventListener('mouseup', function(e) {
        const action = this.getAttribute('data-cc-action');
        if (action === 'close' || action === 'cancel') hideModal();
        else if (action === 'save') saveFromModal();
      });
    });
    
    // Event listeners for toggle switches - use native label behavior
    modal.querySelectorAll('input[type="checkbox"][data-category]').forEach(checkbox => {
      // Ensure checkbox is directly clickable
      checkbox.style.pointerEvents = 'auto';
      checkbox.style.cursor = checkbox.disabled ? 'not-allowed' : 'pointer';
      
      // Handle change event
      checkbox.addEventListener('change', function(e) {
        e.stopPropagation();
      });
      
      // Make label work natively - don't interfere
      const label = checkbox.closest('label.cc-toggle');
      if (label && !checkbox.disabled) {
        label.style.cursor = 'pointer';
        // Let native label behavior work - no custom handler needed
      }
    });
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) hideModal();
    });
    
    return overlay;
  }

  // ============================================================================
  // UI ACTIONS
  // ============================================================================

  function acceptAll() {
    const categories = Object.keys(STATE.config.categories);
    savePreferences({ categories: categories, timestamp: Date.now() });
    hideBanner();
    setTimeout(function() {
      window.location.reload();
    }, 100);
  }

  function rejectAll() {
    const categories = Object.keys(STATE.config.categories).filter(cat => 
      STATE.config.categories[cat].readOnly
    );
    savePreferences({ categories: categories, timestamp: Date.now() });
    hideBanner();
    setTimeout(function() {
      window.location.reload();
    }, 100);
  }

  function showModal() {
    if (!document.body) {
      return;
    }
    // Reload the page first, THEN open the preferences modal. This guarantees
    // every cookie set by the page (scripts / server) is present before the
    // modal reads them, so the cookie tables are always complete. A one-shot
    // sessionStorage flag both prevents a reload loop and tells init() to
    // re-open the modal automatically after the reload.
    try {
      if (!sessionStorage.getItem('cc_open_prefs')) {
        sessionStorage.setItem('cc_open_prefs', '1');
        window.location.reload();
        return;
      }
      sessionStorage.removeItem('cc_open_prefs');
    } catch (e) { /* sessionStorage unavailable — just open the modal in place */ }

    // Always rebuild the modal so the cookie tables reflect the cookies that
    // are present right now.
    if (STATE.modalElement && STATE.modalElement.parentNode) {
      STATE.modalElement.parentNode.removeChild(STATE.modalElement);
    }
    STATE.modalElement = createModal();
    if (STATE.modalElement) {
      // Hide the banner while the preferences modal is open, so they don't
      // overlap on screen. The banner CSS uses display:block !important, so the
      // inline override must also be !important.
      if (STATE.bannerElement) { STATE.bannerElement.style.setProperty('display', 'none', 'important'); }
      const mc = document.getElementById('cc-main');
      if (mc) { mc.style.setProperty('display', 'block', 'important'); }
      setTimeout(() => {
        STATE.modalElement.classList.add('show');
        STATE.modalShown = true;
      }, 10);
      // Re-scan shortly after opening, to catch any late-written cookies.
      setTimeout(refreshCookieTables, 600);
      setTimeout(refreshCookieTables, 1800);
    }
  }

  function hideModal() {
    if (STATE.modalElement) {
      STATE.modalElement.classList.remove('show');
      STATE.modalShown = false;
    }
    // If the visitor closed settings without making a choice, bring the banner
    // back so they can still accept or reject.
    if (!STATE.preferences && STATE.bannerElement) {
      STATE.bannerElement.style.setProperty('display', 'block', 'important');
      STATE.bannerElement.style.setProperty('visibility', 'visible', 'important');
      STATE.bannerElement.style.setProperty('opacity', '1', 'important');
    }
  }

  function hideBanner() {
    // Hide via STATE.bannerElement
    if (STATE.bannerElement) {
      STATE.bannerElement.style.display = 'none';
      STATE.bannerElement.style.visibility = 'hidden';
      STATE.bannerElement.style.opacity = '0';
      STATE.modalShown = false;
    }
    // Also hide via DOM query as backup
    const banner = document.querySelector('.cc-banner');
    if (banner) {
      banner.style.display = 'none';
      banner.style.visibility = 'hidden';
      banner.style.opacity = '0';
    }
    // Hide the main container if it only contains the banner
    const mainContainer = document.getElementById('cc-main');
    if (mainContainer) {
      const hasModal = mainContainer.querySelector('.cc-overlay.show');
      if (!hasModal) {
        mainContainer.style.display = 'none';
      }
    }
  }

  function saveFromModal() {
    // Get checkboxes from the modal specifically
    const modalBody = document.querySelector('.cc-modal__body');
    if (!modalBody) {
      return;
    }
    
    const selectedCategories = [];
    
    // Always include readOnly categories (like Necessary)
    for (const categoryKey of Object.keys(STATE.config.categories)) {
      const category = STATE.config.categories[categoryKey];
      if (category.readOnly) {
        selectedCategories.push(categoryKey);
      }
    }
    
    // Add checked non-readOnly categories
    const checkboxes = modalBody.querySelectorAll('input[type="checkbox"][data-category]');
    Array.from(checkboxes).forEach(checkbox => {
      const categoryKey = checkbox.getAttribute('data-category');
      const category = STATE.config.categories[categoryKey];
      if (!category.readOnly && checkbox.checked) {
        selectedCategories.push(categoryKey);
      }
    });
    
    savePreferences({ categories: selectedCategories, timestamp: Date.now() });
    hideModal();
    hideBanner();
    initializeScripts();
    setTimeout(function() {
      window.location.reload();
    }, 100);
  }

  // ============================================================================
  // API
  // ============================================================================

  const CookieConsent = {
    init: function(config) {
      STATE.config = Object.assign({}, DEFAULTS, config);
      // Deep-merge text so a config can override just some labels and still get
      // sensible defaults for the rest.
      STATE.config.text = Object.assign({}, DEFAULTS.text, (config && config.text) || {});

      // Create styles
      createStyles();
      
      // Add theme class to body
      if (STATE.config.theme === 'dark') {
        document.documentElement.classList.add('cc-theme-dark');
      }
      
      // Cookie guard already installed when script loaded
      // Just install script interceptor
      installScriptInterceptor();
      
      // Load existing preferences
      STATE.preferences = loadPreferences();
      
      // Show banner if needed - ensure DOM is ready
      function tryShowBanner() {
        if (STATE.config.autoShow && !STATE.preferences) {
          STATE.bannerElement = createBanner();
        }

        // Initialize existing scripts
        if (STATE.preferences) {
          initializeScripts();
          enforcePreferences();
        }

        // If the user clicked "Settings" before a reload, re-open the
        // preferences modal now (the flag is consumed inside showModal()).
        try {
          if (sessionStorage.getItem('cc_open_prefs')) {
            showModal();
          }
        } catch (e) {}
      }
      
      if (document.body) {
        tryShowBanner();
      } else {
        document.addEventListener('DOMContentLoaded', tryShowBanner);
      }
      
      return this;
    },
    
    show: function() {
      if (!STATE.preferences) {
        if (!document.body) {
          console.error('CookieConsent: document.body not ready. Please call after DOMContentLoaded.');
          return this;
        }
        STATE.bannerElement = createBanner();
      } else {
        showModal();
      }
      return this;
    },
    
    showPreferences: showModal,
    
    hide: hideBanner,
    
    acceptAll: acceptAll,
    
    rejectAll: rejectAll,
    
    getPreferences: function() {
      return STATE.preferences;
    },
    
    reset: function() {
      deleteCookie(STATE.config.cookieName);
      STATE.preferences = null;
      if (STATE.config.autoShow) {
        if (!document.body) {
          console.error('CookieConsent: document.body not ready. Please call after DOMContentLoaded.');
          return this;
        }
        STATE.bannerElement = createBanner();
      }
      return this;
    }
  };

  // Expose to global scope
  window.CookieConsent = CookieConsent;

  // CRITICAL: Install cookie guard IMMEDIATELY when script loads
  // This prevents cookies from being set BEFORE init() is called
  // (e.g., Google Analytics scripts that load early in <head>)
  installCookieGuard();

  // Auto-initialize if config provided via data attribute
  if (document.currentScript && document.currentScript.dataset.config) {
    try {
      const config = JSON.parse(document.currentScript.dataset.config);
      CookieConsent.init(config);
    } catch (e) {
      console.error('CookieConsent: Invalid configuration', e);
    }
  }

})(window, document);
