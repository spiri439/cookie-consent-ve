# Installation Guide

This project provides **two deployment options** for cookie consent:

1. **Standalone** - Add to any website with a simple `<script>` tag
2. **WordPress Plugin** - Install as a WordPress plugin

---

## Option 1: Standalone Installation

### Quick Start

1. Copy `cookie-consent-standalone.js` to your website
2. Include in your HTML `<head>`:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="cookie-consent-standalone.js"></script>
  <script>
    CookieConsent.init({
      categories: {
        necessary: { enabled: true, readOnly: true, name: 'Necessary', description: 'Essential cookies.' },
        analytics: { enabled: false, name: 'Analytics', description: 'Website analytics.' },
        marketing: { enabled: false, name: 'Marketing', description: 'Personalized ads.' }
      }
    });
  </script>
</head>
<body>
  <!-- Your content -->
  
  <!-- Gated scripts -->
  <script type="text/plain" data-category="analytics">
    // Only loads after consent
    console.log('Analytics enabled');
  </script>
</body>
</html>
```

### Configuration Options

```javascript
CookieConsent.init({
  cookieName: 'cc_cookie',        // Storage cookie name
  cookieExpiry: 365,               // Days until expiry
  autoShow: true,                  // Show banner on first visit
  position: 'bottom-right',        // Banner position
  theme: 'light',                  // 'light' or 'dark'
  reloadOnChange: true,            // Reload page when preferences change
  categories: { ... }              // Your categories
});
```

### Positions
- `bottom-right` (default)
- `bottom-left`
- `bottom-center`
- `top-right`
- `top-left`

### Gating Scripts

Scripts marked with `type="text/plain"` and `data-category` won't load until consent:

```html
<!-- Analytics -->
<script type="text/plain" data-category="analytics">
  // Google Analytics
  gtag('config', 'UA-XXXXXXXXX-X');
</script>

<!-- External Analytics -->
<script type="text/plain" data-category="analytics" 
        src="https://www.google-analytics.com/analytics.js"></script>

<!-- Marketing -->
<script type="text/plain" data-category="marketing">
  // Facebook Pixel
  fbq('track', 'PageView');
</script>
```

### API Methods

```javascript
CookieConsent.show()              // Show banner/modal
CookieConsent.showPreferences()   // Open preferences
CookieConsent.hide()              // Hide banner
CookieConsent.acceptAll()         // Accept all cookies
CookieConsent.rejectAll()         // Reject all except necessary
CookieConsent.getPreferences()    // Get current preferences
CookieConsent.reset()             // Clear and show banner
```

---

## Option 2: WordPress Plugin Installation

### Installation Steps

1. **Upload Plugin Files**
   ```bash
   # Copy wordpress-plugin folder to your WordPress installation
   cp -r wordpress-plugin /path/to/wordpress/wp-content/plugins/cookie-consent-standalone
   ```

2. **Activate Plugin**
   - Go to WordPress Admin Dashboard
   - Navigate to Plugins
   - Find "Cookie Consent Standalone"
   - Click "Activate"

3. **Configure Settings**
   - Go to Settings > Cookie Consent
   - Configure categories, position, theme
   - Save settings

### Configuration

The plugin admin interface provides:
- ✅ General settings (position, theme, auto-show)
- ✅ Cookie name and expiry
- ✅ Category management (necessary, analytics, marketing)
- ✅ Read-only toggles for mandatory categories

### Usage in WordPress

#### Shortcode for Settings Link

Add anywhere in your content:

```
[cc_settings text="Cookie Settings"]
```

Or with custom styling:

```
[cc_settings text="Manage Cookies" class="my-custom-class"]
```

#### Gated Scripts in Themes

In your theme's `header.php` or `footer.php`:

```php
<?php if (is_user_logged_in()): ?>
  <!-- User-specific scripts -->
<?php endif; ?>

<!-- Analytics - only loads after consent -->
<script type="text/plain" data-category="analytics">
  // Your analytics code
</script>

<!-- Marketing - only loads after consent -->
<script type="text/plain" data-category="marketing">
  // Your marketing code
</script>
```

#### Gated Scripts in Content

In post/page editor, switch to "Text" or "HTML" mode:

```html
<script type="text/plain" data-category="analytics">
  console.log('Analytics loaded');
</script>
```

### Hooks and Filters

The plugin supports WordPress hooks for customization:

```php
// Filter JavaScript config before output
add_filter('cc_js_config', function($config) {
    $config['position'] = 'bottom-left';
    return $config;
});

// Add custom CSS
add_action('wp_head', function() {
    echo '<style>.cc-banner { background: red; }</style>';
});
```

---

## Testing

### Standalone

1. Open `standalone-example.html` in your browser
2. Test banner display and interactions
3. Check console for script loading
4. Inspect cookies in DevTools

### WordPress

1. Install and activate plugin
2. Configure settings
3. Add a test page with gated scripts
4. Test in incognito/private mode
5. Verify cookie persistence
6. Test settings link shortcode

---

## Troubleshooting

### Scripts Not Loading

**Problem:** Scripts remain as `type="text/plain"`

**Solution:**
- Check browser console for errors
- Verify category names match configuration
- Ensure CookieConsent is initialized before scripts

### Banner Not Showing

**Problem:** Banner doesn't appear on first visit

**Solution:**
- Check `autoShow: true` in config
- Clear browser cookies
- Verify `cookie-consent-standalone.js` is loaded
- Check browser console for JavaScript errors

### Preferences Not Saving

**Problem:** Cookie preferences reset on page reload

**Solution:**
- Verify cookie domain/path settings
- Check browser cookie settings
- Test in different browsers
- Clear browser cache

### WordPress Issues

**Problem:** Plugin not activating

**Solution:**
- Check file permissions (644 for files, 755 for folders)
- Verify PHP version (7.0+ required)
- Check for plugin conflicts
- Review WordPress debug log

---

## Example Implementations

### Complete Example

See `standalone-example.html` for a full working example with:
- Multiple gated scripts
- Manual controls
- Preference display
- API usage

### Integration Examples

#### Google Analytics
```html
<script type="text/plain" data-category="analytics" 
        src="https://www.googletagmanager.com/gtag/js?id=UA-XXXXXXXXX-X"></script>
<script type="text/plain" data-category="analytics">
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'UA-XXXXXXXXX-X');
</script>
```

#### Facebook Pixel
```html
<script type="text/plain" data-category="marketing">
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
</script>
```

#### Hotjar
```html
<script type="text/plain" data-category="analytics">
  (function(h,o,t,j,a,r){
      h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
      h._hjSettings={hjid:YOUR_HOTJAR_ID,hjsv:6};
      a=o.getElementsByTagName('head')[0];
      r=o.createElement('script');r.async=1;
      r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
      a.appendChild(r);
  })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
</script>
```

---

## Deployment Checklist

### Standalone
- [ ] Upload `cookie-consent-standalone.js` to server
- [ ] Include script in `<head>` of all pages
- [ ] Configure categories and settings
- [ ] Add gated scripts with proper attributes
- [ ] Test in different browsers
- [ ] Verify GDPR compliance

### WordPress
- [ ] Upload plugin files to `/wp-content/plugins/`
- [ ] Activate plugin
- [ ] Configure admin settings
- [ ] Add shortcode to footer/sidebar
- [ ] Gate existing scripts
- [ ] Test on staging before production
- [ ] Review privacy policy

---

## Support

For issues, questions, or contributions:
- Check GitHub issues
- Review documentation
- Test in browser console
- Verify configuration

## License

MIT License - Free to use in commercial projects.
