<?php
/**
 * WordPress Helper Code
 * 
 * Add this to your theme's functions.php if you want even earlier cookie blocking
 * This ensures cookie consent script loads BEFORE Google Analytics and other tracking scripts
 */

// Load cookie consent script with highest priority (before other scripts)
function cc_load_cookie_consent_early() {
    // Only load if plugin is not already doing it
    if (!wp_script_is('cookie-consent', 'enqueued')) {
        wp_enqueue_script(
            'cookie-consent',
            plugin_dir_url(__FILE__) . 'cookie-consent.js',
            array(),
            '1.0.1',
            false // Load in HEAD
        );
    }
}
// Priority 1 = Very early, before most other scripts
add_action('wp_enqueue_scripts', 'cc_load_cookie_consent_early', 1);

