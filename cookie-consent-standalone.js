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
    return document.cookie.split('; ').map(c => c.split('=')[0]);
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
    
    try {
      // First, delete any existing analytics/marketing cookies that shouldn't be there
      function deleteBlockedCookies() {
        if (!document.cookie) return;
        
        const analyticsPatterns = [
          /^_ga/, /^_gid$/, /^_gat/, /^_gcl_au$/, /^__utm/, /^_uet/, 
          /^_dc_gtm/, /^_gac_/, /^_gtm/, /^analytics/, /^ga_/, /^gid_/,
          /^collect$/, /^_gat_gtag/, /^_ga_/, /^AMP_TOKEN/, /^_vwo/
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
        writable: false,
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
            /^collect$/, /^_gat_gtag/, /^_ga_/, /^AMP_TOKEN/, /^_vwo/
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
          const analyticsPatterns = [/^_ga/, /^_gid/, /^_gat/, /^__utm/];
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
      /^_ga/, /^_gid$/, /^_gat_/, /^_gcl_au$/, /^__utm/, /^_uet/, /^_fbp$/
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
      .cc-main { position: fixed; z-index: 999999 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; pointer-events: none; }
      .cc-main * { box-sizing: border-box; }
      .cc-main > * { pointer-events: auto; }
      
      /* Banner */
      .cc-banner { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 24px; max-width: 520px; display: block !important; visibility: visible !important; opacity: 1 !important; position: fixed; }
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
      .cc-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999998; display: none; }
      .cc-overlay.show { display: flex; align-items: center; justify-content: center; }
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
      
      @media (max-width: 480px) {
        .cc-main { width: 100% !important; z-index: 999999 !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; pointer-events: none !important; }
        .cc-banner { padding: 16px !important; width: calc(100% - 20px) !important; max-width: calc(100% - 20px) !important; display: block !important; visibility: visible !important; opacity: 1 !important; position: fixed !important; z-index: 999999 !important; }
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
      document.body.appendChild(mainContainer);
      STATE.bypassInterceptor = false;
    }
    
    // Create banner
    STATE.bypassInterceptor = true;
    const banner = document.createElement('div');
    banner.className = `cc-banner cc-position-${STATE.config.position}`;
    banner.innerHTML = `
      <div class="cc-banner__title">🍪 Cookie Preferences</div>
      <div class="cc-banner__text">
        We use cookies to enhance your browsing experience and analyze our traffic. 
        Click "Accept" to consent to our use of cookies or "Settings" to manage your preferences.
      </div>
      <div class="cc-banner__actions">
        <button class="cc-banner__btn cc-banner__btn--secondary" data-cc-action="reject">Reject All</button>
        <button class="cc-banner__btn cc-banner__btn--secondary" data-cc-action="settings">Settings</button>
        <button class="cc-banner__btn cc-banner__btn--primary" data-cc-action="accept">Accept All</button>
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
        </div>
      `;
    }).join('');
    
    modal.innerHTML = `
      <div class="cc-modal__header">
        <h2 class="cc-modal__title">Cookie Preferences</h2>
        <button class="cc-modal__close" data-cc-action="close">&times;</button>
      </div>
      <div class="cc-modal__body">
        ${categoriesHtml}
      </div>
      <div class="cc-modal__footer">
        <button class="cc-banner__btn cc-banner__btn--secondary" data-cc-action="cancel">Cancel</button>
        <button class="cc-banner__btn cc-banner__btn--primary" data-cc-action="save">Save Preferences</button>
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
    if (STATE.modalElement) {
      STATE.modalElement.classList.add('show');
      STATE.modalShown = true;
    } else {
      STATE.modalElement = createModal();
      if (STATE.modalElement) {
        setTimeout(() => {
          STATE.modalElement.classList.add('show');
          STATE.modalShown = true;
        }, 10);
      }
    }
  }

  function hideModal() {
    if (STATE.modalElement) {
      STATE.modalElement.classList.remove('show');
      STATE.modalShown = false;
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
