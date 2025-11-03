# Troubleshooting Guide

Common issues and solutions for Cookie Consent.

---

## ❌ Banner Not Appearing

### Problem
Cookie consent banner doesn't show up on your website.

### Solutions

#### 1. Check Browser Console
Open browser DevTools (F12) → Console tab. Look for:
- ❌ Script loading errors (404 Not Found)
- ❌ JavaScript errors
- ❌ "CookieConsent not defined"

**Fix:** Verify script path is correct.

#### 2. Cookie Already Set
If you previously accepted/rejected cookies, the banner won't show automatically.

**Fix:** Clear the cookie:
```javascript
// In browser console
document.cookie = 'cc_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
location.reload();
```

Or use the debug page:
```
http://yoursite.com/test-debug.html
```
Click "Clear Cookie & Reload" button.

#### 3. Script Loaded in Wrong Order
Scripts must load in this order:
1. `cookie-consent-standalone.js`
2. Your `CookieConsent.init()` call

**Wrong:**
```html
<script>
  CookieConsent.init({...});  <!-- Error: CookieConsent not defined -->
</script>
<script src="cookie-consent-standalone.js"></script>
```

**Correct:**
```html
<script src="cookie-consent-standalone.js"></script>
<script>
  CookieConsent.init({...});
</script>
```

#### 4. DOM Not Ready
If `autoShow` is true but DOM isn't ready, banner won't show.

**Fix:** The script now handles this automatically. If issues persist:

```html
<script src="cookie-consent-standalone.js"></script>
<script>
  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', function() {
    CookieConsent.init({
      categories: { ... }
    });
  });
</script>
```

#### 5. Wrong File Path
Check that the file is in the correct location.

**Fix:**
```html
<!-- If file is in root -->
<script src="cookie-consent-standalone.js"></script>

<!-- If file is in js/ folder -->
<script src="js/cookie-consent-standalone.js"></script>

<!-- If loading from CDN -->
<script src="https://cdn.example.com/cookie-consent-standalone.js"></script>
```

---

## ❌ Gated Scripts Still Loading

### Problem
Scripts with `type="text/plain"` are executing before consent.

### Solutions

#### 1. Missing data-category Attribute
Gated scripts MUST have both attributes:

**Wrong:**
```html
<script type="text/plain">
  console.log('This will NOT work');
</script>
```

**Correct:**
```html
<script type="text/plain" data-category="analytics">
  console.log('This works!');
</script>
```

#### 2. Script Loaded After Consent
If consent was already given, scripts initialize immediately.

**Fix:** Check if this is expected behavior. Scripts should load on consent.

#### 3. Wrong Category Name
Category must match your configuration:

**Your Config:**
```javascript
CookieConsent.init({
  categories: {
    analytics: { ... },  // Category name is 'analytics'
    marketing: { ... }
  }
});
```

**Script Must Use:**
```html
<!-- This will work -->
<script type="text/plain" data-category="analytics">...</script>

<!-- This will NOT work -->
<script type="text/plain" data-category="tracking">...</script>
```

---

## ❌ Styling Issues

### Problem
Banner looks broken, unstyled, or misplaced.

### Solutions

#### 1. CSS Not Loading
Styles are injected via JavaScript. Check console for errors.

**Fix:** Ensure script loads without errors.

#### 2. Z-Index Conflicts
Banner might be behind other elements.

**Fix:** The banner uses `z-index: 999999`. If still hidden:

```css
/* Add to your CSS */
.cc-main { z-index: 9999999 !important; }
```

#### 3. Position Off-Screen
Banner might be positioned outside viewport.

**Fix:** Try different positions:

```javascript
CookieConsent.init({
  position: 'bottom-right',  // Try: bottom-left, top-right, etc.
  ...
});
```

---

## ❌ WordPress Plugin Issues

### Problem
WordPress plugin not working.

### Solutions

#### 1. Plugin Not Activated
**Fix:** 
1. Go to WordPress Admin → Plugins
2. Find "Cookie Consent Standalone"
3. Click "Activate"

#### 2. Permission Error
**Fix:** Check file permissions:
```bash
chmod 644 wordpress-plugin/cookie-consent.php
chmod 644 wordpress-plugin/cookie-consent.js
chmod 755 wordpress-plugin/
```

#### 3. Settings Not Saving
**Fix:** 
1. Go to Settings → Cookie Consent
2. Configure options
3. Scroll down and click "Save Changes"
4. Check if settings persist after refresh

#### 4. Shortcode Not Working
**Check:**
```
[cc_settings text="Cookie Settings"]
```

**Fix:** Ensure plugin is activated and no caching enabled.

---

## ❌ Browser Compatibility

### Problem
Not working in specific browsers.

### Supported Browsers
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers
- ❌ IE11 and older (not supported)

### Fix
Update browser to latest version.

---

## 🔍 Debug Tools

### Use Debug Page
Open `test-debug.html` in browser for:
- Manual banner controls
- Cookie status display
- Preference logging

### Console Commands
Open browser console (F12) and try:

```javascript
// Show banner manually
CookieConsent.show();

// Show preferences modal
CookieConsent.showPreferences();

// Check current preferences
console.log(CookieConsent.getPreferences());

// Reset everything
CookieConsent.reset();

// Check if loaded
console.log(typeof CookieConsent);  // Should return "object"
```

### Network Tab
Check DevTools → Network:
- Script loaded successfully
- No 404 errors
- Script size is reasonable (~30KB)

---

## 📋 Checklist

Before asking for help, verify:

- [ ] Script file exists at correct path
- [ ] Script loads without 404 errors
- [ ] No JavaScript errors in console
- [ ] Cookie cleared (for testing)
- [ ] Browser supports modern JavaScript
- [ ] `CookieConsent.init()` called with valid config
- [ ] Categories defined correctly
- [ ] Using `type="text/plain"` for gated scripts
- [ ] `data-category` attribute matches config
- [ ] Testing in incognito/private mode
- [ ] Cache cleared

---

## 🆘 Still Having Issues?

1. **Check console errors** - Most issues show error messages
2. **Use test-debug.html** - It has diagnostic tools built-in
3. **Try minimal example** - Copy from `standalone-example.html`
4. **Clear everything:**
   - Clear browser cache
   - Clear cookies
   - Hard refresh (Ctrl+Shift+R)
   - Try incognito mode

---

## 📞 Getting Help

When asking for help, include:

1. Browser and version
2. Console error messages (copy/paste)
3. Your HTML setup (relevant parts)
4. Your CookieConsent.init() configuration
5. Steps to reproduce the issue

---

## 🔧 Common Configuration Mistakes

### Missing Categories
```javascript
// ❌ Wrong
CookieConsent.init({});

// ✅ Correct
CookieConsent.init({
  categories: {
    necessary: { enabled: true, readOnly: true },
    analytics: { enabled: false }
  }
});
```

### Wrong Auto-Show
```javascript
// Banner won't show automatically
CookieConsent.init({
  autoShow: false,  // ❌ Disables auto-show
  ...
});

// Banner shows automatically
CookieConsent.init({
  autoShow: true,  // ✅ Shows on first visit
  ...
});
```

### Wrong Position
```javascript
// ❌ Wrong - position doesn't exist
position: 'center',

// ✅ Correct - use valid position
position: 'bottom-right',
position: 'bottom-left',
position: 'bottom-center',
position: 'top-right',
position: 'top-left',
```

---

## ✅ Quick Fixes

**Banner won't show?**
→ Clear cookie, hard refresh, check console

**Scripts execute immediately?**
→ Add `type="text/plain"` and `data-category`

**WordPress not working?**
→ Activate plugin, check permissions

**Styling broken?**
→ Check console for JavaScript errors

**Modal not closing?**
→ Click overlay outside modal

**Preferences not saving?**
→ Clear browser cookies, check console

---

Need more help? Check console for specific error messages!
