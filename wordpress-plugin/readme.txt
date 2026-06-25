=== Cookie Consent VE ===
Contributors: nextdoorentertainment
Tags: gdpr, cookie consent, cookie banner, privacy, consent
Requires at least: 5.0
Tested up to: 6.6
Requires PHP: 7.0
Stable tag: 1.1.7
License: MIT
License URI: https://opensource.org/licenses/MIT

GDPR cookie consent with script gating, category-based blocking, a preferences modal, and auto-clearing of analytics and marketing cookies.

== Description ==

Cookie Consent VE is a lightweight, GDPR-minded cookie consent solution. It shows a consent banner on the first visit, gates analytics and marketing scripts until the visitor opts in, and automatically clears tracking cookies when consent is withdrawn.

Scripts are blocked *before* they run (not just hidden), so no analytics or marketing code executes without consent. A preferences modal lets visitors toggle categories at any time, and a shortcode or JavaScript API lets them reopen it later.

= Key features =

* Consent banner shown automatically on first visit.
* Preferences modal with per-category toggles (Necessary, Analytics, Marketing).
* Script gating by consent: mark scripts with `type="text/plain"` and `data-category` and they only run once allowed.
* Auto-clear of common analytics/marketing cookies (`_ga`, `_gid`, `_gcl_au`, `_fbp`, `fr`, `hubspotutk`, and more) when a category is declined.
* Customizable banner position (5 positions), light/dark theme, cookie name and expiry.
* `[cc_settings]` shortcode to drop a "Cookie Settings" link anywhere.
* JavaScript API: `CookieConsent.show()`, `.showPreferences()`, `.acceptAll()`, `.rejectAll()`, `.getPreferences()`, `.reset()`.
* Block and widget for the settings link.
* Built-in English and Romanian text, fully editable.
* Responsive design; runs early on `wp_head` so gating applies before third-party code loads.

This plugin helps you collect and respect consent. It does not, by itself, make your site legally compliant — you are responsible for your cookie policy and for categorizing your own scripts correctly.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`, or install the ZIP via Plugins → Add New → Upload Plugin.
2. Activate the plugin through the Plugins menu in WordPress.
3. Go to Settings → Cookie Consent to configure categories, position, theme, and text.
4. Mark any analytics/marketing scripts with `type="text/plain"` and a `data-category` attribute so they are gated by consent.

== Frequently Asked Questions ==

= How do I stop a script from running until consent is given? =

Change its type to `text/plain` and add a category, for example:

`<script type="text/plain" data-category="analytics">/* Google Analytics */</script>`

External scripts work the same way:

`<script type="text/plain" data-category="marketing" src="https://example.com/pixel.js"></script>`

The script runs only after the visitor accepts that category.

= How can visitors reopen the preferences later? =

Use the shortcode `[cc_settings text="Cookie Settings"]` in any post, page, or widget, or call `CookieConsent.showPreferences()` from your own button.

= Does it clear cookies when consent is withdrawn? =

Yes. When a category is declined, the plugin removes cookies matching common analytics and marketing patterns.

= Is it multilingual? =

It ships with English and Romanian strings, and all banner/modal text is editable in the settings.

== Screenshots ==

1. Consent banner shown on first visit.
2. Preferences modal with per-category toggles.
3. Admin settings: categories, position, theme, and text.

== Changelog ==

= 1.1.7 =
* Directory compliance: distinct Plugin URI and Author URI, WordPress.org username as author, explicit License URI.
* Added WordPress.org readme.

== Upgrade Notice ==

= 1.1.7 =
Packaging and header fixes for the WordPress.org directory. No functional changes.
