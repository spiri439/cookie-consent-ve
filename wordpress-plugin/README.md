# Cookie Consent VE - WordPress Plugin

**GDPR-compliant cookie consent for WordPress with automatic cookie blocking**

Plugin Website: **https://vesrl.ro**  
GitHub: **cookie-consent-ve**

Features automatic script gating, preferences modal, auto-clear functionality, and intelligent cookie blocking.

## Installation

1. Download the plugin files
2. Upload the `wordpress-plugin` folder to `/wp-content/plugins/`
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Configure settings under Settings > Cookie Consent

## Features

- ✅ GDPR-compliant cookie management
- ✅ Automatic cookie banner on first visit
- ✅ Preferences modal with category toggles
- ✅ Script gating for analytics and marketing code
- ✅ Auto-clear cookies on preference change
- ✅ Customizable categories, position, and theme
- ✅ Shortcode support for settings link
- ✅ Fully responsive design

## Configuration

### Admin Settings

Navigate to **Settings > Cookie Consent** to configure:

- **Auto Show Banner**: Show banner automatically on first visit
- **Banner Position**: Choose from 5 positions (bottom-right, bottom-left, bottom-center, top-right, top-left)
- **Theme**: Light or dark theme
- **Cookie Name**: Name of the preference cookie
- **Cookie Expiry**: Number of days until cookie expires (1-3650)
- **Reload on Change**: Reload page when preferences change
- **Categories**: Configure necessary, analytics, and marketing categories

### Cookie Categories

Each category supports:
- **Enabled**: Whether the category is available
- **Read Only**: Users cannot disable (typically for "Necessary" cookies)
- **Display Name**: Name shown to users
- **Description**: Detailed explanation of what the category does

## Usage

### Shortcode

Add a cookie settings link anywhere in your content:

```
[cc_settings text="Cookie Settings"]
```

### Script Gating

To gate scripts by consent, use the `data-category` attribute:

#### Analytics Script
```html
<script type="text/plain" data-category="analytics">
  // Google Analytics, etc.
  console.log('Analytics script loaded');
</script>
```

#### Marketing Script
```html
<script type="text/plain" data-category="marketing">
  // Facebook Pixel, etc.
  console.log('Marketing script loaded');
</script>
```

#### External Scripts
```html
<script type="text/plain" data-category="analytics" src="https://www.google-analytics.com/analytics.js"></script>
```

### JavaScript API

Control the consent banner programmatically:

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
CookieConsent.getPreferences();

// Reset and show banner
CookieConsent.reset();
```

## Cookie Categories

### Necessary
Essential cookies required for website functionality. Cannot be disabled by users.

### Analytics
Cookies that help understand visitor behavior (Google Analytics, etc.)

### Marketing
Cookies used for personalized advertising (Facebook Pixel, etc.)

## Auto-Clear Cookies

The plugin automatically clears cookies matching common patterns:

**Analytics:**
- `_ga`, `_gid`, `_gat_`, `_gcl_au`, `__utm*`, `_uet`, `_fbp`

**Marketing:**
- `_fbp`, `fr`, `hubspotutk`, `intercom-session*`, `tawk*`, `datadog*`

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## License

MIT License - Free for commercial use

## Links

- **Plugin Website**: https://vesrl.ro
- **GitHub**: https://github.com/spiri439/cookie-consent-ve
- **Documentation**: See root `README.md` and `INSTALLATION.md`

## Support

For issues, feature requests, or questions, please visit the plugin repository or website.
