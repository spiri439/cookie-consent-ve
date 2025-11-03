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
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_footer', array($this, 'output_config'));
        add_shortcode('cc_settings', array($this, 'shortcode_settings_link'));
        
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
            function initCookieConsent() {
                if (typeof CookieConsent !== 'undefined') {
                    CookieConsent.init(<?php echo json_encode($this->get_js_config()); ?>);
                } else {
                    // Retry if script not loaded yet
                    setTimeout(initCookieConsent, 50);
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
            'cookieExpiry' => intval($this->settings['cookie_expiry']),
            'reloadOnChange' => $this->settings['reload_on_change'] === 'yes'
        );
    }
    
    public function shortcode_settings_link($atts) {
        $atts = shortcode_atts(array(
            'text' => 'Cookie Settings',
            'class' => 'cc-settings-link'
        ), $atts);
        
        return '<a href="#" class="' . esc_attr($atts['class']) . '" onclick="event.preventDefault(); CookieConsent.showPreferences();">' . 
               esc_html($atts['text']) . '</a>';
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
                <p><?php _e('To add a cookie settings link in your content, use the shortcode:', 'cookie-consent'); ?></p>
                <code>[cc_settings text="Cookie Settings"]</code>
                
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

// Initialize plugin
new CookieConsent_Plugin();
