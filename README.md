# Cookie Consent VE 🍪

**GDPR-compliant cookie consent solution with automatic cookie blocking**

Plugin Website: **https://vesrl.ro**  
GitHub: **cookie-consent-ve**

GDPR-compliant cookie consent with **three deployment options**:

1. **Standalone** - Add to any website with a simple `<script>` tag
2. **WordPress Plugin** - Install as a WordPress plugin
3. **Official Library Demo** - Example using orestbida/cookieconsent v3

---

## 🚀 Quick Start

### Standalone (Recommended for Most Sites)

**One file deployment** - Just add to your `<head>`:

```html
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
```

See `standalone-example.html` for complete example.

### WordPress Plugin

1. Copy `wordpress-plugin` to `/wp-content/plugins/`
2. Activate "Cookie Consent Standalone"
3. Configure under Settings > Cookie Consent
4. Use shortcode `[cc_settings]` for settings link

See `wordpress-plugin/README.md` for details.

---

## ✨ Features

All solutions include:

- ✅ GDPR-compliant cookie management
- ✅ **Automatic blocking** - Cookies AND scripts blocked automatically!
- ✅ **Zero code changes** - Works with existing analytics/marketing code
- ✅ Automatic cookie banner on first visit
- ✅ Preferences modal with category toggles
- ✅ Intelligent script detection (Google Analytics, Facebook Pixel, etc.)
- ✅ Cookie guard intercepts all cookie writes
- ✅ Pattern-based blocking for cookies and scripts
- ✅ Auto-clear cookies on preference change
- ✅ Fully responsive design
- ✅ Light/Dark themes
- ✅ Customizable categories

---

## 📁 Project Structure

```
cookie-consent-ve/
├── cookie-consent-standalone.js  # Standalone version (recommended)
├── standalone-example.html        # Example for standalone
├── wordpress-plugin/              # WordPress plugin
│   ├── cookie-consent.php        # Main plugin file
│   ├── cookie-consent.js         # Cookie consent logic
│   └── README.md                 # Plugin documentation
├── demo/                          # Official library demo
│   ├── index.html                # Main demo page
│   └── settings.html             # Settings portal
├── src/cc.js                      # Custom experiment
├── styles/cc.css                  # Custom styles
├── cookieconsent/                 # Official library
└── INSTALLATION.md                # Detailed installation guide
```

---

## 📖 Documentation

- **Quick Start**: See `QUICK-START.md` - Get running in 2 minutes!
- **Installation**: See `INSTALLATION.md` - Full setup guide
- **Troubleshooting**: See `TROUBLESHOOTING.md` - Fix common issues
- **Auto-Gating Demo**: See `auto-gate-demo.html` - Test automatic blocking
- **Standalone**: See `standalone-example.html` - Working demo
- **WordPress**: See `wordpress-plugin/README.md` - Plugin guide
- **Official Demo**: See `demo/` - orestbida/cookieconsent examples

---

## 🎯 Use Cases

### Standalone
- Static websites (HTML/CSS/JS)
- React, Vue, Angular apps
- Any custom framework
- CDN deployment

### WordPress Plugin
- WordPress sites
- WooCommerce shops
- Blog sites
- Easy admin configuration

### Official Library Demo
- Reference implementation
- Testing & development
- Learning the library

---

## 🔧 Automatic Blocking

**No changes needed!** The plugin automatically detects and blocks analytics/marketing.

### Automatic Detection

Works with your existing code:

```html
<!-- Google Analytics - automatically blocked until consent -->
<script src="https://www.googletagmanager.com/gtag/js?id=UA-XXXXXXXXX-X"></script>
<script>
  gtag('config', 'UA-XXXXXXXXX-X');
</script>

<!-- Facebook Pixel - automatically blocked until consent -->
<script>
  fbq('init', 'PIXEL_ID');
  fbq('track', 'PageView');
</script>
```

### Manual Gating (Optional)

You can also mark scripts explicitly:

```html
<!-- Analytics - only loads after consent -->
<script type="text/plain" data-category="analytics">
  gtag('config', 'UA-XXXXXXXXX-X');
</script>

<!-- Marketing - only loads after consent -->
<script type="text/plain" data-category="marketing">
  fbq('track', 'PageView');
</script>
```

---

## 🌐 Run Locally

All solutions work with any HTTP server:

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000

# Then open http://localhost:8000/standalone-example.html
```

---

## 📦 Deployment

### Standalone
Upload `cookie-consent-standalone.js` to your server and include in `<head>`.

### WordPress
Upload plugin folder to `/wp-content/plugins/` and activate.

### CDN / Direct Download
Download from: **https://vesrl.ro**  
GitHub: **https://github.com/spiri439/cookie-consent-ve**

---

## 📄 License

MIT License - Free for commercial use

---

## 🌐 Links

- **Plugin Website**: https://vesrl.ro
- **GitHub**: https://github.com/spiri439/cookie-consent-ve
- **Live Demo**: See `standalone-example.html` and `auto-gate-demo.html`

---

## 🤝 Support

For issues or questions, check:
- `INSTALLATION.md` - Installation guide
- `TROUBLESHOOTING.md` - Fix common issues
- `wordpress-plugin/README.md` - WordPress docs
- Browser console for JavaScript errors

