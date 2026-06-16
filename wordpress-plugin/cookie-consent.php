<?php
/**
 * Plugin Name: Cookie Consent VE
 * Plugin URI: https://vesrl.ro
 * Description: GDPR-compliant cookie consent plugin with automatic cookie blocking, script gating, and preferences modal.
 * Version: 1.5.1
 * Author: VE
 * Author URI: https://vesrl.ro
 * License: MIT
 * Text Domain: cookie-consent
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

define('CC_VERSION', '1.5.1');
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

        // Add a "Settings" link on the Plugins page row.
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), array($this, 'add_action_links'));

        // Stop cache/optimization plugins from deferring or delaying our script.
        add_filter('script_loader_tag', array($this, 'exclude_from_optimization'), 10, 3);

        // Admin "Scan site for cookies" action.
        add_action('admin_post_cc_scan_cookies', array($this, 'handle_scan'));

        // Admin "Update from GitHub" action.
        add_action('admin_post_cc_update_github', array($this, 'handle_github_update'));

        // Front-end "Scan Cookies" button in the admin bar (admins only) + its
        // AJAX endpoint. This reads the REAL cookies on the page (incl. JS-set
        // ones a server scan can't see).
        add_action('admin_bar_menu', array($this, 'admin_bar_node'), 100);
        add_action('wp_footer', array($this, 'admin_bar_scan_script'), 100);
        add_action('wp_ajax_cc_scan_clientside', array($this, 'ajax_scan_clientside'));

        // Load settings
        $this->settings = get_option('cc_settings', $this->get_default_settings());
    }
    
    public function init() {
        load_plugin_textdomain('cookie-consent', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }
    
    /** Supported UI languages. */
    public function languages() {
        return array('en' => 'English', 'ro' => 'Română');
    }

    /** Built-in UI text for a language ('en' or 'ro'). */
    public function default_text($lang) {
        $t = array(
            'en' => array(
                'title' => '🍪 Cookie Preferences',
                'description' => 'We use cookies to enhance your browsing experience and analyze our traffic. Click "Accept All" to consent to our use of cookies or "Settings" to manage your preferences.',
                'acceptAll' => 'Accept All',
                'rejectAll' => 'Reject All',
                'settings' => 'Settings',
                'modalTitle' => 'Cookie Preferences',
                'save' => 'Save Preferences',
                'cancel' => 'Cancel',
                'tableCookie' => 'Cookie',
                'tablePurpose' => 'Purpose',
                'tableDuration' => 'Duration',
                'tableStatus' => 'Status',
                'statusStored' => 'Stored now',
                'statusIfAccepted' => 'Blocked until you accept',
                'noCookies' => 'No cookies stored, and no matching services were detected on this page.'
            ),
            'ro' => array(
                'title' => '🍪 Preferințe Cookie',
                'description' => 'Folosim cookie-uri pentru a îmbunătăți experiența ta de navigare și a analiza traficul. Apasă „Acceptă toate" pentru a consimți sau „Setări" pentru a-ți gestiona preferințele.',
                'acceptAll' => 'Acceptă toate',
                'rejectAll' => 'Respinge toate',
                'settings' => 'Setări',
                'modalTitle' => 'Preferințe Cookie',
                'save' => 'Salvează preferințele',
                'cancel' => 'Anulează',
                'tableCookie' => 'Cookie',
                'tablePurpose' => 'Scop',
                'tableDuration' => 'Durată',
                'tableStatus' => 'Stare',
                'statusStored' => 'Stocat acum',
                'statusIfAccepted' => 'Blocat până accepți',
                'noCookies' => 'Niciun cookie stocat și niciun serviciu corespunzător detectat pe această pagină.'
            )
        );
        return isset($t[$lang]) ? $t[$lang] : $t['en'];
    }

    /** Known tracking scripts -> the cookies they set (used by the scanner). */
    public function tracking_signatures() {
        return array(
            array('match' => array('googletagmanager.com/gtag/js', 'google-analytics.com', 'gtag('), 'category' => 'analytics', 'cookies' => array(
                array('name' => '_ga', 'purpose' => 'Google Analytics – distinguishes unique visitors.', 'duration' => '2 years'),
                array('name' => '_ga_*', 'purpose' => 'Google Analytics 4 – persists the session state.', 'duration' => '2 years'),
                array('name' => '_gid', 'purpose' => 'Google Analytics – distinguishes unique visitors.', 'duration' => '24 hours'),
            )),
            array('match' => array('googletagmanager.com/gtm.js', 'GTM-'), 'category' => 'analytics', 'cookies' => array(
                array('name' => '_ga', 'purpose' => 'Google Analytics (via Tag Manager) – distinguishes unique visitors.', 'duration' => '2 years'),
                array('name' => '_ga_*', 'purpose' => 'Google Analytics 4 (via Tag Manager) – session state.', 'duration' => '2 years'),
                array('name' => '_gid', 'purpose' => 'Google Analytics (via Tag Manager) – distinguishes visitors.', 'duration' => '24 hours'),
                array('name' => '_dc_gtm_*', 'purpose' => 'Google Tag Manager – throttles request rate.', 'duration' => '1 minute'),
            )),
            array('match' => array('UA-'), 'category' => 'analytics', 'cookies' => array(
                array('name' => '_gat', 'purpose' => 'Universal Analytics – throttles the request rate.', 'duration' => '1 minute'),
                array('name' => '__utma', 'purpose' => 'Universal Analytics – visitor/session data.', 'duration' => 'up to 2 years'),
            )),
            array('match' => array('googleadservices.com', 'googlesyndication.com'), 'category' => 'marketing', 'cookies' => array(
                array('name' => '_gcl_au', 'purpose' => 'Google Ads – stores ad-click conversion info.', 'duration' => '90 days'),
            )),
            array('match' => array('connect.facebook.net', 'fbevents.js', 'fbq('), 'category' => 'marketing', 'cookies' => array(
                array('name' => '_fbp', 'purpose' => 'Meta (Facebook) Pixel – identifies browsers for ad delivery.', 'duration' => '90 days'),
                array('name' => 'fr', 'purpose' => 'Meta (Facebook) – ad delivery and measurement.', 'duration' => '90 days'),
            )),
            array('match' => array('static.hotjar.com'), 'category' => 'analytics', 'cookies' => array(
                array('name' => '_hj*', 'purpose' => 'Hotjar – behaviour analytics and session sampling.', 'duration' => 'varies'),
            )),
            array('match' => array('clarity.ms'), 'category' => 'analytics', 'cookies' => array(
                array('name' => '_clck / _clsk', 'purpose' => 'Microsoft Clarity – session analytics.', 'duration' => '1 year'),
            )),
            array('match' => array('snap.licdn.com', 'linkedin.com/insight'), 'category' => 'marketing', 'cookies' => array(
                array('name' => 'li_*', 'purpose' => 'LinkedIn – ad targeting and conversion tracking.', 'duration' => 'varies'),
            )),
            array('match' => array('js.hs-scripts.com', 'js.hsforms.net'), 'category' => 'marketing', 'cookies' => array(
                array('name' => 'hubspotutk', 'purpose' => 'HubSpot – tracks visitor identity for marketing.', 'duration' => '6 months'),
            )),
            array('match' => array('analytics.tiktok.com'), 'category' => 'marketing', 'cookies' => array(
                array('name' => '_ttp', 'purpose' => 'TikTok – ad measurement and targeting.', 'duration' => '13 months'),
            )),
        );
    }

    /**
     * Cookies the scanner ignores: WordPress's own admin/login/session cookies
     * that only exist for logged-in users, so the admin running the scan does
     * not pollute the public list with their own session cookies.
     */
    public function is_ignored_cookie($name) {
        $ignore = array('/^wordpress_/', '/^wp-settings/', '/^wp_lang$/', '/^comment_author/', '/^wordpress_test_cookie$/');
        foreach ($ignore as $re) { if (preg_match($re, $name)) return true; }
        return false;
    }

    /** Best-effort category for a cookie name found via Set-Cookie. */
    public function guess_category($name) {
        $analytics = array('/^_ga/', '/^_gid/', '/^_gat/', '/^__utm/', '/^_uet/', '/^_vwo/', '/^_dc_gtm/', '/^trafic/', '/^_pk_/', '/^_hj/');
        $marketing = array('/^_fbp/', '/^fr$/', '/^_gcl/', '/^_scid/', '/^li_/', '/^_pin/', '/^hubspot/', '/^_tt/', '/^_uetsid/', '/^_uetvid/');
        foreach ($analytics as $p) { if (preg_match($p, $name)) return 'analytics'; }
        foreach ($marketing as $p) { if (preg_match($p, $name)) return 'marketing'; }
        return 'necessary';
    }

    /**
     * Scan the site's front page: collect server Set-Cookie names and tracking
     * scripts present in the HTML, and return a deduped list of cookies.
     */
    public function scan_site_cookies() {
        $resp = wp_remote_get(home_url('/'), array(
            'timeout' => 15, 'sslverify' => false, 'redirection' => 3,
            'user-agent' => 'Mozilla/5.0 (CookieConsentVE Scanner)'
        ));
        if (is_wp_error($resp)) {
            return array('error' => $resp->get_error_message(), 'cookies' => array());
        }
        $found = array();

        // The plugin's own consent cookie is always used.
        $ccname = isset($this->settings['cookie_name']) ? $this->settings['cookie_name'] : 'cc_cookie';
        $found[$ccname] = array('name' => $ccname, 'category' => 'necessary', 'purpose' => 'Stores your cookie consent choices.', 'duration' => (isset($this->settings['cookie_expiry']) ? intval($this->settings['cookie_expiry']) . ' days' : '1 year'), 'source' => 'plugin');

        // Server-set cookies (e.g. trafic_mon, PHPSESSID).
        $setc = wp_remote_retrieve_header($resp, 'set-cookie');
        if (!empty($setc)) {
            foreach ((array) $setc as $line) {
                $name = trim(strtok($line, '='));
                if ($name === '' || isset($found[$name]) || $this->is_ignored_cookie($name)) continue;
                $found[$name] = array('name' => $name, 'category' => $this->guess_category($name), 'purpose' => 'Set by the website server.', 'duration' => '', 'source' => 'server');
            }
        }

        // Tracking scripts in the HTML -> their known cookies.
        $body = (string) wp_remote_retrieve_body($resp);
        if ($body !== '') {
            foreach ($this->tracking_signatures() as $sig) {
                $hit = false;
                foreach ($sig['match'] as $m) { if (strpos($body, $m) !== false) { $hit = true; break; } }
                if (!$hit) continue;
                foreach ($sig['cookies'] as $ck) {
                    if (isset($found[$ck['name']])) continue;
                    $found[$ck['name']] = array('name' => $ck['name'], 'category' => $sig['category'], 'purpose' => $ck['purpose'], 'duration' => $ck['duration'], 'source' => 'script');
                }
            }
        }
        return array('error' => '', 'cookies' => array_values($found));
    }

    /** Handle the "Scan Cookies" button: scan, merge into settings, redirect. */
    public function handle_scan() {
        if (!current_user_can('manage_options')) wp_die('Insufficient permissions');
        check_admin_referer('cc_scan_cookies');

        $result = $this->scan_site_cookies();
        $existing = (isset($this->settings['cookies']) && is_array($this->settings['cookies'])) ? $this->settings['cookies'] : array();
        $by_name = array();
        foreach ($existing as $c) { if (!empty($c['name'])) $by_name[$c['name']] = $c; }
        foreach ($result['cookies'] as $c) { if (!isset($by_name[$c['name']])) $by_name[$c['name']] = $c; } // keep admin edits
        $this->settings['cookies'] = array_values($by_name);
        update_option('cc_settings', $this->settings);

        wp_safe_redirect(add_query_arg(array(
            'page' => 'cookie-consent',
            'cc_scanned' => count($result['cookies']),
            'cc_scan_error' => $result['error'] !== '' ? rawurlencode($result['error']) : false,
        ), admin_url('options-general.php')));
        exit;
    }

    /** GitHub repo the "Update from GitHub" button pulls from. */
    public function github_zip_url() {
        return 'https://github.com/spiri439/cookie-consent-ve/archive/refs/heads/main.zip';
    }

    /** Download the latest plugin files from GitHub and overwrite this plugin. */
    public function handle_github_update() {
        if (!current_user_can('update_plugins') && !current_user_can('manage_options')) wp_die('Insufficient permissions');
        check_admin_referer('cc_update_github');

        require_once ABSPATH . 'wp-admin/includes/file.php';
        WP_Filesystem();
        global $wp_filesystem;

        $redirect = function ($status, $msg = '') {
            wp_safe_redirect(add_query_arg(array(
                'page' => 'cookie-consent',
                'cc_update' => $status,
                'cc_update_msg' => $msg !== '' ? rawurlencode($msg) : false,
            ), admin_url('options-general.php')));
            exit;
        };

        $tmp = download_url($this->github_zip_url(), 30);
        if (is_wp_error($tmp)) $redirect('error', $tmp->get_error_message());

        $dest = trailingslashit(get_temp_dir()) . 'ccve-update-' . wp_rand();
        $unzip = unzip_file($tmp, $dest);
        @unlink($tmp);
        if (is_wp_error($unzip)) $redirect('error', $unzip->get_error_message());

        // Locate the plugin files inside the extracted archive (…/wordpress-plugin
        // or a folder that contains cookie-consent.php).
        $src = '';
        $top = @scandir($dest);
        if ($top) {
            foreach ($top as $entry) {
                if ($entry === '.' || $entry === '..') continue;
                $cand = $dest . '/' . $entry . '/wordpress-plugin';
                if ($wp_filesystem->is_dir($cand) && $wp_filesystem->exists($cand . '/cookie-consent.php')) { $src = $cand; break; }
                $cand2 = $dest . '/' . $entry;
                if ($wp_filesystem->exists($cand2 . '/cookie-consent.php')) { $src = $cand2; break; }
            }
        }
        if ($src === '') { $wp_filesystem->delete($dest, true); $redirect('error', 'Plugin files not found in the downloaded archive.'); }

        $copied = copy_dir($src, untrailingslashit(CC_PLUGIN_DIR));
        $wp_filesystem->delete($dest, true);
        if (is_wp_error($copied)) $redirect('error', $copied->get_error_message());

        // Read the new version from the updated header.
        $new_ver = '';
        if (function_exists('get_plugin_data')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
            $data = get_plugin_data(CC_PLUGIN_DIR . 'cookie-consent.php', false, false);
            $new_ver = isset($data['Version']) ? $data['Version'] : '';
        }
        $redirect('success', $new_ver !== '' ? ('Updated to ' . $new_ver) : 'Updated from GitHub.');
    }

    /** Add the "Scan Cookies" button to the admin bar (front-end, admins). */
    public function admin_bar_node($bar) {
        if (!current_user_can('manage_options') || is_admin()) return;
        $bar->add_node(array(
            'id' => 'cc-scan',
            'title' => '🍪 ' . __('Scan Cookies', 'cookie-consent'),
            'href' => '#',
            'meta' => array('title' => __('Cookie Consent VE — scan this page for cookies', 'cookie-consent')),
        ));
    }

    /** JS that powers the admin-bar scan: read this page's cookies, send to AJAX. */
    public function admin_bar_scan_script() {
        if (!current_user_can('manage_options') || !is_admin_bar_showing() || is_admin()) return;
        $nonce = wp_create_nonce('cc_scan_clientside');
        $ajax = admin_url('admin-ajax.php');
        $settings_url = admin_url('options-general.php?page=cookie-consent');
        ?>
        <script data-no-optimize="1" data-no-defer="1">
        (function(){
            var link = document.querySelector('#wp-admin-bar-cc-scan a');
            if (!link) return;
            link.addEventListener('click', function(e){
                e.preventDefault();
                // Read all JS-accessible cookies currently on this page.
                var names = (document.cookie || '').split(';').map(function(c){ return c.split('=')[0].trim(); }).filter(Boolean);
                if (!names.length) { alert(<?php echo wp_json_encode(__('No cookies found on this page. Accept cookies first, then scan again.', 'cookie-consent')); ?>); return; }
                var body = 'action=cc_scan_clientside&nonce=<?php echo esc_js($nonce); ?>';
                names.forEach(function(n){ body += '&cookies[]=' + encodeURIComponent(n); });
                fetch(<?php echo wp_json_encode($ajax); ?>, {
                    method:'POST', credentials:'same-origin',
                    headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:body
                }).then(function(r){ return r.json(); }).then(function(res){
                    if (res && res.success) {
                        if (confirm(res.data.count + ' ' + <?php echo wp_json_encode(__('cookie(s) saved. Open settings to review?', 'cookie-consent')); ?>)) {
                            window.location.href = <?php echo wp_json_encode($settings_url); ?>;
                        }
                    } else {
                        alert(<?php echo wp_json_encode(__('Scan failed.', 'cookie-consent')); ?>);
                    }
                }).catch(function(){ alert(<?php echo wp_json_encode(__('Scan failed (network).', 'cookie-consent')); ?>); });
            });
        })();
        </script>
        <?php
    }

    /** Describe a cookie name: [category, purpose, duration]. */
    public function describe_cookie($name) {
        $map = array(
            '/^_ga$/' => array('analytics', 'Google Analytics – distinguishes unique visitors.', '2 years'),
            '/^_ga_/' => array('analytics', 'Google Analytics 4 – persists the session state.', '2 years'),
            '/^_gid$/' => array('analytics', 'Google Analytics – distinguishes unique visitors.', '24 hours'),
            '/^_gat/' => array('analytics', 'Google Analytics – throttles the request rate.', '1 minute'),
            '/^__utm/' => array('analytics', 'Universal Analytics – visitor/session data.', 'up to 2 years'),
            '/^_dc_gtm/' => array('analytics', 'Google Tag Manager – throttles request rate.', '1 minute'),
            '/^trafic/' => array('analytics', 'Site traffic monitoring / visit statistics.', 'varies'),
            '/^_gcl/' => array('marketing', 'Google Ads – stores ad-click conversion info.', '90 days'),
            '/^_fbp/' => array('marketing', 'Meta (Facebook) Pixel – identifies browsers for ad delivery.', '90 days'),
            '/^fr$/' => array('marketing', 'Meta (Facebook) – ad delivery and measurement.', '90 days'),
            '/^_scid/' => array('marketing', 'Advertising – campaign/click attribution.', 'varies'),
            '/^li_/' => array('marketing', 'LinkedIn – ad targeting and tracking.', 'varies'),
            '/^_hj/' => array('analytics', 'Hotjar – behaviour analytics.', 'varies'),
            '/^_clck|^_clsk/' => array('analytics', 'Microsoft Clarity – session analytics.', '1 year'),
            '/^hubspotutk/' => array('marketing', 'HubSpot – visitor identity for marketing.', '6 months'),
        );
        foreach ($map as $re => $info) {
            if (preg_match($re, $name)) return $info;
        }
        $ccname = isset($this->settings['cookie_name']) ? $this->settings['cookie_name'] : 'cc_cookie';
        if ($name === $ccname) return array('necessary', 'Stores your cookie consent choices.', '1 year');
        return array($this->guess_category($name), 'Detected on the website.', '');
    }

    /** AJAX: save the cookies the admin-bar scanner read from the page. */
    public function ajax_scan_clientside() {
        if (!current_user_can('manage_options')) wp_send_json_error();
        check_ajax_referer('cc_scan_clientside', 'nonce');

        $names = isset($_POST['cookies']) ? (array) $_POST['cookies'] : array();
        $existing = (isset($this->settings['cookies']) && is_array($this->settings['cookies'])) ? $this->settings['cookies'] : array();
        $by_name = array();
        foreach ($existing as $c) { if (!empty($c['name'])) $by_name[$c['name']] = $c; }

        $added = 0;
        foreach ($names as $raw) {
            $name = sanitize_text_field(wp_unslash($raw));
            if ($name === '' || isset($by_name[$name]) || $this->is_ignored_cookie($name)) continue;
            list($cat, $purpose, $duration) = $this->describe_cookie($name);
            $by_name[$name] = array('name' => $name, 'category' => $cat, 'purpose' => $purpose, 'duration' => $duration, 'source' => 'browser');
            $added++;
        }
        $this->settings['cookies'] = array_values($by_name);
        update_option('cc_settings', $this->settings);
        wp_send_json_success(array('count' => count($names), 'added' => $added));
    }

    public function get_default_settings() {
        return array(
            'auto_show' => 'yes',
            'position' => 'bottom-right',
            'theme' => 'light',
            'cookie_name' => 'cc_cookie',
            'cookie_expiry' => 365,
            'reload_on_change' => 'yes',
            'language' => 'en',
            'cookies' => array(), // discovered/declared cookies: [{name,category,purpose,duration,source}]
            'text' => array(
                'en' => $this->default_text('en'),
                'ro' => $this->default_text('ro')
            ),
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
    
    /**
     * Add a "Settings" link to this plugin's row on the Plugins page.
     */
    public function add_action_links($links) {
        $settings_link = '<a href="' . esc_url(admin_url('options-general.php?page=cookie-consent')) . '">' . __('Settings', 'cookie-consent') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
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

        // Display language
        $langs = array_keys($this->languages());
        $sanitized['language'] = (isset($input['language']) && in_array($input['language'], $langs, true))
            ? $input['language'] : 'en';

        // Banner / modal text — stored per language (en, ro)
        $sanitized['text'] = array();
        foreach ($langs as $lng) {
            $defs = $this->default_text($lng);
            $in = (isset($input['text'][$lng]) && is_array($input['text'][$lng])) ? $input['text'][$lng] : array();
            $sanitized['text'][$lng] = array();
            foreach ($defs as $key => $default) {
                if (isset($in[$key]) && $in[$key] !== '') {
                    $sanitized['text'][$lng][$key] = ($key === 'description')
                        ? sanitize_textarea_field($in[$key])
                        : sanitize_text_field($in[$key]);
                } else {
                    $sanitized['text'][$lng][$key] = $default;
                }
            }
        }

        // Scanned/declared cookies (from the "Scan Cookies" table). A row with
        // its "remove" box ticked, or with an empty name, is dropped.
        $valid_cats = array('necessary', 'analytics', 'marketing');
        $sanitized['cookies'] = array();
        if (isset($input['cookies']) && is_array($input['cookies'])) {
            foreach ($input['cookies'] as $row) {
                if (!is_array($row) || !empty($row['remove'])) continue;
                $name = isset($row['name']) ? sanitize_text_field($row['name']) : '';
                if ($name === '') continue;
                $cat = (isset($row['category']) && in_array($row['category'], $valid_cats, true)) ? $row['category'] : 'necessary';
                $sanitized['cookies'][] = array(
                    'name' => $name,
                    'category' => $cat,
                    'purpose' => isset($row['purpose']) ? sanitize_text_field($row['purpose']) : '',
                    'duration' => isset($row['duration']) ? sanitize_text_field($row['duration']) : '',
                    'source' => isset($row['source']) ? sanitize_text_field($row['source']) : 'manual',
                );
            }
        }

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
        <script data-no-optimize="1" data-no-defer="1" data-cfasync="false">
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
                var analyticsPatterns = [/^_ga/, /^_gid/, /^_gat/, /^__utm/, /^_uet/, /^_dc_gtm/, /^_gac_/, /^_gtm/, /^analytics/, /^ga_/, /^gid_/, /^collect$/, /^_gat_gtag/, /^_ga_/, /^AMP_TOKEN/, /^_vwo/, /^_gat_/, /^_gcl/, /^_uetsid/, /^_uetvid/, /^trafic_mon/];
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
                    /^collect$/, /^_gat_gtag/, /^_ga_/, /^AMP_TOKEN/, /^_vwo/, /^trafic_mon/
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
                            // Read from the cookie we just set if it's cc_cookie, otherwise read from document.cookie
                            if (cookieName === 'cc_cookie') {
                                var cookieValue = value.split('=')[1].split(';')[0];
                                currentPreferences = JSON.parse(decodeURIComponent(cookieValue));
                            } else {
                                var cookies = document.cookie.split('; ');
                                for (var prefIdx = 0; prefIdx < cookies.length; prefIdx++) {
                                    var parts = cookies[prefIdx].split('=');
                                    if (parts[0].trim() === 'cc_cookie') {
                                        currentPreferences = JSON.parse(decodeURIComponent(parts[1]));
                                        break;
                                    }
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

    /**
     * Keep optimization/cache plugins (LiteSpeed, WP Rocket, Autoptimize, etc.)
     * from deferring, delaying, combining or minifying the consent script.
     * It must run early and intact to block cookies and render the banner;
     * deferring it breaks that. The data-* attributes are the exclusion markers
     * those plugins honour.
     */
    public function exclude_from_optimization($tag, $handle, $src) {
        if ($handle !== 'cookie-consent') {
            return $tag;
        }
        if (strpos($tag, 'data-no-optimize') === false) {
            $tag = str_replace('<script ', '<script data-no-optimize="1" data-no-defer="1" data-cfasync="false" ', $tag);
        }
        return $tag;
    }

    public function output_config() {
        ?>
        <script data-no-optimize="1" data-no-defer="1" data-cfasync="false">
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

        // Stored (scanned) cookies grouped by category — the only source the
        // front-end modal uses. No live scanning happens on the website.
        $cookies = array('necessary' => array(), 'analytics' => array(), 'marketing' => array());
        if (!empty($this->settings['cookies']) && is_array($this->settings['cookies'])) {
            foreach ($this->settings['cookies'] as $c) {
                if (empty($c['name']) || $this->is_ignored_cookie($c['name'])) continue;
                $cat = (isset($c['category']) && isset($cookies[$c['category']])) ? $c['category'] : 'necessary';
                $cookies[$cat][] = array(
                    'name' => $c['name'],
                    'description' => isset($c['purpose']) ? $c['purpose'] : '',
                    'duration' => isset($c['duration']) ? $c['duration'] : ''
                );
            }
        }

        return array(
            'categories' => $categories,
            'position' => $this->settings['position'],
            'theme' => $this->settings['theme'],
            'autoShow' => $this->settings['auto_show'] === 'yes',
            'cookieName' => $this->settings['cookie_name'],
            'cookieExpiry' => intval($this->settings['cookie_expiry']),
            'reloadOnChange' => $this->settings['reload_on_change'] === 'yes',
            'cookies' => $cookies,
            'text' => $this->get_text()
        );
    }

    /** Currently selected display language ('en' or 'ro'). */
    public function current_language() {
        $langs = array_keys($this->languages());
        $lang = isset($this->settings['language']) ? $this->settings['language'] : 'en';
        return in_array($lang, $langs, true) ? $lang : 'en';
    }

    /**
     * Resolved banner/modal text for the selected language, merged with the
     * built-in defaults so every key is present. Handles legacy flat 'text'
     * (pre-multilingual saves) by treating it as English overrides.
     */
    public function get_text() {
        $lang = $this->current_language();
        $defaults = $this->default_text($lang);
        $saved = array();
        if (isset($this->settings['text']) && is_array($this->settings['text'])) {
            if (isset($this->settings['text'][$lang]) && is_array($this->settings['text'][$lang])) {
                $saved = $this->settings['text'][$lang];
            } elseif ($lang === 'en' && isset($this->settings['text']['title'])) {
                // Legacy flat text from an older version.
                $saved = $this->settings['text'];
            }
        }
        return wp_parse_args($saved, $defaults);
    }

    /** Saved (or default) text for one language, for the admin form. */
    public function text_for($lang) {
        $defaults = $this->default_text($lang);
        $saved = (isset($this->settings['text'][$lang]) && is_array($this->settings['text'][$lang]))
            ? $this->settings['text'][$lang] : array();
        return wp_parse_args($saved, $defaults);
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

            <?php
            if (isset($_GET['cc_scan_error']) && $_GET['cc_scan_error'] !== '') {
                echo '<div class="notice notice-error"><p>' . esc_html__('Scan failed:', 'cookie-consent') . ' ' . esc_html(rawurldecode($_GET['cc_scan_error'])) . '</p></div>';
            } elseif (isset($_GET['cc_scanned'])) {
                echo '<div class="notice notice-success"><p>' . sprintf(esc_html__('Scan complete — %d cookie(s) found. Review and Save Changes below.', 'cookie-consent'), intval($_GET['cc_scanned'])) . '</p></div>';
            }
            if (isset($_GET['cc_update'])) {
                $msg = isset($_GET['cc_update_msg']) ? rawurldecode($_GET['cc_update_msg']) : '';
                $cls = $_GET['cc_update'] === 'success' ? 'notice-success' : 'notice-error';
                echo '<div class="notice ' . $cls . '"><p>' . esc_html($msg !== '' ? $msg : ($_GET['cc_update'] === 'success' ? 'Updated from GitHub.' : 'Update failed.')) . '</p></div>';
            }
            ?>

            <div style="margin:16px 0;">
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                    <input type="hidden" name="action" value="cc_scan_cookies">
                    <?php wp_nonce_field('cc_scan_cookies'); ?>
                    <?php submit_button(__('Scan Cookies', 'cookie-consent'), 'secondary', 'cc_scan_submit', false); ?>
                </form>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;margin-left:8px;" onsubmit="return confirm('<?php echo esc_js(__('Download the latest version from GitHub and overwrite the plugin files?', 'cookie-consent')); ?>');">
                    <input type="hidden" name="action" value="cc_update_github">
                    <?php wp_nonce_field('cc_update_github'); ?>
                    <?php submit_button(__('Update from GitHub', 'cookie-consent'), 'secondary', 'cc_update_submit', false); ?>
                </form>
                <p class="description" style="margin-top:6px;">
                    <?php _e('“Scan Cookies” lists cookies found on your homepage below. “Update from GitHub” pulls the latest plugin version.', 'cookie-consent'); ?>
                    <?php echo ' ' . esc_html(sprintf(__('Current version: %s', 'cookie-consent'), CC_VERSION)); ?>
                </p>
            </div>

            <form method="post" action="options.php">
                <?php settings_fields('cc_settings_group'); ?>

                <h2><?php _e('Scanned Cookies', 'cookie-consent'); ?></h2>
                <p><?php _e('Cookies found by "Scan Cookies" above (or added manually). This is exactly what the preferences modal lists — the website does no live scanning. Edit the category/purpose/duration, tick Remove to delete, then Save Changes.', 'cookie-consent'); ?></p>
                <?php $scanned = (isset($this->settings['cookies']) && is_array($this->settings['cookies'])) ? $this->settings['cookies'] : array(); ?>
                <table class="widefat striped" style="max-width:1000px;margin-bottom:20px;">
                    <thead><tr>
                        <th><?php _e('Cookie', 'cookie-consent'); ?></th>
                        <th><?php _e('Category', 'cookie-consent'); ?></th>
                        <th><?php _e('Purpose', 'cookie-consent'); ?></th>
                        <th><?php _e('Duration', 'cookie-consent'); ?></th>
                        <th><?php _e('Source', 'cookie-consent'); ?></th>
                        <th><?php _e('Remove', 'cookie-consent'); ?></th>
                    </tr></thead>
                    <tbody>
                    <?php
                    // Render saved rows, then 3 blank rows for manual additions.
                    $rows = $scanned;
                    for ($b = 0; $b < 3; $b++) { $rows[] = array('name' => '', 'category' => 'necessary', 'purpose' => '', 'duration' => '', 'source' => 'manual'); }
                    foreach ($rows as $i => $c):
                    ?>
                        <tr>
                            <td><input type="text" name="cc_settings[cookies][<?php echo $i; ?>][name]" value="<?php echo esc_attr($c['name']); ?>" placeholder="<?php esc_attr_e('cookie name', 'cookie-consent'); ?>" style="width:160px;"><input type="hidden" name="cc_settings[cookies][<?php echo $i; ?>][source]" value="<?php echo esc_attr(isset($c['source'])?$c['source']:'manual'); ?>"></td>
                            <td>
                                <select name="cc_settings[cookies][<?php echo $i; ?>][category]">
                                    <?php foreach (array('necessary','analytics','marketing') as $cat): ?>
                                        <option value="<?php echo $cat; ?>" <?php selected(isset($c['category'])?$c['category']:'necessary', $cat); ?>><?php echo esc_html(ucfirst($cat)); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                            <td><input type="text" class="regular-text" name="cc_settings[cookies][<?php echo $i; ?>][purpose]" value="<?php echo esc_attr(isset($c['purpose'])?$c['purpose']:''); ?>"></td>
                            <td><input type="text" name="cc_settings[cookies][<?php echo $i; ?>][duration]" value="<?php echo esc_attr(isset($c['duration'])?$c['duration']:''); ?>" style="width:110px;"></td>
                            <td><?php echo esc_html(isset($c['source'])?$c['source']:'manual'); ?></td>
                            <td style="text-align:center;"><input type="checkbox" name="cc_settings[cookies][<?php echo $i; ?>][remove]" value="1"></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <p class="description"><?php _e('Tip: JavaScript-set cookies (e.g. a custom traffic counter) can\'t be seen by a server scan — add them in the blank rows above.', 'cookie-consent'); ?></p>
                
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

                <h2><?php _e('Display Language', 'cookie-consent'); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Banner Language', 'cookie-consent'); ?></th>
                        <td>
                            <select name="cc_settings[language]">
                                <?php foreach ($this->languages() as $lang_code => $lang_label): ?>
                                    <option value="<?php echo esc_attr($lang_code); ?>" <?php selected($this->current_language(), $lang_code); ?>><?php echo esc_html($lang_label); ?></option>
                                <?php endforeach; ?>
                            </select>
                            <p class="description"><?php _e('Language used for the banner and preferences modal on the website.', 'cookie-consent'); ?></p>
                        </td>
                    </tr>
                </table>

                <h2><?php _e('Banner Text', 'cookie-consent'); ?></h2>
                <?php
                $cur_lang = $this->current_language();
                $cur_label = $this->languages()[$cur_lang];
                ?>
                <p><?php printf(esc_html__('Text for the selected language: %s. Change "Banner Language" above and Save to edit the other language.', 'cookie-consent'), '<strong>' . esc_html($cur_label) . '</strong>'); ?></p>
                <?php
                $text_labels = array(
                    'title' => __('Banner Title', 'cookie-consent'),
                    'description' => __('Banner Description', 'cookie-consent'),
                    'acceptAll' => __('"Accept All" Button', 'cookie-consent'),
                    'rejectAll' => __('"Reject All" Button', 'cookie-consent'),
                    'settings' => __('"Settings" Button', 'cookie-consent'),
                    'modalTitle' => __('Preferences Modal Title', 'cookie-consent'),
                    'save' => __('"Save Preferences" Button', 'cookie-consent'),
                    'cancel' => __('"Cancel" Button', 'cookie-consent'),
                    'tableCookie' => __('Column: Cookie', 'cookie-consent'),
                    'tablePurpose' => __('Column: Purpose', 'cookie-consent'),
                    'tableDuration' => __('Column: Duration', 'cookie-consent'),
                    'tableStatus' => __('Column: Status', 'cookie-consent'),
                    'statusStored' => __('Status: stored now', 'cookie-consent'),
                    'statusIfAccepted' => __('Status: blocked until accept', 'cookie-consent'),
                    'noCookies' => __('"No cookies" message', 'cookie-consent'),
                );
                $lt = $this->text_for($cur_lang);
                ?>
                <table class="form-table">
                    <?php foreach ($text_labels as $tk => $tlabel): ?>
                    <tr>
                        <th scope="row"><?php echo esc_html($tlabel); ?></th>
                        <td>
                            <?php if ($tk === 'description'): ?>
                                <textarea class="large-text" rows="3" name="cc_settings[text][<?php echo esc_attr($cur_lang); ?>][<?php echo esc_attr($tk); ?>]"><?php echo esc_textarea($lt[$tk]); ?></textarea>
                            <?php else: ?>
                                <input type="text" class="regular-text" name="cc_settings[text][<?php echo esc_attr($cur_lang); ?>][<?php echo esc_attr($tk); ?>]" value="<?php echo esc_attr($lt[$tk]); ?>">
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
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
