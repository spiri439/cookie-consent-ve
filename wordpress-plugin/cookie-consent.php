<?php
/**
 * Plugin Name: Cookie Consent VE
 * Plugin URI: https://vesrl.ro
 * Description: GDPR-compliant cookie consent plugin with automatic cookie blocking, script gating, and preferences modal.
 * Version: 1.0.1
 * Author: VE
 * Author URI: https://vesrl.ro
 * License: MIT
 * Text Domain: cookie-consent
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

define('CC_VERSION', '1.0.1');
define('CC_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('CC_PLUGIN_URL', plugin_dir_url(__FILE__));

class CookieConsent_Plugin {
    
    private $settings;
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('wp_head', array($this, 'output_cookie_guard_early'), 0); // Priority 0 = EARLIEST possible
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_footer', array($this, 'output_config'));
        add_shortcode('cc_settings', array($this, 'shortcode_settings_link'));
        add_action('init', array($this, 'register_blocks'));
        add_action('widgets_init', array($this, 'register_widget'));
        
        // Load settings
        $this->settings = get_option('cc_settings', $this->get_default_settings());
    }
    
    public function init() {
        load_plugin_textdomain('cookie-consent', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }
    
    public function get_default_settings() {
        return array(
            'auto_show' => 'yes',
            'position' => 'bottom-right',
            'theme' => 'light',
            'cookie_name' => 'cc_cookie',
            'cookie_expiry' => 365,
            'reload_on_change' => 'yes',
            'categories' => array(
                'necessary' => array(
                    'enabled' => 'yes',
                    'readonly' => 'yes',
                    'name' => 'Necessary',
                    'description' => 'Essential cookies required for the website to function properly.'
                ),
                'analytics' => array(
                    'enabled' => 'no',
                    'readonly' => 'no',
                    'name' => 'Analytics',
                    'description' => 'Help us understand how visitors interact with our website.'
                ),
                'marketing' => array(
                    'enabled' => 'no',
                    'readonly' => 'no',
                    'name' => 'Marketing',
                    'description' => 'Used to deliver personalized content and ads.'
                )
            )
        );
    }
    
    public function add_admin_menu() {
        add_options_page(
            __('Cookie Consent Settings', 'cookie-consent'),
            __('Cookie Consent', 'cookie-consent'),
            'manage_options',
            'cookie-consent',
            array($this, 'render_admin_page')
        );
    }
    
    public function register_settings() {
        register_setting('cc_settings_group', 'cc_settings', array($this, 'sanitize_settings'));
    }
    
    public function sanitize_settings($input) {
        $sanitized = array();
        
        // General settings
        $sanitized['auto_show'] = isset($input['auto_show']) ? sanitize_text_field($input['auto_show']) : 'no';
        $sanitized['position'] = isset($input['position']) ? sanitize_text_field($input['position']) : 'bottom-right';
        $sanitized['theme'] = isset($input['theme']) ? sanitize_text_field($input['theme']) : 'light';
        $sanitized['cookie_name'] = isset($input['cookie_name']) ? sanitize_text_field($input['cookie_name']) : 'cc_cookie';
        $sanitized['cookie_expiry'] = isset($input['cookie_expiry']) ? absint($input['cookie_expiry']) : 365;
        $sanitized['reload_on_change'] = isset($input['reload_on_change']) ? sanitize_text_field($input['reload_on_change']) : 'no';
        
        // Categories - preserve existing if not submitted, or merge with defaults
        $default_categories = $this->get_default_settings()['categories'];
        if (isset($input['categories']) && is_array($input['categories'])) {
            foreach ($input['categories'] as $key => $category) {
                $sanitized['categories'][$key] = array(
                    'enabled' => isset($category['enabled']) ? sanitize_text_field($category['enabled']) : 'no',
                    'readonly' => isset($category['readonly']) ? sanitize_text_field($category['readonly']) : 'no',
                    'name' => isset($category['name']) ? sanitize_text_field($category['name']) : (isset($default_categories[$key]['name']) ? $default_categories[$key]['name'] : ''),
                    'description' => isset($category['description']) ? sanitize_textarea_field($category['description']) : (isset($default_categories[$key]['description']) ? $default_categories[$key]['description'] : '')
                );
            }
        } else {
            // If no categories submitted, keep existing ones or use defaults
            $sanitized['categories'] = isset($this->settings['categories']) ? $this->settings['categories'] : $default_categories;
        }
        
        return $sanitized;
    }
    
    // Output minimal cookie guard inline VERY early in <head>
    public function output_cookie_guard_early() {
        ?>
        <script>
        (function(){
            // FIRST: Delete any existing analytics/marketing cookies immediately
            // BUT ONLY IF THEY'RE NOT ACCEPTED!
            function deleteBlockedCookies() {
                if (!document.cookie) return;
                
                // Read preferences from cookie
                var preferences = null;
                try {
                    var cookies = document.cookie.split('; ');
                    for (var idx = 0; idx < cookies.length; idx++) {
                        var parts = cookies[idx].split('=');
                        if (parts[0].trim() === 'cc_cookie') {
                            preferences = JSON.parse(decodeURIComponent(parts[1]));
                            break;
                        }
                    }
                } catch(e) {}
                
                // Build accepted categories set
                var acceptedCategories = {};
                if (preferences && preferences.categories && Array.isArray(preferences.categories)) {
                    for (var catIdx = 0; catIdx < preferences.categories.length; catIdx++) {
                        acceptedCategories[preferences.categories[catIdx]] = true;
                    }
                }
                
                // If analytics/marketing are accepted, DON'T delete them!
                var analyticsAccepted = acceptedCategories['analytics'] === true;
                var marketingAccepted = acceptedCategories['marketing'] === true;
                
                // If both are accepted, skip deletion entirely
                if (analyticsAccepted && marketingAccepted) {
                    return;
                }
                
                var cookies = document.cookie.split('; ');
                var analyticsPatterns = [/^_ga/, /^_gid/, /^_gat/, /^__utm/, /^_uet/, /^_dc_gtm/, /^_gac_/, /^_gtm/, /^analytics/, /^ga_/, /^gid_/, /^collect$/, /^_gat_gtag/, /^_ga_/, /^AMP_TOKEN/, /^_vwo/, /^_gat_/, /^_gcl/, /^_uetsid/, /^_uetvid/];
                var marketingPatterns = [/^_fbp/, /^fr$/, /^hubspotutk$/, /^intercom/, /^tawk/, /^datadog/, /^_fbp_/, /^fbc$/, /^sb$/, /^wd$/, /^xs$/, /^c_user$/, /^presence$/, /^act$/, /^m_pixel_ratio$/, /^spin$/, /^locale$/, /^datr$/, /^_pin/, /^_pinterest/, /^_ads/, /^_ad/, /^_adroll/, /^_scid/, /^li_at/, /^_li/, /^_linkedin/, /^tracking/, /^clickid/, /^affiliate/];
                var hostname = window.location.hostname;
                var domainParts = hostname.split('.');
                var rootDomain = domainParts.length > 1 ? domainParts.slice(-2).join('.') : hostname;
                var domain = hostname;
                var dotDomain = '.' + rootDomain;
                var parentDomain = domainParts.length > 1 ? '.' + domainParts.slice(-2).join('.') : hostname;
                
                for (var i = 0; i < cookies.length; i++) {
                    var cookieName = cookies[i].split('=')[0].trim();
                    if (cookieName === 'cc_cookie') continue;
                    
                    var isAnalytics = false;
                    var isMarketing = false;
                    
                    // Check if it's an analytics cookie
                    for (var j = 0; j < analyticsPatterns.length; j++) {
                        if (analyticsPatterns[j].test(cookieName)) {
                            isAnalytics = true;
                            break;
                        }
                    }
                    
                    // Check if it's a marketing cookie
                    if (!isAnalytics) {
                        for (var k = 0; k < marketingPatterns.length; k++) {
                            if (marketingPatterns[k].test(cookieName)) {
                                isMarketing = true;
                                break;
                            }
                        }
                    }
                    
                    // Only delete if:
                    // 1. It's an analytics cookie AND analytics is NOT accepted
                    // 2. It's a marketing cookie AND marketing is NOT accepted
                    var shouldDelete = false;
                    if (isAnalytics && !analyticsAccepted) {
                        shouldDelete = true;
                    } else if (isMarketing && !marketingAccepted) {
                        shouldDelete = true;
                    }
                    
                    if (shouldDelete) {
                        // Delete with ALL possible combinations - cookies can have various domain/path settings
                        // CRITICAL: Cookies with .domain format need exact domain match to delete
                        var paths = ['/', '/index.html', ''];
                        var domainsToTry = [domain, dotDomain, parentDomain, rootDomain, ''];
                        
                        // Try deleting with each combination
                        for (var p = 0; p < paths.length; p++) {
                            for (var d = 0; d < domainsToTry.length; d++) {
                                var dom = domainsToTry[d];
                                var path = paths[p] || '/';
                                
                                if (dom) {
                                    // Try with domain specified
                                    document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=' + path + ';domain=' + dom;
                                } else {
                                    // Try without domain (for exact domain match cookies)
                                    document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=' + path;
                                }
                            }
                        }
                        
                        // Extra attempts with most common combinations
                        document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
                        document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + hostname;
                        document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.' + hostname;
                        document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + dotDomain;
                        document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + rootDomain;
                        
                        if (domainParts.length > 1) {
                            document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + parentDomain;
                        }
                    }
                }
            }
            
            // Delete immediately and continuously
            deleteBlockedCookies();
            // Delete VERY aggressively every 25ms for .domain format cookies
            setInterval(deleteBlockedCookies, 25);
            // Also delete on any DOM events
            if (document.addEventListener) {
                document.addEventListener('DOMContentLoaded', deleteBlockedCookies);
                window.addEventListener('load', deleteBlockedCookies);
                window.addEventListener('focus', deleteBlockedCookies);
                document.addEventListener('visibilitychange', deleteBlockedCookies);
            }
            
            // Install cookie guard IMMEDIATELY - before any other scripts can run
            if (typeof document === 'undefined' || typeof Object === 'undefined' || typeof Object.defineProperty === 'undefined') return;
            
            try {
                var cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || 
                                      Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
                
                if (!cookieDescriptor || !cookieDescriptor.set) return;
                
                var nativeCookieSetter = cookieDescriptor.set.bind(document);
                var STATE = { config: null, preferences: null, cookieName: 'cc_cookie' };
                
                // Try to load preferences from cookie
                try {
                    var cookies = document.cookie.split('; ');
                    for (var i = 0; i < cookies.length; i++) {
                        var parts = cookies[i].split('=');
                        if (parts[0].trim() === 'cc_cookie') {
                            STATE.preferences = JSON.parse(decodeURIComponent(parts[1]));
                            break;
                        }
                    }
                } catch(e) {}
                
                var analyticsPatterns = [
                    /^_ga/, /^_gid$/, /^_gat/, /^_gcl_au$/, /^__utm/, /^_uet/, 
                    /^_dc_gtm/, /^_gac_/, /^_gtm/, /^analytics/, /^ga_/, /^gid_/,
                    /^collect$/, /^_gat_gtag/, /^_ga_/, /^AMP_TOKEN/, /^_vwo/
                ];
                
                var marketingPatterns = [
                    /^_fbp$/, /^fr$/, /^hubspotutk$/, /^intercom/, /^tawk/, /^datadog/,
                    /^_fbp_/, /^fbc$/, /^sb$/, /^wd$/, /^xs$/, /^c_user$/, /^presence$/,
                    /^act$/, /^m_pixel_ratio$/, /^spin$/, /^locale$/, /^datr$/,
                    /^_pin/, /^_pinterest/, /^_ads/, /^_ad/, /^_adroll/, /^_scid/,
                    /^li_at/, /^_li/, /^_linkedin/, /^tracking/, /^clickid/, /^affiliate/
                ];
                
                Object.defineProperty(document, 'cookie', {
                    configurable: true,
                    writable: false,
                    get: cookieDescriptor.get.bind(document),
                    set: function(value) {
                        var cookieName = String(value).split('=')[0].trim();
                        
                        // Always allow our consent cookie
                        if (cookieName === 'cc_cookie') {
                            nativeCookieSetter(value);
                            // Update STATE.preferences immediately when consent cookie is set
                            try {
                                var cookieValue = value.split('=')[1].split(';')[0];
                                STATE.preferences = JSON.parse(decodeURIComponent(cookieValue));
                            } catch(e) {}
                            return;
                        }
                        
                        // ALWAYS read preferences fresh from cookie - don't rely on STATE
                        var currentPreferences = null;
                        try {
                            var cookies = document.cookie.split('; ');
                            for (var prefIdx = 0; prefIdx < cookies.length; prefIdx++) {
                                var parts = cookies[prefIdx].split('=');
                                if (parts[0].trim() === 'cc_cookie') {
                                    currentPreferences = JSON.parse(decodeURIComponent(parts[1]));
                                    break;
                                }
                            }
                        } catch(e) {}
                        
                        var isAnalytics = analyticsPatterns.some(function(pattern) {
                            return pattern.test(cookieName);
                        });
                        
                        var isMarketing = marketingPatterns.some(function(pattern) {
                            return pattern.test(cookieName);
                        });
                        
                        // If no preferences yet, block ALL analytics/marketing cookies
                        if (!currentPreferences || !currentPreferences.categories) {
                            if (isAnalytics || isMarketing) {
                                // DO NOT SET THE COOKIE - Block it completely
                                // Also delete it immediately in case it was set before guard
                                setTimeout(function() {
                                    var hostname = window.location.hostname;
                                    var domainParts = hostname.split('.');
                                    var parentDomain = domainParts.length > 1 ? '.' + domainParts.slice(-2).join('.') : hostname;
                                    
                                    // Delete with all combinations
                                    document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
                                    document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + hostname;
                                    document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.' + hostname;
                                    if (domainParts.length > 1) {
                                        document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + parentDomain;
                                    }
                                }, 0);
                                return;
                            }
                            nativeCookieSetter(value);
                            return;
                        }
                        
                        // If we have preferences, check them
                        var accepted = currentPreferences.categories || [];
                        var acceptedSet = {};
                        for (var j = 0; j < accepted.length; j++) {
                            acceptedSet[accepted[j]] = true;
                        }
                        
                        if ((isAnalytics && !acceptedSet['analytics']) || 
                            (isMarketing && !acceptedSet['marketing'])) {
                            // DO NOT SET THE COOKIE - Block it completely
                            // Also delete it immediately in case it was set before guard
                            setTimeout(function() {
                                var hostname = window.location.hostname;
                                var domainParts = hostname.split('.');
                                var rootDomain = domainParts.length > 1 ? domainParts.slice(-2).join('.') : hostname;
                                var dotDomain = '.' + rootDomain;
                                var parentDomain = domainParts.length > 1 ? '.' + domainParts.slice(-2).join('.') : hostname;
                                
                                // Delete with ALL domain combinations - cookies with .domain format need exact match
                                document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
                                document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + hostname;
                                document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.' + hostname;
                                document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + dotDomain;
                                document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + rootDomain;
                                if (domainParts.length > 1) {
                                    document.cookie = cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=' + parentDomain;
                                }
                            }, 0);
                            return;
                        }
                        
                        // All checks passed, allow the cookie
                        nativeCookieSetter(value);
                    }
                });
            } catch(e) {
                // Silent failure - will be retried when main script loads
            }
        })();
        </script>
        <?php
    }
    
    public function enqueue_scripts() {
        // Load script in HEAD with high priority to block cookies before other scripts
        // Priority 1 ensures it loads before most other scripts
        wp_enqueue_script(
            'cookie-consent',
            CC_PLUGIN_URL . 'cookie-consent.js',
            array(),
            CC_VERSION,
            false // Load in HEAD, not footer - critical for cookie blocking
        );
    }
    
    public function output_config() {
        ?>
        <script>
        (function() {
            // Wait for DOM and script to be ready
            var maxRetries = 100; // 5 seconds max wait
            var retryCount = 0;
            
            function initCookieConsent() {
                if (typeof CookieConsent !== 'undefined' && typeof CookieConsent.init === 'function') {
                    try {
                        var config = <?php echo json_encode($this->get_js_config()); ?>;
                        console.log('CookieConsent: Initializing with config:', config);
                        CookieConsent.init(config);
                        console.log('CookieConsent: Initialization complete');
                    } catch (error) {
                        console.error('CookieConsent: Error during initialization:', error);
                    }
                } else {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(initCookieConsent, 50);
                    } else {
                        console.error('CookieConsent: Script failed to load after ' + (maxRetries * 50) + 'ms');
                    }
                }
            }
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initCookieConsent);
            } else {
                initCookieConsent();
            }
        })();
        </script>
        <?php
    }
    
    public function get_js_config() {
        $categories = array();
        
        foreach ($this->settings['categories'] as $key => $category) {
            $categories[$key] = array(
                'enabled' => $category['enabled'] === 'yes',
                'readOnly' => $category['readonly'] === 'yes',
                'name' => $category['name'],
                'description' => $category['description']
            );
        }
        
        return array(
            'categories' => $categories,
            'position' => $this->settings['position'],
            'theme' => $this->settings['theme'],
            'autoShow' => $this->settings['auto_show'] === 'yes',
            'cookieName' => $this->settings['cookie_name'],
            'cookieExpiry' => intval($this->settings['cookie_expiry']),
            'reloadOnChange' => $this->settings['reload_on_change'] === 'yes'
        );
    }
    
    public function shortcode_settings_link($atts) {
        $atts = shortcode_atts(array(
            'text' => 'Cookie Settings',
            'class' => 'cc-settings-link',
            'button' => 'no'
        ), $atts);
        
        $is_button = ($atts['button'] === 'yes' || $atts['button'] === 'true' || $atts['button'] === '1');
        
        $onclick = 'onclick="event.preventDefault(); if(typeof CookieConsent !== \'undefined\') { CookieConsent.showPreferences(); } else { console.warn(\'Cookie Consent not loaded\'); }"';
        
        if ($is_button) {
            return '<button type="button" class="' . esc_attr($atts['class']) . ' cc-settings-button" ' . $onclick . '>' . 
                   esc_html($atts['text']) . '</button>';
        } else {
            return '<a href="#" class="' . esc_attr($atts['class']) . '" ' . $onclick . '>' . 
                   esc_html($atts['text']) . '</a>';
        }
    }
    
    // Register Gutenberg block for cookie settings
    public function register_blocks() {
        if (!function_exists('register_block_type')) {
            return;
        }
        
        register_block_type('cookie-consent/settings-link', array(
            'editor_script' => 'cookie-consent',
            'render_callback' => array($this, 'block_settings_link_render'),
            'attributes' => array(
                'text' => array('type' => 'string', 'default' => 'Cookie Settings'),
                'isButton' => array('type' => 'boolean', 'default' => false)
            )
        ));
    }
    
    public function block_settings_link_render($atts) {
        $text = isset($atts['text']) ? $atts['text'] : 'Cookie Settings';
        $is_button = isset($atts['isButton']) ? $atts['isButton'] : false;
        
        if ($is_button) {
            return '<button type="button" class="cc-settings-link" onclick="event.preventDefault(); if(typeof CookieConsent !== \'undefined\') { CookieConsent.showPreferences(); }">' . 
                   esc_html($text) . '</button>';
        } else {
            return '<a href="#" class="cc-settings-link" onclick="event.preventDefault(); if(typeof CookieConsent !== \'undefined\') { CookieConsent.showPreferences(); }">' . 
                   esc_html($text) . '</a>';
        }
    }
    
    // Register WordPress Widget
    public function register_widget() {
        register_widget('Cookie_Consent_Widget');
    }
    
    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <form method="post" action="options.php">
                <?php settings_fields('cc_settings_group'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Auto Show Banner', 'cookie-consent'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="cc_settings[auto_show]" value="yes" <?php checked($this->settings['auto_show'], 'yes'); ?>>
                                <?php _e('Show cookie banner automatically on first visit', 'cookie-consent'); ?>
                            </label>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Banner Position', 'cookie-consent'); ?></th>
                        <td>
                            <select name="cc_settings[position]">
                                <option value="bottom-right" <?php selected($this->settings['position'], 'bottom-right'); ?>>Bottom Right</option>
                                <option value="bottom-left" <?php selected($this->settings['position'], 'bottom-left'); ?>>Bottom Left</option>
                                <option value="bottom-center" <?php selected($this->settings['position'], 'bottom-center'); ?>>Bottom Center</option>
                                <option value="top-right" <?php selected($this->settings['position'], 'top-right'); ?>>Top Right</option>
                                <option value="top-left" <?php selected($this->settings['position'], 'top-left'); ?>>Top Left</option>
                            </select>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Theme', 'cookie-consent'); ?></th>
                        <td>
                            <select name="cc_settings[theme]">
                                <option value="light" <?php selected($this->settings['theme'], 'light'); ?>>Light</option>
                                <option value="dark" <?php selected($this->settings['theme'], 'dark'); ?>>Dark</option>
                            </select>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Cookie Name', 'cookie-consent'); ?></th>
                        <td>
                            <input type="text" name="cc_settings[cookie_name]" value="<?php echo esc_attr($this->settings['cookie_name']); ?>" class="regular-text">
                            <p class="description"><?php _e('Name of the cookie used to store preferences', 'cookie-consent'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Cookie Expiry (days)', 'cookie-consent'); ?></th>
                        <td>
                            <input type="number" name="cc_settings[cookie_expiry]" value="<?php echo esc_attr($this->settings['cookie_expiry']); ?>" min="1" max="3650" class="small-text">
                            <p class="description"><?php _e('Number of days until cookie expires', 'cookie-consent'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Reload on Change', 'cookie-consent'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="cc_settings[reload_on_change]" value="yes" <?php checked($this->settings['reload_on_change'], 'yes'); ?>>
                                <?php _e('Reload page when preferences are changed', 'cookie-consent'); ?>
                            </label>
                        </td>
                    </tr>
                </table>
                
                <h2><?php _e('Cookie Categories', 'cookie-consent'); ?></h2>
                <p><?php _e('Configure cookie categories that users can manage', 'cookie-consent'); ?></p>
                
                <?php foreach ($this->settings['categories'] as $key => $category): ?>
                <fieldset style="margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <legend><strong><?php echo esc_html(ucfirst($key)); ?> Cookies</strong></legend>
                    
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php _e('Enabled', 'cookie-consent'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="cc_settings[categories][<?php echo esc_attr($key); ?>][enabled]" value="yes" <?php checked($category['enabled'], 'yes'); ?>>
                                    <?php _e('Enable this category', 'cookie-consent'); ?>
                                </label>
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row"><?php _e('Read Only', 'cookie-consent'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="cc_settings[categories][<?php echo esc_attr($key); ?>][readonly]" value="yes" <?php checked($category['readonly'], 'yes'); ?>>
                                    <?php _e('Users cannot disable this category', 'cookie-consent'); ?>
                                </label>
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row"><?php _e('Display Name', 'cookie-consent'); ?></th>
                            <td>
                                <input type="text" name="cc_settings[categories][<?php echo esc_attr($key); ?>][name]" value="<?php echo esc_attr($category['name']); ?>" class="regular-text">
                            </td>
                        </tr>
                        
                        <tr>
                            <th scope="row"><?php _e('Description', 'cookie-consent'); ?></th>
                            <td>
                                <textarea name="cc_settings[categories][<?php echo esc_attr($key); ?>][description]" rows="3" class="large-text"><?php echo esc_textarea($category['description']); ?></textarea>
                            </td>
                        </tr>
                    </table>
                </fieldset>
                <?php endforeach; ?>
                
                <?php submit_button(); ?>
            </form>
            
            <div style="margin-top: 40px; padding: 20px; background: #f0f0f0; border-radius: 8px;">
                <h2><?php _e('Usage', 'cookie-consent'); ?></h2>
                
                <h3><?php _e('Shortcode', 'cookie-consent'); ?></h3>
                <p><?php _e('Add a cookie settings link anywhere in your content using:', 'cookie-consent'); ?></p>
                <ul style="list-style: disc; margin-left: 20px;">
                    <li><code>[cc_settings]</code> - <?php _e('Simple link with default text', 'cookie-consent'); ?></li>
                    <li><code>[cc_settings text="Manage Cookies"]</code> - <?php _e('Custom text', 'cookie-consent'); ?></li>
                    <li><code>[cc_settings text="Cookie Preferences" button="yes"]</code> - <?php _e('Display as button', 'cookie-consent'); ?></li>
                </ul>
                
                <h3 style="margin-top: 20px;"><?php _e('Widget', 'cookie-consent'); ?></h3>
                <p><?php _e('Go to Appearance > Widgets and add "Cookie Settings" widget to any widget area.', 'cookie-consent'); ?></p>
                
                <h3 style="margin-top: 20px;"><?php _e('Gutenberg Block', 'cookie-consent'); ?></h3>
                <p><?php _e('Search for "Cookie Settings" in the block inserter.', 'cookie-consent'); ?></p>
                
                <h3 style="margin-top: 20px;"><?php _e('Gated Scripts', 'cookie-consent'); ?></h3>
                <p><?php _e('To gate your scripts by consent, add these attributes to script tags:', 'cookie-consent'); ?></p>
                <pre style="background: white; padding: 15px; border: 1px solid #ddd; border-radius: 4px; overflow-x: auto;">
&lt;script type="text/plain" data-category="analytics"&gt;
    // Your analytics code here
&lt;/script&gt;

&lt;script type="text/plain" data-category="marketing"&gt;
    // Your marketing code here
&lt;/script&gt;
                </pre>
            </div>
        </div>
        <?php
    }
}

// WordPress Widget Class
class Cookie_Consent_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'cookie_consent_widget',
            __('Cookie Settings', 'cookie-consent'),
            array(
                'description' => __('Display a link or button to open cookie preferences', 'cookie-consent')
            )
        );
    }
    
    public function widget($args, $instance) {
        $title = !empty($instance['title']) ? $instance['title'] : '';
        $text = !empty($instance['text']) ? $instance['text'] : 'Cookie Settings';
        $is_button = !empty($instance['is_button']) ? $instance['is_button'] : false;
        
        echo $args['before_widget'];
        
        if (!empty($title)) {
            echo $args['before_title'] . esc_html($title) . $args['after_title'];
        }
        
        if ($is_button) {
            echo '<button type="button" class="cc-settings-link cc-settings-button" onclick="event.preventDefault(); if(typeof CookieConsent !== \'undefined\') { CookieConsent.showPreferences(); } else { alert(\'Cookie Consent not loaded\'); }">' . 
                 esc_html($text) . '</button>';
        } else {
            echo '<a href="#" class="cc-settings-link" onclick="event.preventDefault(); if(typeof CookieConsent !== \'undefined\') { CookieConsent.showPreferences(); } else { alert(\'Cookie Consent not loaded\'); }">' . 
                 esc_html($text) . '</a>';
        }
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : '';
        $text = !empty($instance['text']) ? $instance['text'] : 'Cookie Settings';
        $is_button = !empty($instance['is_button']) ? $instance['is_button'] : false;
        ?>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('title')); ?>"><?php _e('Title:', 'cookie-consent'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('title')); ?>" 
                   name="<?php echo esc_attr($this->get_field_name('title')); ?>" 
                   type="text" value="<?php echo esc_attr($title); ?>">
        </p>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('text')); ?>"><?php _e('Link/Button Text:', 'cookie-consent'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('text')); ?>" 
                   name="<?php echo esc_attr($this->get_field_name('text')); ?>" 
                   type="text" value="<?php echo esc_attr($text); ?>">
        </p>
        <p>
            <input class="checkbox" type="checkbox" 
                   id="<?php echo esc_attr($this->get_field_id('is_button')); ?>" 
                   name="<?php echo esc_attr($this->get_field_name('is_button')); ?>" 
                   value="1" <?php checked($is_button, 1); ?>>
            <label for="<?php echo esc_attr($this->get_field_id('is_button')); ?>"><?php _e('Display as button instead of link', 'cookie-consent'); ?></label>
        </p>
        <?php
    }
    
    public function update($new_instance, $old_instance) {
        $instance = array();
        $instance['title'] = (!empty($new_instance['title'])) ? sanitize_text_field($new_instance['title']) : '';
        $instance['text'] = (!empty($new_instance['text'])) ? sanitize_text_field($new_instance['text']) : 'Cookie Settings';
        $instance['is_button'] = (!empty($new_instance['is_button'])) ? 1 : 0;
        return $instance;
    }
}

// Initialize plugin
new CookieConsent_Plugin();
