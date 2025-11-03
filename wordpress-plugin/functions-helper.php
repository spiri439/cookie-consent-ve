<?php
/**
 * WordPress Helper Code
 * 
 * Add this to your theme's functions.php if you want even earlier cookie blocking
 * This ensures cookie consent script loads BEFORE Google Analytics and other tracking scripts
 */

// Load cookie consent script with highest priority (before other scripts)
// NOTE: This is only needed if plugin loads too late
// The plugin already loads in HEAD, but this gives even higher priority
function cc_load_cookie_consent_early() {
    // Get plugin directory URL
    $plugin_url = plugin_dir_url(__DIR__ . '/cookie-consent.php');
    if (!$plugin_url) {
        $plugin_url = plugins_url('cookie-consent-ve/cookie-consent.js');
    } else {
        $plugin_url = $plugin_url . 'cookie-consent.js';
    }
    
    // Only load if plugin is not already doing it
    if (!wp_script_is('cookie-consent', 'enqueued')) {
        wp_enqueue_script(
            'cookie-consent-early',
            $plugin_url,
            array(),
            '1.0.1',
            false // Load in HEAD
        );
    }
}
// Priority 1 = Very early, before most other scripts
add_action('wp_enqueue_scripts', 'cc_load_cookie_consent_early', 1);

