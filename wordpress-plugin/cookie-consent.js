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

  function installCookieGuard() {
    if (STATE.cookieGuardInstalled) return;
    
    try {
      // Intercept document.cookie setter to block analytics/marketing cookies
      const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || 
                                Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
      
      if (!cookieDescriptor || !cookieDescriptor.set) return;
      
      const nativeCookieSetter = cookieDescriptor.set.bind(document);
      
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: cookieDescriptor.get.bind(document),
        set: function(value) {
          // Extract cookie name from "name=value; attributes..."
          const cookieName = String(value).split('=')[0].trim();
          
          // If no preferences yet, check if this looks like analytics/marketing
          if (!STATE.preferences) {
            const analyticsPatterns = [/^_ga/, /^_gid$/, /^_gat_/, /^_gcl_au$/, /^__utm/, /^_uet/];
            const marketingPatterns = [/^_fbp$/, /^fr$/, /^hubspotutk$/, /^intercom/, /^tawk/, /^datadog/];
            
            const isAnalytics = analyticsPatterns.some(pattern => pattern.test(cookieName));
            const isMarketing = marketingPatterns.some(pattern => pattern.test(cookieName));
            
            // Block analytics/marketing cookies until consent
            if (isAnalytics || isMarketing) {
              console.log('Cookie blocked until consent:', cookieName);
              return; // Don't set the cookie
            }
          }
          
          // If we have preferences, check them
          if (STATE.preferences) {
            const accepted = new Set(STATE.preferences.categories || []);
            
            const analyticsPatterns = [/^_ga/, /^_gid$/, /^_gat_/, /^_gcl_au$/, /^__utm/, /^_uet/];
            const marketingPatterns = [/^_fbp$/, /^fr$/, /^hubspotutk$/, /^intercom/, /^tawk/, /^datadog/];
            
            const isAnalytics = analyticsPatterns.some(pattern => pattern.test(cookieName));
            const isMarketing = marketingPatterns.some(pattern => pattern.test(cookieName));
            
            if ((isAnalytics && !accepted.has('analytics')) || 
                (isMarketing && !accepted.has('marketing'))) {
              console.log('Cookie blocked:', cookieName);
              return;
            }
          }
          
          // Allow the cookie
          nativeCookieSetter(value);
        }
      });
      
      STATE.cookieGuardInstalled = true;
      console.log('Cookie guard installed');
    } catch (e) {
      console.warn('Cookie guard installation failed:', e);
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
      .cc-main { position: fixed; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      .cc-main * { box-sizing: border-box; }
      
      /* Banner */
      .cc-banner { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 24px; max-width: 520px; }
      .cc-theme-dark .cc-banner { background: #1a1a1a; border-color: #333; color: #fff; }
      
      .cc-banner__title { font-size: 18px; font-weight: 600; margin: 0 0 12px; color: #111; }
      .cc-theme-dark .cc-banner__title { color: #fff; }
      
      .cc-banner__text { font-size: 14px; line-height: 1.6; margin: 0 0 20px; color: #555; }
      .cc-theme-dark .cc-banner__text { color: #ccc; }
      
      .cc-banner__actions { display: flex; gap: 12px; flex-wrap: wrap; }
      .cc-banner__btn { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #d1d5db; transition: all 0.2s; }
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
      
      .cc-toggle { position: relative; display: inline-block; width: 50px; height: 28px; }
      .cc-toggle input { opacity: 0; width: 0; height: 0; }
      .cc-toggle__slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.3s; border-radius: 28px; }
      .cc-toggle__slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: 0.3s; border-radius: 50%; }
      .cc-toggle input:checked + .cc-toggle__slider { background-color: #2563eb; }
      .cc-toggle input:disabled + .cc-toggle__slider { background-color: #d1d5db; cursor: not-allowed; opacity: 0.6; }
      .cc-toggle input:checked:disabled + .cc-toggle__slider { background-color: #94a3b8; }
      
      .cc-modal__footer { padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end; }
      .cc-theme-dark .cc-modal__footer { border-color: #333; }
      
      /* Position variants */
      .cc-position-bottom-right { bottom: 20px; right: 20px; }
      .cc-position-bottom-left { bottom: 20px; left: 20px; }
      .cc-position-bottom-center { bottom: 20px; left: 50%; transform: translateX(-50%); }
      .cc-position-top-right { top: 20px; right: 20px; }
      .cc-position-top-left { top: 20px; left: 20px; }
      
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
    
    document.body.appendChild(banner);
    
    // Add event listeners
    banner.querySelectorAll('[data-cc-action]').forEach(btn => {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-cc-action');
        if (action === 'accept') {
          acceptAll();
        } else if (action === 'reject') {
          rejectAll();
        } else if (action === 'settings') {
          showModal();
        }
      });
    });
    
    return banner;
  }

  function createModal() {
    if (!document.body) {
      console.error('CookieConsent: document.body not ready. Please call after DOMContentLoaded.');
      return null;
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'cc-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'cc-modal';
    
    const categories = Object.keys(STATE.config.categories);
    const currentPrefs = STATE.preferences && STATE.preferences.categories || [];
    
    let categoriesHtml = categories.map(categoryKey => {
      const category = STATE.config.categories[categoryKey];
      const isChecked = currentPrefs.includes(categoryKey);
      const isDisabled = category.readOnly;
      
      return `
        <div class="cc-category">
          <div class="cc-category__header">
            <div>
              <div class="cc-category__title">${category.name}</div>
              <div class="cc-category__desc">${category.description}</div>
            </div>
            <label class="cc-toggle">
              <input type="checkbox" data-category="${categoryKey}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
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
    document.body.appendChild(overlay);
    
    // Event listeners
    modal.querySelectorAll('[data-cc-action]').forEach(btn => {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-cc-action');
        if (action === 'close' || action === 'cancel') {
          hideModal();
        } else if (action === 'save') {
          saveFromModal();
        }
      });
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
    initializeScripts();
  }

  function rejectAll() {
    const categories = Object.keys(STATE.config.categories).filter(cat => 
      STATE.config.categories[cat].readOnly
    );
    savePreferences({ categories: categories, timestamp: Date.now() });
    hideBanner();
    if (STATE.config.reloadOnChange) {
      window.location.reload();
    }
  }

  function showModal() {
    if (STATE.modalElement) {
      STATE.modalElement.classList.add('show');
      STATE.modalShown = true;
    } else {
      STATE.modalElement = createModal();
      setTimeout(() => STATE.modalElement.classList.add('show'), 10);
      STATE.modalShown = true;
    }
  }

  function hideModal() {
    if (STATE.modalElement) {
      STATE.modalElement.classList.remove('show');
      STATE.modalShown = false;
    }
  }

  function hideBanner() {
    if (STATE.bannerElement) {
      STATE.bannerElement.style.display = 'none';
      STATE.modalShown = false;
    }
  }

  function saveFromModal() {
    const checkboxes = document.querySelectorAll('[data-category]');
    const selectedCategories = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.getAttribute('data-category'));
    
    savePreferences({ categories: selectedCategories, timestamp: Date.now() });
    hideModal();
    hideBanner();
    initializeScripts();
    
    if (STATE.config.reloadOnChange) {
      window.location.reload();
    }
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
      
      // Install cookie guard immediately - before any other scripts run
      installCookieGuard();
      
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
