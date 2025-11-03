# Quick Start Guide

Get cookie consent working in 2 minutes!

---

## 🚀 Fastest Setup

### Step 1: Include the Script

Add to your website's `<head>` section:

```html
<script src="cookie-consent-standalone.js"></script>
```

### Step 2: Initialize

Right after the script, initialize with basic config:

```html
<script>
CookieConsent.init({
  categories: {
    necessary: {
      enabled: true,
      readOnly: true,
      name: 'Necessary',
      description: 'Essential cookies required for website functionality.'
    },
    analytics: {
      enabled: false,
      name: 'Analytics',
      description: 'Help us understand website usage.'
    },
    marketing: {
      enabled: false,
      name: 'Marketing',
      description: 'Used for personalized advertising.'
    }
  }
});
</script>
```

### Step 3: Gate Your Scripts

Add `type="text/plain"` and `data-category` to scripts you want to gate:

```html
<!-- Analytics - only loads after consent -->
<script type="text/plain" data-category="analytics">
  // Your Google Analytics code
  gtag('config', 'UA-XXXXXXXXX-X');
</script>

<!-- Marketing - only loads after consent -->
<script type="text/plain" data-category="marketing">
  // Your Facebook Pixel code
  fbq('track', 'PageView');
</script>
```

### Done! ✅

Banner will appear automatically on first visit.

**🚀 Bonus:** Cookies are automatically blocked! Analytics/marketing cookies 
(`_ga`, `_fbp`, etc.) won't be set until you accept. No code changes needed!

See `auto-gate-demo.html` to test the automatic blocking.

---

## 🎨 Customization

### Change Position

```javascript
CookieConsent.init({
  position: 'bottom-right',  // bottom-left, bottom-center, top-right, top-left
  ...
});
```

### Change Theme

```javascript
CookieConsent.init({
  theme: 'light',  // or 'dark'
  ...
});
```

### Disable Auto-Show

```javascript
CookieConsent.init({
  autoShow: false,  // Don't show banner automatically
  ...
});
```

Then show manually:

```javascript
CookieConsent.show();  // Show banner
CookieConsent.showPreferences();  // Show settings modal
```

---

## 📝 Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
  
  <!-- Cookie Consent -->
  <script src="cookie-consent-standalone.js"></script>
  <script>
    CookieConsent.init({
      categories: {
        necessary: {
          enabled: true,
          readOnly: true,
          name: 'Necessary',
          description: 'Essential cookies required for website functionality.'
        },
        analytics: {
          enabled: false,
          name: 'Analytics',
          description: 'Help us understand website usage.'
        },
        marketing: {
          enabled: false,
          name: 'Marketing',
          description: 'Used for personalized advertising.'
        }
      },
      position: 'bottom-right',
      theme: 'light',
      autoShow: true
    });
  </script>
</head>
<body>
  <h1>My Website</h1>
  
  <!-- Your content here -->
  
  <!-- Analytics - only loads after consent -->
  <script type="text/plain" data-category="analytics">
    // Your analytics code here
    console.log('Analytics enabled!');
  </script>
  
  <!-- Marketing - only loads after consent -->
  <script type="text/plain" data-category="marketing">
    // Your marketing code here
    console.log('Marketing enabled!');
  </script>
</body>
</html>
```

---

## 🎮 Manual Controls

```javascript
// Show banner/modal
CookieConsent.show();

// Show preferences modal
CookieConsent.showPreferences();

// Hide banner
CookieConsent.hide();

// Accept all cookies
CookieConsent.acceptAll();

// Reject all except necessary
CookieConsent.rejectAll();

// Get current preferences
const prefs = CookieConsent.getPreferences();

// Reset and show banner again
CookieConsent.reset();
```

---

## 🐛 Troubleshooting

### Banner Not Showing? (Most Common Issue)

**If banner doesn't appear:**

1. **Clear your cookies** - You may have already accepted/rejected:
   ```javascript
   // In browser console (F12)
   document.cookie = 'cc_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
   location.reload();
   ```

2. **Check browser console** for errors (press F12)

3. **Verify script loaded** - Check Network tab for 404 errors

4. **Try manual show:**
   ```javascript
   CookieConsent.show();  // In console
   ```

5. **Open debug page** - Use `test-debug.html` for diagnostics

### Scripts Still Loading?

1. ✅ Add `type="text/plain"`
2. ✅ Add `data-category="category_name"`
3. ✅ Match category name with your config

### WordPress?

1. Copy `wordpress-plugin` to `/wp-content/plugins/`
2. Activate in WordPress admin
3. Configure at Settings → Cookie Consent
4. Use shortcode: `[cc_settings]`

### Still stuck?

📄 See `TROUBLESHOOTING.md` for detailed help!

---

## 📚 More Info

- `standalone-example.html` - Working demo
- `test-debug.html` - Debug tools
- `INSTALLATION.md` - Detailed setup
- `TROUBLESHOOTING.md` - Fix issues
- `wordpress-plugin/README.md` - WordPress guide

---

## ✅ Checklist

- [ ] Script included in `<head>`
- [ ] `CookieConsent.init()` called
- [ ] Categories defined
- [ ] Gated scripts have `type="text/plain"`
- [ ] Gated scripts have `data-category`
- [ ] Tested in browser
- [ ] Banner appears on first visit

---

**That's it! You're GDPR-compliant!** 🎉
