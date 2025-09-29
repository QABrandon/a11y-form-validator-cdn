"use strict";

// ============================================================================
// EXTENSION INITIALIZATION
// v1.0.0 - CDN-ready form validation with custom messaging
// ============================================================================

console.log('🚀 A11y Form Validator Extension Loading... v1.0.0');

// Global variables
let isWebflowDesigner = false;
let currentExtensionSize = 'large';
let currentSelectedElement = null;
let siteInfo = null;
let userCapabilities = null;
let validationStates = new Map();
let scannedForms = [];
let isInitialized = false;
let globalProcessedFields = new Set(); // Track all processed fields across all forms to prevent duplication

// Notification deduplication system
let sentNotifications = new Set(); // Track sent notifications to prevent duplicates
const NOTIFICATION_COOLDOWN = 2000; // 2 second cooldown between identical notifications

// Plan limits caching system
let planLimitsCache = null;
let planLimitsCacheExpiry = 0;
const PLAN_LIMITS_CACHE_DURATION = 30000; // 30 seconds cache

// Version-aware persistence system
const EXTENSION_VERSION = '1.0.0';
const PERSISTENCE_VERSION_KEY = 'a11yValidatorPersistenceVersion';
const VALIDATION_DATA_KEY = 'a11yValidatorValidationData';

// ============================================================================
// MAIN INITIALIZATION FUNCTION
// ============================================================================

/**
 * Main initialization function - called when everything is ready
 */
async function initializeExtension() {
    if (isInitialized) {
        console.log('⚠️ Extension already initialized, skipping...');
        return;
    }
    
    // Set flag immediately to prevent duplicate initialization
    isInitialized = true;
    
    console.log('✅ Initializing A11y Form Validator Extension');
    
    try {
        // Check if we're in Webflow Designer context
        isWebflowDesigner = typeof webflow !== 'undefined';
        console.log(`🔌 Webflow Designer context: ${isWebflowDesigner}`);
        
        if (isWebflowDesigner) {
            await setupWebflowIntegration();
        } else {
            console.log('⚠️ Not in Webflow Designer context - running in preview mode');
            updateStatus('Preview mode - Interface loaded successfully', 'success');
        }
        
        // Initialize core functionality
        await initializePersistenceSystem();
        setupEventListeners();
        initializeAdvancedUI();
        initializeContentProtection();
        removeInlineStyles();
        setupStyleObserver();
        
        // Set initial layout based on current extension size
        updateResponsiveLayout(currentExtensionSize);
        
        safeConsoleLog('✅ Extension initialized successfully');
        showSuccessNotification('A11y Form Validator Extension is ready!');
        
    } catch (error) {
        // Reset initialization flag on error so fallback can try again
        isInitialized = false;
        
        const sanitizedError = typeof sanitizeErrorMessage === 'function' 
            ? sanitizeErrorMessage(error) 
            : error.toString();
        safeConsoleLog('❌ Failed to initialize extension:', sanitizedError);
        updateStatus('Failed to initialize extension', 'error');
        showErrorNotification('Failed to initialize extension');
    }
}

// ============================================================================
// INITIALIZATION TRIGGERS
// ============================================================================

/**
 * Wait for DOM and Webflow API to be ready
 */
function waitForInitialization() {
    console.log('📄 Waiting for initialization...');
    
    // Check if DOM is already ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 DOM Content Loaded');
            waitForWebflowAPI();
        });
    } else {
        console.log('📄 DOM already ready');
        waitForWebflowAPI();
    }
}

/**
 * Wait for Webflow API to be available
 */
function waitForWebflowAPI() {
    console.log('🔌 Checking for Webflow API...');
    
    // Check if we're in Webflow Designer context
    if (typeof webflow !== 'undefined') {
        console.log('🔌 Webflow API detected, waiting for ready event...');
        
        // Wait for webflow.ready() if available
        if (typeof webflow.ready === 'function') {
            webflow.ready().then(() => {
                console.log('✅ Webflow API ready');
                initializeExtension();
            }).catch(error => {
                console.error('❌ Webflow API ready failed:', error);
                // Fallback: initialize anyway
                initializeExtension();
            });
        } else {
            console.log('⚠️ webflow.ready() not available, initializing directly');
            initializeExtension();
        }
    } else {
        console.log('⚠️ Not in Webflow Designer context, initializing directly');
        initializeExtension();
    }
    
    // Additional check for Webflow API availability with timeout
    let webflowCheckCount = 0;
    const maxWebflowChecks = 10; // Check for 5 seconds (10 * 500ms)
    
    const checkWebflowAPI = () => {
        if (typeof webflow !== 'undefined') {
            console.log('🔌 Webflow API detected during polling');
            initializeExtension();
            return;
        }
        
        webflowCheckCount++;
        if (webflowCheckCount < maxWebflowChecks) {
            setTimeout(checkWebflowAPI, 500);
        } else {
            console.log('⚠️ Webflow API not detected after timeout, initializing in preview mode');
            initializeExtension();
        }
    };
    
    // Start polling for Webflow API
    setTimeout(checkWebflowAPI, 500);
}

// ============================================================================
// START INITIALIZATION
// ============================================================================

// Start the initialization process
waitForInitialization();

// Fallback initialization - ensure extension loads even if main initialization fails
setTimeout(() => {
    if (!isInitialized) {
        console.log('⚠️ Fallback initialization triggered');
        initializeExtension().catch(error => {
            console.error('❌ Fallback initialization failed:', error);
            // Show basic interface even if initialization fails
            updateStatus('Extension loaded with limited functionality', 'warning');
        });
    }
}, 5000); // 5 second fallback (increased to reduce conflicts)

// ============================================================================
// VERSION-AWARE PERSISTENCE SYSTEM
// ============================================================================

/**
 * Initialize the persistence system with version checking
 */
async function initializePersistenceSystem() {
    try {
        console.log('🔄 Initializing version-aware persistence system...');
        
        // Check if this is a version update
        const storedVersion = localStorage.getItem(PERSISTENCE_VERSION_KEY);
        const isVersionUpdate = storedVersion && storedVersion !== EXTENSION_VERSION;
        
        if (isVersionUpdate) {
            console.log(`🔄 Version update detected: ${storedVersion} → ${EXTENSION_VERSION}`);
            await handleVersionUpdate(storedVersion, EXTENSION_VERSION);
        } else if (!storedVersion) {
            console.log('🆕 First-time initialization');
        }
        
        // Update stored version
        localStorage.setItem(PERSISTENCE_VERSION_KEY, EXTENSION_VERSION);
        
        // Initialize validation data structure
        await initializeValidationData();
        
        // Sync validation data on initialization
        await syncValidationData();
        
        // Update UI with dynamic plan limits
        await updatePlanLimitsInUI();
        
        console.log('✅ Persistence system initialized');
    } catch (error) {
        console.error('❌ Failed to initialize persistence system:', error);
    }
}

/**
 * Handle version updates with data migration
 */
async function handleVersionUpdate(oldVersion, newVersion) {
    try {
        console.log(`🔄 Migrating data from ${oldVersion} to ${newVersion}`);
        
        // Get existing validation data
        const existingData = getStoredValidationData();
        
        // Perform version-specific migrations
        const migratedData = await migrateValidationData(existingData, oldVersion, newVersion);
        
        // Store migrated data
        setStoredValidationData(migratedData);
        
        console.log('✅ Data migration completed');
    } catch (error) {
        console.error('❌ Data migration failed:', error);
        // Continue with fresh data if migration fails
        await initializeValidationData();
    }
}

/**
 * Migrate validation data between versions
 */
async function migrateValidationData(data, oldVersion, newVersion) {
    const migratedData = { ...data };
    
    // Version-specific migration rules
    const migrationRules = {
        '1.2.80': () => {
            // Add new fields for v1.2.80+
            migratedData.version = newVersion;
            migratedData.migratedAt = new Date().toISOString();
            return migratedData;
        },
        '1.2.81': () => {
            // Add validation metadata
            migratedData.validationMetadata = migratedData.validationMetadata || {};
            migratedData.validationMetadata.lastValidated = new Date().toISOString();
            return migratedData;
        },
        '1.2.82': () => {
            // Add form tracking improvements
            migratedData.formTracking = migratedData.formTracking || {};
            migratedData.formTracking.enabled = true;
            return migratedData;
        },
        '1.2.83': () => {
            // Add count synchronization
            migratedData.countSync = migratedData.countSync || {};
            migratedData.countSync.lastSync = new Date().toISOString();
            migratedData.countSync.autoUpdate = true;
            return migratedData;
        }
    };
    
    // Apply migration rules
    for (const [version, migration] of Object.entries(migrationRules)) {
        if (isVersionNewer(version, oldVersion)) {
            console.log(`🔄 Applying migration for version ${version}`);
            Object.assign(migratedData, migration());
        }
    }
    
    return migratedData;
}

/**
 * Initialize validation data structure
 */
async function initializeValidationData() {
    const existingData = getStoredValidationData();
    
    if (!existingData || !existingData.version) {
        const initialData = {
            version: EXTENSION_VERSION,
            initializedAt: new Date().toISOString(),
            validationStates: {},
            formCounts: {},
            lastSync: new Date().toISOString(),
            autoUpdate: true
        };
        
        setStoredValidationData(initialData);
        console.log('🆕 Initialized validation data structure');
    }
}

/**
 * Get stored validation data
 */
function getStoredValidationData() {
    try {
        const data = localStorage.getItem(VALIDATION_DATA_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.warn('⚠️ Failed to parse stored validation data:', error);
        return null;
    }
}

/**
 * Set stored validation data
 */
function setStoredValidationData(data) {
    try {
        localStorage.setItem(VALIDATION_DATA_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('❌ Failed to store validation data:', error);
    }
}

/**
 * Update validation count with persistence
 */
async function updateValidationCountWithPersistence(newCount) {
    try {
        // Update database/extension settings
        await updateTotalValidatedForms(newCount);
        
        // Update local persistence
        const data = getStoredValidationData();
        if (data) {
            data.formCounts = data.formCounts || {};
            data.formCounts.current = newCount;
            data.formCounts.lastUpdated = new Date().toISOString();
            data.lastSync = new Date().toISOString();
            setStoredValidationData(data);
        }
        
        console.log(`📊 Updated validation count to ${newCount} with persistence`);
    } catch (error) {
        console.error('❌ Failed to update validation count with persistence:', error);
    }
}

/**
 * Sync validation data across all sources
 */
async function syncValidationData() {
    try {
        console.log('🔄 Syncing validation data...');
        
        // Get current count from database
        const dbCount = await getTotalValidatedForms();
        
        // Get stored count
        const data = getStoredValidationData();
        const storedCount = data?.formCounts?.current || 0;
        
        // Use database count as source of truth, but update stored count to match
        // This ensures removals are properly reflected
        const syncedCount = dbCount;
        
        // Always update stored count to match database
        if (storedCount !== dbCount) {
            await updateValidationCountWithPersistence(syncedCount);
        }
        
        // Update display
        await displayValidatedFormsCount();
        
        console.log('✅ Validation data synced');
    } catch (error) {
        console.error('❌ Failed to sync validation data:', error);
    }
}

/**
 * Check if version is newer
 */
function isVersionNewer(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;
        
        if (v1Part > v2Part) return true;
        if (v1Part < v2Part) return false;
    }
    
    return false;
}

/**
 * Update UI elements with dynamic plan limits
 */
async function updatePlanLimitsInUI() {
    try {
        const planLimits = await getCurrentPlanLimits();
        const maxForms = planLimits.limits.max_forms;
        const maxFields = planLimits.limits.max_required_fields_per_form;
        
        // Update HTML elements
        const formsLimitElement = document.getElementById('starter-forms-limit');
        if (formsLimitElement) {
            formsLimitElement.textContent = maxForms;
        }
        
        const fieldsLimitElement = document.getElementById('starter-fields-limit');
        if (fieldsLimitElement) {
            fieldsLimitElement.textContent = maxFields;
        }
        
        console.log(`📊 Updated UI with plan limits: ${maxForms} forms, ${maxFields} fields`);
    } catch (error) {
        console.warn('⚠️ Failed to update plan limits in UI:', error);
    }
}

// ============================================================================
// WEBFLOW DATA API INTEGRATION
// ============================================================================

/**
 * Initialize Webflow Data API integration
 */
async function initializeWebflowDataAPI() {
    try {
        console.log('🔌 Initializing Webflow Data API integration...');
        
        // Check if we're in the Webflow Designer
        if (typeof webflow !== 'undefined') {
            console.log('✅ Webflow API detected');
            
            // Note: webflow.getUserInfo() is not available in the current API
            // We'll use extension settings for plan management instead
            console.log('📋 Using extension settings for plan management');
            
            // Initialize plan detection from settings
            await initializeUserPlan();
        } else {
            console.log('⚠️ Not in Webflow Designer context');
        }
    } catch (error) {
        console.error('❌ Error initializing Webflow Data API:', error);
    }
}

/**
 * Detect user plan from Webflow subscription
 */
async function detectUserPlanFromWebflow() {
    try {
        console.log('🔍 Detecting user plan from Webflow...');
        
        // Note: webflow.getWorkspaces() and getWorkspaceSubscription() are not available
        // We'll use extension settings for plan management instead
        console.log('📋 Using extension settings for plan management');
        
        // Return default plan - users can upgrade through the extension interface
        planSource = 'extension_settings';
        return 'STARTER';
    } catch (error) {
        console.warn('❌ Could not detect plan from Webflow:', error);
        return 'STARTER';
    }
}

/**
 * Map Webflow plans to extension plans
 */
function mapWebflowPlanToExtensionPlan(webflowPlan) {
    const planMapping = {
        'free': 'STARTER',
        'basic': 'STARTER',
        'cms': 'PRO',
        'business': 'PRO',
        'agency': 'AGENCY'
    };
    
    return planMapping[webflowPlan.toLowerCase()] || 'STARTER';
}

/**
 * Save plan to local storage (fallback since extension settings not available)
 */
async function savePlanToExtensionSettings(plan) {
    try {
        // Use localStorage as fallback since webflow.getExtensionSettings is not available
        const planData = {
            a11yValidatorPlan: plan,
            lastUpdated: new Date().toISOString(),
            planSource: planSource
        };
        
        localStorage.setItem('a11yValidatorPlan', JSON.stringify(planData));
        console.log('💾 Plan saved to local storage:', plan);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to save plan to local storage:', error);
        return false;
    }
}

/**
 * Get plan from local storage (fallback since extension settings not available)
 */
async function getPlanFromExtensionSettings() {
    try {
        const planData = localStorage.getItem('a11yValidatorPlan');
        if (planData) {
            const parsed = JSON.parse(planData);
            return parsed.a11yValidatorPlan || 'STARTER';
        }
        return 'STARTER';
    } catch (error) {
        console.warn('❌ Could not get plan from local storage:', error);
        return 'STARTER';
    }
}

/**
 * Initialize user plan detection and storage
 */
async function initializeUserPlan() {
    console.log('🔍 Initializing user plan detection...');
    
    // Enforce Starter plan for MVP
    if (PLAN_ENFORCEMENT_ACTIVE) {
        console.log('🔒 Plan enforcement active - locked to Starter plan');
        currentPlan = 'STARTER';
        updateInterfaceForPlan();
        console.log('✅ User plan initialized (enforced):', currentPlan);
        return currentPlan;
    }
    
    // Step 1: Try to get plan from extension settings first
    let detectedPlan = await getPlanFromExtensionSettings();
    console.log('📋 Plan from extension settings:', detectedPlan);
    
    // Step 2: If no stored plan, detect from Webflow
    if (detectedPlan === 'STARTER') {
        const webflowPlan = await detectUserPlanFromWebflow();
        console.log('📋 Plan detected from Webflow:', webflowPlan);
        
        // Step 3: Save detected plan to extension settings
        if (webflowPlan !== 'STARTER') {
            await savePlanToExtensionSettings(webflowPlan);
            detectedPlan = webflowPlan;
        }
    }
    
    // Step 4: Update current plan and interface
    currentPlan = detectedPlan;
    updateInterfaceForPlan();
    
    console.log('✅ User plan initialized:', detectedPlan);
    return detectedPlan;
}

/**
 * Initialize hybrid authentication
 */
async function initializeHybridAuth() {
    try {
        console.log('🔐 Initializing hybrid authentication...');
        
        // Check if HybridAuthManager is available
        if (typeof window.HybridAuthManager === 'undefined') {
            console.warn('⚠️ HybridAuthManager not loaded, skipping hybrid auth initialization');
            return false;
        }
        
        // Initialize hybrid authentication
        const hybridAuth = new window.HybridAuthManager();
        const success = await hybridAuth.initialize();
        
        if (success) {
            console.log('🔐 Hybrid authentication initialized');
            // Store the auth manager instance for later use
            window.hybridAuthManager = hybridAuth;
        } else {
            console.warn('⚠️ Hybrid authentication failed to initialize');
            
            // Get detailed error information and show user-friendly message
            const errorDetails = hybridAuth.getLastOAuthError();
            if (errorDetails) {
                const userMessage = hybridAuth.getOAuthErrorMessage();
                console.error('🔐 OAuth Error Details:', errorDetails);
                
                // Show error notification to user
                showErrorNotification(userMessage);
                
                // Update status to indicate authentication is needed
                updateStatus('Authentication required for full functionality', 'warning');
            } else {
                console.warn('⚠️ No specific OAuth error details available');
                showWarningNotification('Authentication failed - extension running with limited functionality');
            }
        }
        
        return success;
    } catch (error) {
        console.error('❌ Error initializing hybrid authentication:', error);
        return false;
    }
}

/**
 * Retry OAuth authentication - can be called by user
 */
async function retryAuthentication() {
    try {
        console.log('🔄 Retrying OAuth authentication...');
        
        // Check if HybridAuthManager is available
        if (typeof window.HybridAuthManager === 'undefined') {
            showErrorNotification('Authentication system not available');
            return false;
        }
        
        // Clear previous errors
        if (window.hybridAuthManager) {
            window.hybridAuthManager.clearOAuthError();
        }
        
        // Initialize new authentication attempt
        const hybridAuth = new window.HybridAuthManager();
        const success = await hybridAuth.initialize();
        
        if (success) {
            console.log('✅ OAuth authentication successful');
            window.hybridAuthManager = hybridAuth;
            
            // Show success message
            showSuccessNotification('Authentication successful! Full functionality enabled.');
            updateStatus('Authentication successful - full functionality enabled', 'success');
            
            // Try to reinitialize database API
            if (siteInfo && window.databaseAPI) {
                try {
                    await window.databaseAPI.initialize(siteInfo);
                    console.log('✅ Database API reinitialized after authentication');
                    
                    // Initialize feature flag manager with database API
                    if (window.FeatureFlagManager) {
                        await window.FeatureFlagManager.initialize(window.databaseAPI);
                        console.log('✅ Feature Flag Manager initialized with database API');
                    }
                    
                    showSuccessNotification('Database connection established!');
                } catch (dbError) {
                    console.warn('⚠️ Database reinitialization failed:', dbError);
                    showWarningNotification('Authentication successful, but database connection failed');
                }
            }
            
            return true;
        } else {
            // Handle authentication failure
            const errorDetails = hybridAuth.getLastOAuthError();
            if (errorDetails) {
                const userMessage = hybridAuth.getOAuthErrorMessage();
                showErrorNotification(userMessage);
            } else {
                showErrorNotification('Authentication failed. Please try again.');
            }
            return false;
        }
    } catch (error) {
        console.error('❌ Error retrying authentication:', error);
        showErrorNotification('Authentication retry failed. Please try again.');
        return false;
    }
}

// Make retry function globally available
window.retryAuthentication = retryAuthentication;

/**
 * Refresh plan detection - DISABLED until Pro/Agency plans are added
 */
async function refreshPlanDetection() {
    console.log('🔄 Plan refresh disabled - Pro/Agency plans not yet available');
    updateStatus('Plan refresh disabled - Pro/Agency plans coming soon', 'info');
    
    // TODO: Re-enable when Pro/Agency plans are implemented
    /*
    try {
        // Clear stored plan to force re-detection
        const currentSettings = await webflow.getExtensionSettings();
        const clearedSettings = {
            ...currentSettings,
            a11yValidatorPlan: null
        };
        await webflow.setExtensionSettings(clearedSettings);
        
        // Re-initialize plan detection
        const newPlan = await initializeUserPlan();
        
        // Update status with success message
        updateStatus(`Plan updated to: ${newPlan}`, 'success');
        
        // Re-inject validation script with new plan
        injectValidationScript(newPlan);
        
    } catch (error) {
        console.error('❌ Failed to refresh plan detection:', error);
        updateStatus('Failed to refresh plan detection', 'error');
    }
    */
}

// ============================================================================
// PLAN TIER SYSTEM & FEATURE GATING
// ============================================================================

// Plan tier configuration with feature flags (fallback for backward compatibility)
const PLAN_TIERS = {
    STARTER: {
        name: 'Starter',
        price: 0,
        features: {
            'basic-validation': true,
            'field-level-messaging': true,   // Available in Starter (default messages)
            'custom-error-messages': false,  // Pro feature (custom messages)
            'dynamic-requirements': false,   // Pro feature
            'extended-limits': false,        // Pro feature (higher character limits)
            'error-styling': false,          // Pro feature (custom error colors)
            'advanced-styling': false,       // Agency feature
            'analytics': false               // Agency feature
        },
        limits: {
            max_sites: 1,
            max_workspaces: 1,
            max_forms: 5,
            max_required_fields_per_form: 5,
            supported_field_types: ['TextInput', 'TextArea', 'email', 'phone', 'url'],
            excluded_field_types: ['checkbox', 'radio', 'select', 'file', 'custom']
        }
    },
    PRO: {
        name: 'Pro',
        price: 29,
        features: {
            'basic-validation': true,
            'field-level-messaging': true,   // Enabled in Pro
            'custom-error-messages': true,   // Enabled in Pro
            'dynamic-requirements': true,    // Enabled in Pro
            'extended-limits': true,         // Enabled in Pro (higher character limits)
            'error-styling': true,           // Enabled in Pro (custom error colors)
            'advanced-styling': false,       // Agency feature
            'analytics': false               // Agency feature
        },
        limits: {
            max_sites: 10,
            max_workspaces: 1,
            max_forms: 25,
            max_required_fields_per_form: 10,
            supported_field_types: ['TextInput', 'TextArea', 'email', 'phone', 'url', 'checkbox', 'radio', 'select'],
            excluded_field_types: ['file', 'custom']
        }
    },
    AGENCY: {
        name: 'Agency',
        price: 99,
        features: {
            'basic-validation': true,
            'field-level-messaging': true,
            'custom-error-messages': true,
            'dynamic-requirements': true,
            'extended-limits': true,         // Enabled in Agency (higher character limits)
            'error-styling': true,           // Enabled in Agency (custom error colors)
            'advanced-styling': true,        // Enabled in Agency
            'analytics': true                // Enabled in Agency
        },
        limits: {
            max_sites: -1,   // Unlimited
            max_workspaces: -1,   // Unlimited
            max_forms: -1,   // Unlimited
            max_required_fields_per_form: -1,   // Unlimited
            supported_field_types: ['TextInput', 'TextArea', 'email', 'phone', 'url', 'checkbox', 'radio', 'select', 'file', 'custom'],
            excluded_field_types: []
        }
    }
};

// Current user plan (default to Starter) - ENFORCED FOR MVP
let currentPlan = 'STARTER';
let currentUserId = null;
let planSource = 'default';
let currentWorkspaceId = null;

// Plan enforcement flag - locks MVP to Starter plan only
const PLAN_ENFORCEMENT_ACTIVE = false;

// Plan tier mapping for testing interface
const PLAN_TIER_MAPPING = {
    'starter': 'STARTER',
    'pro': 'PRO',
    'agency': 'AGENCY'
};

// Feature access control with plan enforcement (backward compatibility)
function isFeatureAllowed(featureName) {
    // Use the new feature flag system if available
    if (window.FeatureFlagManager && window.FeatureFlagManager.isInitialized) {
        // Use async feature checking with fallback
        return window.FallbackSystem.checkFeatureWithFallback(featureName);
    }
    
    // Otherwise, fall back to existing plan tier system
    if (PLAN_ENFORCEMENT_ACTIVE) {
        const starterPlan = PLAN_TIERS.STARTER;
        return starterPlan?.features[featureName] || false;
    }
    
    const plan = PLAN_TIERS[currentPlan];
    return plan?.features[featureName] || false;
}



async function getCurrentPlanLimits(planName = null) {
    const targetPlan = planName || currentPlan;
    
    // Check cache first (only for current plan)
    if (!planName && planLimitsCache && Date.now() < planLimitsCacheExpiry) {
        return planLimitsCache;
    }
    
    // Try to get limits from database API first
    if (window.databaseAPI && window.databaseAPI.siteId) {
        try {
            // Get workspace plan limits from database
            const response = await fetch(`${window.databaseAPI.baseURL}/api/plans/${targetPlan.toLowerCase()}/limits`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const planLimits = await response.json();
                console.log('✅ Got plan limits from database:', planLimits);
                
                // Find the forms limit from the plan limits array
                const formsLimit = planLimits.find(limit => 
                    limit.rule_type === 'forms' && limit.rule_scope === 'site'
                );
                const fieldsLimit = planLimits.find(limit => 
                    limit.rule_type === 'fields' && limit.rule_scope === 'form'
                );
                
                // Convert plan limits to PLAN_TIERS format
                const planLimitsData = {
                    name: targetPlan === 'STARTER' ? 'Starter' : 
                          targetPlan === 'PRO' ? 'Pro' : 
                          targetPlan === 'AGENCY' ? 'Agency' : 
                          targetPlan === 'ADMIN' ? 'Admin' : targetPlan,
                    price: 0,
                    features: {},
                    limits: {
                        max_sites: 1,
                        max_workspaces: 1,
                        max_forms: formsLimit ? formsLimit.limit_value : 5,
                        max_required_fields_per_form: fieldsLimit ? fieldsLimit.limit_value : 5,
                        supported_field_types: ['TextInput', 'TextArea', 'email', 'phone', 'url'],
                        excluded_field_types: ['checkbox', 'radio', 'select', 'file', 'custom']
                    }
                };
                
                // Cache the result (only for current plan)
                if (!planName) {
                    planLimitsCache = planLimitsData;
                    planLimitsCacheExpiry = Date.now() + PLAN_LIMITS_CACHE_DURATION;
                }
                
                return planLimitsData;
            }
        } catch (error) {
            // Silently handle 404 errors as they're expected in testing mode
            if (error.message && !error.message.includes('404')) {
                console.warn('⚠️ Could not get workspace plan limits from database, falling back to PLAN_TIERS:', error);
            }
        }
    }
    
    // Fallback to hardcoded PLAN_TIERS
    let fallbackLimits;
    if (PLAN_ENFORCEMENT_ACTIVE) {
        fallbackLimits = PLAN_TIERS.STARTER;
    } else {
        fallbackLimits = PLAN_TIERS[targetPlan] || PLAN_TIERS.STARTER;
    }
    
    // Cache the fallback result too (only for current plan)
    if (!planName) {
        planLimitsCache = fallbackLimits;
        planLimitsCacheExpiry = Date.now() + PLAN_LIMITS_CACHE_DURATION;
    }
    
    return fallbackLimits;
}

// ============================================================================
// STARTER PLAN LIMIT ENFORCEMENT FUNCTIONS
// ============================================================================

async function checkSiteLimits() {
    const currentSiteInfo = await webflow.getSiteInfo();
    
    // Try to get extension settings, fallback to empty object if not available
    let settings = {};
    try {
        if (webflow.getExtensionSettings) {
            settings = await webflow.getExtensionSettings();
        } else {
            console.log('⚠️ Extension settings not available, using fallback');
        }
    } catch (error) {
        console.log('⚠️ Could not access extension settings:', error);
        settings = {};
    }
    
    const siteTracking = settings.siteTracking || {
        allowedSites: [],
        firstSiteSet: false
    };
    
    // Check if this is a new site
    const isNewSite = !siteTracking.allowedSites.includes(currentSiteInfo.siteId);
    
    // If extension settings are not available, be more lenient with site limits
    const hasExtensionSettings = webflow.getExtensionSettings && webflow.setExtensionSettings;
    
    const planLimits = await getCurrentPlanLimits();
    if (isNewSite && siteTracking.allowedSites.length >= planLimits.limits.max_sites && hasExtensionSettings) {
        return {
            allowed: false,
            message: `You've reached your site limit (${planLimits.limits.max_sites}). | <a href="https://www.a11yformvalidator.com" target="_blank" class="upgrade-link">Sign up</a> now to learn when our Pro and Agency plans will be available`,
            notificationMessage: `Site limit reached (${planLimits.limits.max_sites} sites maximum)`
        };
    }
    
    // Add new site if first time
    if (isNewSite) {
        siteTracking.allowedSites.push(currentSiteInfo.siteId);
        siteTracking.firstSiteSet = true;
        
        // Try to save settings, but don't fail if not available
        try {
            if (webflow.setExtensionSettings) {
                await webflow.setExtensionSettings({
                    ...settings,
                    siteTracking: siteTracking
                });
            } else {
                console.log('⚠️ Extension settings save not available, using fallback');
            }
        } catch (error) {
            console.log('⚠️ Could not save extension settings:', error);
        }
    }
    
    return { allowed: true };
}

async function checkTotalFormsLimit(forms) {
    const planLimits = await getCurrentPlanLimits();
    const limits = planLimits.limits;
    const formCount = forms.length;
    
    if (formCount > limits.max_forms) {
        return {
            exceeded: true,
            current: formCount,
            limit: limits.max_forms,
            message: `Found ${formCount} forms (limit: ${limits.max_forms}) | <a href="https://www.a11yformvalidator.com" target="_blank" class="upgrade-link">Sign up</a> now to learn when our Pro and Agency plans will be available`,
            notificationMessage: `Form limit exceeded (${formCount}/${limits.max_forms} forms)`
        };
    }
    
    return { exceeded: false, current: formCount, limit: limits.max_forms };
}

async function checkRequiredFieldLimit(form) {
    const planLimits = await getCurrentPlanLimits();
    const limits = planLimits.limits;
    const requiredFields = form.fields.filter(field => field.required);
    const requiredCount = requiredFields.length;
    
    if (requiredCount > limits.max_required_fields_per_form) {
        return {
            exceeded: true,
            current: requiredCount,
            limit: limits.max_required_fields_per_form,
            message: `Form "${form.name}" has ${requiredCount} required fields (limit: ${limits.max_required_fields_per_form}) | <a href="https://www.a11yformvalidator.com" target="_blank" class="upgrade-link">Sign up</a> now to learn when our Pro and Agency plans will be available or remove over limit fields to continue`,
            notificationMessage: `Required field limit exceeded (${requiredCount}/${limits.max_required_fields_per_form} fields)`
        };
    }
    
    return { exceeded: false, current: requiredCount, limit: limits.max_required_fields_per_form };
}


async function checkApproachingLimits(forms) {
    const planLimits = await getCurrentPlanLimits();
    const limits = planLimits.limits;
    const formCount = forms.length;
    
    const warnings = [];
    
    // Check if approaching form limit (within 20%)
    const formLimitThreshold = Math.floor(limits.max_forms * 0.8);
    if (formCount >= formLimitThreshold && formCount < limits.max_forms) {
        warnings.push({
            type: 'forms',
            message: `Approaching form limit: ${formCount}/${limits.max_forms} forms used`,
            notificationMessage: `Approaching form limit (${formCount}/${limits.max_forms})`
        });
    }
    
    return warnings;
}

async function checkFieldTypeSupport(elementType, elementId) {
    const planLimits = await getCurrentPlanLimits();
    const limits = planLimits.limits;
    const supportedTypes = limits.supported_field_types;
    const excludedIds = ['legend', 'fieldSet'];
    
    // Check if element type is supported
    if (!supportedTypes.includes(elementType)) {
        return {
            supported: false,
            reason: 'field_type_not_supported',
            message: `${elementType} fields are not supported in the Starter plan. Supported types: ${supportedTypes.join(', ')}`
        };
    }
    
    // Check if element ID is excluded
    if (excludedIds.includes(elementId)) {
        return {
            supported: false,
            reason: 'element_id_excluded',
            message: 'Custom elements are not supported in the Starter plan'
        };
    }
    
    return { supported: true };
}

async function isFieldTypeSupported(elementType, elementId) {
    const result = await checkFieldTypeSupport(elementType, elementId);
    return result.supported;
}

function prioritizeRequiredFields(fields) {
    return fields.sort((a, b) => {
        if (a.required && !b.required) return -1;
        if (!a.required && b.required) return 1;
        return 0;
    });
}

async function updateInterfaceForPlan() {
    const plan = await getCurrentPlanLimits();
    
    
    // Initialize element hiding manager if available
    if (typeof window.elementHidingManager === 'undefined') {
        console.warn('⚠️ Element hiding manager not available, falling back to CSS hiding');
        updateInterfaceForPlanFallback();
        return;
    }
    
    // Hide What's Included and Future Features sections (temporarily hidden)
    const whatsIncludedSection = document.getElementById('whats-included-section');
    if (whatsIncludedSection) {
        window.elementHidingManager.hideByPlan(whatsIncludedSection, 'HIDDEN');
    }
    
    const futureFeaturesSection = document.getElementById('future-features-section');
    if (futureFeaturesSection) {
        window.elementHidingManager.hideByPlan(futureFeaturesSection, 'HIDDEN');
    }
    
    // Update character limits based on plan
    updateCharacterLimits();
    
    // Show upgrade prompts for disabled features
    showUpgradePrompts();
    
    console.log('🔒 Updated interface using element hiding system');
}



function showUpgradePrompts() {


}

/**
 * Fallback function for when element hiding manager is not available
 */
function updateInterfaceForPlanFallback() {
    console.log('⚠️ Using CSS fallback for interface updates');
    
    // Hide What's Included and Future Features sections (temporarily hidden)
    const whatsIncludedSection = document.getElementById('whats-included-section');
    if (whatsIncludedSection) {
        whatsIncludedSection.style.display = 'none';
    }
    
    const futureFeaturesSection = document.getElementById('future-features-section');
    if (futureFeaturesSection) {
        futureFeaturesSection.style.display = 'none';
    }
}

function addUpgradePrompt(sectionId, message) {
    const section = document.getElementById(sectionId);
    if (section) {
        // Remove existing upgrade prompt
        const existingPrompt = section.querySelector('.upgrade-prompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }
        
        // Add new upgrade prompt
        const upgradePrompt = document.createElement('div');
        upgradePrompt.className = 'upgrade-prompt';
        upgradePrompt.innerHTML = `
            <div class="upgrade-banner">
                <span class="upgrade-icon">⭐</span>
                <span class="upgrade-text">${message}</span>
                <button class="upgrade-btn" onclick="handleUpgradeClick('${sectionId}')">Upgrade to Pro</button>
            </div>
        `;
        section.appendChild(upgradePrompt);
    }
}

function handleUpgradeClick(featureId) {
    console.log(`🚀 Upgrade requested for feature: ${featureId}`);
    showInfoNotification('Upgrade to Pro to unlock advanced features!');
    // In a real implementation, this would redirect to pricing page
}



/**
 * Get last plan update time
 */
function getLastPlanUpdate() {
    // This would be retrieved from extension settings
    return new Date().toLocaleString();
}

/**
 * Show plan upgrade modal - DISABLED until Pro/Agency plans are added
 */
async function showPlanUpgradeModal() {
    try {
        // Load pricing plans from database
        const plans = await loadPricingPlans();
        
        // Generate plan cards dynamically
        const planCards = plans.map(plan => {
            const isCurrentPlan = plan.id === currentPlan.toLowerCase();
            const isFeatured = plan.id === 'agency';
            const priceDisplay = plan.monthlyPrice === 0 ? 'Free' : `$${plan.monthlyPrice}/month`;
            
            return `
                <div class="plan-card ${plan.id} ${isFeatured ? 'featured' : ''}">
                    <div class="plan-header">
                        <h3>${getPlanIcon(plan.id)} ${plan.name}</h3>
                        <p class="price">${priceDisplay}</p>
                        ${isFeatured ? '<span class="featured-badge">Most Popular</span>' : ''}
                    </div>
                    <div class="plan-features">
                        <ul>
                            ${plan.features.map(feature => `<li>✅ ${feature}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="plan-status">
                        ${isCurrentPlan ? '<span class="current-plan-badge">Current Plan</span>' : ''}
                        ${!isCurrentPlan && plan.monthlyPrice > 0 ? `<button onclick="upgradeToPlan('${plan.id.toUpperCase()}')" class="upgrade-btn ${plan.id}-btn">Upgrade to ${plan.name}</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        const modal = document.createElement('div');
        modal.className = 'upgrade-modal';
        modal.innerHTML = `
            <div class="upgrade-modal-content">
                <div class="modal-header">
                    <h2>🚀 Upgrade Your A11y Form Validator</h2>
                    <button onclick="closeUpgradeModal()" class="modal-close-btn" aria-label="Close upgrade modal">×</button>
                </div>
                
                <div class="modal-body">
                    <p class="upgrade-intro">Unlock advanced features and higher limits to take your form validation to the next level.</p>
                    
                    <div class="plan-comparison">
                        ${planCards}
                    </div>
                    
                    <div class="upgrade-footer">
                        <p>💡 <strong>Need help choosing?</strong> Start with Pro and upgrade anytime. All plans include a 14-day free trial.</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('❌ Failed to load pricing plans:', error);
        showErrorNotification('Failed to load pricing information. Please try again.');
    }
}

/**
 * Get plan icon based on plan ID
 */
function getPlanIcon(planId) {
    const icons = {
        'free': '⭐',
        'starter': '⭐',
        'pro': '🚀',
        'agency': '🏢'
    };
    return icons[planId] || '📋';
}

/**
 * Close upgrade modal
 */
function closeUpgradeModal() {
    const modal = document.querySelector('.upgrade-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Handle plan upgrade
 */
async function upgradeToPlan(plan) {
    console.log(`🚀 Upgrading to ${plan} plan`);
    
    try {
        // Close the modal first
        closeUpgradeModal();
        
        // Show loading state
        updateStatus(`Redirecting to ${plan} plan checkout...`, 'info');
        
        // Get current user info
        const userInfo = await getCurrentUserInfo();
        if (!userInfo) {
            throw new Error('User authentication required for upgrade');
        }
        
        // Create checkout session
        const checkoutUrl = await createCheckoutSession(plan, userInfo);
        
        if (checkoutUrl) {
            // Redirect to Stripe checkout
            window.open(checkoutUrl, '_blank');
            updateStatus(`Redirecting to ${plan} plan checkout...`, 'success');
        } else {
            throw new Error('Failed to create checkout session');
        }
        
    } catch (error) {
        console.error('❌ Upgrade failed:', error);
        updateStatus(`Upgrade failed: ${error.message}`, 'error');
        showErrorNotification('Failed to start upgrade process. Please try again.');
    }
}

/**
 * Create Stripe checkout session
 */
async function createCheckoutSession(plan, userInfo) {
    try {
        const response = await fetch('/api/billing/create-checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userInfo.token}`
            },
            body: JSON.stringify({
                plan: plan.toLowerCase(),
                successUrl: `${window.location.origin}/upgrade-success?plan=${plan}`,
                cancelUrl: `${window.location.origin}/upgrade-cancelled`
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.url;
        
    } catch (error) {
        console.error('❌ Checkout session creation failed:', error);
        throw error;
    }
}

/**
 * Load pricing plans from database
 */
async function loadPricingPlans() {
    try {
        const response = await fetch('/api/billing/plans', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.plans || [];
        
    } catch (error) {
        console.error('❌ Failed to load pricing plans:', error);
        // Fallback to hardcoded plans
        return await getFallbackPlans();
    }
}

/**
 * Get fallback plans if database is unavailable
 */
async function getFallbackPlans() {
    // Get current plan limits from database for all plans
    const starterLimits = await getCurrentPlanLimits();
    const proLimits = await getCurrentPlanLimits('pro');
    const agencyLimits = await getCurrentPlanLimits('agency');
    
    return [
        {
            id: 'free',
            name: 'Starter',
            description: 'Perfect for small projects and getting started',
            monthlyPrice: 0,
            yearlyPrice: 0,
            currency: 'USD',
            features: [
                'Basic form validation',
                'WCAG 2.2 AA compliance',
                `Up to ${starterLimits.limits.max_forms} forms per site`,
                `Up to ${starterLimits.limits.max_required_fields_per_form} fields per form`,
                'Standard error messages'
            ],
            limits: {
                forms_per_site: starterLimits.limits.max_forms,
                fields_per_form: starterLimits.limits.max_required_fields_per_form,
                sites_per_workspace: 1
            },
            isActive: true
        },
        {
            id: 'pro',
            name: 'Pro',
            description: 'Advanced validation features for professional websites',
            monthlyPrice: 29,
            yearlyPrice: 290,
            currency: 'USD',
            features: [
                'Everything in Starter',
                'Custom error messages',
                'Dynamic requirements',
                'Extended character limits',
                'Custom error styling',
                `Up to ${proLimits.limits.max_forms} forms per site`,
                `Up to ${proLimits.limits.max_required_fields_per_form} fields per form`,
                'Priority support'
            ],
            limits: {
                forms_per_site: proLimits.limits.max_forms,
                fields_per_form: proLimits.limits.max_required_fields_per_form,
                sites_per_workspace: 5
            },
            isActive: true
        },
        {
            id: 'agency',
            name: 'Agency',
            description: 'Unlimited validation features for agencies and enterprises',
            monthlyPrice: 99,
            yearlyPrice: 990,
            currency: 'USD',
            features: [
                'Everything in Pro',
                'Advanced styling options',
                'Analytics dashboard',
                agencyLimits.limits.max_forms === -1 ? 'Unlimited forms & fields' : `Up to ${agencyLimits.limits.max_forms} forms per site`,
                'Priority support',
                'Up to 20 sites',
                'API access',
                'White-label options'
            ],
            limits: {
                forms_per_site: agencyLimits.limits.max_forms,
                fields_per_form: agencyLimits.limits.max_required_fields_per_form,
                sites_per_workspace: 20
            },
            isActive: true
        }
    ];
}

/**
 * Get current user info for authentication
 */
async function getCurrentUserInfo() {
    try {
        // Try to get user info from Webflow context
        if (typeof webflow !== 'undefined' && webflow.getUserInfo) {
            const userInfo = await webflow.getUserInfo();
            return {
                id: userInfo.id,
                email: userInfo.email,
                token: userInfo.token || 'webflow-token'
            };
        }
        
        // Fallback to extension settings
        const settings = await webflow.getExtensionSettings();
        if (settings.userInfo) {
            return settings.userInfo;
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Failed to get user info:', error);
        return null;
    }
}


/**
 * Update character limits based on current plan
 */
function updateCharacterLimits() {
    const isProOrHigher = isFeatureAllowed('extended-limits');
    
    // Text input limits
    const maxLengthText = document.getElementById('max-length-text');
    if (maxLengthText) {
        const defaultMax = parseInt(maxLengthText.dataset.defaultMax) || 100;
        const planMax = isProOrHigher ? 1000 : defaultMax;
        
        maxLengthText.max = planMax;
        if (parseInt(maxLengthText.value) > planMax) {
            maxLengthText.value = planMax;
        }
        
        // Update UI elements
        const maxLimitBadge = maxLengthText.closest('.max-length-container')?.querySelector('.max-limit-badge');
        const upgradeNotice = maxLengthText.closest('.max-length-container')?.querySelector('.plan-upgrade-notice');
        
        if (maxLimitBadge) {
            maxLimitBadge.textContent = `Max: ${planMax} chars`;
        }
        
        if (upgradeNotice) {
            upgradeNotice.classList.toggle('hidden', isProOrHigher);
        }
    }
    
    // Textarea limits
    const maxLengthTextarea = document.getElementById('max-length-textarea');
    if (maxLengthTextarea) {
        const defaultMax = parseInt(maxLengthTextarea.dataset.defaultMax) || 500;
        const planMax = isProOrHigher ? 5000 : defaultMax;
        
        maxLengthTextarea.max = planMax;
        if (parseInt(maxLengthTextarea.value) > planMax) {
            maxLengthTextarea.value = planMax;
        }
        
        // Update UI elements
        const maxLimitBadge = maxLengthTextarea.closest('.max-length-container')?.querySelector('.max-limit-badge');
        const upgradeNotice = maxLengthTextarea.closest('.max-length-container')?.querySelector('.plan-upgrade-notice');
        
        if (maxLimitBadge) {
            maxLimitBadge.textContent = `Max: ${planMax} chars`;
        }
        
        if (upgradeNotice) {
            upgradeNotice.classList.toggle('hidden', isProOrHigher);
        }
    }
    
    console.log(`📏 Character limits updated - Pro+: ${isProOrHigher}`);
}

// ============================================================================
// ADVANCED UI INTEGRATION (Core Features)
// ============================================================================



// ============================================================================
// TESTING CONTROLS
// ============================================================================





function initializeContentProtection() {
    safeConsoleLog('🔒 Initializing content protection system...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            maskSensitiveAttributesInDOM();
        });
    } else {
        // DOM is already ready
        maskSensitiveAttributesInDOM();
    }
    
    // Set up observer to mask new elements that get added
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the new element has sensitive attributes
                        if (node.hasAttribute && (
                            node.hasAttribute('data-webflow-id') ||
                            node.hasAttribute('data-site-id') ||
                            node.hasAttribute('data-page-id') ||
                            node.hasAttribute('data-workspace-id')
                        )) {
                            maskSensitiveAttributes(node);
                        }
                        
                        // Check child elements
                        const sensitiveElements = node.querySelectorAll('[data-webflow-id], [data-site-id], [data-page-id], [data-workspace-id]');
                        sensitiveElements.forEach(element => {
                            maskSensitiveAttributes(element);
                        });
                    }
                });
            }
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Initialize Phase 2.4 advanced content protection
    initializeAdvancedContentProtection();
    
    safeConsoleLog('✅ Content protection system initialized');
}

/**
 * Initialize Phase 2.4 advanced content protection features
 */
function initializeAdvancedContentProtection() {
    if (typeof sensitiveDataManager !== 'undefined') {
        // Start periodic cleanup
        sensitiveDataManager.startPeriodicCleanup();
        safeConsoleLog('🧹 Periodic sensitive data cleanup started');
    }
    
    // Set up global error handler for sanitization
    window.addEventListener('error', (event) => {
        event.preventDefault();
        const sanitizedError = typeof sanitizeErrorMessage === 'function' 
            ? sanitizeErrorMessage(event.error) 
            : event.error.toString();
        safeConsoleLog('🚨 Application Error:', sanitizedError);
    });
    
    // Set up unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        event.preventDefault();
        const sanitizedError = typeof sanitizeErrorMessage === 'function' 
            ? sanitizeErrorMessage(event.reason) 
            : event.reason.toString();
        safeConsoleLog('🚨 Unhandled Promise Rejection:', sanitizedError);
    });
    
    // Run content protection tests in development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        setTimeout(() => {
            if (typeof testContentProtection === 'function') {
                testContentProtection();
            }
        }, 1000);
    }
    
    safeConsoleLog('✅ Advanced content protection initialized');
}



/**
 * Initialize advanced UI features (called after core initialization)
 */
function initializeAdvancedUI() {
    console.log('🎯 Initializing advanced UI features...');
    
    // Initialize plan-based UI visibility
    updateInterfaceForPlan();
    

    
    // Add event listeners for advanced controls
    setupAdvancedEventListeners();
    
    console.log('✅ Advanced UI features initialized');
}

/**
 * Set up event listeners for advanced features
 */
function setupAdvancedEventListeners() {
    // Field-level messaging controls
    const enableFieldMessaging = document.getElementById('enable-field-messaging');
    if (enableFieldMessaging) {
        enableFieldMessaging.addEventListener('change', async (e) => {
            if (e.target.checked) {
                await enableFieldLevelErrorMessaging();
            } else {
                await disableFieldLevelErrorMessaging();
            }
        });
    }
    

    
    // Manual embed configuration controls
    const configureManualEmbeds = document.getElementById('configure-manual-embeds');
    if (configureManualEmbeds) {
        configureManualEmbeds.addEventListener('click', async () => {
            await configureManualEmbedElements();
        });
    }
    
    const showEmbedGuidance = document.getElementById('show-embed-guidance');
    if (showEmbedGuidance) {
        showEmbedGuidance.addEventListener('click', () => {
            showManualEmbedGuidance();
        });
    }
    
    // Custom code setup controls
    const generateValidationScript = document.getElementById('generate-validation-script');
    if (generateValidationScript) {
            generateValidationScript.addEventListener('click', () => {
            generateAndCopyValidationScript();
        });
    }

    console.log('✅ Advanced event listeners set up');
}

// ============================================================================
// EXISTING CORE FUNCTIONALITY (DO NOT MODIFY)
// ============================================================================

// Notification system for Webflow Designer
function showNotification(message, type = 'Info') {
    // Apply content protection to notification messages
    const filteredMessage = typeof filterNotificationContent === 'function' 
        ? filterNotificationContent(message) 
        : message;
    
    // Create a unique key for this notification
    const notificationKey = `${type}:${filteredMessage}`;
    
    // Check if we've already sent this notification recently
    if (sentNotifications.has(notificationKey)) {
        safeConsoleLog(`🚫 Duplicate notification blocked: ${filteredMessage} (${type})`);
        return;
    }
    
    // Add to sent notifications set
    sentNotifications.add(notificationKey);
    
    // Remove from set after cooldown period to allow future notifications
    setTimeout(() => {
        sentNotifications.delete(notificationKey);
    }, NOTIFICATION_COOLDOWN);
    
    if (isWebflowDesigner && typeof webflow !== 'undefined') {
        try {
            // Ensure the notification object is properly formatted
            const notificationOptions = {
                type: type,
                message: filteredMessage
            };
            
            safeConsoleLog(`📢 Attempting to send notification:`, notificationOptions);
            
            // Call the notification API
            const result = webflow.notify(notificationOptions);
            
            // Handle both Promise and direct return
            if (result && typeof result.then === 'function') {
                result.then(() => {
                    safeConsoleLog(`✅ Notification sent successfully: ${filteredMessage} (${type})`);
                }).catch((error) => {
                    const sanitizedError = typeof sanitizeErrorMessage === 'function' 
                        ? sanitizeErrorMessage(error) 
                        : error.toString();
                    safeConsoleLog('❌ Notification failed:', sanitizedError);
                });
            } else {
                safeConsoleLog(`✅ Notification sent: ${filteredMessage} (${type})`);
            }
        } catch (error) {
            const sanitizedError = typeof sanitizeErrorMessage === 'function' 
                ? sanitizeErrorMessage(error) 
                : error.toString();
            safeConsoleLog('❌ Could not send notification:', sanitizedError);
            safeConsoleLog('Error details:', {
                message: sanitizedError,
                webflowAvailable: typeof webflow !== 'undefined',
                notifyAvailable: typeof webflow?.notify === 'function'
            });
        }
    } else {
        safeConsoleLog(`📢 Preview mode - Would send notification: ${filteredMessage} (${type})`);
    }
}

function showSuccessNotification(message) {
    showNotification(message, 'Success');
}

function showInfoNotification(message) {
    showNotification(message, 'Info');
}

function showWarningNotification(message) {
    showNotification(message, 'Info'); // Webflow only supports Error, Info, Success
}

function showErrorNotification(message) {
    showNotification(message, 'Error');
}

// Enhanced notification system for validation operations
let validationProgress = {
    totalForms: 0,
    currentForm: 0,
    totalFields: 0,
    currentField: 0,
    operation: '', // 'applying', 'updating', 'removing'
    startTime: null
};

function startValidationProgress(operation, totalForms, totalFields = 0) {
    validationProgress = {
        totalForms: totalForms,
        currentForm: 0,
        totalFields: totalFields,
        currentField: 0,
        operation: operation,
        startTime: Date.now()
    };
    
    const operationText = operation === 'applying' ? 'Applying' : 
                         operation === 'updating' ? 'Updating' : 
                         operation === 'removing' ? 'Removing' : 'Processing';
    
            // showInfoNotification(`${operationText} validation to ${totalForms} form${totalForms > 1 ? 's' : ''}...`);
}

function updateFormProgress(formName, formIndex, totalFields = 0) {
    validationProgress.currentForm = formIndex + 1;
    validationProgress.totalFields = totalFields;
    validationProgress.currentField = 0;
    
    const operationText = validationProgress.operation === 'applying' ? 'Applying' : 
                         validationProgress.operation === 'updating' ? 'Updating' : 
                         validationProgress.operation === 'removing' ? 'Removing' : 'Processing';
    
    const progress = Math.round((validationProgress.currentForm / validationProgress.totalForms) * 100);
            // showInfoNotification(`${operationText} validation to "${formName}" (${validationProgress.currentForm}/${validationProgress.totalForms}) - ${progress}%`);
}

function updateFieldProgress(fieldName, fieldIndex, fieldType) {
    validationProgress.currentField = fieldIndex + 1;
    
    const operationText = validationProgress.operation === 'applying' ? 'Applying' : 
                         validationProgress.operation === 'updating' ? 'Updating' : 
                         validationProgress.operation === 'removing' ? 'Removing' : 'Processing';
    
    if (validationProgress.totalFields > 0) {
        const fieldProgress = Math.round((validationProgress.currentField / validationProgress.totalFields) * 100);
        // Show percentage progress as user notification
        showInfoNotification(`${operationText} ${fieldType} validation to "${fieldName}" (${validationProgress.currentField}/${validationProgress.totalFields}) - ${fieldProgress}%`);
    } else {
        // Show progress without percentage
        showInfoNotification(`${operationText} ${fieldType} validation to "${fieldName}"...`);
    }
}

function completeValidationProgress(successCount, failureCount = 0) {
    const operationText = validationProgress.operation === 'applying' ? 'Applied' : 
                         validationProgress.operation === 'updating' ? 'Updated' : 
                         validationProgress.operation === 'removing' ? 'Removed' : 'Processed';
    
    const duration = Math.round((Date.now() - validationProgress.startTime) / 1000);
    
    if (failureCount > 0) {
        showWarningNotification(`${operationText} validation to ${successCount}/${validationProgress.totalForms} forms (${failureCount} failed) in ${duration}s`);
    } else {
        // showSuccessNotification(`${operationText} validation to all ${successCount} forms successfully in ${duration}s`);
    }
    
    // Reset progress
    validationProgress = {
        totalForms: 0,
        currentForm: 0,
        totalFields: 0,
        currentField: 0,
        operation: '',
        startTime: null
    };
}

function showFieldNotification(fieldName, fieldType, operation, success = true) {
    const operationText = operation === 'apply' ? 'Applied' : 
                         operation === 'update' ? 'Updated' : 
                         operation === 'remove' ? 'Removed' : 'Processed';
    
    const message = `${operationText} ${fieldType} validation to "${fieldName}"`;
    
    if (success) {
        showSuccessNotification(message);
    } else {
        showErrorNotification(`Failed to ${operation} ${fieldType} validation to "${fieldName}"`);
    }
}

function showFormNotification(formName, operation, success = true) {
    const operationText = operation === 'apply' ? 'Applied' : 
                         operation === 'update' ? 'Updated' : 
                         operation === 'remove' ? 'Removed' : 'Processed';
    
    const message = `${operationText} validation to form "${formName}"`;
    
    if (success) {
        showSuccessNotification(message);
    } else {
        showErrorNotification(`Failed to ${operation} validation to form "${formName}"`);
    }
}


// Initialization is now handled by the new waitForInitialization() function
/**
 * Remove inline styles from specific elements to rely on CSS file
 */
function removeInlineStyles() {
    try {
        console.log('🧹 Removing inline styles from extension elements...');
        
        // Debug: Log all elements with site-page-info class
        const allSitePageInfoElements = document.querySelectorAll('[class*="site-page-info"]');
        console.log('🔍 Found site-page-info elements:', allSitePageInfoElements.length);
        allSitePageInfoElements.forEach((element, index) => {
            console.log(`  ${index + 1}. Classes: "${element.className}", Style: "${element.style.cssText}"`);
            
            // Check for any child elements with inline styles
            const childrenWithStyles = element.querySelectorAll('[style*="margin"]');
            if (childrenWithStyles.length > 0) {
                console.log(`    ⚠️ Found ${childrenWithStyles.length} child elements with inline margin styles:`);
                childrenWithStyles.forEach((child, childIndex) => {
                    console.log(`      ${childIndex + 1}. ${child.tagName} "${child.className}" - Style: "${child.style.cssText}"`);
                });
            }
        });
        
        // Remove inline styles from site-page-info elements
        const sitePageInfoElements = document.querySelectorAll('.site-page-info p');
        console.log('🎯 Found .site-page-info p elements:', sitePageInfoElements.length);
        sitePageInfoElements.forEach((element, index) => {
            console.log(`  ${index + 1}. Element:`, element);
            if (element.style.margin) {
                console.log('🗑️ Removing inline margin from site-page-info element');
                element.style.removeProperty('margin');
            }
            // Force apply the CSS rule
            element.style.setProperty('margin', '0', 'important');
        });
        
        // Remove inline styles from status-message elements
        const statusMessageElements = document.querySelectorAll('.status-message');
        console.log('🎯 Found .status-message elements:', statusMessageElements.length);
        statusMessageElements.forEach(element => {
            if (element.style.marginBottom) {
                console.log('🗑️ Removing inline margin-bottom from status-message element');
                element.style.removeProperty('margin-bottom');
            }
        });
        
        // Remove any other problematic inline styles
        const allElements = document.querySelectorAll('[style*="margin"]');
        console.log('🎯 Found elements with inline margin styles:', allElements.length);
        allElements.forEach((element, index) => {
            console.log(`  ${index + 1}. Element:`, element.tagName, 'Classes:', element.className, 'Style:', element.style.cssText);
            if (element.classList.contains('site-page-info') || 
                element.classList.contains('status-message') ||
                element.classList.contains('p')) {
                console.log('🗑️ Removing inline margin from element:', element.className);
                element.style.removeProperty('margin');
                element.style.removeProperty('margin-bottom');
            }
        });
        
        console.log('✅ Inline styles removed successfully');
        
        // Make function available globally for manual testing
        window.debugRemoveInlineStyles = removeInlineStyles;
        window.forceApplyStyles = () => {
            const elements = document.querySelectorAll('.site-page-info p');
            elements.forEach(element => {
                element.style.setProperty('margin', '0', 'important');
            });
            console.log('🔧 Forced styles applied to', elements.length, 'elements');
        };
        window.debugCheckElements = () => {
            console.log('🔍 Checking for site-page-info elements...');
            const elements = document.querySelectorAll('.site-page-info');
            console.log('Found', elements.length, 'site-page-info elements');
            elements.forEach((element, index) => {
                console.log(`Element ${index + 1}:`, element);
                console.log('  Classes:', element.className);
                console.log('  Inline styles:', element.style.cssText);
                const paragraphs = element.querySelectorAll('p');
                console.log('  Paragraphs:', paragraphs.length);
                paragraphs.forEach((p, pIndex) => {
                    console.log(`    Paragraph ${pIndex + 1}:`, p);
                    console.log('    Classes:', p.className);
                    console.log('    Inline styles:', p.style.cssText);
                    console.log('    Computed margin:', window.getComputedStyle(p).margin);
                });
            });
        };
        console.log('🔧 Debug functions available: window.debugRemoveInlineStyles(), window.forceApplyStyles(), and window.debugCheckElements()');
        
    } catch (error) {
        console.warn('⚠️ Error removing inline styles:', error);
    }
}

/**
 * Clean inline styles from extension elements (can be called repeatedly)
 */
function cleanExtensionStyles() {
    try {
        // Target specific elements that should use CSS file styles
        const selectors = [
            '.site-page-info p',
            '.status-message',
            '.panel-header p',
            '.section-content p',
            '.feature-group p'
        ];
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Remove margin-related inline styles
                if (element.style.margin) {
                    element.style.removeProperty('margin');
                }
                if (element.style.marginBottom) {
                    element.style.removeProperty('margin-bottom');
                }
                if (element.style.marginTop) {
                    element.style.removeProperty('margin-top');
                }
                if (element.style.marginLeft) {
                    element.style.removeProperty('margin-left');
                }
                if (element.style.marginRight) {
                    element.style.removeProperty('margin-right');
                }
            });
        });
        
        console.log('🧹 Extension styles cleaned');
    } catch (error) {
        console.warn('⚠️ Error cleaning extension styles:', error);
    }
}

/**
 * Set up MutationObserver to clean styles for dynamically added content
 */
function setupStyleObserver() {
    try {
        // Create observer to watch for DOM changes
        const observer = new MutationObserver((mutations) => {
            let shouldClean = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if added element has our target classes
                            if (node.classList && (
                                node.classList.contains('site-page-info') ||
                                node.classList.contains('status-message') ||
                                node.classList.contains('p')
                            )) {
                                shouldClean = true;
                            }
                            
                            // Check child elements
                            const targetElements = node.querySelectorAll('.site-page-info p, .status-message, .panel-header p');
                            if (targetElements.length > 0) {
                                shouldClean = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldClean) {
                // Debounce the cleaning to avoid excessive calls
                clearTimeout(window.styleCleanupTimeout);
                window.styleCleanupTimeout = setTimeout(() => {
                    cleanExtensionStyles();
                }, 100);
            }
        });
        
        // Start observing the document body
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('👁️ Style observer set up for dynamic content');
    } catch (error) {
        console.warn('⚠️ Error setting up style observer:', error);
    }
}

// This function is now defined at the top of the file with improved initialization logic
async function setupWebflowIntegration() {
    if (!isWebflowDesigner)
        return;
    
    try {
        siteInfo = await webflow.getSiteInfo();
        safeConsoleLog('✅ Site info loaded:', maskSensitiveObject(siteInfo, 'siteId'));
        
        // Check site limits for starter plan
        if (PLAN_ENFORCEMENT_ACTIVE) {
            const siteValidation = await checkSiteLimits();
            if (!siteValidation.allowed) {
                updateStatus(siteValidation.message, 'error');
                showErrorNotification(siteValidation.notificationMessage);
                return; // Stop initialization
            }
        }
        
        // Initialize feature flags system
        try {
            console.log('🚩 Initializing feature flags system...');
            
            // Get workspace ID from site info or user info
            currentWorkspaceId = siteInfo.workspaceId || siteInfo.userInfo?.workspaceId;
            
            if (currentWorkspaceId) {
                // Initialize feature flags with workspace ID and current plan
                await window.initializeFeatureFlags(currentWorkspaceId, currentPlan.toLowerCase());
                console.log('✅ Feature flags initialized successfully');
            } else {
                console.warn('⚠️ No workspace ID found, using fallback feature flags');
            }
        } catch (error) {
            console.warn('⚠️ Feature flags initialization failed:', error);
            // Continue with fallback system
        }
        
        // Initialize database API for site-wide persistence
        try {
            console.log('🔌 Initializing database API for site-wide form tracking...');
            await window.databaseAPI.initialize(siteInfo);
            console.log('✅ Database API initialized successfully');
            
            // Initialize feature flag manager with database API
            if (window.FeatureFlagManager) {
                await window.FeatureFlagManager.initialize(window.databaseAPI);
                console.log('✅ Feature Flag Manager initialized with database API');
            }
            
            // Set up periodic domain synchronization
            setupDomainSyncMonitoring();
        } catch (error) {
            console.warn('⚠️ Database API initialization failed:', error);
            
            // Check if this is an authentication-related error
            if (error.message && error.message.includes('User email is required')) {
                console.log('🔐 Database initialization failed due to missing authentication');
                
                // Check if we have OAuth error details
                if (window.hybridAuthManager) {
                    const oauthError = window.hybridAuthManager.getLastOAuthError();
                    if (oauthError) {
                        const userMessage = window.hybridAuthManager.getOAuthErrorMessage();
                        showErrorNotification(userMessage);
                        updateStatus('Authentication required for database persistence', 'warning');
                    } else {
                        showWarningNotification('Please authenticate to enable database persistence and limit enforcement');
                        updateStatus('Authentication required for full functionality', 'warning');
                    }
                } else {
                    showWarningNotification('Please authenticate to enable database persistence and limit enforcement');
                    updateStatus('Authentication required for full functionality', 'warning');
                }
            } else {
                // Other database errors
                showWarningNotification('Database connection failed - extension running with limited functionality');
                updateStatus('Database unavailable - basic functionality only', 'warning');
            }
        }
        
        // Display site information
        displaySiteInfo(siteInfo);
        
        // Get and display page information
        try {
            const currentPage = await webflow.getCurrentPage();
            safeConsoleLog('✅ Page info loaded:', maskSensitiveObject(currentPage, 'pageId'));
            await displayPageInfo(currentPage);
        } catch (error) {
            const sanitizedError = typeof sanitizeErrorMessage === 'function' 
                ? sanitizeErrorMessage(error) 
                : error.toString();
            safeConsoleLog('⚠️ Could not load page info:', sanitizedError);
            showWarningNotification('Could not load page information');
        }
        
        // Display validated forms count
        await displayValidatedFormsCount();
        
        userCapabilities = await checkUserCapabilities();
        
        // Subscribe to element selection changes
        webflow.subscribe('selectedelement', (element) => {
            handleElementSelection(element).catch(error => {
                const sanitizedError = typeof sanitizeErrorMessage === 'function' 
                    ? sanitizeErrorMessage(error) 
                    : error.toString();
                safeConsoleLog('❌ Error in handleElementSelection:', sanitizedError);
            });
        });
        
        // Note: Webflow API doesn't support 'pagechange' subscription
        // Using periodic monitoring instead for page information updates
        try {
            const initialElement = await webflow.getSelectedElement();
            await handleElementSelection(initialElement);
        }
        catch (error) {
            const sanitizedError = typeof sanitizeErrorMessage === 'function' 
                ? sanitizeErrorMessage(error) 
                : error.toString();
            safeConsoleLog('⚠️ Could not get initial selected element:', sanitizedError);
        }
        updateStatus('Connected to Webflow Designer - Ready to configure forms', 'success');
        
        // Start periodic page information updates as a fallback
        startPageInfoMonitoring();
    }
    catch (error) {
        const sanitizedError = typeof sanitizeErrorMessage === 'function' 
            ? sanitizeErrorMessage(error) 
            : error.toString();
        safeConsoleLog('❌ Failed to setup Webflow integration:', sanitizedError);
        updateStatus('Failed to connect to Webflow Designer', 'error');
        showErrorNotification('Failed to connect to Webflow Designer');
    }
}
async function checkUserCapabilities() {
    try {
        const capabilities = await webflow.canForAppMode([
            webflow.appModes.canDesign,
            webflow.appModes.canEdit,
            webflow.appModes.canAccessCanvas,
            webflow.appModes.canCreateStyles,
            webflow.appModes.canModifyStyles
        ]);
        return capabilities;
    }
    catch (error) {
        const sanitizedError = typeof sanitizeErrorMessage === 'function' 
            ? sanitizeErrorMessage(error) 
            : error.toString();
        safeConsoleLog('❌ Failed to check user capabilities:', sanitizedError);
        return {
            canDesign: true,
            canEdit: true,
            canAccessCanvas: true,
            canCreateStyles: true,
            canModifyStyles: true
        };
    }
}
async function handleElementSelection(element) {
            safeConsoleLog('🎯 Element selected:', maskSensitiveObject(element, 'elementId'));
    currentSelectedElement = element;
    
    if (element && (element.type === 'Form' || element.type === 'form' || element.type === 'FormForm')) {
        // Get form name properly - handle both string and object IDs
        let elementName = 'Unnamed form';
        
        if (element.name) {
            elementName = element.name;
        } else if (element.id) {
            // Handle object ID by extracting the value
            if (typeof element.id === 'object' && element.id.value) {
                elementName = element.id.value;
            } else if (typeof element.id === 'string') {
                elementName = element.id;
            } else {
                elementName = 'Form Element';
            }
        }
        
        console.log('✅ Form element selected:', elementName);
        updateStatus(`Form selected: ${elementName}`, 'success');
    }
    else if (element) {
        // Enhanced status for non-form elements with better label/field detection
        let statusMessage = '';
        let elementName = '';
        
        console.log('🔍 Element details:', {
            type: element.type,
            name: element.name,
            id: element.id,
            properties: Object.keys(element)
        });
        
        // Try to get the element name from various properties
        if (element.name) {
            elementName = element.name;
        } else if (element.id) {
            if (typeof element.id === 'object' && element.id.value) {
                elementName = element.id.value;
            } else if (typeof element.id === 'string') {
                elementName = element.id;
            }
        }
        
        // Handle all form field types with proper name extraction
        if (element.type === 'FormLabel' || element.type === 'FormBlockLabel') {
            statusMessage = `Selected: Label`;
        }
        // Handle input fields (FormTextInput, FormTextarea, FormSelect, etc.)
        else if (element.type === 'FormInput' || element.type === 'FormTextInput' || element.type === 'FormTextarea' || element.type === 'FormSelect' || element.type === 'FieldSet' || element.type === 'FormCheckbox' || element.type === 'FormRadio' || element.type === 'Legend') {
            let fieldName = elementName;
            // Try to get placeholder or other identifying text
            if (element.getAttribute) {
                try {
                    const placeholder = await element.getAttribute('placeholder');
                    if (placeholder) {
                        fieldName = placeholder;
                    }
                } catch (error) {
                    console.log('Could not get placeholder:', error);
                }
            }
            // Try getName as alternative
            if (element.getName && fieldName === elementName) {
                try {
                    const name = await element.getName();
                    if (name) fieldName = name;
                } catch (error) {
                    console.log('Could not get field name via getName():', error);
                }
            }
            statusMessage = `Selected: Input "${fieldName}"`;
        }
        // Handle form blocks and containers - only show quotes if name is available
        else if (element.type === 'FormBlock' || element.type === 'Block') {
            if (elementName && elementName !== '') {
                statusMessage = `Selected: Form Block "${elementName}"`;
            } else {
                statusMessage = `Selected: Form Block`;
            }
        } else if (element.type === 'FormWrapper') {
            if (elementName && elementName !== '') {
                statusMessage = `Selected: Form Container "${elementName}"`;
            } else {
                statusMessage = `Selected: Form Container`;
            }
        } else {
            // Fallback for other element types - only show quotes if name is available
            if (elementName && elementName !== '') {
                statusMessage = `Selected: ${element.type} "${elementName}"`;
            } else {
                statusMessage = `Selected: ${element.type}`;
            }
        }
        
        // console.log('ℹ️ Non-form element selected:', element.type, 'Status:', statusMessage); // Commented out - redundant logging
        updateStatus(statusMessage, 'info');
    }
    else {
        // console.log('ℹ️ No element selected'); // Commented out - redundant logging
        updateStatus('No element selected', 'info');
    }
}
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
        // Use innerHTML to support HTML links in messages
        statusElement.innerHTML = message;
        statusElement.className = `status-message ${type}`;
    }
    // console.log(`📊 Status: ${message} (${type})`); // Commented out - reduces console noise
}

// Display site information in the UI
function displaySiteInfo(siteInfo) {
    try {
        const siteNameElement = document.getElementById('site-name');
        
        if (siteNameElement && siteInfo) {
            try {
                siteNameElement.innerHTML = `<strong>Site Name:</strong> ${siteInfo.siteName || 'Unknown'}`;
            } catch (error) {
                console.warn('⚠️ Could not get site name:', error);
                siteNameElement.innerHTML = '<strong>Site Name:</strong> Unknown';
            }
        }
        
        console.log('✅ Site information displayed in UI');
    } catch (error) {
        console.warn('⚠️ Could not display site information:', error);
    }
}

/**
 * Set up domain synchronization monitoring
 */
function setupDomainSyncMonitoring() {
    console.log('🔄 Setting up domain synchronization monitoring...');
    
    // Check for domain changes every 5 minutes
    const domainSyncInterval = 5 * 60 * 1000; // 5 minutes
    
    // Initial check after 30 seconds (to allow initialization to complete)
    setTimeout(() => {
        checkAndSyncDomains();
    }, 30000);
    
    // Set up periodic checks
    setInterval(() => {
        checkAndSyncDomains();
    }, domainSyncInterval);
    
    console.log('✅ Domain synchronization monitoring set up');
}

/**
 * Check for domain changes and sync if needed
 */
async function checkAndSyncDomains() {
    try {
        if (!window.databaseAPI || !window.databaseAPI.siteId) {
            console.log('⚠️ Database API not available for domain sync check');
            return;
        }
        
        console.log('🔍 Checking for domain changes...');
        const syncResult = await window.databaseAPI.syncDomainsIfNeeded();
        
        if (syncResult.synced) {
            console.log('🔄 Domain synchronization completed:', syncResult.reason);
            // Optionally show a notification to the user
            showSuccessNotification('Domain information updated');
        }
    } catch (error) {
        console.warn('⚠️ Domain sync check failed:', error);
        // Don't show error notifications for background sync failures
    }
}

/**
 * Start monitoring page changes and update information periodically
 */
function startPageInfoMonitoring() {
    let lastPageId = null;
    
    // Check for page changes every 2 seconds
    setInterval(async () => {
        try {
            if (!isWebflowDesigner || typeof webflow === 'undefined') return;
            
            const currentPage = await webflow.getCurrentPage();
            if (!currentPage) return;
            
            // Get page ID to detect changes
            const pageId = currentPage.id || currentPage.pageId;
            
            if (pageId !== lastPageId) {
                safeConsoleLog('🔄 Page change detected via monitoring, updating...');
                lastPageId = pageId;
                await displayPageInfo(currentPage);
            }
        } catch (error) {
            // Silently handle errors in monitoring
            const sanitizedError = typeof sanitizeErrorMessage === 'function' 
                ? sanitizeErrorMessage(error) 
                : error.toString();
            safeConsoleLog('⚠️ Page monitoring error:', sanitizedError);
        }
    }, 2000); // Check every 2 seconds
}

// Display page information in the UI
async function displayPageInfo(pageInfo) {
    try {
        const pageNameElement = document.getElementById('page-name');
        
        if (pageNameElement && pageInfo) {
            try {
                const pageName = await pageInfo.getName();
                pageNameElement.innerHTML = `<strong>Page name:</strong> ${pageName || 'Unknown'}`;
            } catch (error) {
                console.warn('⚠️ Could not get page name:', error);
                pageNameElement.innerHTML = '<strong>Page name:</strong> Unknown';
            }
        }
        
        console.log('✅ Page information displayed in UI');
    } catch (error) {
        console.warn('⚠️ Could not display page information:', error);
    }
}

// Display validated forms count in the UI with plan limits
async function displayValidatedFormsCount() {
    try {
        const validatedCountElement = document.getElementById('validated-forms-count');
        
        if (validatedCountElement) {
            try {
                const validatedCount = await getTotalValidatedForms();
                const planLimit = await getPlanFormLimit();
                
                // Format the display based on plan limit
                let limitDisplay;
                if (planLimit === -1 || planLimit === null) {
                    limitDisplay = 'unlimited';
                } else {
                    limitDisplay = planLimit;
                }
                
                validatedCountElement.innerHTML = `<strong>Validated:</strong> ${validatedCount}/${limitDisplay} forms`;
            } catch (error) {
                console.warn('⚠️ Could not get validated forms count or plan limit:', error);
                validatedCountElement.innerHTML = '<strong>Validated:</strong> 0 forms';
            }
        }
        
        console.log('✅ Validated forms count with plan limits displayed in UI');
    } catch (error) {
        console.warn('⚠️ Could not display validated forms count:', error);
    }
}
function setupEventListeners() {
    // Initialize Webflow Data API integration if in Designer
    if (isWebflowDesigner && typeof webflow !== 'undefined') {
        initializeWebflowDataAPI();
        // Initialize hybrid authentication
        initializeHybridAuth();
    }
    
    const sizeButtons = ['size-comfortable', 'size-large'];
    sizeButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => handleSizeChange(buttonId.replace('size-', '')));
        }
    });
    
    // Close button functionality
    const closeBtn = document.getElementById('close-extension');
    if (closeBtn) {
        closeBtn.addEventListener('click', handleCloseExtension);
    }
    

    
    const scanBtn = document.getElementById('scan-page-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', handleScanPage);
    }
    const applyBtn = document.getElementById('apply-validation');
    if (applyBtn) {
        applyBtn.addEventListener('click', handleApplyValidation);
    }
    const removeAllBtn = document.getElementById('remove-all-validations');
    if (removeAllBtn) {
        removeAllBtn.addEventListener('click', handleRemoveAllValidations);
        // Initialize remove button visibility based on current validation state
        updateRemoveButtonVisibility();
    }



    // Initialize collapsible sections
    initializeCollapsibleSections();
    
    // Set up Select All/Deselect All buttons
    const selectAllBtn = document.getElementById('select-all-forms');
    const deselectAllBtn = document.getElementById('deselect-all-forms');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', handleSelectAllForms);
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', handleDeselectAllForms);
    }
    
    // Add close button for forms list
    const closeFormsBtn = document.getElementById('close-forms-list');
    if (closeFormsBtn) {
        closeFormsBtn.addEventListener('click', handleCloseFormsList);
    }
    
    console.log('✅ Event listeners setup complete');
}
async function handleSizeChange(size) {
    console.log(`📏 Changing extension size to: ${size}`);
    if (isWebflowDesigner && webflow.setExtensionSize) {
        try {
            switch (size) {
                case 'comfortable':
                    await webflow.setExtensionSize({ width: 320, height: 460 });
                    break;
                case 'large':
                    await webflow.setExtensionSize({ width: 800, height: 600 });
                    break;
            }
            const sizeButtons = document.querySelectorAll('.size-btn');
            sizeButtons.forEach(btn => btn.classList.remove('active'));
            const activeButton = document.getElementById(`size-${size}`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
            currentExtensionSize = size;
            updateResponsiveLayout(size);
            updateStatus(`Extension size changed to ${size}`, 'success');
        }
        catch (error) {
            console.error('❌ Failed to change extension size:', error);
            updateStatus('Failed to change extension size', 'error');
        }
    }
    else {
        console.log(`ℹ️ Preview mode - Size would change to ${size}`);
        updateStatus(`Preview: Size would change to ${size}`, 'info');
    }
}
async function handleScanPage() {
    console.log('🔍 Scanning page for forms...');
            // showInfoNotification('Scanning page for forms...');
    
    if (!isWebflowDesigner) {
        updateStatus('Preview: Would scan page for forms', 'info');
        return;
    }
    try {
        // Reset global field tracking for clean scan
        globalProcessedFields.clear();
        console.log('🔄 Reset global field tracking for new scan');
        
        // Clear validation states to prevent accumulation from previous scans
        validationStates.clear();
        console.log('🔄 Reset validation states for new scan');
        
        updateStatus('Scanning page for forms...', 'info');
        const elements = await webflow.getAllElements();
        // 🔒 CRITICAL: Form Detection Logic - DO NOT MODIFY
        // This section correctly detects FormForm elements
        // Modifying this will break form detection functionality
        const formFormElements = elements.filter(element => {
            const elementType = element.type || element.tagName || '';
            return elementType === 'FormForm';
        });
        
        console.log(`📋 Found ${formFormElements.length} FormForm elements`);
        
        // Process each FormForm element to find nested fields
        let forms;
        try {
            forms = await Promise.all(formFormElements.map(async (formElement, index) => {
            console.log(`🔍 Processing FormForm ${index + 1}`);
            
            // Get form name using Webflow API
            let formName = `FormForm ${index + 1}`;
            if (formElement.getName) {
                try {
                    formName = await formElement.getName();
                } catch (error) {
                    console.log(`⚠️ Could not get form name:`, error);
                }
            }
            
            // Create unique form identifier for this specific form instance
            const formUniqueId = {
                component: formElement.id.component,
                element: formElement.id.element,
                index: index,
                instance: `${formElement.id.component}-${formElement.id.element}-${index}`
            };
            
            console.log(`🔍 Form ${index + 1} unique identifier:`, formUniqueId);
            
            // 🔒 CRITICAL: Check for existing validations
            let hasExistingValidations = false;
            let existingValidationData = {};
            
            // First check local custom attributes
            try {
                if (formElement.customAttributes) {
                    const customAttributes = await formElement.getAllCustomAttributes();
                    existingValidationData = customAttributes.reduce((acc, attr) => {
                        if (attr.name.startsWith('data-a11y-validator-') || attr.name === 'data-a11y-validator') {
                            acc[attr.name] = attr.value;
                            if (attr.name === 'data-a11y-validator' && attr.value === 'enabled') {
                                hasExistingValidations = true;
                            }
                        }
                        return acc;
                    }, {});
                }
            } catch (error) {
                console.log(`⚠️ Could not check local custom attributes for ${formName}:`, error);
            }
            
            // Then check database for site-wide validation states
            try {
                if (window.databaseAPI && window.databaseAPI.siteId) {
                    console.log(`🔍 Checking database for existing validation state of form: ${formName}`);
                    const siteValidationStates = await window.databaseAPI.getSiteValidationStates();
                    
                    // Check if this form is already validated in the database
                    // We need to match by form instance ID first, then fall back to form name + page ID
                    const currentPage = await webflow.getCurrentPage();
                    const currentPageId = currentPage.id;
                    const existingDbValidation = siteValidationStates.find(state => 
                        state.form_webflow_id === formUniqueId.instance && 
                        state.page_webflow_id === currentPageId
                    );
                    
                    if (existingDbValidation) {
                        hasExistingValidations = true;
                        existingValidationData = {
                            ...existingValidationData,
                            'database-validation': true,
                            'validation-id': existingDbValidation.id,
                            'applied-at': existingDbValidation.applied_at
                        };
                        console.log(`✅ Found existing database validation for form "${formName}":`, existingDbValidation);
                    } else {
                        console.log(`ℹ️ No existing database validation found for form "${formName}"`);
                    }
                } else {
                    console.log(`⚠️ Database API not available for validation state check`);
                }
            } catch (error) {
                console.log(`⚠️ Could not check database validation states for ${formName}:`, error);
            }
            
            console.log(`🔍 Form validation check for ${formName}:`, {
                hasExistingValidations,
                existingValidationData
            });
            
            console.log(`🔍 FormForm ${index + 1}: ${formName} (${formElement.fields?.length || 0} fields)`);
            
            const fields = [];
            
            // 🔒 CRITICAL: Field Detection Methods - DO NOT MODIFY
            // This multi-method approach ensures reliable field detection
            // Modifying this will break field detection functionality
            
            // Method 1: Check if form has direct fields property
            if (formElement.fields && Array.isArray(formElement.fields)) {
                console.log(`🔍 Method 1: Found ${formElement.fields.length} fields in fields property`);
                for (const field of formElement.fields) {
                    if (field && field.type) {
                        let fieldLabel = '';
                        if (field.getLabel) {
                            try {
                                fieldLabel = await field.getLabel();
                            } catch (error) {
                                console.log(`⚠️ Could not get label for field:`, error);
                            }
                        }
                        
                        if (!fieldLabel && field.getName) {
                            try {
                                fieldLabel = await field.getName();
                            } catch (error) {
                                console.log(`⚠️ Could not get name for field:`, error);
                            }
                        }
                        
                        if (!fieldLabel) {
                            fieldLabel = field.label || field.name || field.id || `Field ${fields.length + 1}`;
                        }
                        
                        const fieldInfo = {
                            type: field.type,
                            label: fieldLabel,
                            id: field.id || 'no-id',
                            name: field.name || 'no-name',
                            depth: 0
                        };
                        
                        fields.push(fieldInfo);
                        console.log(`✅ Found field from fields property:`, fieldInfo);
                    }
                }
            }
            
            // Use Webflow's Designer API properly (fallback to manual scanning)
            if (fields.length === 0) {
                console.log(`🔍 Finding fields for form "${formName}"...`);
                
                try {
                    // Use Webflow's available API methods for form detection
                    const allElements = await webflow.getAllElements();
                    const formFields = [];
                    
                    // Find fields that belong to this specific form
                    for (const element of allElements) {
                        const elementType = element.type;
                        // 🎯 FILTER: Only process FormTextInput and FormTextArea (as per requirements)
                        const isFormField = elementType === 'FormTextInput' ||
                                           elementType === 'FormTextarea';
                        
                        if (!isFormField) continue;
                        
                        // Get field information - always extract the actual field label
                        let fieldLabel = '';
                        
                        // Webflow fields always have labels, so we should be able to get them
                        if (element.label && typeof element.label === 'object') {
                            // Label is an object, extract the actual text value
                            fieldLabel = element.label.value || element.label.text || element.label.name;
                        } else if (element.label) {
                            // Label is a direct value
                            fieldLabel = element.label;
                        } else if (element.name) {
                            // Fallback to name property
                            fieldLabel = element.name;
                        } else if (element.id && typeof element.id === 'object') {
                            // ID object might contain label information
                            fieldLabel = element.id.value || element.id.name;
                        }
                        
                        // If we still don't have a label, try to get it from the field's properties
                        if (!fieldLabel && element.getLabel) {
                            try {
                                fieldLabel = await element.getLabel();
                            } catch (error) {
                                console.log(`⚠️ Could not get label via getLabel() for field:`, error);
                            }
                        }
                        
                        // If we still don't have a label, try to get it from the field's properties
                        if (!fieldLabel && element.getName) {
                            try {
                                fieldLabel = await element.getName();
                            } catch (error) {
                                console.log(`⚠️ Could not get name via getName() for field:`, error);
                            }
                        }
                        
                        // Final fallback - use a descriptive placeholder that indicates we need to investigate
                        if (!fieldLabel) {
                            fieldLabel = `Field ${formFields.length + 1}`;
                            console.log(`⚠️ Could not extract label for field, using placeholder:`, element);
                        }
                        const fieldId = element.id;
                        const formElementId = formElement.id;
                        
                                                                        // Find actual field-to-form relationships using Webflow's official API methods
                        // Using proper Webflow Designer API: form.getName(), field.getRequired(), field.getName()
                        let belongsToThisForm = false;
                        
                        // Method 1: Use Webflow's official form structure analysis
                        // The formElement IS the FormForm, so we check its direct children
                        try {
                            // Get all children of the FormForm element
                            const formChildren = await formElement.getChildren();
                            // console.log(`🔍 Form "${formName}" has ${formChildren.length} children:`, formChildren.map(child => ({ type: child.type, id: child.id?.element })));
                            
                            // Debug: Show detailed children info
                            for (let i = 0; i < formChildren.length; i++) {
                                const child = formChildren[i];
                                // console.log(`🔍 Child ${i + 1}: type="${child.type}", id="${child.id?.element}"`);
                                
                                // If it's a DOMElement, check its children too
                                if (child.type === 'DOMElement') {
                                    try {
                                        const grandChildren = await child.getChildren();
                                        console.log(`   └─ Has ${grandChildren.length} grandchildren:`, grandChildren.map(gc => ({ type: gc.type, id: gc.id?.element })));
                            } catch (error) {
                                        console.log(`   └─ Error getting grandchildren:`, error);
                                    }
                                }
                            }
                            
                            // Check if this field is a direct child of the FormForm
                            belongsToThisForm = formChildren.some(child => 
                                child.id && child.id.element === fieldId.element
                            );
                            
                            if (belongsToThisForm) {
                                console.log(`✅ Field "${fieldLabel}" found as direct child of form "${formName}"`);
                            }
                            
                            // If not found in direct children, check nested children (Block elements, VFlex elements, and input wrappers)
                            if (!belongsToThisForm) {
                                for (const child of formChildren) {
                                    // Check VFlex elements (common in Webflow forms)
                                    if (child.type === 'VFlex') {
                                        try {
                                            const vflexChildren = await child.getChildren();
                                            // console.log(`🔍 Checking VFlex child with ${vflexChildren.length} children:`, vflexChildren.map(vc => ({ type: vc.type, id: vc.id?.element })));
                                            belongsToThisForm = vflexChildren.some(vflexChild => 
                                                vflexChild.id && vflexChild.id.element === fieldId.element
                                            );
                                            if (belongsToThisForm) {
                                                console.log(`✅ Field "${fieldLabel}" found in VFlex child of form "${formName}"`);
                                                break;
                                            }
                                            
                                            // Check even deeper nesting in VFlex elements
                                            for (const vflexChild of vflexChildren) {
                                                if (vflexChild.type === 'Block' || vflexChild.type === 'DOM' || vflexChild.type === 'VFlex' || vflexChild.type === 'HFlex' || vflexChild.type === 'Container') {
                                                    try {
                                                        const grandChildren = await vflexChild.getChildren();
                                                        // console.log(`🔍 Checking VFlex grandchild with ${grandChildren.length} children:`, grandChildren.map(gc => ({ type: gc.type, id: gc.id?.element })));
                                                        belongsToThisForm = grandChildren.some(grandChild => 
                                                            grandChild.id && grandChild.id.element === fieldId.element
                                                        );
                                                        if (belongsToThisForm) {
                                                            console.log(`✅ Field "${fieldLabel}" found in VFlex grandchild of form "${formName}"`);
                                                            break;
                    }
                } catch (error) {
                                                        console.log(`⚠️ Error checking VFlex grandchild:`, error);
                                                    }
                                                }
                                            }
                                        } catch (error) {
                                            console.log(`⚠️ Error checking VFlex child:`, error);
                                        }
                                    }
                                    
                                    // Check HFlex elements (common in Webflow forms)
                                    if (child.type === 'HFlex') {
                                        try {
                                            const hflexChildren = await child.getChildren();
                                            // console.log(`🔍 Checking HFlex child with ${hflexChildren.length} children:`, hflexChildren.map(hc => ({ type: hc.type, id: hc.id?.element })));
                                            belongsToThisForm = hflexChildren.some(hflexChild => 
                                                hflexChild.id && hflexChild.id.element === fieldId.element
                                            );
                                            if (belongsToThisForm) {
                                                console.log(`✅ Field "${fieldLabel}" found in HFlex child of form "${formName}"`);
                                                break;
                                            }
                                            
                                            // Check even deeper nesting in HFlex elements
                                            for (const hflexChild of hflexChildren) {
                                                if (hflexChild.type === 'Block' || hflexChild.type === 'DOM' || hflexChild.type === 'VFlex' || hflexChild.type === 'HFlex' || hflexChild.type === 'Container') {
                                                    try {
                                                        const grandChildren = await hflexChild.getChildren();
                                                        // console.log(`🔍 Checking HFlex grandchild with ${grandChildren.length} children:`, grandChildren.map(gc => ({ type: gc.type, id: gc.id?.element })));
                                                        belongsToThisForm = grandChildren.some(grandChild => 
                                                            grandChild.id && grandChild.id.element === fieldId.element
                                                        );
                                                        if (belongsToThisForm) {
                                                            console.log(`✅ Field "${fieldLabel}" found in HFlex grandchild of form "${formName}"`);
                                                            break;
                                                        }
                                    } catch (error) {
                                                        console.log(`⚠️ Error checking HFlex grandchild:`, error);
                                                    }
                                                }
                                            }
                                    } catch (error) {
                                            console.log(`⚠️ Error checking HFlex child:`, error);
                                        }
                                    }
                                    
                                    // Check Container elements (common in Webflow forms)
                                    if (child.type === 'Container') {
                                        try {
                                            const containerChildren = await child.getChildren();
                                            // console.log(`🔍 Checking Container child with ${containerChildren.length} children:`, containerChildren.map(cc => ({ type: cc.type, id: cc.id?.element })));
                                            belongsToThisForm = containerChildren.some(containerChild => 
                                                containerChild.id && containerChild.id.element === fieldId.element
                                            );
                                            if (belongsToThisForm) {
                                                console.log(`✅ Field "${fieldLabel}" found in Container child of form "${formName}"`);
                                                break;
                                            }
                                            
                                            // Check even deeper nesting in Container elements
                                            for (const containerChild of containerChildren) {
                                                if (containerChild.type === 'Block' || containerChild.type === 'DOM' || containerChild.type === 'VFlex' || containerChild.type === 'HFlex' || containerChild.type === 'Container') {
                                                    try {
                                                        const grandChildren = await containerChild.getChildren();
                                                        // console.log(`🔍 Checking Container grandchild with ${grandChildren.length} children:`, grandChildren.map(gc => ({ type: gc.type, id: gc.id?.element })));
                                                        belongsToThisForm = grandChildren.some(grandChild => 
                                                            grandChild.id && grandChild.id.element === fieldId.element
                                                        );
                                                        if (belongsToThisForm) {
                                                            console.log(`✅ Field "${fieldLabel}" found in Container grandchild of form "${formName}"`);
                                                            break;
                                                        }
                                                    } catch (error) {
                                                        console.log(`⚠️ Error checking Container grandchild:`, error);
                                                    }
                                                }
                                            }
                                        } catch (error) {
                                            console.log(`⚠️ Error checking Container child:`, error);
                                        }
                                    }
                                    
                                    // Check Block elements (common in Webflow forms)
                                    if (child.type === 'Block') {
                                        try {
                                            const blockChildren = await child.getChildren();
                                            // console.log(`🔍 Checking Block child with ${blockChildren.length} children:`, blockChildren.map(bc => ({ type: bc.type, id: bc.id?.element })));
                                            belongsToThisForm = blockChildren.some(blockChild => 
                                                blockChild.id && blockChild.id.element === fieldId.element
                                            );
                                            if (belongsToThisForm) {
                                                console.log(`✅ Field "${fieldLabel}" found in Block child of form "${formName}"`);
                                                break;
                                            }
                                            
                                            // Check even deeper nesting in Block elements
                                            for (const blockChild of blockChildren) {
                                                if (blockChild.type === 'Block' || blockChild.type === 'DOM' || blockChild.type === 'VFlex' || blockChild.type === 'HFlex' || blockChild.type === 'Container') {
                                                    try {
                                                        const grandChildren = await blockChild.getChildren();
                                                        // console.log(`🔍 Checking Block grandchild with ${grandChildren.length} children:`, grandChildren.map(gc => ({ type: gc.type, id: gc.id?.element })));
                                                        belongsToThisForm = grandChildren.some(grandChild => 
                                                            grandChild.id && grandChild.id.element === fieldId.element
                                                        );
                                                        if (belongsToThisForm) {
                                                            console.log(`✅ Field "${fieldLabel}" found in Block grandchild of form "${formName}"`);
                                                            break;
                                                        }
                    } catch (error) {
                                                        console.log(`⚠️ Error checking Block grandchild:`, error);
                                                    }
                                                }
                                            }
                                        } catch (error) {
                                            console.log(`⚠️ Error checking Block child:`, error);
                                        }
                                    }
                                    
                                    // Check DOM elements (Custom Elements from Add panel - when Block elements are converted)
                                    if (child.type === 'DOM') {
                                        try {
                                            const domChildren = await child.getChildren();
                                            // console.log(`🔍 Checking DOM child with ${domChildren.length} children:`, domChildren.map(dc => ({ type: dc.type, id: dc.id?.element })));
                                            belongsToThisForm = domChildren.some(domChild => 
                                                domChild.id && domChild.id.element === fieldId.element
                                            );
                                            if (belongsToThisForm) {
                                                console.log(`✅ Field "${fieldLabel}" found in DOM child of form "${formName}"`);
                                                break;
                                            }
                                            
                                            // Check even deeper nesting in DOM Elements
                                            for (const domChild of domChildren) {
                                                if (domChild.type === 'Block' || domChild.type === 'DOM' || domChild.type === 'VFlex' || domChild.type === 'HFlex' || domChild.type === 'Container') {
                                                    try {
                                                        const grandChildren = await domChild.getChildren();
                                                        // console.log(`🔍 Checking DOM grandchild with ${grandChildren.length} children:`, grandChildren.map(gc => ({ type: gc.type, id: gc.id?.element })));
                                                        belongsToThisForm = grandChildren.some(grandChild => 
                                                            grandChild.id && grandChild.id.element === fieldId.element
                                                        );
                                                        if (belongsToThisForm) {
                                                            console.log(`✅ Field "${fieldLabel}" found in DOM grandchild of form "${formName}"`);
                                                            break;
                                                        }
                                                    } catch (error) {
                                                        console.log(`⚠️ Error checking DOM grandchild:`, error);
                                                    }
                                                }
                                            }
                                        } catch (error) {
                                            console.log(`⚠️ Error checking DOM child:`, error);
                                        }
                                    }
                                    
                                    // Also check DOMElement wrappers (legacy support)
                                    if (child.type === 'DOMElement') {
                                        const wrapperChildren = await child.getChildren();
                                        // console.log(`🔍 Checking DOMElement wrapper with ${wrapperChildren.length} children:`, wrapperChildren.map(wc => ({ type: wc.type, id: wc.id?.element })));
                                        belongsToThisForm = wrapperChildren.some(wrapperChild => 
                                            wrapperChild.id && wrapperChild.id.element === fieldId.element
                                        );
                                        if (belongsToThisForm) {
                                            console.log(`✅ Field "${fieldLabel}" found in DOMElement wrapper of form "${formName}"`);
                                            break;
                                        }
                                    }
                                    
                                    if (belongsToThisForm) break;
                                }
                            }
                        } catch (error) {
                            console.log(`⚠️ Error checking form structure for "${formName}":`, error);
                        }
                        
                        // Method 2: Fallback - Use form boundary analysis
                        // This is the backup method when the proper form structure method fails
                        if (!belongsToThisForm) {
                            const formElementIndex = allElements.findIndex(el => el.id === formElementId);
                            const fieldElementIndex = allElements.indexOf(element);
                            
                            if (formElementIndex !== -1 && fieldElementIndex > formElementIndex) {
                                // Look for the next form element to determine the boundary
                                let nextFormIndex = -1;
                                for (let i = formElementIndex + 1; i < allElements.length; i++) {
                                    if (allElements[i].type === 'FormForm') {
                                        nextFormIndex = i;
                                        break;
                                    }
                                }
                                
                                // If field is between this form and the next form, it belongs to this form
                                if (nextFormIndex === -1 || fieldElementIndex < nextFormIndex) {
                                    belongsToThisForm = true;
                                }
                            }
                        }
                        
                        if (belongsToThisForm) {
                            // 🎯 FILTER: Check if field label matches our criteria (Name, Email, Phone, URL, Message)
                            const labelLower = fieldLabel.toLowerCase().trim();
                            const isRelevantField = labelLower.includes('name') || 
                                                   labelLower.includes('email') || 
                                                   labelLower.includes('phone') || 
                                                   labelLower.includes('url') ||
                                                   labelLower.includes('website') ||
                                                   labelLower.includes('telephone') ||
                                                   labelLower.includes('tel') ||
                                                   labelLower.includes('mobile') ||
                                                   labelLower.includes('cell') ||
                                                   labelLower.includes('message') ||
                                                   labelLower.includes('comment') ||
                                                   labelLower.includes('description') ||
                                                   labelLower.includes('notes') ||
                                                   labelLower.includes('feedback') ||
                                                   labelLower.includes('inquiry');
                            
                            if (!isRelevantField) {
                                console.log(`⏭️ Skipping field "${fieldLabel}" - doesn't match Name/Email/Phone/URL/Message criteria`);
                                continue;
                            }
                            
                            // Use Webflow's official API methods to get field information
                            let fieldName = fieldLabel;
                            let isRequired = true; // Default to true, will be updated below
                            
                            // Get field name using Webflow's getName() method
                            try {
                                if (element.getName) {
                                    const apiFieldName = await element.getName();
                                    if (apiFieldName) {
                                        fieldName = apiFieldName;
                                    }
                                }
                            } catch (error) {
                                console.log(`⚠️ Could not get field name via getName() for "${fieldLabel}":`, error);
                            }
                            
                            // Get required status using Webflow's getRequired() method
                            try {
                                if (element.getRequired) {
                                    isRequired = await element.getRequired();
                                }
                                } catch (error) {
                                // Silently handle errors - fallback to false
                            }
                            
                            // Clean up field type display by removing "Form" prefix
                            const cleanType = elementType.replace(/^Form/, '');
                            
                            // 🎯 FILTER: Check field type and determine if it matches our criteria
                            let fieldType = 'plain'; // Default type
                            let isValidFieldType = false;
                            
                            // Determine field type based on label and element type
                            if (isLikelyEmailField(fieldLabel)) {
                                fieldType = 'email';
                                isValidFieldType = true;
                            } else if (isLikelyPhoneField(fieldLabel)) {
                                fieldType = 'phone';
                                isValidFieldType = true;
                            } else if (isLikelyUrlField(fieldLabel)) {
                                fieldType = 'url';
                                isValidFieldType = true;
                            } else if (labelLower.includes('name')) {
                                fieldType = 'plain';
                                isValidFieldType = true;
                            } else if (labelLower.includes('message') || labelLower.includes('comment') || 
                                       labelLower.includes('description') || labelLower.includes('notes') ||
                                       labelLower.includes('feedback') || labelLower.includes('inquiry')) {
                                fieldType = 'message';
                                isValidFieldType = true;
                            }
                            
                            // Skip if field type doesn't match our criteria
                            if (!isValidFieldType) {
                                console.log(`⏭️ Skipping field "${fieldLabel}" - field type "${fieldType}" doesn't match criteria`);
                                continue;
                            }
                            
                            const fieldInfo = {
                                type: cleanType,
                                fieldType: fieldType, // Add the determined field type
                                label: fieldLabel,
                                name: fieldName,
                                id: fieldId,
                                depth: element.depth || 0,
                                required: isRequired
                            };
                            
                            // Only add fields that are actually required
                            if (isRequired) {
                            formFields.push(fieldInfo);
                                console.log(`✅ Required field found for form "${formName}":`, {
                                    type: cleanType,
                                    fieldType: fieldType,
                                    label: fieldLabel,
                                    name: fieldName,
                                    required: isRequired,
                                    depth: element.depth || 0,
                                    formDepth: formElement.depth || 0,
                                    fieldElementId: fieldId.element,
                                    formElementId: formElementId.element
                                });
                            } else {
                                console.log(`⏭️ Skipping non-required field "${fieldLabel}" for form "${formName}"`);
                            }
                        } else {
                            // Debug: Log why field was not associated with this form
                            // console.log(`❌ Field "${fieldLabel}" (${elementType}) not associated with form "${formName}":`, {
                            //     fieldDepth: element.depth || 0,
                            //     formDepth: formElement.depth || 0,
                            //     fieldElementId: fieldId.element,
                            //     formElementId: formElementId.element,
                            //     hasDirectRelationship: !!(element.formId || element.formName || element.parentForm)
                            // });
                        }
                    }
                    
                    console.log(`🔍 Found ${formFields.length} fields for form "${formName}"`);
                    
                    // Add all found fields to the main fields array
                    fields.push(...formFields);
                    // Don't return here - continue to return the form object
                    
                } catch (error) {
                    console.log(`⚠️ Error in field detection:`, error);
                    return fields;
                }
            }
            
            console.log(`📊 FormForm ${index + 1} has ${fields.length} fields:`, fields);
            
            // Check required field limits for starter plan
            if (PLAN_ENFORCEMENT_ACTIVE && fields.length > 0) {
                const requiredLimitCheck = await checkRequiredFieldLimit({
                    name: formName,
                    fields: fields
                });
                
                if (requiredLimitCheck.exceeded) {
                    console.warn(`⚠️ Form "${formName}" exceeds required field limit`);
                    // Show warning but continue processing - don't stop scanning
                    updateStatus(requiredLimitCheck.message, 'warning');
                    showWarningNotification(requiredLimitCheck.notificationMessage);
                    // Continue processing this form but mark it as limited
                    return {
                        id: formUniqueId.instance, // Use Webflow instance ID for database consistency
                        name: formName,
                        fields: fields,
                        element: formElement,
                        hasExistingValidations: hasExistingValidations,
                        existingValidationData: existingValidationData,
                        limitExceeded: true,
                        limitMessage: requiredLimitCheck.message
                    };
                }
            }
            
            return {
                id: formUniqueId.instance, // Use Webflow instance ID for database consistency
                name: formName,
                fields: fields,
                element: formElement,
                hasExistingValidations: hasExistingValidations,
                existingValidationData: existingValidationData
            };
        }));
        } catch (error) {
            // Re-throw errors (no longer catching required field limit errors)
            throw error;
        }
        
        // Debug: Log what we have before filtering
        console.log(`🔍 Debug: Forms array before filtering:`, forms);
        forms.forEach((form, index) => {
            console.log(`🔍 Form ${index}:`, {
                name: form.name,
                hasFields: !!form.fields,
                fieldsType: typeof form.fields,
                fieldsLength: form.fields ? form.fields.length : 'N/A',
                fields: form.fields
            });
        });
        
        // Filter out forms with 0 fields (not real forms)
        const validForms = forms.filter(form => {
            // Safety check: ensure form.fields exists and is an array
            if (!form.fields || !Array.isArray(form.fields)) {
                console.log(`⚠️ Form "${form.name}" has invalid fields property - excluding from results`);
                return false;
            }
            
            if (form.fields.length === 0) {
                console.log(`⚠️ Form "${form.name}" has no fields - excluding from results`);
                return false;
            }
            
            if (form.fields.length < 1) {
                console.log(`⚠️ Form "${form.name}" has insufficient fields (${form.fields.length}) - excluding from results`);
                return false;
            }
            
            console.log(`✅ Form "${form.name}" validated with ${form.fields.length} fields`);
            return true;
        });
        
        console.log(`📊 Form validation complete: ${forms.length} total forms, ${validForms.length} valid forms`);
        console.log('✅ Valid forms:', validForms);
        
        // Check form limits for starter plan
        if (PLAN_ENFORCEMENT_ACTIVE) {
            // Check if approaching limits (within 20%)
            const approachingWarnings = await checkApproachingLimits(validForms);
            approachingWarnings.forEach(warning => {
                updateStatus(warning.message, 'warning');
                showWarningNotification(warning.notificationMessage);
            });
            
            // Check if limits are exceeded
            const formLimitCheck = await checkTotalFormsLimit(validForms);
            if (formLimitCheck.exceeded) {
                updateStatus(formLimitCheck.message, 'warning');
                showWarningNotification(formLimitCheck.notificationMessage);
                // Continue processing - don't stop scanning
            }
        }
        
        // Display detailed field information for debugging
        displayFormFieldDetails(validForms);
        
        scannedForms = validForms;
        await updateFormsList(validForms);
        
        // Update validation states based on valid forms
        validForms.forEach(form => {
            // Always update validation states to reflect current form state
            validationStates.set(form.id, {
                hasValidation: form.hasExistingValidations || false,
                appliedAt: form.hasExistingValidations ? new Date().toISOString() : null,
                settings: null,
                status: form.hasExistingValidations ? 'applied' : 'none'
            });
        });
        
        // Update remove button visibility after scanning
        updateRemoveButtonVisibility();
        
        if (validForms.length > 0) {
            updateStatus(`Found ${validForms.length} valid form${validForms.length > 1 ? 's' : ''} on page`, 'success');
            // showSuccessNotification(`Found ${validForms.length} valid form${validForms.length > 1 ? 's' : ''} on page`);
        }
        else {
            updateStatus('No valid forms found on this page', 'warning');
            showWarningNotification('No valid forms found on this page');
        }
    }
    catch (error) {
        console.error('❌ Failed to scan page:', error);
        updateStatus('Failed to scan page for forms - Check console for details', 'error');
        showErrorNotification('Failed to scan page for forms');
        try {
            console.log('🔄 Trying fallback form detection...');
            const currentPage = await webflow.getCurrentPage();
            if (currentPage) {
                console.log('📄 Current page:', currentPage);
                updateStatus('Using fallback form detection method', 'info');
            }
        }
        catch (fallbackError) {
            console.error('❌ Fallback form detection also failed:', fallbackError);
        }
    }
}

// Debug function to display detailed field information
function displayFormFieldDetails(forms) {
    console.log('🔍 === FORM FIELD DETAILS DEBUG ===');
    forms.forEach((form, index) => {
        console.log(`📋 Form ${index + 1}: "${form.name}"`);
        console.log(`   ID: ${form.id}`);
        console.log(`   Fields: ${form.fields ? form.fields.length : 0}`);
        
        if (form.fields && form.fields.length > 0) {
            form.fields.forEach((field, fieldIndex) => {
                console.log(`   Field ${fieldIndex + 1}:`);
                console.log(`     Type: ${field.type}`);
                console.log(`     Label: ${field.label}`);
                console.log(`     Name: ${field.name}`);
                console.log(`     Required: ${field.required}`);
                console.log(`     Depth: ${field.depth}`);
                console.log(`     ID:`, field.id);
            });
        } else {
            console.log(`   No fields detected`);
        }
        console.log('---');
    });
    console.log('🔍 === END FORM FIELD DETAILS ===');
}

async function updateFormsList(forms) {
    const formsList = document.getElementById('forms-list');
    const formsContainer = document.getElementById('forms-container');
    const noFormsMessage = document.getElementById('no-forms-found');
    const formsCountDisplay = document.getElementById('forms-count-display');
    
    if (formsList && formsContainer && noFormsMessage) {
        if (forms.length > 0) {
            // Update form count display
            if (formsCountDisplay) {
                formsCountDisplay.textContent = `${forms.length} form${forms.length === 1 ? '' : 's'} found - Select forms to validate`;
            }
            formsList.style.display = 'block';
            noFormsMessage.style.display = 'none';
            
            // Get plan limits once for all forms
            const planLimits = await getCurrentPlanLimits();
            const maxRequiredFields = planLimits.limits.max_required_fields_per_form;
            
            formsContainer.innerHTML = forms.map((form, index) => {
                const fields = form.fields || [];
                const fieldTypes = [...new Set(fields.map(field => field.type || 'unknown'))];
                // 🔒 CRITICAL: Field Label Display - DO NOT MODIFY
                // This ensures ALL field labels are shown (not limited to 5)
                // Modifying this will limit field visibility
                const fieldLabels = fields.map(field => {
                    // Handle label object structure - extract the actual text value
                    if (field.label && typeof field.label === 'object') {
                        return field.label.value || field.label.text || field.label.name;
                    }
                    return field.label || field.name;
                }).map(label => label || 'unnamed'); // Show ALL field labels with fallback
                
                // Check validation status
                const hasValidation = form.hasExistingValidations || false;
                const validationStatus = hasValidation ? 'has-validation' : 'no-validation';
                const validationText = hasValidation ? 'Validation applied' : 'No validation applied';
                const validationIcon = hasValidation ? '✅' : '❌';
                
                // Check if form exceeded required field limit
                const limitExceeded = form.limitExceeded || false;
                const requiredFieldsCount = fields.filter(f => f.required === true).length;
                const limitStatus = limitExceeded ? 'limit-exceeded' : 'limit-ok';
                const limitText = limitExceeded ? `Exceeds limit (${requiredFieldsCount}/${maxRequiredFields})` : `Within limit (${requiredFieldsCount}/${maxRequiredFields})`;
                const limitIcon = limitExceeded ? '⚠️' : '✅';
                
                // Use sequential ID for UI display (form-0, form-1, etc.)
                const formIdValue = `form-${index}`;
                
                return `
                <div class="form-item" data-form-id="${formIdValue}" data-has-validation="${hasValidation}">
                    <div class="form-info-section">
                        <div class="form-header">
                            <h4 class="form-name">${form.name || `Form ${index + 1}`}</h4>
                        </div>
                        <div class="form-details">
                            <div class="field-count">📊 ${fields.length} total fields (${fields.filter(f => f.required === true).length} required)</div>
                            <div class="field-types">🔧 Types: ${fieldTypes.join(', ') || 'No types detected'}</div>
                            <div class="field-labels">📝 Fields: ${fieldLabels.length > 0 ? fieldLabels.join(', ') : 'No field labels detected'}</div>
                        </div>
                        <div class="validation-status">
                            <div class="validation-indicator ${validationStatus}">
                                <span class="validation-text">${validationIcon} ${validationText}</span>
                            </div>
                        </div>
                        <div class="limit-status">
                            <div class="limit-indicator ${limitStatus}">
                                <span class="limit-text">${limitIcon} ${limitText}</span>
                            </div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <div class="form-checkbox">
                            <input type="checkbox" id="form-${index}" data-form-id="${formIdValue}" ${limitExceeded ? 'disabled' : ''}>
                            <label for="form-${index}" ${limitExceeded ? 'class="disabled-label"' : ''}>Select</label>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            forms.forEach((form, index) => {
                const checkbox = document.getElementById(`form-${index}`);
                // Use sequential ID for UI display (form-0, form-1, etc.)
                const formIdValue = `form-${index}`;
                const formItem = document.querySelector(`[data-form-id="${formIdValue}"]`);
                
                console.log(`🔧 Setting up form ${index}: checkbox element exists=${!!checkbox}, checked=${checkbox?.checked || false}, formIdValue="${formIdValue}"`);
                
                if (checkbox) {
                    checkbox.addEventListener('change', (e) => {
                        console.log(`🔧 Checkbox ${index} changed: checked=${e.target.checked}, formId=${e.target.dataset.formId}`);
                        console.log(`🔧 Checkbox element:`, e.target);
                        console.log(`🔧 Checkbox checked property:`, e.target.checked);
                        handleFormSelection(e.target);
                    });
                    
                    // Add click and focus event listeners for disabled forms
                    if (checkbox.disabled) {
                        checkbox.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Let handleFormSelection handle the error message
                            handleFormSelection(checkbox);
                        });
                        
                        checkbox.addEventListener('focus', (e) => {
                            // Let handleFormSelection handle the error message
                            handleFormSelection(checkbox);
                        });
                    }
                }
                
                // Make entire form item clickable
                if (formItem) {
                    formItem.addEventListener('click', (e) => {
                        // Don't trigger if clicking on the checkbox itself
                        if (e.target.type === 'checkbox' || e.target.tagName === 'LABEL') {
                            return;
                        }
                        
                        // Toggle checkbox
                        if (checkbox) {
                            const newState = !checkbox.checked;
                            checkbox.checked = newState;
                            // console.log(`🔧 Form item clicked: toggled checkbox ${index} to ${newState}`);
                            // console.log(`🔧 Checkbox element after toggle:`, checkbox);
                            // console.log(`🔧 Checkbox checked property after toggle:`, checkbox.checked);
                            handleFormSelection(checkbox);
                        }
                    });
                    
                    // Add cursor pointer to indicate clickable
                    formItem.style.cursor = 'pointer';
                }
            });
        }
        else {
            formsList.style.display = 'none';
            noFormsMessage.style.display = 'block';
        }
    }
}
async function handleFormSelection(checkbox) {
    const formId = checkbox.dataset.formId;
    const formItem = checkbox.closest('.form-item');
    
    // Check if form is disabled due to limit exceeded
    if (checkbox.disabled) {
        // Prevent selection and show error message
        checkbox.checked = false;
        if (formItem) {
            formItem.classList.remove('selected');
        }
        
        // Get form name for error message
        const formNameElement = formItem?.querySelector('.form-name');
        const formName = formNameElement?.textContent || 'Unknown Form';
        
        // Get required field count
        const limitIndicator = formItem?.querySelector('.limit-indicator .limit-text');
        const limitText = limitIndicator?.textContent || '';
        const requiredCountMatch = limitText.match(/(\d+)\/(\d+)/);
        const requiredCount = requiredCountMatch ? requiredCountMatch[1] : 'unknown';
        const maxRequired = requiredCountMatch ? requiredCountMatch[2] : 'unknown';
        
        // Show error message in panel
        const errorMessage = `Form "${formName}" has ${requiredCount} required fields (limit: ${maxRequired}) | <a href="https://www.a11yformvalidator.com" target="_blank" class="upgrade-link">Sign up</a> now to learn when our Pro and Agency plans will be available or remove over limit fields to continue`;
        updateStatus(errorMessage, 'error');
        
        // Show Webflow notification
        const notificationMessage = `Required field limit exceeded (${requiredCount}/${maxRequired} fields)`;
        showErrorNotification(notificationMessage);
        
        console.log(`🚫 Form ${formId} selection blocked - exceeds required field limit`);
        return;
    }
    
    if (formItem) {
        if (checkbox.checked) {
            formItem.classList.add('selected');
        }
        else {
            formItem.classList.remove('selected');
        }
    }
    console.log(`🔧 Form ${formId} ${checkbox.checked ? 'selected' : 'deselected'}`);
    console.log(`🔧 Checkbox state: checked=${checkbox.checked}, formId=${formId}`);
    
    // Check form selection limits
    if (checkbox.checked) {
        const selectedForms = getSelectedForms();
        const limits = await getCurrentPlanLimits();
        
        if (selectedForms.length > limits.limits.max_forms) {
            // Uncheck the checkbox and show error
            checkbox.checked = false;
            if (formItem) {
                formItem.classList.remove('selected');
            }
            
            const errorMessage = `Cannot select ${selectedForms.length} forms. Maximum ${limits.limits.max_forms} forms allowed | <a href="https://www.a11yformvalidator.com" target="_blank" class="upgrade-link">Sign up</a> now to learn when our Pro and Agency plans will be available`;
            updateStatus(errorMessage, 'error');
            showErrorNotification(`Form selection limit exceeded (${selectedForms.length}/${limits.limits.max_forms} forms)`);
            return;
        }
    }
    
    // Show notification for form selection count
    try {
        console.log('🔧 About to call getSelectedForms()');
        const selectedForms = getSelectedForms();
        console.log(`🔧 Selected forms count: ${selectedForms.length}`);
        if (selectedForms.length > 0) {
            // showInfoNotification(`${selectedForms.length} form${selectedForms.length > 1 ? 's' : ''} selected`);
        }
    } catch (error) {
        console.error('❌ Error in getSelectedForms():', error);
    }
}

// Handle Select All Forms button click
function handleSelectAllForms() {
    console.log('🔧 Select All button clicked');
    
    const formCheckboxes = document.querySelectorAll('#forms-container .form-checkbox input[type="checkbox"]');
    let selectedCount = 0;
    
    formCheckboxes.forEach(checkbox => {
        if (!checkbox.checked) {
            checkbox.checked = true;
            handleFormSelection(checkbox);
            selectedCount++;
        }
    });
    
    if (selectedCount > 0) {
        // showInfoNotification(`Selected all ${formCheckboxes.length} forms`);
        console.log(`🔧 Selected all ${formCheckboxes.length} forms`);
    } else {
        // showInfoNotification('All forms are already selected');
        console.log('🔧 All forms were already selected');
    }
}

// Handle Deselect All Forms button click
function handleDeselectAllForms() {
    console.log('🔧 Deselect All button clicked');
    
    const formCheckboxes = document.querySelectorAll('#forms-container .form-checkbox input[type="checkbox"]');
    let deselectedCount = 0;
    
    formCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            checkbox.checked = false;
            handleFormSelection(checkbox);
            deselectedCount++;
        }
    });
    
    if (deselectedCount > 0) {
        // showInfoNotification(`Deselected all ${formCheckboxes.length} forms`);
        console.log(`🔧 Deselected all ${formCheckboxes.length} forms`);
    } else {
        // showInfoNotification('No forms are currently selected');
        console.log('🔧 No forms were selected to deselect');
    }
}

// Handle Close Forms List button click
function handleCloseFormsList() {
    console.log('🔧 Close forms list button clicked');
    
    const formsList = document.getElementById('forms-list');
    if (formsList) {
        formsList.style.display = 'none';
        console.log('🔧 Forms list hidden');
    }
}

// Function to check if any forms have validation and show/hide remove button
function updateRemoveButtonVisibility() {
    const removeAllBtn = document.getElementById('remove-all-validations');
    if (!removeAllBtn) return;
    
    // Check if any forms have validation applied (exclude removed states)
    const validationStatesArray = Array.from(validationStates.values());
    const hasValidatedForms = validationStatesArray.some(state => state.hasValidation && state.status !== 'removed');
    
    console.log('🔍 Remove button visibility check:', {
        totalValidationStates: validationStatesArray.length,
        validationStates: validationStatesArray.map(state => ({
            hasValidation: state.hasValidation,
            status: state.status
        })),
        hasValidatedForms
    });
    
    if (hasValidatedForms) {
        removeAllBtn.style.display = 'block';
        console.log('✅ Showing Remove All Validations button - validated forms found');
    } else {
        removeAllBtn.style.display = 'none';
        console.log('ℹ️ Hiding Remove All Validations button - no validated forms found');
    }
}

// 🔒 CRITICAL: Handle remove all validations button click
async function handleRemoveAllValidations() {
    console.log('🗑️ Remove all validations button clicked');
    
    if (!isWebflowDesigner) {
        updateStatus('Preview: Would remove all validations', 'info');
        return;
    }
    
    try {
        // Get selected forms
        const selectedForms = getSelectedForms();
        if (selectedForms.length === 0) {
            updateStatus('Please select at least one form to remove validations from', 'warning');
            return;
        }
        
        // Calculate total fields for progress tracking
        const totalFields = selectedForms.reduce((total, form) => total + (form.fields?.length || 0), 0);
        
        // Start enhanced progress tracking
        startValidationProgress('removing', selectedForms.length, totalFields);
        
        // Show the removal process message
        const removeValidationContainer = document.getElementById('remove-validation-container');
        if (removeValidationContainer) {
            removeValidationContainer.classList.add('processing');
        }
        
        updateStatus('Removing validations from selected forms...', 'info');
        console.log(`🗑️ Removing validations from ${selectedForms.length} selected forms...`);
        
        let successCount = 0;
        let failureCount = 0;
        
        for (let i = 0; i < selectedForms.length; i++) {
            const form = selectedForms[i];
            const formName = form.name || form.id || `Form ${i + 1}`;
            const totalFormFields = form.fields?.length || 0;
            
            // Update form progress
            updateFormProgress(formName, i, totalFormFields);
            
            try {
                console.log(`🗑️ Removing validations from form: ${form.id}`);
            await removeAllValidations(form.element, form.fields, formName);
                successCount++;
                showFormNotification(formName, 'remove', true);
            } catch (error) {
                console.error(`❌ Failed to remove validations from form ${form.id}:`, error);
                failureCount++;
                showFormNotification(formName, 'remove', false);
            }
        }
        
        // Complete progress tracking
        completeValidationProgress(successCount, failureCount);
        
        // Update validation states and remove from database
        for (const form of selectedForms) {
            validationStates.set(form.id, {
                hasValidation: false,
                appliedAt: null,
                settings: null,
                status: 'removed'
            });
            
            // Remove from database
            try {
                if (window.databaseAPI && window.databaseAPI.siteId) {
                    console.log('🗑️ Removing validation state from database for form:', form.id);
                    await window.databaseAPI.removeValidationState(form.id);
                    console.log('✅ Validation state removed from database for form:', form.id);
                }
            } catch (error) {
                console.warn('⚠️ Failed to remove validation state from database:', error);
                // Don't fail the entire operation for database errors
            }
        }
        
        // Add a small delay to ensure all database operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        updateStatus(`✅ Removed validations from ${selectedForms.length} selected form(s)`, 'success');
        
        // Hide the removal process message
        if (removeValidationContainer) {
            removeValidationContainer.classList.remove('processing');
        }
        
        // Update remove button visibility after removing validation
        updateRemoveButtonVisibility();
        
        // Update the total validated forms count with persistence
        // Recalculate from database after all removals are complete
        console.log('🔄 Recalculating validation count after removals...');
        const actualCount = await getTotalValidatedForms();
        console.log('📊 Actual count from database after removals:', actualCount);
        await updateValidationCountWithPersistence(actualCount);
        console.log('✅ Validation count updated to:', actualCount);
        
        // Refresh the forms list to show updated validation status
        await handleScanPage();
        
    } catch (error) {
        console.error('❌ Failed to remove all validations:', error);
        updateStatus('Failed to remove validations from selected forms', 'error');
        showErrorNotification('Failed to remove validations from selected forms');
        
        // Hide the removal process message on error
        if (removeValidationContainer) {
            removeValidationContainer.classList.remove('processing');
        }
    }
}

async function handleApplyValidation() {
    console.log('🚀 Applying validation to selected forms...');
    
    if (!isWebflowDesigner) {
        updateStatus('Preview: Would apply validation to selected forms', 'info');
        return;
    }
    
    const selectedForms = getSelectedForms();
    if (selectedForms.length === 0) {
        updateStatus('Please select at least one form to configure', 'error');
        return;
    }
    
    // Get plan limits for all checks
    const planLimits = await getCurrentPlanLimits();
    const limits = planLimits.limits;
    
    // Check total forms limit using database API
    if (window.databaseAPI && window.databaseAPI.siteId) {
        console.log('🔍 Checking site-wide limits using database API...');
        try {
            const limitCheck = await window.databaseAPI.canAddForms(selectedForms.length);
            
            if (!limitCheck.allowed) {
                console.log('❌ Site-wide limit exceeded:', limitCheck);
                updateStatus(limitCheck.message, 'error');
                showErrorNotification(`Site-wide form limit exceeded (${limitCheck.wouldBe}/${limitCheck.limit} forms)`);
                return;
            }
            
            console.log('✅ Site-wide limit check passed:', limitCheck);
        } catch (error) {
            console.warn('⚠️ Database API failed, falling back to local limit checking:', error);
            // Fall through to fallback logic below
        }
    }
    
    // Fallback to local limit checking (if database API not available or failed)
    if (!window.databaseAPI || !window.databaseAPI.siteId) {
        console.log('⚠️ Database API not available, using fallback limit checking...');
    }
    
    const currentValidatedForms = await getTotalValidatedForms();
    const totalFormsAfterValidation = currentValidatedForms + selectedForms.length;
    
    if (totalFormsAfterValidation > limits.max_forms) {
        const errorMessage = `Cannot validate ${selectedForms.length} forms. Total forms would exceed limit (${totalFormsAfterValidation}/${limits.max_forms}) | <a href="https://www.a11yformvalidator.com" target="_blank" class="upgrade-link">Sign up</a> now to learn when our Pro and Agency plans will be available`;
        updateStatus(errorMessage, 'error');
        showErrorNotification(`Form limit exceeded (${totalFormsAfterValidation}/${limits.max_forms} forms)`);
        return;
    }
    
    // Check page-level form limit
    if (selectedForms.length > limits.max_forms) {
        const errorMessage = `Cannot validate ${selectedForms.length} forms on this page. Maximum ${limits.max_forms} forms per page allowed | <a href="https://www.a11yformvalidator.com" target="_blank" class="upgrade-link">Sign up</a> now to learn when our Pro and Agency plans will be available`;
        updateStatus(errorMessage, 'error');
        showErrorNotification(`Page form limit exceeded (${selectedForms.length}/${limits.max_forms} forms)`);
        return;
    }
    
    
    
    const settings = getValidationSettings();
    console.log('⚙️ Validation settings:', settings);
    
    try {
        // Calculate total fields for progress tracking
        const totalFields = selectedForms.reduce((total, form) => total + (form.fields?.length || 0), 0);
        
        // Start enhanced progress tracking
        startValidationProgress('applying', selectedForms.length, totalFields);
        
        updateStatus(`Applying validation to ${selectedForms.length} form${selectedForms.length > 1 ? 's' : ''}...`, 'info');
        
        let successCount = 0;
        let failureCount = 0;
        
        for (let i = 0; i < selectedForms.length; i++) {
            const form = selectedForms[i];
            const formName = form.name || form.id || `Form ${i + 1}`;
            const totalFormFields = form.fields?.length || 0;
            
            // Update form progress
            updateFormProgress(formName, i, totalFormFields);
            
            try {
                await applyValidationToForm(form, settings, i);
                successCount++;
                updateFormValidationStatus(form, true);
                showFormNotification(formName, 'apply', true);
            } catch (error) {
                console.error(`❌ Failed to apply validation to form ${form.id}:`, error);
                failureCount++;
                updateFormValidationStatus(form, false);
                showFormNotification(formName, 'apply', false);
            }
        }
        
        // Complete progress tracking
        completeValidationProgress(successCount, failureCount);
        
        if (successCount === selectedForms.length) {
            // Update validated forms count with persistence
            const currentCount = await getTotalValidatedForms();
            await updateValidationCountWithPersistence(currentCount + successCount);
            
            updateStatus(`✅ Validation applied to all ${successCount} forms successfully!`, 'success');
        } else if (successCount > 0) {
            // Update validated forms count for successful forms with persistence
            const currentCount = await getTotalValidatedForms();
            await updateValidationCountWithPersistence(currentCount + successCount);
            
            updateStatus(`⚠️ Validation applied to ${successCount}/${selectedForms.length} forms (${failureCount} failed)`, 'warning');
        } else {
            updateStatus(`❌ Failed to apply validation to any forms`, 'error');
        }
        
        // Update remove button visibility after applying validation
        updateRemoveButtonVisibility();
        
        // Update validated forms count display
        await displayValidatedFormsCount();
    } catch (error) {
        console.error('❌ Failed to apply validation:', error);
        updateStatus('Failed to apply validation - See console for details', 'error');
        showErrorNotification('Failed to apply validation');
    }
}
// Get total number of validated forms across all sites/pages
async function getTotalValidatedForms() {
    try {
        // Use database API for true site-wide tracking
        if (window.databaseAPI && window.databaseAPI.siteId) {
            const totalForms = await window.databaseAPI.getTotalValidatedForms();
            console.log('📊 Database API: Total validated forms across site:', totalForms);
            return totalForms;
        }
        
        // Fallback to extension settings if database API not available
        if (typeof webflow !== 'undefined' && webflow.getExtensionSettings) {
            const settings = await webflow.getExtensionSettings();
            const fallbackCount = settings.validatedFormsCount || 0;
            console.log('📊 Fallback: Total validated forms from settings:', fallbackCount);
            return fallbackCount;
        }
    } catch (error) {
        console.warn('⚠️ Could not get validated forms count:', error);
    }
    return 0;
}

// Get plan form limit for the current user/site
async function getPlanFormLimit() {
    try {
        // Use database API to get plan limits
        if (window.databaseAPI && window.databaseAPI.siteData && window.databaseAPI.siteData.id) {
            try {
                const planLimits = await window.databaseAPI.checkPlanLimits('forms', 'site');
                console.log('📊 Database API: Plan form limits:', planLimits);
                return planLimits.limit;
            } catch (error) {
                console.warn('⚠️ Could not get plan limits from database API:', error);
            }
        }
        
        // Fallback to current plan system
        const plan = await getCurrentPlanLimits();
        if (plan && plan.limits && plan.limits.max_forms !== undefined) {
            return plan.limits.max_forms;
        }
        
        // Default fallback based on plan tiers
        switch (currentPlan) {
            case 'STARTER':
                return 5; // From PLAN_TIERS.STARTER.limits.max_forms
            case 'PRO':
                return 25; // Updated Pro plan limit
            case 'AGENCY':
                return -1; // Unlimited
            case 'ADMIN':
                return -1; // Unlimited
            default:
                return 5; // Default to starter plan limit
        }
    } catch (error) {
        console.warn('⚠️ Could not get plan form limit:', error);
        return 5; // Default to starter plan limit
    }
}

// Update total validated forms count
async function updateTotalValidatedForms(count) {
    try {
        if (typeof webflow !== 'undefined' && webflow.setExtensionSettings) {
            await webflow.setExtensionSettings({ validatedFormsCount: count });
            console.log(`📊 Updated validated forms count: ${count}`);
        }
    } catch (error) {
        console.warn('⚠️ Could not update validated forms count:', error);
    }
}

function getSelectedForms() {
    try {
            // console.log('🔍 getSelectedForms() called');
    // console.log('🔍 scannedForms length:', scannedForms.length);
        
        // Debug: Check all checkboxes first
        const allCheckboxes = document.querySelectorAll('.form-checkbox input[type="checkbox"]');
        // console.log('🔍 Total checkboxes found:', allCheckboxes.length);
        
        allCheckboxes.forEach((checkbox, index) => {
            // console.log(`🔍 Checkbox ${index}: checked=${checkbox.checked}, formId=${checkbox.dataset.formId}, id=${checkbox.id}`);
        });
        
        const selectedCheckboxes = document.querySelectorAll('.form-checkbox input[type="checkbox"]:checked');
        // console.log('🔍 Selected checkboxes:', selectedCheckboxes.length);
        
        if (selectedCheckboxes.length === 0) {
            console.log('🔍 No checkboxes are checked!');
            return [];
        }
        
        return Array.from(selectedCheckboxes).map(checkbox => {
            const formId = checkbox.dataset.formId;
            // console.log('🔍 Looking for form with ID:', formId);
            
            // Extract the index from the formId (e.g., "form-0" -> 0)
            const formIndex = parseInt(formId.replace('form-', ''));
            // console.log('🔍 Extracted form index:', formIndex);
            
            // Get the form directly by index from scannedForms
            const form = scannedForms[formIndex];
            
            if (form) {
                // console.log('✅ Found matching form by index:', form);
            } else {
                console.log('❌ No matching form found for index:', formIndex);
                console.log('🔍 Available forms:', scannedForms.map((f, i) => ({
                    index: i,
                    id: f.id,
                    name: f.name
                })));
            }
            
            return form;
        }).filter(Boolean);
    } catch (error) {
        console.error('❌ Error in getSelectedForms():', error);
        return [];
    }
}
function getValidationSettings() {
    return {
        rules: {
            required: true, // Always Active - Core validation feature
            email: true, // Always Active - Core validation feature
            phone: true, // Always Active - Core validation feature
            url: true, // Always Active - Core validation feature
            minLengthText: parseInt(document.getElementById('min-length-text')?.value || '0'),
            maxLengthText: parseInt(document.getElementById('max-length-text')?.value || '100'),
            minLengthTextarea: parseInt(document.getElementById('min-length-textarea')?.value || '0'),
            maxLengthTextarea: parseInt(document.getElementById('max-length-textarea')?.value || '500'),
        },
        fieldMessaging: {
            enabled: true, // Always Active - Core field-level messaging feature
            realTimeValidation: true, // Always Active - Core validation timing
            blurValidation: true, // Always Active - Core validation timing
            submitValidation: true, // Always Active - Core validation timing
            showErrorIcons: true, // Always Active - Core error display option
            animateErrors: true, // Always Active - Core error display option
            characterCount: true, // Always Active - Character count display
        },
        messages: {
            required: document.getElementById('required-message')?.value || 'This field is required',
            email: document.getElementById('email-message')?.value || 'Please enter a valid email address',
            phone: document.getElementById('phone-message')?.value || 'Please enter a valid phone number',
        },
        accessibility: {
            ariaLabels: true, // Always Active - Core accessibility feature
            errorSummary: true, // Always Active - Core accessibility feature
            liveValidation: true, // Always Active - Core accessibility feature
            focusManagement: true // Always Active - Core accessibility feature
        },
        styling: {
            customStyling: document.getElementById('custom-styling')?.checked || false
        }
    };
}
async function applyValidationToForm(form, settings, formIndex = 0) {
    console.log(`🔧 Applying validation to form: ${form.id}`);
    
    const formName = form.name || form.id || `Form ${formIndex + 1}`;
    
    try {
        // Get the actual form element from Webflow Designer
        const formElement = form.element;
        if (!formElement) {
            throw new Error('Form element not found');
        }

        // 🔒 CRITICAL: Check for existing validations and update if needed
        let isUpdate = false;
        try {
            const existingAttributes = await formElement.getAllCustomAttributes();
            if (existingAttributes && existingAttributes.some(attr => attr.name === 'data-a11y-validator')) {
                console.log(`🔄 Found existing validation - updating instead of creating new`);
                isUpdate = true;
                
                // Clean up existing validation attributes
                await cleanupExistingValidation(formElement, existingAttributes);
            }
        } catch (error) {
            console.warn(`⚠️ Could not check existing validations:`, error);
        }
        
        // 📋 Log current validation settings for transparency
        console.log(`📋 Current validation settings:`, {
            required: settings.rules.required,
            email: settings.rules.email,
            phone: settings.rules.phone,
            url: settings.rules.url,
            minLengthText: settings.rules.minLengthText,
            maxLengthText: settings.rules.maxLengthText,
            minLengthTextarea: settings.rules.minLengthTextarea,
            maxLengthTextarea: settings.rules.maxLengthTextarea
        });
        
            // 🔒 CRITICAL: Apply WCAG 2.2 AA conformance features to ALL plan tiers
    console.log(`🔒 Applying WCAG 2.2 AA conformance features using Webflow Designer API...`);
        
        // 1. Apply form-level attributes using Webflow Designer API
        console.log(`🔧 Applying form-level attributes to:`, formElement);
        
        // Add novalidate="novalidate" to disable browser validation
        try {
            if (formElement.setCustomAttribute) {
                await formElement.setCustomAttribute('novalidate', 'novalidate');
            } else if (formElement.setAttribute) {
                await formElement.setAttribute('novalidate', 'novalidate');
            } else {
                console.warn(`⚠️ Could not add novalidate attribute - no suitable API method`);
            }
        } catch (error) {
            console.warn(`⚠️ Failed to add novalidate attribute:`, error);
        }
        
        // Add tracking attributes
        try {
            if (formElement.setCustomAttribute) {
                await formElement.setCustomAttribute('data-a11y-validator', 'enabled');
                await formElement.setCustomAttribute('data-a11y-timestamp', new Date().toLocaleString());
            } else if (formElement.setAttribute) {
                await formElement.setAttribute('data-a11y-validator', 'enabled');
                await formElement.setAttribute('data-a11y-timestamp', new Date().toLocaleString());
            }
        } catch (error) {
            console.warn(`⚠️ Failed to add tracking attributes:`, error);
        }
        
        // 2. Apply field-level validation using Webflow Designer API
        if (form.fields && Array.isArray(form.fields)) {
            console.log(`🔧 Processing ${form.fields.length} fields using Webflow Designer API...`);
            for (let fieldIndex = 0; fieldIndex < form.fields.length; fieldIndex++) {
                const field = form.fields[fieldIndex];
                const fieldName = field.label || field.name || `Field ${fieldIndex + 1}`;
                const fieldType = field.type || 'text';
                
                // console.log(`🔧 Processing field: ${fieldName} (${fieldType})`);
                
                // Update field progress
                updateFieldProgress(fieldName, fieldIndex, fieldType);
                
                // Add small delay to ensure notification is visible before processing
                await new Promise(resolve => setTimeout(resolve, 80));
                
                try {
                    await applyEnhancedFieldValidation(field, settings, formElement);
                    // showFieldNotification(fieldName, fieldType, 'apply', true);
                } catch (error) {
                    console.error(`❌ Failed to apply validation to field ${fieldName}:`, error);
                    showFieldNotification(fieldName, fieldType, 'apply', false);
                }
                
                // Add delay between fields for real-time sequence
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
        
        // 3. If no validation rules are selected, remove all validations
        const hasAnyValidationRules = settings.rules.required || 
                                     settings.rules.email || 
                                     settings.rules.phone || 
                                     settings.rules.url || 
                                     settings.rules.minLengthText > 0 || 
                                     settings.rules.maxLengthText > 0 ||
                                     settings.rules.minLengthTextarea > 0 || 
                                     settings.rules.maxLengthTextarea > 0;
        
        if (!hasAnyValidationRules) {
            console.log(`🗑️ No validation rules selected - removing all existing validations`);
            await removeAllValidations(formElement, form.fields);
            return; // Exit early since we're removing everything
        }
        
        // 3. Add validation script using Webflow Designer API
        showInfoNotification('Finalizing validation...', 'Adding validation script to page');
        
        // Add a brief delay to ensure the notification is visible before script processing
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const pageInfo = await webflow.getCurrentPage();
        await addPageLevelValidationScript(pageInfo.id, settings);
        
        // 4. Update validation state locally
        validationStates.set(form.id, {
            hasValidation: true,
            appliedAt: new Date().toISOString(),
            settings: settings,
            status: 'applied'
        });
        
        // 5. Persist validation state to database
        try {
            if (window.databaseAPI && window.databaseAPI.siteId) {
                console.log('💾 Persisting validation state to database...');
                
                // Get the actual page name using the proper async method
                let pageName = 'Unknown Page';
                try {
                    pageName = await pageInfo.getName() || 'Unknown Page';
                } catch (error) {
                    console.warn('⚠️ Could not get page name for database storage:', error);
                }
                
                const result = await window.databaseAPI.addValidationState({
                    formId: form.id,
                    pageId: pageInfo.id,
                    formName: formName,
                    pageName: pageName,
                    fieldCount: form.fields.length,
                    settings: settings
                });
                console.log('✅ Validation state persisted to database');
            } else {
                console.log('⚠️ Database API not available, skipping persistence');
            }
        } catch (error) {
            console.error('❌ Failed to persist validation state to database:', error);
            // If database persistence fails, we need to rollback the validation
            // to maintain site-wide limit integrity
            console.log('🔄 Rolling back validation due to database persistence failure...');
            
            // Remove the validation attributes that were just applied
            try {
                await removeAllValidations(formElement, form.fields, formName);
                console.log('✅ Validation rolled back successfully');
            } catch (rollbackError) {
                console.error('❌ Failed to rollback validation:', rollbackError);
            }
            
            // Show error to user
            updateStatus('Validation failed: Unable to persist to database. Please try again.', 'error');
            showErrorNotification('Validation failed: Database error. Please try again.');
            return;
        }
        
        console.log(`✅ WCAG 2.2 AA validation applied to form: ${form.id} using Webflow Designer API`);
        
    } catch (error) {
        console.error(`❌ Failed to apply validation to form ${form.id}:`, error);
        throw error;
    }
}
// 🔒 CRITICAL: Check if form has existing validation
async function checkFormHasExistingValidation(formElement) {
    try {
        const existingAttributes = await formElement.getAllCustomAttributes();
        return existingAttributes && existingAttributes.some(attr => attr.name === 'data-a11y-validator');
    } catch (error) {
        console.warn(`⚠️ Could not check existing validation:`, error);
        return false;
    }
}

// 🔒 CRITICAL: Remove all validations from form and fields
async function removeAllValidations(formElement, fields, formName = 'Form') {
    try {
        console.log(`🗑️ Removing all validations from form and fields...`);
        
        // 1. Clean up form element
        await cleanupExistingValidation(formElement);
        
        // 2. Clean up all field elements with deep scanning and notifications
        if (fields && Array.isArray(fields)) {
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                try {
                    const fieldName = field.label || field.name || `Field ${i + 1}`;
                    const fieldType = field.type || 'Field';
                    
                    // Update field progress with percentage (matches Apply Validation)
                    updateFieldProgress(fieldName, i, fieldType);
                    
                    // Add small delay to ensure notification is visible before processing
                    await new Promise(resolve => setTimeout(resolve, 80));
                    
                    await cleanupFieldValidation(field, formName);
                    
                    // Add delay between fields for real-time sequence
                    await new Promise(resolve => setTimeout(resolve, 150));
                    
                    // Show field success notification
                    // showFieldNotification(fieldName, fieldType, 'remove', true);
                    
                } catch (error) {
                    console.warn(`⚠️ Error cleaning up field ${field.label}:`, error);
                    const fieldName = field.label || field.name || `Field ${i + 1}`;
                    const fieldType = field.type || 'Field';
                    showFieldNotification(fieldName, fieldType, 'remove', false);
                }
            }
        }
        
        // 3. Deep scan for any remaining validation elements
        showInfoNotification('Finalizing cleanup...', 'Performing final validation cleanup');
        
        // Add a brief delay to ensure the notification is visible before starting the deep scan
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await deepScanAndRemoveValidations();
        
        console.log(`✅ All validations removed successfully`);
        
    } catch (error) {
        console.error(`❌ Error removing all validations:`, error);
    }
}

// 🔒 CRITICAL: Clean up individual field validation (efficient approach)
async function cleanupFieldValidation(field, formName = 'Form') {
    try {
        const fieldType = field.type || 'text';
        const fieldName = field.name || field.id || 'unnamed-field';
        const fieldLabel = field.label || fieldName;
        
        // Get the actual field element from Webflow (same efficient approach as apply)
        let fieldElement = null;
        const fieldId = typeof field.id === 'object' ? field.id?.id || field.id?.toString() : field.id;
        
        if (fieldId && webflow) {
            try {
                // Try different Webflow API methods (same as apply)
                if (webflow.getElement) {
                    fieldElement = await webflow.getElement(fieldId);
                } else if (webflow.getElements) {
                    const elements = await webflow.getElements();
                    fieldElement = elements.find(el => el.id === fieldId);
                } else if (webflow.getAllElements) {
                    const allElements = await webflow.getAllElements();
                    fieldElement = allElements.find(el => el.id === fieldId);
                }
            } catch (error) {
                console.warn(`⚠️ Could not get Webflow element for ${fieldName}:`, error);
            }
        }
        
        // If we can't get the field element, try to find it by scanning all elements (same as apply)
        if (!fieldElement && webflow) {
            try {
                const allElements = await webflow.getAllElements();
                
                // Find field by matching label or name (same as apply)
                for (const element of allElements) {
                    const elementType = element.type;
                    const isFormField = elementType === 'FormTextInput' || 
                                       elementType === 'FormTextarea' || 
                                       elementType === 'FormSelect' || 
                                       elementType === 'FormCheckboxInput' || 
                                       elementType === 'FormRadioInput';
                    
                    if (isFormField) {
                        let elementLabel = '';
                        let elementName = '';
                        
                        // Try to get label
                        if (element.getLabel) {
                            try {
                                elementLabel = await element.getLabel();
                            } catch (e) {
                                // Ignore label errors
                            }
                        }
                        
                        // Try to get name
                        if (element.getName) {
                            try {
                                elementName = await element.getName();
                            } catch (e) {
                                // Ignore name errors
                            }
                        }
                        
                        // Match by label or name (same as apply)
                        if (elementLabel === fieldLabel || elementName === fieldLabel) {
                            fieldElement = element;
                            break;
                        }
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Could not search for field element:`, error);
            }
        }
        
        if (fieldElement) {
            await cleanupExistingValidation(fieldElement);
            console.log(`✅ Cleaned up field: ${fieldLabel}`);
        } else {
            console.warn(`⚠️ Field element not found for ${fieldLabel} (${fieldType}), skipping...`);
        }
        
    } catch (error) {
        console.warn(`⚠️ Error in cleanupFieldValidation for ${field.label}:`, error);
    }
}

// 🔒 CRITICAL: Scan for nested elements within a field
async function scanNestedElements(fieldElement) {
    try {
        // Get all elements and find any that might be nested within this field
        const allElements = await webflow.getAllElements();
        
        for (const element of allElements) {
            try {
                // Check if this element has validation attributes
                const hasValidationAttributes = await checkForValidationAttributes(element);
                
                if (hasValidationAttributes) {
                    console.log(`🔍 Found nested element with validation: ${element.type}`);
                    await cleanupExistingValidation(element);
                    console.log(`✅ Cleaned up nested element: ${element.type}`);
                }
            } catch (error) {
                // Continue scanning other elements
            }
        }
    } catch (error) {
        console.warn(`⚠️ Error scanning nested elements:`, error);
    }
}

// 🔒 CRITICAL: Check if element has validation attributes
async function checkForValidationAttributes(element) {
    try {
        // Get current plan to determine which attributes to check
        const currentPlan = 'STARTER'; // Default to Starter plan
        
        // Starter plan validation attributes only (required, email, phone, URL)
        const starterPlanAttributes = [
            'data-a11y-validator',
            'data-a11y-timestamp',
            'novalidate',
            'required',
            'aria-required',
            'aria-describedby',
            'type', // Only for email, tel, url types
            'pattern', // Only for email validation pattern
            'data-error-id',
            'data-needs-error-container',
            'data-error-container-type',
            'data-field-label',
            'data-proper-field-id',
            'data-embed-id',
            'data-embed-class',
            'data-embed-field-id',
            'data-embed-error-container-id',
            'data-error-container-class',
            'data-error-container-role',
            'data-error-container-aria-live',
            'data-error-container-aria-atomic'
        ];
        
        // Pro/Agency plan attributes (not checked on Starter plan)
        const advancedPlanAttributes = [
            'minlength',
            'maxlength'
        ];
        
        // Use appropriate attribute list based on plan
        const validationAttributes = currentPlan === 'STARTER' ? starterPlanAttributes : [...starterPlanAttributes, ...advancedPlanAttributes];
        
        // Check custom attributes
        if (element.getAllCustomAttributes) {
            try {
                const customAttributes = await element.getAllCustomAttributes();
                for (const attr of customAttributes) {
                    if (validationAttributes.includes(attr.name)) {
                        return true;
                    }
                }
            } catch (error) {
                // Continue to other checks
            }
        }
        
        // Check regular attributes
        if (element.getAllAttributes) {
            try {
                const attributes = await element.getAllAttributes();
                for (const attr of attributes) {
                    if (validationAttributes.includes(attr.name)) {
                        return true;
                    }
                }
            } catch (error) {
                // Continue to other checks
            }
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

// 🔒 CRITICAL: Deep scan for any remaining validation elements (optimized)
async function deepScanAndRemoveValidations() {
    try {
        console.log(`🔍 Scanning for any remaining validation elements...`);
        
        const allElements = await webflow.getAllElements();
        let cleanedCount = 0;
        
        // Only scan elements that are likely to have validation attributes
        for (const element of allElements) {
            try {
                // Only check form-related elements and embeds
                const isFormElement = element.type === 'FormTextInput' || 
                                     element.type === 'FormTextarea' || 
                                     element.type === 'FormSelect' || 
                                     element.type === 'FormCheckboxInput' || 
                                     element.type === 'FormRadioInput' ||
                                     element.type === 'FormForm' ||
                                     element.type === 'Embed' || 
                                     element.type === 'HtmlEmbed' || 
                                     element.type === 'FormEmbed';
                
                if (!isFormElement) {
                    continue; // Skip non-form elements
                }
                
                // Check for validation attributes
                const hasValidationAttributes = await checkForValidationAttributes(element);
                
                if (hasValidationAttributes) {
                    console.log(`🔍 Found element with validation attributes: ${element.type}`);
                    await cleanupExistingValidation(element);
                    cleanedCount++;
                    console.log(`✅ Cleaned up element: ${element.type}`);
                }
            } catch (error) {
                // Continue scanning other elements
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`✅ Scan completed - cleaned up ${cleanedCount} elements`);
            
            // UI cleanup completed
            console.log(`✅ Updated UI to reflect cleaned validation state`);
        } else {
            console.log(`✅ Scan completed - no additional validation elements found`);
        }
        
    } catch (error) {
        console.warn(`⚠️ Error in deep scan:`, error);
    }
}

// 🔒 CRITICAL: Check for embed validation attributes
async function checkForEmbedValidationAttributes(element) {
    try {
        const embedValidationAttributes = [
            'data-field-id',
            'data-error-container-id',
            'data-field-label',
            'data-error-display-script',
            'data-embed-id',
            'data-embed-class',
            'data-embed-field-id',
            'data-embed-error-container-id'
        ];
        
        for (const attrName of embedValidationAttributes) {
            try {
                if (element.getCustomAttribute) {
                    const value = await element.getCustomAttribute(attrName);
                    if (value) {
                        console.log(`🔍 Found embed validation attribute: ${attrName} = ${value}`);
                        return true;
                    }
                }
            } catch (error) {
                // Continue checking other attributes
            }
        }
        
        return false;
    } catch (error) {
        console.warn(`⚠️ Error checking embed validation attributes:`, error);
        return false;
    }
}

// 🔒 CRITICAL: Clean up embed validation attributes
async function cleanupEmbedValidation(element) {
    try {
        console.log(`🧹 Cleaning up embed validation attributes...`);
        
        // List of embed validation-related custom attributes to remove
        const embedValidationCustomAttributes = [
            'data-field-id',
            'data-error-container-id',
            'data-field-label',
            'data-error-display-script',
            'data-embed-id',
            'data-embed-class',
            'data-embed-field-id',
            'data-embed-error-container-id'
        ];
        
        // Remove custom attributes
        for (const attrName of embedValidationCustomAttributes) {
            try {
                if (element.removeCustomAttribute && typeof element.removeCustomAttribute === 'function') {
                    await element.removeCustomAttribute(attrName);
                }
            } catch (error) {
                // Silently ignore errors for attributes that don't exist
            }
        }
        
        // Handle ID attribute - check both custom and regular attributes
        try {
            let embedId = null;
            
            // First check if ID is set as a custom attribute
            if (element.getCustomAttribute) {
                embedId = await element.getCustomAttribute('id');
            }
            
            // If not found as custom attribute, check the regular ID property
            if (!embedId && element.id) {
                embedId = element.id.toString();
            }
            
            if (embedId && (embedId.includes('error') || embedId.includes('embed') || embedId.includes('-embed'))) {
                console.log(`🔍 Found embed validation ID to remove: ${embedId}`);
                
                // Try to remove as custom attribute first
                if (element.removeCustomAttribute && typeof element.removeCustomAttribute === 'function') {
                    try {
                        await element.removeCustomAttribute('id');
                        console.log(`✅ Removed embed validation ID (custom): ${embedId}`);
                    } catch (error) {
                        // If that fails, try as regular attribute
                        if (element.removeAttribute && typeof element.removeAttribute === 'function') {
                            await element.removeAttribute('id');
                            console.log(`✅ Removed embed validation ID (regular): ${embedId}`);
                        } else if (element.setAttribute && typeof element.setAttribute === 'function') {
                            await element.setAttribute('id', ''); // Clear the ID
                            console.log(`✅ Cleared embed validation ID: ${embedId}`);
                        }
                    }
                } else if (element.removeAttribute && typeof element.removeAttribute === 'function') {
                    await element.removeAttribute('id');
                    console.log(`✅ Removed embed validation ID (regular): ${embedId}`);
                } else if (element.setAttribute && typeof element.setAttribute === 'function') {
                    await element.setAttribute('id', ''); // Clear the ID
                    console.log(`✅ Cleared embed validation ID: ${embedId}`);
                }
            }
        } catch (error) {
            console.warn(`⚠️ Error removing embed ID:`, error);
        }
        
        // Handle class attribute - check both custom and regular attributes
        try {
            let embedClass = null;
            
            // First check if class is set as a custom attribute
            if (element.getCustomAttribute) {
                embedClass = await element.getCustomAttribute('class');
            }
            
            // If not found as custom attribute, try to get it as a regular attribute
            if (!embedClass && element.getAttribute) {
                embedClass = await element.getAttribute('class');
            }
            
            if (embedClass && (embedClass.includes('a11y') || embedClass.includes('error'))) {
                console.log(`🔍 Found embed validation class to remove: ${embedClass}`);
                
                // Try to remove as custom attribute first
                if (element.removeCustomAttribute && typeof element.removeCustomAttribute === 'function') {
                    try {
                        await element.removeCustomAttribute('class');
                        console.log(`✅ Removed embed validation class (custom): ${embedClass}`);
                    } catch (error) {
                        // If that fails, try as regular attribute
                        if (element.removeAttribute && typeof element.removeAttribute === 'function') {
                            await element.removeAttribute('class');
                            console.log(`✅ Removed embed validation class (regular): ${embedClass}`);
                        } else if (element.setAttribute && typeof element.setAttribute === 'function') {
                            // Remove only validation-related classes, keep others
                            const cleanClass = embedClass.replace(/a11y[^\s]*/g, '').replace(/error[^\s]*/g, '').trim();
                            await element.setAttribute('class', cleanClass);
                            console.log(`✅ Cleaned embed class from: ${embedClass} to: ${cleanClass}`);
                        }
                    }
                } else if (element.removeAttribute && typeof element.removeAttribute === 'function') {
                    await element.removeAttribute('class');
                    console.log(`✅ Removed embed validation class (regular): ${embedClass}`);
                } else if (element.setAttribute && typeof element.setAttribute === 'function') {
                    // Remove only validation-related classes, keep others
                    const cleanClass = embedClass.replace(/a11y[^\s]*/g, '').replace(/error[^\s]*/g, '').trim();
                    await element.setAttribute('class', cleanClass);
                    console.log(`✅ Cleaned embed class from: ${embedClass} to: ${cleanClass}`);
                }
            }
        } catch (error) {
            console.warn(`⚠️ Error removing embed class:`, error);
        }
        
        console.log(`✅ Embed cleanup completed for element`);
        
    } catch (error) {
        console.warn(`⚠️ Error during embed cleanup:`, error);
    }
}

// 🔒 CRITICAL: Clean up existing validation attributes
async function cleanupExistingValidation(element, existingAttributes) {
    try {
        console.log(`🧹 Cleaning up existing validation attributes...`);
        
        // Get current plan to determine which attributes to remove
        const currentPlan = 'STARTER'; // Default to Starter plan
        console.log(`📋 Current plan: ${currentPlan} - removing only Starter plan validation attributes`);
        
        // Starter plan validation attributes only (required, email, phone, URL)
        const starterPlanAttributes = [
            'data-a11y-validator',
            'data-a11y-timestamp',
            'novalidate',
            'required',
            'aria-required',
            'aria-describedby',
            'type', // Only for email, tel, url types
            'pattern', // Only for email validation pattern
            'autocomplete',
            'data-error-id',
            'data-needs-error-container',
            'data-error-container-type',
            'data-field-label',
            'data-proper-field-id',
            'data-embed-id',
            'data-embed-class',
            'data-embed-field-id',
            'data-embed-error-container-id',
            'data-error-container-class',
            'data-error-container-role',
            'data-error-container-aria-live',
            'data-error-container-aria-atomic'
        ];
        
        // Pro/Agency plan attributes (not removed on Starter plan)
        const advancedPlanAttributes = [
            'minlength',
            'maxlength'
        ];
        
        // Use appropriate attribute list based on plan
        const validationAttributes = currentPlan === 'STARTER' ? starterPlanAttributes : [...starterPlanAttributes, ...advancedPlanAttributes];
        
        // Remove known validation attributes
        for (const attrName of validationAttributes) {
            try {
                if (element.removeCustomAttribute && typeof element.removeCustomAttribute === 'function') {
                    await element.removeCustomAttribute(attrName);
                } else if (element.removeAttribute && typeof element.removeAttribute === 'function') {
                    await element.removeAttribute(attrName);
                }
            } catch (error) {
                // Silently ignore errors for attributes that don't exist
                // console.warn(`⚠️ Could not remove attribute ${attrName}:`, error);
            }
        }
        
        // Future-proof: Remove any data-* attributes that contain Starter plan validation keywords
        try {
            if (element.getAllCustomAttributes) {
                const allCustomAttributes = await element.getAllCustomAttributes();
                const starterPlanKeywords = ['error', 'a11y', 'validator', 'validation', 'required', 'aria', 'embed'];
                // Exclude advanced plan keywords like 'length', 'min', 'max' for character limits
                
                for (const attr of allCustomAttributes) {
                    const attrName = attr.name;
                    if (attrName.startsWith('data-') && starterPlanKeywords.some(keyword => attrName.toLowerCase().includes(keyword))) {
                        // Skip advanced plan attributes
                        if (attrName.toLowerCase().includes('length') || attrName.toLowerCase().includes('min') || attrName.toLowerCase().includes('max')) {
                            console.log(`⏭️ Skipping advanced plan attribute: ${attrName} (Starter plan only)`);
                            continue;
                        }
                        
                        if (element.removeCustomAttribute && typeof element.removeCustomAttribute === 'function') {
                            await element.removeCustomAttribute(attrName);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`⚠️ Error during future-proof cleanup:`, error);
        }
        
        console.log(`✅ Cleanup completed for element`);
        
    } catch (error) {
        console.warn(`⚠️ Error during cleanup:`, error);
    }
}

// 🔒 CRITICAL: Helper function for setting attributes optimally
// This function uses Webflow API methods to set attributes
async function setOptimalAttribute(element, name, value) {
    try {
        // console.log(`🔧 Attempting to set ${name}="${value}" on element: ${element.id}`);
        
        // Method 1: Webflow Custom Attributes API (preferred - persists to live site)
        if (element.setCustomAttribute && typeof element.setCustomAttribute === 'function') {
            try {
                await element.setCustomAttribute(name, value);
                
                // Mask sensitive attributes after setting them
                if (typeof maskSensitiveAttributes === 'function') {
                    maskSensitiveAttributes(element);
                }
                
                return true;
            } catch (error) {
                console.warn(`⚠️ Webflow Custom Attributes API failed for ${name}:`, error);
            }
        }
        
        // Method 2: Webflow setAttribute API (alternative)
        if (element.setAttribute && typeof element.setAttribute === 'function') {
            try {
                await element.setAttribute(name, value);
                
                // Mask sensitive attributes after setting them
                if (typeof maskSensitiveAttributes === 'function') {
                    maskSensitiveAttributes(element);
                }
                
                return true;
            } catch (error) {
                console.warn(`⚠️ Webflow setAttribute API failed for ${name}:`, error);
            }
        }
        
        // Method 3: Webflow update method (if available)
        if (element.update && typeof element.update === 'function') {
            try {
                await element.update({ [name]: value });
                 // console.log(`✅ Set ${name}="${value}" using Webflow update API`);
                
                // Mask sensitive attributes after setting them
                if (typeof maskSensitiveAttributes === 'function') {
                    maskSensitiveAttributes(element);
                }
                
                return true;
            } catch (error) {
                console.warn(`⚠️ Webflow update API failed for ${name}:`, error);
            }
        }
        
        console.warn(`⚠️ Could not set ${name}="${value}" - no suitable Webflow API method found`);
        return false;
        
    } catch (error) {
        console.error(`❌ Failed to set ${name}="${value}":`, error);
        return false;
    }
}

// 🔒 CRITICAL: Helper function to get user-friendly field ID
function getProperFieldId(fieldElement, fieldName, fieldLabel) {
    // Use the field label for user-friendly error IDs
    // This makes debugging much easier and more intuitive
    // If fieldName is 'no-name' or generic, use the label instead
    let idToUse;
    if (fieldName === 'no-name' || fieldName === 'unnamed-field' || !fieldName) {
        idToUse = fieldLabel || 'field';
    } else {
        idToUse = fieldName;
    }
    
    // Normalize the ID to lowercase, hyphenated format for consistency
    return idToUse.toLowerCase()
        .replace(/[\s\-_]+/g, '-')  // Replace spaces, underscores, and multiple hyphens with single hyphen
        .replace(/[^a-z0-9\-]/g, '') // Remove all non-alphanumeric characters except hyphens
        .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
}

// 🎯 Smart field type detection functions
function isLikelyEmailField(fieldLabel) {
    if (!fieldLabel) return false;
    
    const label = fieldLabel.toLowerCase().trim();
    
    // Common email field labels
    const emailKeywords = [
        'email', 'e-mail', 'e mail', 'email address', 'email addr', 
        'mail', 'mail address', 'mail addr', 'contact email',
        'work email', 'personal email', 'business email', 'primary email',
        'secondary email', 'alternate email', 'backup email', 'recovery email',
        'notification email', 'alert email', 'newsletter email', 'marketing email',
        'support email', 'help email', 'admin email', 'technical email',
        'billing email', 'invoice email', 'receipt email', 'confirmation email'
    ];
    
    return emailKeywords.some(keyword => label.includes(keyword));
}

function isLikelyPhoneField(fieldLabel) {
    if (!fieldLabel) return false;
    
    const label = fieldLabel.toLowerCase().trim();
    
    // Common phone field labels
    const phoneKeywords = [
        'phone', 'telephone', 'tel', 'mobile', 'cell', 'cell phone',
        'phone number', 'phone num', 'mobile number', 'mobile num',
        'contact phone', 'work phone', 'home phone', 'business phone',
        'primary phone', 'secondary phone', 'alternate phone', 'backup phone',
        'emergency phone', 'emergency contact', 'contact number', 'phone contact',
        'landline', 'land line', 'office phone', 'work number', 'home number',
        'personal phone', 'private phone', 'direct phone', 'extension',
        'fax', 'fax number', 'facsimile', 'toll free', 'toll-free'
    ];
    
    return phoneKeywords.some(keyword => label.includes(keyword));
}

function isLikelyUrlField(fieldLabel) {
    if (!fieldLabel) return false;
    
    const label = fieldLabel.toLowerCase().trim();
    
    // Common URL field labels
    const urlKeywords = [
        'url', 'website', 'web site', 'webpage', 'web page', 'link',
        'homepage', 'home page', 'site', 'domain', 'web address',
        'company website', 'business website', 'personal website',
        'portfolio', 'portfolio site', 'profile', 'profile page',
        'social media', 'social profile', 'linkedin', 'twitter', 'facebook',
        'instagram', 'github', 'gitlab', 'bitbucket', 'codepen',
        'blog', 'blog url', 'blog site', 'newsletter', 'newsletter url',
        'landing page', 'landing url', 'referral url', 'source url',
        'api', 'api endpoint', 'webhook', 'callback url', 'return url'
    ];
    
    return urlKeywords.some(keyword => label.includes(keyword));
}

// 🎯 Smart autocomplete value detection function
function getAutocompleteValue(fieldLabel, fieldType) {
    if (!fieldLabel) return null;
    
    const label = fieldLabel.toLowerCase().trim();
    
    // PRIORITY 1: Message/comment fields - always disable autocomplete
    // Check for FormTextarea fields first (these are always message fields)
    if (fieldType === 'FormTextarea') {
        return 'off';
    }
    
    // Check for message field labels (comprehensive list)
    if (label.includes('message') || label.includes('comment') || label.includes('description') || 
        label.includes('notes') || label.includes('feedback') || label.includes('inquiry') ||
        label.includes('question') || label.includes('details') || label.includes('content') ||
        label.includes('body') || label.includes('text') || label.includes('story') ||
        label.includes('narrative') || label.includes('explanation') || label.includes('reason') ||
        label.includes('additional information') || label.includes('other') || label.includes('remarks')) {
        return 'off'; // Disable autocomplete for message fields
    }
    
    // PRIORITY 2: Name fields
    if (label.includes('name') || label.includes('full name') || label.includes('fullname') ||
        label.includes('display name') || label.includes('preferred name') || label.includes('nickname')) {
        return 'name';
    }
    if (label.includes('first name') || label.includes('firstname') || label.includes('given name') ||
        label.includes('forename') || label.includes('christian name') || label.includes('personal name')) {
        return 'given-name';
    }
    if (label.includes('last name') || label.includes('lastname') || label.includes('surname') ||
        label.includes('family name') || label.includes('second name') || label.includes('maiden name')) {
        return 'family-name';
    }
    if (label.includes('middle name') || label.includes('middlename') || label.includes('middle initial') ||
        label.includes('second name') || label.includes('additional name')) {
        return 'additional-name';
    }
    
    // PRIORITY 3: Email fields
    if (isLikelyEmailField(fieldLabel)) {
        return 'email';
    }
    
    // PRIORITY 4: Phone fields
    if (isLikelyPhoneField(fieldLabel)) {
        return 'tel';
    }
    
    // PRIORITY 5: URL fields
    if (isLikelyUrlField(fieldLabel)) {
        return 'url';
    }
    
    // PRIORITY 6: Address fields
    if (label.includes('address') || label.includes('street') || label.includes('street address') ||
        label.includes('home address') || label.includes('mailing address') || label.includes('billing address') ||
        label.includes('shipping address') || label.includes('residential address') || label.includes('physical address')) {
        return 'street-address';
    }
    if (label.includes('city') || label.includes('town') || label.includes('municipality') ||
        label.includes('locality') || label.includes('urban area')) {
        return 'address-level2';
    }
    if (label.includes('state') || label.includes('province') || label.includes('region') ||
        label.includes('territory') || label.includes('county') || label.includes('district') ||
        label.includes('prefecture') || label.includes('canton')) {
        return 'address-level1';
    }
    if (label.includes('zip') || label.includes('postal') || label.includes('postcode') ||
        label.includes('zip code') || label.includes('postal code') || label.includes('zipcode') ||
        label.includes('postalcode') || label.includes('pin code') || label.includes('pincode')) {
        return 'postal-code';
    }
    if (label.includes('country') || label.includes('nation') || label.includes('residence country') ||
        label.includes('home country') || label.includes('citizenship')) {
        return 'country';
    }
    
    // PRIORITY 7: Company fields (but not if it's a message field)
    if (label.includes('company') || label.includes('organization') || label.includes('org') ||
        label.includes('employer') || label.includes('business') || label.includes('corporation') ||
        label.includes('firm') || label.includes('enterprise') || label.includes('institution') ||
        label.includes('agency') || label.includes('association') || label.includes('society') ||
        label.includes('workplace') || label.includes('office') || label.includes('employer name')) {
        // Double-check: if it contains "message" or similar, it's a message field
        if (label.includes('message') || label.includes('comment') || label.includes('description') ||
            label.includes('notes') || label.includes('feedback') || label.includes('inquiry')) {
            return 'off';
        }
        return 'organization';
    }
    if (label.includes('job title') || label.includes('jobtitle') || label.includes('position') || 
        label.includes('role') || label.includes('title') || label.includes('job position') ||
        label.includes('occupation') || label.includes('profession') || label.includes('career') ||
        label.includes('work title') || label.includes('employment title') || label.includes('job role') ||
        label.includes('designation') || label.includes('rank') || label.includes('level')) {
        return 'organization-title';
    }
    
    // PRIORITY 8: Date fields
    if (label.includes('birth') || label.includes('birthday') || label.includes('dob') ||
        label.includes('date of birth') || label.includes('birth date') || label.includes('born') ||
        label.includes('age') || label.includes('birth year') || label.includes('birthday date')) {
        return 'bday';
    }
    
    // PRIORITY 9: Username fields
    if (label.includes('username') || label.includes('user name') || label.includes('login') ||
        label.includes('user id') || label.includes('userid') || label.includes('account name') ||
        label.includes('screen name') || label.includes('handle') || label.includes('alias') ||
        label.includes('user') || label.includes('login name') || label.includes('account')) {
        return 'username';
    }
    
    // PRIORITY 10: Password fields
    if (label.includes('password') || label.includes('pass') || label.includes('pwd') ||
        label.includes('passcode') || label.includes('pass code') || label.includes('secret') ||
        label.includes('pin') || label.includes('security code') || label.includes('access code')) {
        return 'current-password';
    }
    
    // Default: no autocomplete for unrecognized fields
    return null;
}

    // 🔒 CRITICAL: Enhanced field validation with WCAG 2.2 AA conformance
async function applyEnhancedFieldValidation(field, settings, formElement) {
    // Check if this is an update operation
    const isUpdate = formElement && await checkFormHasExistingValidation(formElement);
    const fieldType = field.type || 'text';
    const fieldName = field.name || field.id || 'unnamed-field';
    const fieldLabel = field.label || fieldName;
    
            // console.log(`🔧 Applying enhanced validation to field: ${fieldLabel} (${fieldType})`);
    
    try {
        // Get the actual field element from Webflow
        let fieldElement = null;
        
        // Handle field ID properly (it might be an object)
        const fieldId = typeof field.id === 'object' ? field.id?.id || field.id?.toString() : field.id;
        
        if (fieldId && webflow) {
            try {
                // Try different Webflow API methods
                if (webflow.getElement) {
                    fieldElement = await webflow.getElement(fieldId);
                } else if (webflow.getElements) {
                    const elements = await webflow.getElements();
                    fieldElement = elements.find(el => el.id === fieldId);
                } else if (webflow.getAllElements) {
                    const allElements = await webflow.getAllElements();
                    fieldElement = allElements.find(el => el.id === fieldId);
                }
            } catch (error) {
                console.warn(`⚠️ Could not get Webflow element for ${fieldName}:`, error);
            }
        }
        
        // If we can't get the field element, try to find it by scanning all elements
        if (!fieldElement && webflow) {
            try {
                // console.log(`🔍 Field element not found by ID, searching by label: ${fieldLabel}`);
                const allElements = await webflow.getAllElements();
                
                // Find field by matching label or name
                for (const element of allElements) {
                    const elementType = element.type;
                    const isFormField = elementType === 'FormTextInput' || 
                                       elementType === 'FormTextarea' || 
                                       elementType === 'FormSelect' || 
                                       elementType === 'FormCheckboxInput' || 
                                       elementType === 'FormRadioInput';
                    
                    if (isFormField) {
                        let elementLabel = '';
                        let elementName = '';
                        
                        // Try to get label
                        if (element.getLabel) {
                            try {
                                elementLabel = await element.getLabel();
                            } catch (e) {
                                // Ignore label errors
                            }
                        }
                        
                        // Try to get name
                        if (element.getName) {
                            try {
                                elementName = await element.getName();
                            } catch (e) {
                                // Ignore name errors
                            }
                        }
                        
                        // Match by label or name
                        if (elementLabel === fieldLabel || elementName === fieldLabel) {
                            fieldElement = element;
                            break;
                        }
                    }
                }
                
                if (fieldElement) {
                    // console.log(`✅ Found field element by label: ${fieldLabel}`);
                }
                
            } catch (error) {
                console.warn(`⚠️ Could not search for field element:`, error);
            }
        }
        
        if (!fieldElement) {
            console.warn(`⚠️ Field element not found for ${fieldLabel} (${fieldType}), skipping...`);
            console.warn(`⚠️ Field details: id=${fieldId}, name=${fieldName}, label=${fieldLabel}`);
            return;
        }
        
        // Debug: Confirm fieldElement was found
        // console.log(`✅ Field element found for ${fieldLabel}:`, fieldElement.type);
        
        // 🔒 CRITICAL: Apply WCAG 2.2 AA conformance features
        
        // 1. Required field validation - Apply proper required attributes based on element type
        // console.log(`🔍 Checking required validation for field: ${fieldLabel}, settings.rules.required: ${settings.rules.required}`);
        if (settings.rules.required) {
            const elementType = fieldElement.type || fieldType;
            
            // Check if this is a custom widget (DOM element with id=legend or id=fieldSet)
            const isCustomWidget = await isCustomWidgetElement(fieldElement);
            
            // Check if field is required - trust scanning results first
            let isFieldRequired = false;
            try {
                // PRIMARY: Trust the scanning results (they're working correctly)
                if (field.required === true) {
                    isFieldRequired = true;
                } else {
                    // SECONDARY: Try the getRequired() method as backup
                    if (fieldElement.getRequired) {
                        isFieldRequired = await fieldElement.getRequired();
                    }
                    
                    // TERTIARY: Check custom attributes as final fallback
                    if (!isFieldRequired && fieldElement.getCustomAttribute) {
                    const existingRequired = await fieldElement.getCustomAttribute('required');
                        isFieldRequired = existingRequired === 'required' || existingRequired === 'true';
                    }
                }
            } catch (error) {
                // Fallback: if field was detected as required during scanning, assume it's required
                if (field.required === true) {
                    isFieldRequired = true;
                }
            }
            
            if (isFieldRequired) {
                if (isCustomWidget) {
                    // Use aria-required="true" only for custom widgets where native attributes can't be applied
                    await setOptimalAttribute(fieldElement, 'aria-required', 'true');
                } else {
                    // Use required="required" for standard HTML form fields that use native Webflow required state
                    await setOptimalAttribute(fieldElement, 'required', 'required');
                }
                
                // Mark this field as needing an error container using Webflow API
                if (fieldElement.setCustomAttribute) {
                    await fieldElement.setCustomAttribute('data-needs-error-container', 'true');
                }
            }
        }
        
        // 2. Email validation - Apply only to fields that are likely email fields
        if (fieldType === 'FormTextInput' && settings.rules.email) {
            // Check if this field is likely an email field based on its label
            const isEmailField = isLikelyEmailField(fieldLabel);
            if (isEmailField) {
                await setOptimalAttribute(fieldElement, 'type', 'email');
                await setOptimalAttribute(fieldElement, 'pattern', '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}');
                console.log(`✅ ${isUpdate ? 'Updated' : 'Applied'} email validation to ${fieldLabel}`);
            }
        }
        
        // 3. Phone validation - Apply only to fields that are likely phone fields
        if (fieldType === 'FormTextInput' && settings.rules.phone) {
            // Check if this field is likely a phone field based on its label
            const isPhoneField = isLikelyPhoneField(fieldLabel);
            if (isPhoneField) {
                await setOptimalAttribute(fieldElement, 'type', 'tel');
                await setOptimalAttribute(fieldElement, 'pattern', '[0-9\\s\\-\\(\\)\\+]{10,}');
                console.log(`✅ ${isUpdate ? 'Updated' : 'Applied'} phone validation to ${fieldLabel}`);
            }
        }
        
        // 4. URL validation - Apply only to fields that are likely URL fields
        if (fieldType === 'FormTextInput' && settings.rules.url) {
            // Check if this field is likely a URL field based on its label
            const isUrlField = isLikelyUrlField(fieldLabel);
            if (isUrlField) {
                await setOptimalAttribute(fieldElement, 'type', 'url');
                console.log(`✅ ${isUpdate ? 'Updated' : 'Applied'} URL validation to ${fieldLabel}`);
            }
        }
        

        
        // 6. ARIA accessibility features
        const properFieldId = getProperFieldId(fieldElement, fieldName, fieldLabel);
        
        // Note: No ARIA error attributes set initially - only when errors occur
        // aria-invalid and aria-describedby will be added dynamically during validation
        
        // 7. Mark field as needing error container
        await setOptimalAttribute(fieldElement, 'data-needs-error-container', 'true');
        
        // 8. Set up data attributes for custom code error messaging
        if (settings.rules.required) {
            console.log(`🔧 Setting up custom code error messaging for field: ${fieldLabel}`);
            const errorSetup = await setupCustomCodeErrorMessaging(fieldElement, fieldName, fieldLabel);
            if (errorSetup) {
                console.log(`✅ Custom code error messaging setup successful for field: ${fieldLabel}`);
            } else {
                console.warn(`⚠️ Custom code error messaging setup failed for field: ${fieldLabel}`);
            }
        }
        
        // 9. Add autocomplete attribute for better user experience
        const autocompleteValue = getAutocompleteValue(fieldLabel, fieldType);
        if (autocompleteValue) {
            await setOptimalAttribute(fieldElement, 'autocomplete', autocompleteValue);
        }
        
        // 📋 Summary of applied attributes for this field
        const appliedAttributes = [];
        if (settings.rules.required) appliedAttributes.push('required');
        if (settings.rules.email && fieldType === 'FormTextInput') appliedAttributes.push('email');
        if (settings.rules.phone && fieldType === 'FormTextInput') appliedAttributes.push('phone');
        if (settings.rules.url && fieldType === 'FormTextInput') appliedAttributes.push('url');
        // Note: ARIA attributes are added dynamically during validation
        
    } catch (error) {
        console.error(`❌ Failed to apply enhanced validation to field ${fieldName}:`, error);
        throw error;
    }
}

// 🎯 CUSTOM CODE ERROR MESSAGING - Set up data attributes for dynamic error creation
async function setupCustomCodeErrorMessaging(fieldElement, fieldName, fieldLabel) {
    try {
        // Only set up for REQUIRED fields
        const isRequired = true; // The validation logic above already determined this field should be required
        if (!isRequired) {
            console.log(`⏭️ Skipping non-required field: ${fieldLabel}`);
            return;
        }
        
        // Normalize the field label to match validation script expectations
        let normalizedFieldLabel = fieldLabel; // Fallback to scanned label
        
        if (fieldElement && fieldElement.id) {
            try {
                // Try to get the actual label text from associated label element
                if (webflow && webflow.getAllElements) {
                    const allElements = await webflow.getAllElements();
                    
                    // Look for a label element that targets this field
                    const labelElement = allElements.find(element => {
                        return element.type === 'FormLabel' && 
                               element.htmlElement && 
                               element.htmlElement.getAttribute('for') === fieldElement.id;
                    });
                    
                    if (labelElement && labelElement.getText) {
                        const labelText = await labelElement.getText();
                        if (labelText && labelText.trim()) {
                            normalizedFieldLabel = labelText.trim();
                            console.log(`✅ Found actual field label: "${normalizedFieldLabel}" (was: "${fieldLabel}")`);
                        }
                    }
                }
            } catch (error) {
                console.log(`⚠️ Could not get actual field label, using scanned label: ${fieldLabel}`, error);
            }
        }
        
        // Normalize the label to lowercase, hyphenated format for validation script
        const normalizedLabel = normalizedFieldLabel.toLowerCase()
            .replace(/[\s\-_]+/g, '-')  // Replace spaces, underscores, and multiple hyphens with single hyphen
            .replace(/[^a-z0-9\-]/g, '') // Remove all non-alphanumeric characters except hyphens
            .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
        
        // Get the field ID for the error container
        const properFieldId = getProperFieldId(fieldElement, fieldName, normalizedLabel);
        const errorId = `${properFieldId}-error`;
        
        
        // Set up data attributes for custom code script to use - with normalized field label
        if (fieldElement.setCustomAttribute) {
            try {
                await fieldElement.setCustomAttribute('data-error-id', errorId);
                await fieldElement.setCustomAttribute('data-field-label', normalizedLabel);
                await fieldElement.setCustomAttribute('data-proper-field-id', properFieldId);
                await fieldElement.setCustomAttribute('data-auto-error-messaging', 'true');
                console.log(`✅ Set custom attributes for field: ${fieldLabel} (${errorId})`);
            } catch (error) {
                console.error(`❌ Failed to set custom attributes for field ${fieldLabel}:`, error);
                // Try fallback method using setOptimalAttribute
                try {
                    await setOptimalAttribute(fieldElement, 'data-error-id', errorId);
                    await setOptimalAttribute(fieldElement, 'data-field-label', normalizedLabel);
                    await setOptimalAttribute(fieldElement, 'data-proper-field-id', properFieldId);
                    await setOptimalAttribute(fieldElement, 'data-auto-error-messaging', 'true');
                    console.log(`✅ Set custom attributes using fallback method for field: ${fieldLabel}`);
                } catch (fallbackError) {
                    console.error(`❌ Fallback method also failed for field ${fieldLabel}:`, fallbackError);
                    return null;
                }
            }
        } else {
            console.warn(`⚠️ Field element does not support setCustomAttribute for field: ${fieldLabel}`);
            return null;
        }
        
        // Store reference for error handling
        errorContainers.set(fieldElement.id, {
            fieldElement: fieldElement,
            errorId: errorId,
            fieldLabel: fieldLabel,
            type: 'forms-setup',
            properFieldId: properFieldId
        });
        
        return { errorId, fieldLabel, properFieldId };
        
    } catch (error) {
        console.error(`❌ Failed to setup custom code error messaging for field ${fieldLabel}:`, error);
        return null;
    }
}

// Helper function to check if element is a custom widget (DOM element with id=legend or id=fieldSet)
async function isCustomWidgetElement(fieldElement) {
    try {
        // Get the element's ID
        let elementId = '';
        if (fieldElement.id) {
            if (typeof fieldElement.id === 'object' && fieldElement.id.value) {
                elementId = fieldElement.id.value;
            } else if (typeof fieldElement.id === 'string') {
                elementId = fieldElement.id;
            }
        }
        
        // Check if the element has the specific IDs we're looking for
        const hasSpecificId = elementId === 'fieldSet' || elementId === 'Legend';
        
        if (!hasSpecificId) {
            return false;
        }
        
        // Check if the element is a DOM element (Custom Element from Add panel)
        const isDOMElement = fieldElement.type === 'DOM';
        
        if (!isDOMElement) {
            console.log(`🔍 Element type "${fieldElement.type}" is not "DOM" - not a custom widget`);
            return false;
        }
        
        // Check if the element is nested inside a Form element
        let isNestedInForm = false;
        try {
            if (fieldElement.parent) {
                const parent = await fieldElement.parent;
                if (parent && parent.type === 'FormForm') {
                    isNestedInForm = true;
                    console.log(`✅ Custom widget ${elementId} is nested inside Form element`);
                } else {
                    console.log(`🔍 Custom widget ${elementId} parent type: ${parent?.type || 'unknown'}`);
                }
            }
        } catch (error) {
            console.warn(`⚠️ Could not check parent element:`, error);
        }
        
        const isCustomWidget = hasSpecificId && isDOMElement && isNestedInForm;
        console.log(`🔍 Custom widget check: hasSpecificId=${hasSpecificId}, isDOMElement=${isDOMElement}, isNestedInForm=${isNestedInForm} = ${isCustomWidget}`);
        
        return isCustomWidget;
        
    } catch (error) {
        console.error(`❌ Error checking custom widget element:`, error);
        return false;
    }
}

// Helper function to find the parent container for form fields
async function findParentContainer(fieldElement) {
    try {
        // Try to get the parent element
        const parent = await fieldElement.parent;
        
        // If parent exists and supports children, use it
        if (parent?.children) {
            return parent;
        }
        
        // If no suitable parent found, try to find a form container
        const allElements = await webflow.getAllElements();
        const formElements = allElements.filter(el => el.type === 'FormForm');
        
        if (formElements.length > 0) {
            // Use the first form as parent
            return formElements[0];
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error finding parent container:', error);
        return null;
    }
}

// Helper function to find the correct position for error elements
async function findErrorElementPosition(fieldElement) {
    try {
        // First try to find the field's immediate parent
        const parent = await fieldElement.parent;
        
        if (parent?.children) {
            // Find the field's position in the parent
            const children = await parent.children;
            const fieldIndex = children.findIndex(child => child.id === fieldElement.id);
            
            if (fieldIndex !== -1) {
                // Insert error element after the field
                return { parent, position: 'after', targetElement: children[fieldIndex] };
            }
        }
        
        // Fallback: use the field's parent
        if (parent?.children) {
            return { parent, position: 'append' };
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error finding error element position:', error);
        return null;
    }
}

// Helper function to create error styling
async function createErrorStyle() {
    try {
        // Create a style for error messages
        const errorStyle = await webflow.createStyle('a11y-error-message');
        await errorStyle.setProperties({
            'color': '#721c24',
            'font-size': '14px',
            'margin-top': '8px',
            'font-weight': '600',
            'line-height': '1.4',
            'padding': '8px 12px',
            'border-radius': '4px',
            'background-color': '#f8d7da',
            'border': '1px solid #f5c6cb',
            'margin-bottom': '8px',
            'display': 'none' // Hidden by default
        });
        
        return errorStyle;
    } catch (error) {
        console.error('❌ Error creating error style:', error);
        return null;
    }
}



// 🔒 CRITICAL: Add page-level custom code using Data API (MUCH CLEANER APPROACH)
async function addPageLevelValidationScript(pageId, settings) {
    try {
        // Get current page info with API response masking
        const pageInfo = await handleApiResponse(webflow.getCurrentPage());
        const siteInfo = await handleApiResponse(webflow.getSiteInfo());
        
        // console.log(`🎯 Adding page-level validation script for page: ••••••••`);
        
        // Generate the validation script
        const validationScript = generatePageLevelValidationScript(settings);
        
        // IMPORTANT: Custom code injection requires the Data API
        // The Designer API cannot modify page/site custom code settings
        // We'll provide instructions to the user for manual setup
        await addCustomCodeToPage(validationScript);
        
        
    } catch (error) {
        const sanitizedError = typeof sanitizeErrorMessage === 'function' 
            ? sanitizeErrorMessage(error) 
            : error.toString();
        safeConsoleLog(`❌ Failed to add page-level validation script:`, sanitizedError);
    }
}

// Helper function to handle API responses with content protection
async function handleApiResponse(apiCall) {
    try {
        const response = await apiCall;
        return typeof maskApiResponse === 'function' 
            ? maskApiResponse(response) 
            : response;
    } catch (error) {
        const sanitizedError = typeof sanitizeErrorMessage === 'function' 
            ? sanitizeErrorMessage(error) 
            : error.toString();
        throw new Error(sanitizedError);
    }
}

// Helper function to add custom code to page using Data API
async function addCustomCodeToPage(validationScript) {
    try {
        // Get current page and site info with API response masking
        const pageInfo = await handleApiResponse(webflow.getCurrentPage());
        const siteInfo = await handleApiResponse(webflow.getSiteInfo());
        
        // console.log(`🎯 Adding custom code to page: ••••••••`);
        safeConsoleLog(`📋 Site ID: ••••••••`);
        
        // IMPORTANT: This requires the Data API, not the Designer API
        // The Designer API cannot modify page/site custom code settings
        
        // For now, we'll provide instructions to the user
        const instructions = `
🔧 MANUAL SETUP REQUIRED - Custom Code Injection

Since the Designer API cannot modify page/site custom code settings, 
you need to manually add the validation script to your page:

1. Go to your page settings in Webflow Designer
2. Click on "Custom Code" tab
3. Add this script to the "Head Code" section:

${validationScript}

4. Save and publish your page

This script will provide form validation with error messaging for all forms on this page.
        `;
        
        // Instructions provided to user (not logged to console for security)
        
        // Show notification to user
        await webflow.notify({
            type: 'Info',
            message: 'Manual custom code setup required. Check console for instructions.'
        });
        
        // Note: Script not stored in localStorage for security
        
        // Custom code setup is now the only option
        
        // Add event listener for generate script button
        const generateButton = document.getElementById('generate-validation-script');
        if (generateButton) {
            generateButton.addEventListener('click', generateAndCopyValidationScript);
        }
        
        
    } catch (error) {
        const sanitizedError = typeof sanitizeErrorMessage === 'function' 
            ? sanitizeErrorMessage(error) 
            : error.toString();
        safeConsoleLog(`❌ Failed to provide custom code instructions:`, sanitizedError);
    }
}

// FUTURE IMPLEMENTATION: Data API approach for custom code
// This would be used if we had access to the Data API from the Designer Extension
async function addCustomCodeViaDataAPI(siteId, pageId, validationScript) {
    try {
        // Step 1: Register the script to the site
        const registerResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/registered_scripts/inline`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer YOUR_API_TOKEN',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sourceCode: validationScript,
                version: '1.1.0',
                displayName: 'A11y Form Validation',
                location: 'footer'
            })
        });
        
        if (!registerResponse.ok) {
            throw new Error(`Failed to register script: ${registerResponse.statusText}`);
        }
        
        const scriptData = await registerResponse.json();
        const scriptId = scriptData.id;
        
        // Step 2: Apply the script to the page
        const applyResponse = await fetch(`https://api.webflow.com/v2/pages/${pageId}/custom_code`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer YOUR_API_TOKEN',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scripts: [{
                    id: scriptId,
                    location: 'footer',
                    version: '1.1.0'
                }]
            })
        });
        
        if (!applyResponse.ok) {
            throw new Error(`Failed to apply script: ${applyResponse.statusText}`);
        }
        
        console.log(`✅ Custom code added via Data API successfully`);
        return true;
        
    } catch (error) {
        console.error(`❌ Failed to add custom code via Data API:`, error);
        return false;
    }
}



// Generate and copy validation script
async function generateAndCopyValidationScript() {
    try {
        // Get current settings
        const settings = getCurrentValidationSettings();
        
        // Generate the validation script
        const validationScript = generatePageLevelValidationScript(settings);
        
        // Try modern clipboard API first, then fallback to textarea method
        let copySuccess = false;
        
        try {
            // Try modern clipboard API
            await navigator.clipboard.writeText(validationScript);
            copySuccess = true;
        } catch (clipboardError) {
            console.log('📋 Modern clipboard API failed, trying fallback method...');
            
            // Fallback: Create temporary textarea element
            const textarea = document.createElement('textarea');
            textarea.value = validationScript;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            textarea.style.opacity = '0';
            textarea.setAttribute('readonly', '');
            
            document.body.appendChild(textarea);
            
            // Select and copy
            textarea.select();
            textarea.setSelectionRange(0, 99999); // For mobile devices
            
            try {
                document.execCommand('copy');
                copySuccess = true;
                console.log('✅ Script copied using fallback method');
            } catch (execError) {
                console.error('❌ Fallback copy method failed:', execError);
                copySuccess = false;
            } finally {
                // Clean up
                document.body.removeChild(textarea);
            }
        }
        
        if (copySuccess) {
            // Show success message
            const generateButton = document.getElementById('generate-validation-script');
            if (generateButton) {
                generateButton.textContent = '✅ Script Copied!';
                generateButton.style.backgroundColor = 'var(--greenBackground)';
                
                // Show instructions
                const instructions = document.getElementById('script-instructions');
                if (instructions) {
                    instructions.style.display = 'block';
                    
                    // Add close button functionality
                    const closeButton = instructions.querySelector('.close-btn');
                    if (closeButton) {
                        closeButton.onclick = function() {
                            instructions.style.display = 'none';
                        };
                    }
                }
                
                // Reset button after 3 seconds
                setTimeout(() => {
                    generateButton.textContent = '🚀 Generate & Copy Validation Script';
                    generateButton.style.backgroundColor = 'var(--actionPrimaryBackground)';
                }, 3000);
            }
            
            // Note: Script not stored in localStorage for security
            
            // Show notification
            await webflow.notify({
                type: 'Success',
                message: 'Validation script copied to clipboard! Check the instructions below.'
            });
            
            console.log('✅ Validation script generated and copied successfully');
        } else {
            // Show error message instead of displaying script
            const generateButton = document.getElementById('generate-validation-script');
            if (generateButton) {
                generateButton.textContent = '❌ Copy Failed';
                generateButton.style.backgroundColor = 'var(--redBackground)';
                
                // Show error notification
                await webflow.notify({
                    type: 'Error',
                    message: 'Failed to copy script. Please try again or check browser permissions.'
                });
                
                setTimeout(() => {
                    generateButton.textContent = '🚀 Generate & Copy Validation Script';
                    generateButton.style.backgroundColor = 'var(--actionPrimaryBackground)';
                }, 3000);
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to generate and copy script:', error);
        
        // Show error message
        const generateButton = document.getElementById('generate-validation-script');
        if (generateButton) {
            generateButton.textContent = '❌ Generation Failed';
            generateButton.style.backgroundColor = 'var(--redBackground)';
            
            setTimeout(() => {
                generateButton.textContent = '🚀 Generate & Copy Validation Script';
                generateButton.style.backgroundColor = 'var(--actionPrimaryBackground)';
            }, 3000);
        }
        
        await webflow.notify({
            type: 'Error',
            message: 'Failed to generate script. Please try again.'
        });
    }
}

// Note: Manual script display removed for security - script content not exposed in UI

// Get current validation settings
function getCurrentValidationSettings() {
    // Get settings from UI or use defaults
    return {
        rules: {
            required: true,
            email: true,
            phone: true,
            url: true,
            number: true,
            date: true,
            minlength: true,
            maxlength: true,
            pattern: true
        },
        errorMessages: {
            required: '{fieldLabel} is required',
            email: '{fieldLabel} must be a valid email address (name@company.com)',
            phone: '{fieldLabel} must be a valid phone number (US & CA: (555) 123-4567)',
            url: '{fieldLabel} must be a valid URL (https://www.example.com)',
            number: '{fieldLabel} must be a valid number',
            date: '{fieldLabel} must be a valid date (MM/DD/YYYY)',
            minlength: '{fieldLabel} must be at least {min} characters',
            maxlength: '{fieldLabel} must be no more than {max} characters'
        }
    };
}

// Generate optimized page-level validation script for body placement
function generatePageLevelValidationScript(settings) {
    return `
<!-- jQuery Validation Library Dependencies -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-validate/1.21.0/jquery.validate.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-validate/1.21.0/additional-methods.min.js"></script>

<script>
(function() {
    'use strict';
    
    console.log('🔧 Initializing BASIC PAGE-LEVEL validation script');
    
    // ===== BASIC VALIDATION CODE =====
    
    // Error messages for different field types
    const errorMessages = {
        required: 'This field is required',
        email: 'Please enter a valid email address',
        phone: 'Please enter a valid phone number',
        url: 'Please enter a valid URL',
        number: 'Please enter a valid number',
        date: 'Please enter a valid date',
        minlength: 'Please enter at least {min} characters',
        maxlength: 'Please enter no more than {max} characters'
    };
    
    // Helper function to get field label with flexible matching
    function getFieldLabel(field) {
        // Try to get label from associated label element first (most accurate)
        const fieldId = field.getAttribute('id');
        if (fieldId) {
            const labelElement = document.querySelector('label[for="' + fieldId + '"]');
            if (labelElement && labelElement.textContent.trim()) {
                return labelElement.textContent.trim();
            }
        }
        
        // Try to get label from aria-labelledby
        const ariaLabelledBy = field.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const labelElement = document.getElementById(ariaLabelledBy);
            if (labelElement && labelElement.textContent.trim()) {
                return labelElement.textContent.trim();
            }
        }
        
        // Try to get label from aria-label
        const ariaLabel = field.getAttribute('aria-label');
        if (ariaLabel) {
            return ariaLabel;
        }
        
        // Try to get label from data-field-label attribute (stored by extension)
        const dataLabel = field.getAttribute('data-field-label');
        if (dataLabel) {
            return dataLabel;
        }
        
        // Fallback to field name or placeholder
        const fieldName = field.getAttribute('name');
        if (fieldName) {
            return fieldName.replace(/[-_]/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
        }
        
        // Final fallback
        return 'This field';
    }
    
    // Helper function to normalize field labels for comparison
    function normalizeFieldLabel(label) {
        if (!label) return '';
        return label.toLowerCase()
            .replace(/[\\s\\-_]+/g, '-')  // Replace spaces, underscores, and multiple hyphens with single hyphen
            .replace(/[^a-z0-9\\-]/g, '') // Remove all non-alphanumeric characters except hyphens
            .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
    }
    
    // Helper function to find field by normalized label
    function findFieldByNormalizedLabel(targetLabel) {
        const normalizedTarget = normalizeFieldLabel(targetLabel);
        
        // Get all form fields
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
            const fields = form.querySelectorAll('input, textarea, select');
            
            for (const field of fields) {
                const fieldLabel = getFieldLabel(field);
                const normalizedFieldLabel = normalizeFieldLabel(fieldLabel);
                
                if (normalizedFieldLabel === normalizedTarget) {
                    return field;
                }
            }
        }
        
        return null;
    }
    
    // ===== MAIN VALIDATION CODE =====
    
    // Performance optimization: Only initialize if forms exist
    function initializeValidation() {
        const forms = document.querySelectorAll('form');
        if (forms.length === 0) {
            console.log('ℹ️ No forms found on page, skipping validation initialization');
            return;
        }
        
        console.log('📋 Found', forms.length, 'form(s) on page, initializing validation with spam protection');
    
    // Error messaging system with field-specific messages
    function getFieldSpecificMessage(messageType, fieldLabel, context = {}) {
        const templates = {
            required: '{fieldLabel} is required',
            email: '{fieldLabel} must be a valid email address (name@company.com)',
            phone: '{fieldLabel} must be a valid phone number (US & CA: (555) 123-4567)',
            url: '{fieldLabel} must be a valid URL (https://www.example.com)'
        };
        
        let message = templates[messageType] || 'Please check {fieldLabel}';
        
        // Replace placeholders
        message = message.replace('{fieldLabel}', fieldLabel);
        message = message.replace('{min}', context.min || '');
        message = message.replace('{max}', context.max || '');
        
        return message;
    }
    
    // Show error message by creating or updating error element
    function showError(field, message) {
        const errorId = field.getAttribute('data-error-id');
        if (!errorId) return;
        
        // Find existing error element or create new one
        let errorElement = document.getElementById(errorId);
        
        if (!errorElement) {
            // Create error element dynamically
            errorElement = document.createElement('div');
            errorElement.id = errorId;
            errorElement.className = 'a11y-error-message';
            errorElement.setAttribute('role', 'alert');
            
            // Insert after the field
            const fieldParent = field.parentElement;
            if (fieldParent) {
                fieldParent.insertBefore(errorElement, field.nextSibling);
            }
        }
        
        // Update error element
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.color = '#721c24';
        errorElement.style.backgroundColor = '#f8d7da';
        errorElement.style.border = '1px solid #f5c6cb';
        errorElement.style.padding = '8px 12px';
        errorElement.style.borderRadius = '4px';
        errorElement.style.marginTop = '8px';
        errorElement.style.fontSize = '14px';
        errorElement.style.fontWeight = '600';
        errorElement.style.lineHeight = '1.4';
    }
    
    // Hide error message
    function hideError(field) {
        const errorId = field.getAttribute('data-error-id');
        if (!errorId) return;
        
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
    
    // Basic field validation function
    function validateField(field) {
        let isValid = true;
        let errorMessage = '';
        
        // Get field label for specific error messages
        const fieldLabel = getFieldLabel(field);
        
        // Required validation
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            errorMessage = getFieldSpecificMessage('required', fieldLabel);
        }
        
        // Email validation
        if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('email', fieldLabel);
            }
        }
        
        // Phone validation
        if (field.type === 'tel' && field.value) {
            const phoneRegex = /^[0-9\\s\\-\\(\\)\\+]{10,}$/;
            if (!phoneRegex.test(field.value)) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('phone', fieldLabel);
            }
        }
        
        // URL validation
        if (field.type === 'url' && field.value) {
            try {
                new URL(field.value);
            } catch (e) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('url', fieldLabel);
            }
        }
        
        // Show/hide error and manage ARIA attributes
    if (!isValid && errorMessage) {
        showError(field, errorMessage);
        field.setAttribute('aria-invalid', 'true');
        const errorId = field.getAttribute('data-error-id');
        if (errorId) {
            field.setAttribute('aria-describedby', errorId);
        }
    } else {
        hideError(field);
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
    }
    
    return isValid;
    }
    
        // Add event listeners only to fields with our custom attributes
        let formFields = document.querySelectorAll('input, textarea, select');
        
        // Filter to only include fields that have our custom validation attributes
        const validatedFields = [];
        for (const field of formFields) {
            const hasDataLabel = field.hasAttribute('data-field-label');
            const hasDataErrorId = field.hasAttribute('data-error-id');
            const hasDataAutoError = field.hasAttribute('data-auto-error-messaging');
            
            // Debug logging for each field
            if (hasDataLabel || hasDataErrorId || hasDataAutoError) {
                console.log('🔍 Found field with custom attributes:', {
                    field: field.name || field.id || 'unnamed',
                    hasDataLabel,
                    hasDataErrorId,
                    hasDataAutoError,
                    dataFieldLabel: field.getAttribute('data-field-label'),
                    dataErrorId: field.getAttribute('data-error-id')
                });
            }
            
            // Only include fields that have our custom attributes (not Webflow-generated ones)
            if (hasDataLabel || hasDataErrorId || hasDataAutoError) {
                validatedFields.push(field);
            }
        }
        
        formFields = validatedFields;
        console.log('🔍 Found', formFields.length, 'fields with custom validation attributes for page-level validation');
        
        formFields.forEach(field => {
            // Track when user actually changes the field content
            field.addEventListener('input', function() {
                // Mark field as interacted with
                this.setAttribute('data-has-interacted', 'true');
                // Hide any existing errors when user starts typing
                if (this.hasAttribute('data-error-id')) {
                    hideError(this);
                }
            });
            
            // Only validate on blur if user has actually interacted with the field
            field.addEventListener('blur', function() {
                if (this.getAttribute('data-has-interacted') === 'true') {
                    validateField(this);
                }
            });
        });
        
        // Validate on form submit
        forms.forEach(form => {
            form.addEventListener('submit', function(e) {
                console.log('🔧 Form submit event triggered');
                
                let isValid = true;
                let firstErrorField = null;
                const fields = this.querySelectorAll('input, textarea, select');
                
                console.log('🔧 Validating', fields.length, 'fields on form submit');
                
                // Basic validation for fields with our custom attributes only
                fields.forEach(field => {
                        // Only validate fields that have our custom attributes
                        const hasDataLabel = field.hasAttribute('data-field-label');
                        const hasDataErrorId = field.hasAttribute('data-error-id');
                        const hasDataAutoError = field.hasAttribute('data-auto-error-messaging');
                        
                        if (hasDataLabel || hasDataErrorId || hasDataAutoError) {
                            if (!validateField(field)) {
                            isValid = false;
                                console.log('❌ Field validation failed:', field.getAttribute('data-field-label') || field.name || field.id);
                            if (!firstErrorField) {
                                firstErrorField = field;
                            }
                        }
                    }
                });
                
                if (!isValid) {
                    console.log('❌ Form validation failed, preventing submission');
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Focus on the first error field
                    if (firstErrorField) {
                        console.log('🎯 Focusing on first error field:', firstErrorField.name || firstErrorField.id);
                        firstErrorField.focus();
                        
                        // Scroll to the error field if needed
                        firstErrorField.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                        });
                        
                        // Announce error to screen readers
                        const errorId = firstErrorField.getAttribute('data-error-id');
                        if (errorId) {
                            const errorElement = document.getElementById(errorId);
                            if (errorElement) {
                                console.log('📢 Announcing error to screen readers:', errorElement.textContent);
                                // Announce the error message
                                const announcement = document.createElement('div');
                                announcement.setAttribute('role', 'alert');
                                announcement.setAttribute('aria-atomic', 'true');
                                announcement.style.position = 'absolute';
                                announcement.style.left = '-10000px';
                                announcement.style.width = '1px';
                                announcement.style.height = '1px';
                                announcement.style.overflow = 'hidden';
                                announcement.textContent = 'Validation error: ' + errorElement.textContent;
                                document.body.appendChild(announcement);
                                
                                // Remove announcement after a short delay
                                setTimeout(() => {
                                    if (announcement.parentNode) {
                                        announcement.parentNode.removeChild(announcement);
                                    }
                                }, 1000);
                            }
                        }
                    }
                    
                    return false;
                } else {
                    console.log('✅ Form validation passed, allowing submission');
                }
            });
        });
        
        console.log('✅ Basic validation initialization completed for', forms.length, 'form(s)');
    }
    
    // Smart initialization strategy for body placement
    if (document.readyState === 'loading') {
        // DOM is still loading, wait for it
        document.addEventListener('DOMContentLoaded', initializeValidation);
    } else {
        // DOM is already ready, initialize immediately
        initializeValidation();
    }
    
    console.log('✅ Basic page-level validation script loaded');
})();
</script>
    `;
}

// 🔒 CRITICAL: Generate basic validation script for individual forms
function generateValidationScript(formId, settings) {
    return `
<!-- jQuery Validation Library Dependencies -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-validate/1.21.0/jquery.validate.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-validate/1.21.0/additional-methods.min.js"></script>

<script>
(function() {
    'use strict';
    
    const form = document.querySelector('[data-form-id="${formId}"]') || document.querySelector('#${formId}');
    if (!form) return;
    
    console.log('🔧 Initializing BASIC validation for form:', formId);
    
    // ===== BASIC VALIDATION CODE =====
    
    // Error messages for different field types
    const errorMessages = {
        required: 'This field is required',
        email: 'Please enter a valid email address',
        phone: 'Please enter a valid phone number',
        url: 'Please enter a valid URL',
        number: 'Please enter a valid number',
        date: 'Please enter a valid date',
        minlength: 'Please enter at least {min} characters',
        maxlength: 'Please enter no more than {max} characters'
    };
    
    // Helper function to get field label with flexible matching
    function getFieldLabel(field) {
        // Try to get label from associated label element first (most accurate)
        const fieldId = field.getAttribute('id');
        if (fieldId) {
            const labelElement = document.querySelector('label[for="' + fieldId + '"]');
            if (labelElement && labelElement.textContent.trim()) {
                return labelElement.textContent.trim();
            }
        }
        
        // Try to get label from aria-labelledby
        const ariaLabelledBy = field.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const labelElement = document.getElementById(ariaLabelledBy);
            if (labelElement && labelElement.textContent.trim()) {
                return labelElement.textContent.trim();
            }
        }
        
        // Try to get label from aria-label
        const ariaLabel = field.getAttribute('aria-label');
        if (ariaLabel) {
            return ariaLabel;
        }
        
        // Try to get label from data-field-label attribute (stored by extension)
        const dataLabel = field.getAttribute('data-field-label');
        if (dataLabel) {
            return dataLabel;
        }
        
        // Fallback to field name or placeholder
        const fieldName = field.getAttribute('name');
        if (fieldName) {
            return fieldName.replace(/[-_]/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
        }
        
        // Final fallback
        return 'This field';
    }
    
    // Helper function to normalize field labels for comparison
    function normalizeFieldLabel(label) {
        if (!label) return '';
        return label.toLowerCase()
            .replace(/[\\s\\-_]+/g, '-')  // Replace spaces, underscores, and multiple hyphens with single hyphen
            .replace(/[^a-z0-9\\-]/g, '') // Remove all non-alphanumeric characters except hyphens
            .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
    }
    
    // Helper function to find field by normalized label
    function findFieldByNormalizedLabel(targetLabel) {
        const normalizedTarget = normalizeFieldLabel(targetLabel);
        
        // Get all form fields
        const fields = form.querySelectorAll('input, textarea, select');
        
        for (const field of fields) {
            const fieldLabel = getFieldLabel(field);
            const normalizedFieldLabel = normalizeFieldLabel(fieldLabel);
            
            if (normalizedFieldLabel === normalizedTarget) {
                return field;
            }
        }
        
        return null;
    }
    
    // ===== MAIN VALIDATION CODE =====
    
    // Automated error messaging system with field-specific messages
    function getFieldSpecificMessage(messageType, fieldLabel, context = {}) {
        const templates = {
            required: '{fieldLabel} is required',
            email: '{fieldLabel} must be a valid email address (name@company.com)',
            phone: '{fieldLabel} must be a valid phone number (US & CA: (555) 123-4567)',
            url: '{fieldLabel} must be a valid URL (https://www.example.com)'
        };
        
        let message = templates[messageType] || 'Please check {fieldLabel}';
        
        // Replace placeholders
        message = message.replace('{fieldLabel}', fieldLabel);
        message = message.replace('{min}', context.min || '');
        message = message.replace('{max}', context.max || '');
        
        return message;
    }
    
    // Helper function to get field label with flexible matching
    function getFieldLabel(field) {
        // Try to get label from associated label element first (most accurate)
        const fieldId = field.getAttribute('id');
        if (fieldId) {
            const labelElement = document.querySelector('label[for="' + fieldId + '"]');
            if (labelElement && labelElement.textContent.trim()) {
                return labelElement.textContent.trim();
            }
        }
        
        // Try to get label from aria-labelledby
        const ariaLabelledBy = field.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const labelElement = document.getElementById(ariaLabelledBy);
            if (labelElement && labelElement.textContent.trim()) {
                return labelElement.textContent.trim();
            }
        }
        
        // Try to get label from aria-label
        const ariaLabel = field.getAttribute('aria-label');
        if (ariaLabel) {
            return ariaLabel;
        }
        
        // Try to get label from data-field-label attribute (stored by extension)
        const dataLabel = field.getAttribute('data-field-label');
        if (dataLabel) {
            return dataLabel;
        }
        
        // Fallback to field name or placeholder
        const fieldName = field.getAttribute('name');
        if (fieldName) {
            return fieldName.replace(/[-_]/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
        }
        
        // Final fallback
        return 'This field';
    }
    
    // Fallback error messages (for backward compatibility)
    const errorMessages = {
        required: 'This field is required',
        email: 'Please enter a valid email address',
        phone: 'Please enter a valid phone number',
        url: 'Please enter a valid URL',
        number: 'Please enter a valid number',
        date: 'Please enter a valid date',
        minlength: 'Please enter at least {min} characters',
        maxlength: 'Please enter no more than {max} characters'
    };
    
    // Get all fields with automated error messaging using flexible matching
    let fields = form.querySelectorAll('[data-auto-error-messaging="true"]');
    
    // If no fields found with exact attribute match, try flexible matching
    if (fields.length === 0) {
        console.log('🔍 No fields found with exact data-auto-error-messaging attribute, trying flexible matching...');
        
        // Get all form fields and check for validation attributes
        const allFields = form.querySelectorAll('input, textarea, select');
        const validatedFields = [];
        
        for (const field of allFields) {
            // Check if field has any validation attributes
            const hasRequired = field.hasAttribute('required');
            const hasValidationType = field.type === 'email' || field.type === 'tel' || field.type === 'url';
            const hasDataLabel = field.hasAttribute('data-field-label');
            
            if (hasRequired || hasValidationType || hasDataLabel) {
                validatedFields.push(field);
            }
        }
        
        fields = validatedFields;
        console.log('🔍 Found', fields.length, 'fields with validation attributes using flexible matching');
    } else {
    console.log('📋 Found', fields.length, 'fields with automated error messaging');
    }
    
    // Set up validation for each field
    fields.forEach(field => {
        // Validation on blur
        field.addEventListener('blur', function() {
            validateField(this);
        });
        
        // Clear errors on input and update character count
        field.addEventListener('input', function() {
            clearFieldError(this);
            updateCharacterCount(this);
        });
        
        // Clear errors on focus
        field.addEventListener('focus', function() {
            clearFieldError(this);
        });
    });
    
    // Form submission with basic validation
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateForm()) {
            console.log('✅ Form validation passed, submitting...');
            form.submit();
        } else {
            focusFirstError();
        }
    });
    
    function validateField(field) {
        // Clear any existing error
        clearFieldError(field);
        
        let isValid = true;
        let errorMessage = '';
        
        // Get field label for specific error messages
            const fieldLabel = getFieldLabel(field);
        
        // Required validation
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            errorMessage = getFieldSpecificMessage('required', fieldLabel);
        }
        
        // Email validation
        if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('email', fieldLabel);
            }
        }
        
        // Phone validation
        if (field.type === 'tel' && field.value) {
            const phoneRegex = /^[0-9\\s\\-\\(\\)\\+]{10,}$/;
            if (!phoneRegex.test(field.value)) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('phone', fieldLabel);
            }
        }
        
        // URL validation
        if (field.type === 'url' && field.value) {
            try {
                new URL(field.value);
            } catch (e) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('url', fieldLabel);
            }
        }
        
        // Show error if validation failed
        if (!isValid && errorMessage) {
            showError(field, errorMessage);
        }
        
        return isValid;
    }
    
    // Show error message using automated error messaging
    function showError(field, message) {
        // Get error ID from field attributes
        const errorId = field.getAttribute('data-error-id');
        if (!errorId) return;
        
        // Create or get error container
        let errorElement = document.getElementById(errorId);
        if (!errorElement) {
            errorElement = createErrorElement(errorId);
        }
        
        // Display error message
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // 🎯 DYNAMIC ARIA ATTRIBUTE MANAGEMENT
        // Mark field as invalid for accessibility
        field.setAttribute('aria-invalid', 'true');
        
        // Ensure aria-describedby is active when invalid
        field.setAttribute('aria-describedby', errorId);
        
        // Announce error to screen readers
        announceToScreenReader(message);
    }
    
    // Create error element dynamically
    function createErrorElement(errorId) {
        const errorElement = document.createElement('div');
        errorElement.id = errorId;
        errorElement.className = 'a11y-validation-error';
        errorElement.setAttribute('role', 'alert');
        errorElement.setAttribute('aria-atomic', 'true');
        errorElement.style.cssText = \`
            display: none;
            color: #dc3545;
            font-size: 14px;
            margin-top: 8px;
            font-weight: 500;
            line-height: 1.4;
            padding: 8px 12px;
            border-radius: 4px;
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            margin-bottom: 8px;
            position: relative;
        \`;
        
        // Find the field and insert error after it
        const field = document.querySelector(\`[data-error-id="\${errorId}"]\`);
        if (field && field.parentElement) {
            field.parentElement.insertBefore(errorElement, field.nextSibling);
        }
        
        return errorElement;
    }
    
    // Clear field error
    function clearFieldError(field) {
        const errorId = field.getAttribute('data-error-id');
        if (errorId) {
            const errorElement = document.getElementById(errorId);
            if (errorElement) {
                errorElement.style.display = 'none';
                errorElement.textContent = '';
            }
        }
        
        // Remove all error-related ARIA attributes when valid
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
    }
    
    // Update character count display
    function updateCharacterCount(field) {
        const maxLength = field.getAttribute('maxlength');
        if (!maxLength) return;
        
        const currentLength = field.value.length;
        const maxLengthNum = parseInt(maxLength);
        const remaining = maxLengthNum - currentLength;
        
        // Get or create character count element
        let countElement = field.parentElement.querySelector('.character-count');
        if (!countElement) {
            countElement = document.createElement('div');
            countElement.className = 'character-count';
            countElement.style.cssText = \`
                font-size: 12px;
                color: #6c757d;
                margin-top: 4px;
                text-align: right;
                font-style: italic;
            \`;
            field.parentElement.appendChild(countElement);
        }
        
        // Update count display
        if (remaining >= 0) {
            countElement.textContent = \`\${remaining} characters remaining\`;
            countElement.style.color = remaining <= 10 ? '#dc3545' : '#6c757d';
        } else {
            countElement.textContent = \`\${Math.abs(remaining)} characters over limit\`;
            countElement.style.color = '#dc3545';
        }
        
        // Show/hide count element
        countElement.style.display = currentLength > 0 ? 'block' : 'none';
    }
    
    // Hide error (alias for clearFieldError)
    function hideError(field) {
        clearFieldError(field);
    }
        
        // Pattern validation
        if (field.hasAttribute('pattern') && field.value) {
            const pattern = new RegExp(field.getAttribute('pattern'));
            if (!pattern.test(field.value)) {
                isValid = false;
                errorMessage = errorMessages.pattern;
            }
        }
        
        // Display inline error or clear it
        if (!isValid && errorElement) {
            showError(field, errorMessage);
        } else {
            hideError(field);
        }
        
        return isValid;
    }
    
    // Show error message following W3C WAI guidelines
    function showError(field, message, errorType = 'required') {
        const errorId = field.getAttribute('aria-describedby');
        const errorElement = document.getElementById(errorId);
        
        if (errorElement) {
            // Add error icon for better visual indication
            errorElement.innerHTML = '<span style="margin-right: 4px;">⚠️</span>' + message;
            errorElement.style.display = 'block';
            
            // Add ARIA attributes to field (W3C WAI requirement)
            field.setAttribute('aria-invalid', 'true');
            
            // Add error class to field for styling
            field.classList.add('a11y-field-error');
            field.style.borderColor = '#dc3545';
            field.style.boxShadow = '0 0 0 0.2rem rgba(220, 53, 69, 0.25)';
            
            // Announce error to screen readers
            announceToScreenReader('Error: ' + message);
        }
    }
    
    // Hide error message
    function hideError(field) {
        const errorId = field.getAttribute('aria-describedby');
        const errorElement = document.getElementById(errorId);
        
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.innerHTML = '';
        }
        
        // Remove ARIA attributes from field
        field.removeAttribute('aria-invalid');
        
        // Remove error class and styling from field
        field.classList.remove('a11y-field-error');
        field.style.borderColor = '';
        field.style.boxShadow = '';
    }
    
    // Clear field error (for input events)
    function clearFieldError(field) {
        hideError(field);
    }
    
    // Announce to screen readers
    function announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        // Remove announcement after a short delay
        setTimeout(() => {
            if (announcement.parentNode) {
                announcement.parentNode.removeChild(announcement);
            }
        }, 1000);
    }
    
    function validateForm() {
        const fields = form.querySelectorAll('input, textarea, select');
        let isValid = true;
        let firstErrorField = null;
        
        // Basic validation for all fields
            fields.forEach(field => {
                if (!validateField(field)) {
                    isValid = false;
                    if (!firstErrorField) {
                        firstErrorField = field;
                    }
                }
            });
        
        if (!isValid && firstErrorField) {
            // Focus on first error (W3C WAI recommendation)
            firstErrorField.focus();
            
            // Announce form errors to screen readers
            announceToScreenReader('Form submission failed. Please correct the errors and try again.');
        }
        
        return isValid;
    }
    
    function focusFirstError() {
        const firstErrorField = form.querySelector('[aria-invalid="true"]');
        if (firstErrorField) {
            firstErrorField.focus();
        }
    }
    
    console.log('✅ Basic validation script loaded for form ${formId}');
    
    // Smart initialization strategy for body placement
    if (document.readyState === 'loading') {
        // DOM is still loading, wait for it
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🔧 DOM ready, initializing basic validation for form:', formId);
        });
    } else {
        // DOM is already ready, initialize immediately
        console.log('🔧 DOM already ready, initializing basic validation for form:', formId);
    }
})();
</script>
    `;
}
function updateFormValidationStatus(form, hasValidation) {
    // Find the form index in scannedForms
    const formIndex = scannedForms.indexOf(form);
    const formIdValue = `form-${formIndex}`;
    const formItem = document.querySelector(`.form-item[data-form-id="${formIdValue}"]`);
    if (formItem) {
        const indicator = formItem.querySelector('.validation-indicator');
        const text = formItem.querySelector('.validation-text');
        if (indicator) {
            indicator.className = `validation-indicator ${hasValidation ? 'has-validation' : 'no-validation'}`;
        }
        if (text) {
            text.textContent = hasValidation ? '✅ Has validation' : '❌ No validation';
        }
    }
}
function resetValidation() {
    console.log('🔄 Resetting validation settings...');
    const elements = {
        'required-rule': false,
        'email-rule': false,
        'phone-rule': false,
        'url-rule': false,
        'min-length-text': '0',
        'max-length-text': '100',
        'min-length-textarea': '0',
        'max-length-textarea': '500',
        
        'required-message': 'This field is required',
        'email-message': 'Please enter a valid email address',
        'phone-message': 'Please enter a valid phone number',
        
        'aria-labels': true,
        'error-summary': true,
        'live-validation': true,
        'focus-management': false,

        'custom-styling': true
    };
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            }
            else {
                element.value = value;
            }
        }
    });
    updateStatus('Validation settings reset to defaults', 'success');
}
function toggleDemoMode() {
    console.log('🎭 Toggling demo mode...');
    const demoBtn = document.getElementById('demo-mode');
    if (demoBtn) {
        const currentText = demoBtn.textContent;
        if (currentText?.includes('Demo Mode')) {
            updateStatus('Demo: Form selected - configure validation below', 'success');
            demoBtn.textContent = '🔄 Reset Demo';
        }
        else {
            updateStatus('Demo: No form selected', 'info');
            demoBtn.textContent = '🎭 Toggle Demo Mode';
        }
    }
}

function handleCloseExtension() {
    console.log('❌ Closing extension...');
    if (isWebflowDesigner && webflow.closeExtension) {
        try {
            webflow.closeExtension();
            console.log('✅ Extension closed successfully');
        } catch (error) {
            console.error('❌ Failed to close extension:', error);
            updateStatus('Failed to close extension', 'error');
        }
    } else {
        console.log('ℹ️ Preview mode - Extension would close');
        updateStatus('Preview: Extension would close', 'info');
    }
}

// ============================================================================
// v2.7.0 FIELD-LEVEL ERROR MESSAGING SYSTEM
// ============================================================================

// Default error messages for different field types
const DEFAULT_ERROR_MESSAGES = {
    required: 'This field is required',
    email: 'Please enter a valid email address',
    phone: 'Please enter a valid phone number',
    url: 'Please enter a valid URL',
    minLength: 'Please enter at least {min} characters',
    maxLength: 'Please enter no more than {max} characters',
    pattern: 'Please match the required format'
};

// Store custom error messages per field (Pro feature)
const customErrorMessages = {};

// Store error containers for cleanup
const errorContainers = new Map();

// ============================================================================
// CORE ERROR SYSTEM FUNCTIONS
// ============================================================================

/**
 * Check if a field has the required property enabled
 * @param {Object} field - Webflow field element
 * @returns {Promise<boolean>} - True if field is required
 */
async function checkFieldRequirement(field) {
    try {
        console.log(`🔍 Checking requirement for field: ${field.label || field.name || field.id}`);
        
        // Get the actual field element using the same logic as the successful initial scan
        let fieldElement = null;
        
        // If field is already an element, use it
        if (field.getAttribute) {
            fieldElement = field;
        } else {
            // Use the same successful scanning logic as the initial form scan
            try {
                const allElements = await webflow.getAllElements();
                console.log(`🔍 Searching through ${allElements.length} elements for field: ${field.label}`);
                
                // Use the same logic that works in the initial scan
                const fieldLabel = field.label || field.name || '';
                const fieldType = field.type || '';
                
                // Use the EXACT SAME field finding logic that works in applyEnhancedFieldValidation
                // console.log(`🔍 Searching for field element by label: ${fieldLabel}`);
                
                // Find field by matching label or name (same as working validation logic)
                for (const element of allElements) {
                    const elementType = element.type;
                    const isFormField = elementType === 'FormTextInput' || 
                                       elementType === 'FormTextarea' || 
                                       elementType === 'FormSelect' || 
                                       elementType === 'FormCheckboxInput' || 
                                       elementType === 'FormRadioInput';
                    
                    if (isFormField) {
                        let elementLabel = '';
                        let elementName = '';
                        
                        // Try to get label (same as working validation logic)
                        if (element.getLabel) {
                            try {
                                elementLabel = await element.getLabel();
                            } catch (e) {
                                // Ignore label errors
                            }
                        }
                        
                        // Try to get name (same as working validation logic)
                        if (element.getName) {
                            try {
                                elementName = await element.getName();
                            } catch (e) {
                                // Ignore name errors
                            }
                        }
                        
                        // Match by label or name (EXACT same logic as working validation)
                        if (elementLabel === fieldLabel || elementName === fieldLabel) {
                            fieldElement = element;
                            console.log(`✅ Found field element using validation logic: "${fieldLabel}" matches "${elementLabel || elementName}"`);
                            break;
                        }
                    }
                }
                
                if (!fieldElement) {
                    console.warn(`⚠️ No field element found using validation logic for: ${fieldLabel}`);
                }
                
            } catch (error) {
                console.warn(`⚠️ Could not find field element for ${field.label}:`, error);
            }
        }
        
        if (!fieldElement) {
            console.warn(`⚠️ No field element found for ${field.label || field.name || field.id}`);
            return false;
        }
        
        // Now check the field requirements using Webflow API methods
        let hasRequired = false;
        let hasAriaRequired = false;
        let hasCustomRequired = false;
        let isEmailField = false;
        let needsErrorContainer = false;
        
        try {
            // Use Webflow API methods to check attributes
            if (fieldElement.getCustomAttribute) {
                // Check required attribute using Webflow API
                const requiredAttr = await fieldElement.getCustomAttribute('required');
                hasRequired = requiredAttr === 'required' || requiredAttr === 'true';
                
                // Check aria-required attribute using Webflow API
                const ariaRequiredAttr = await fieldElement.getCustomAttribute('aria-required');
                hasAriaRequired = ariaRequiredAttr === 'true';
                
                // Check custom required attribute using Webflow API
                const customRequiredAttr = await fieldElement.getCustomAttribute('data-a11y-required');
                hasCustomRequired = customRequiredAttr === 'true';
                
                // Check if field needs error container using Webflow API
                const needsErrorAttr = await fieldElement.getCustomAttribute('data-needs-error-container');
                needsErrorContainer = needsErrorAttr === 'true';
                
                // Check if it's an email field using Webflow API
                const typeAttr = await fieldElement.getCustomAttribute('type');
                isEmailField = typeAttr === 'email';
            }
            
        } catch (error) {
            console.warn(`⚠️ Error checking field attributes using Webflow API:`, error);
        }
        
        // A field is required if:
        // 1. It has required attribute
        // 2. It has aria-required="true"
        // 3. It was marked by our extension
        // 4. It's an email field (typically required)
        // 5. It needs an error container (marked during validation)
        
        const isRequired = hasRequired || hasAriaRequired || hasCustomRequired || isEmailField || needsErrorContainer;
        
        console.log(`📋 Field requirement check:`, {
            field: field.label || field.name || field.id,
            hasRequired,
            hasAriaRequired,
            hasCustomRequired,
            needsErrorContainer,
            isEmailField,
            isRequired,
            fieldElementFound: !!fieldElement
        });
        
        return isRequired;
        
    } catch (error) {
        console.error(`❌ Error checking field requirement for ${field.label || field.name || field.id}:`, error);
        return false;
    }
}

/**
 * Get all required fields from a list of input fields
 * @param {Array} inputFields - Array of Webflow field elements
 * @returns {Promise<Array>} - Array of required fields only
 */
async function getRequiredFields(inputFields) {
    const requiredFields = [];
    
    for (const field of inputFields) {
        if (await checkFieldRequirement(field)) {
            requiredFields.push(field);
        }
    }
    
    return requiredFields;
}



/**
 * Remove error container from a field
 * @param {Object} field - Webflow field element
 */
async function removeErrorContainer(field) {
    try {
        const errorContainer = errorContainers.get(field.id);
        if (errorContainer) {
            await errorContainer.remove();
            errorContainers.delete(field.id);
            console.log('✅ Error container removed for field:', field.id);
        }
    } catch (error) {
        console.error('❌ Failed to remove error container:', error);
    }
}

/**
 * Show error message in the Embed + Text Block error container
 * @param {Object} field - Webflow field element
 * @param {string} message - Error message to display
 * @param {string} errorType - Type of error (required, email, etc.)
 */
async function showFieldError(field, message, errorType = 'required') {
    try {
        const errorContainer = errorContainers.get(field.id);
        if (!errorContainer) {
            console.warn('No error container found for field:', field.id);
            return;
        }
        
        // Handle Embed + Text Block approach
        if (errorContainer.type === 'embed-text-block') {
            try {
                const { textBlock, embedElement, errorId } = errorContainer;
                
                // Step 1: Update Text Block with error message
                if (textBlock.setTextContent) {
                    await textBlock.setTextContent(message);
                    console.log(`✅ Set error message in Text Block: ${message}`);
                }
                
                // Step 2: Show the Text Block with error styling
                if (textBlock.setStyles) {
                    await textBlock.setStyles([{
                        'display': 'block',
                        'color': '#dc3545',
                        'font-size': '14px',
                        'margin-top': '8px',
                        'font-weight': '500',
                        'line-height': '1.4',
                        'padding': '4px 8px',
                        'border-radius': '4px',
                        'background-color': '#f8d7da',
                        'border': '1px solid #f5c6cb'
                    }]);
                    console.log(`✅ Applied error styling to Text Block`);
                }
                
                // Step 3: Update Text Block custom attributes
                if (textBlock.setCustomAttribute) {
                    await textBlock.setCustomAttribute('data-error-type', errorType);
                    await textBlock.setCustomAttribute('data-error-message', message);
                }
                
                // Step 4: Add error state to field
                if (field.setCustomAttribute) {
                    await field.setCustomAttribute('aria-invalid', 'true');
                    await field.setCustomAttribute('aria-describedby', errorId);
                    console.log(`✅ Added error state to field`);
                }
                
                // Step 5: Inject error messaging JavaScript into Embed element
                if (embedElement.setCustomAttribute) {
                    const errorScript = `
                        <script>
                        (function() {
                            // Error messaging functionality for ${errorContainer.fieldLabel}
                            const errorContainer = document.getElementById('${errorId}');
                            const field = document.querySelector('[data-field-id="${field.id}"]');
                            
                            if (errorContainer && field) {
                                // Show error message
                                errorContainer.style.display = 'block';
                                errorContainer.textContent = '${message.replace(/'/g, "\\'")}';
                                
                                // Add error state to field
                                field.setAttribute('aria-invalid', 'true');
                                field.setAttribute('aria-describedby', '${errorId}');
                                
                                console.log('✅ Error message displayed via Embed script for ${errorContainer.fieldLabel}');
                            }
                        })();
                        </script>
                    `;
                    
                    await embedElement.setCustomAttribute('data-error-script', errorScript);
                    console.log(`✅ Injected error messaging script into Embed element`);
                }
                
                console.log('✅ Error message shown via Embed + Text Block for field:', field.id, 'Message:', message);
                
            } catch (embedTextError) {
                console.error('❌ Failed to show error via Embed + Text Block:', embedTextError);
            }
        } 
        // Handle custom attribute fallback approach
        else if (errorContainer.type === 'custom-attribute-fallback') {
            try {
                const { fieldElement, errorId, fieldLabel } = errorContainer;
                
                // Store error message in field's custom attributes
                if (fieldElement.setCustomAttribute) {
                    await fieldElement.setCustomAttribute('data-error-message', message);
                    await fieldElement.setCustomAttribute('data-error-type', errorType);
                    await fieldElement.setCustomAttribute('data-error-display', 'show');
                    await fieldElement.setCustomAttribute('aria-invalid', 'true');
                    await fieldElement.setCustomAttribute('aria-describedby', errorId);
                }
                
            } catch (fallbackError) {
                console.error('❌ Failed to show error via custom attribute fallback:', fallbackError);
            }
        } else {
            console.warn('Unknown error container type:', errorContainer.type);
        }
        
    } catch (error) {
        console.error('❌ Failed to show field error:', error);
    }
}

/**
 * Hide error message for a field
 * @param {Object} field - Webflow field element
 */
async function hideFieldError(field) {
    try {
        const errorContainer = errorContainers.get(field.id);
        if (!errorContainer) {
            return;
        }
        
        // Handle Embed + Text Block approach
        if (errorContainer.type === 'embed-text-block') {
            try {
                const { textBlock, embedElement, errorId } = errorContainer;
                
                // Step 1: Hide the Text Block
                if (textBlock.setStyles) {
                    await textBlock.setStyles([{
                        'display': 'none'
                    }]);
                    console.log(`✅ Hidden Text Block`);
                }
                
                // Step 2: Clear error message
                if (textBlock.setTextContent) {
                    await textBlock.setTextContent('');
                    console.log(`✅ Cleared error message in Text Block`);
                }
                
                // Step 3: Clear Text Block custom attributes
                if (textBlock.setCustomAttribute) {
                    await textBlock.setCustomAttribute('data-error-type', '');
                    await textBlock.setCustomAttribute('data-error-message', '');
                }
                
                // Step 4: Remove error state from field
                if (field.setCustomAttribute) {
                    await field.setCustomAttribute('aria-invalid', 'false');
                    await field.removeCustomAttribute('aria-describedby');
                    console.log(`✅ Removed error state from field`);
                }
                
                // Step 5: Inject hide error JavaScript into Embed element
                if (embedElement.setCustomAttribute) {
                    const hideScript = `
                        <script>
                        (function() {
                            // Hide error functionality for ${errorContainer.fieldLabel}
                            const errorContainer = document.getElementById('${errorId}');
                            const field = document.querySelector('[data-field-id="${field.id}"]');
                            
                            if (errorContainer && field) {
                                // Hide error message
                                errorContainer.style.display = 'none';
                                errorContainer.textContent = '';
                                
                                // Remove error state from field
                                field.removeAttribute('aria-invalid');
                                field.removeAttribute('aria-describedby');
                                
                                console.log('✅ Error message hidden via Embed script for ${errorContainer.fieldLabel}');
                            }
                        })();
                        </script>
                    `;
                    
                    await embedElement.setCustomAttribute('data-hide-script', hideScript);
                    console.log(`✅ Injected hide error script into Embed element`);
                }
                
                console.log('✅ Error message hidden via Embed + Text Block for field:', field.id);
                
            } catch (embedTextError) {
                console.error('❌ Failed to hide error via Embed + Text Block:', embedTextError);
            }
        } 
        // Handle custom attribute fallback approach
        else if (errorContainer.type === 'custom-attribute-fallback') {
            try {
                const { fieldElement, errorId, fieldLabel } = errorContainer;
                
                // Clear error message from field's custom attributes
                if (fieldElement.setCustomAttribute) {
                    await fieldElement.setCustomAttribute('data-error-message', '');
                    await fieldElement.setCustomAttribute('data-error-type', '');
                    await fieldElement.setCustomAttribute('data-error-display', 'hide');
                    await fieldElement.setCustomAttribute('aria-invalid', 'false');
                    await fieldElement.removeCustomAttribute('aria-describedby');
                }
                
            } catch (fallbackError) {
                console.error('❌ Failed to hide error via custom attribute fallback:', fallbackError);
            }
        } else {
            console.warn('Unknown error container type:', errorContainer.type);
        }
        
    } catch (error) {
        console.error('❌ Failed to hide field error:', error);
    }
}

/**
 * Get error message for a field (custom or default)
 * @param {Object} field - Webflow field element
 * @param {string} errorType - Type of error
 * @returns {string} - Error message to display
 */
function getErrorMessage(field, errorType) {
    const fieldId = field.id;
    const customMessage = customErrorMessages[fieldId]?.[errorType];
    
    if (customMessage) {
        return customMessage;
    }
    
    return DEFAULT_ERROR_MESSAGES[errorType] || DEFAULT_ERROR_MESSAGES.required;
}

/**
 * Apply error messaging to a single field
 * @param {Object} field - Webflow field element
 */
async function applyErrorMessagingToField(field) {
    try {
        // Extract field information
        const fieldName = field.name || field.id || 'unnamed-field';
        const fieldLabel = field.label || fieldName;
        
        // Set up custom code error messaging
        const errorSetup = await setupCustomCodeErrorMessaging(field, fieldName, fieldLabel);
        if (!errorSetup) {
            console.error('❌ Failed to setup error messaging for field:', field.id);
            return;
        }
        
        console.log('✅ Custom code error messaging setup for field:', field.id);
        
    } catch (error) {
        console.error('❌ Failed to apply error messaging to field:', error);
    }
}

/**
 * Remove error messaging from a field
 * @param {Object} field - Webflow field element
 */
async function removeErrorMessagingFromField(field) {
    try {
        await removeErrorContainer(field);
        await hideFieldError(field);
        console.log('✅ Error messaging removed from field:', field.id);
    } catch (error) {
        console.error('❌ Failed to remove error messaging from field:', error);
    }
}

/**
 * Check if a field has error messaging applied
 * @param {Object} field - Webflow field element
 * @returns {boolean} - True if field has error messaging
 */
function hasErrorMessaging(field) {
    return errorContainers.has(field.id);
}

/**
 * Process required fields for error messaging
 * @param {Array} forms - Array of selected forms
 */
async function processRequiredFieldsForErrorMessaging(forms) {
    console.log('🔍 Processing required fields for error messaging...');
    
    for (const form of forms) {
        try {
            // Get all input fields in the form
            const allFields = await getFormFields(form);
            console.log(`📋 Found ${allFields.length} total fields in form:`, form.name);
            
            // Filter to required fields only
            const requiredFields = await getRequiredFields(allFields);
            console.log(`📋 Found ${requiredFields.length} required fields in form:`, form.name);
            
            // Apply error messaging to required fields
            for (const field of requiredFields) {
                await applyErrorMessagingToField(field);
            }
            
            console.log(`✅ Applied error messaging to ${requiredFields.length} required fields in form:`, form.name);
            
        } catch (error) {
            console.error('❌ Failed to process form for error messaging:', error);
        }
    }
}

/**
 * Enable field-level error messaging for selected forms
 */
async function enableFieldLevelErrorMessaging() {
    console.log('🚀 Enabling field-level error messaging...');
    
    try {
        // Get selected forms
        const selectedForms = getSelectedForms();
        if (selectedForms.length === 0) {
            showWarningNotification('Please select at least one form first.');
            return;
        }
        
        // Process required fields for error messaging
        await processRequiredFieldsForErrorMessaging(selectedForms);
        

        
        showSuccessNotification('Field-level error messaging enabled for required fields!');
        
    } catch (error) {
        console.error('❌ Failed to enable field-level error messaging:', error);
        showErrorNotification('Failed to enable field-level error messaging.');
    }
}

/**
 * Disable field-level error messaging
 */
async function disableFieldLevelErrorMessaging() {
    console.log('🛑 Disabling field-level error messaging...');
    
    try {
        // Remove all error containers
        for (const [fieldId, errorContainer] of errorContainers) {
            try {
                await errorContainer.remove();
            } catch (error) {
                console.warn('Failed to remove error container:', error);
            }
        }
        
        // Clear the containers map
        errorContainers.clear();
        
        showSuccessNotification('Field-level error messaging disabled!');
        
    } catch (error) {
        console.error('❌ Failed to disable field-level error messaging:', error);
        showErrorNotification('Failed to disable field-level error messaging.');
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
// ⚠️  CRITICAL WARNING: DO NOT MODIFY SCANNING LOGIC ⚠️
// This scanning logic is working perfectly for MVP and handles ALL Webflow form structures:
// - Direct children of FormForm elements
// - Block element wrappers (nested structure)  
// - VFlex element wrappers (vertical layout containers)
// - HFlex element wrappers (horizontal layout containers)
// - Container element wrappers (layout and styling containers)
// - DOM element wrappers (Custom Elements from Add panel)
// - Required field filtering (only validates required fields)
// - Multi-level nesting detection (unlimited depth)
// 
// The logic correctly identifies and validates only:
// - Required fields with types: name, email, phone, URL
// - Respects Starter plan limits (5 forms, 5 fields per form)
// 
// DO NOT CHANGE, UPDATE, OR MOVE THIS LOGIC unless specifically requested
// after thorough review. Current implementation is production-ready for MVP.
// ============================================================================

/**
 * Get all form fields from a form (using existing field detection logic)
 * @param {Object} form - Webflow form element
 * @returns {Promise<Array>} - Array of form field elements
 */
async function getFormFields(form) {
    try {
        const fields = [];
        
        // Method 1: Check if form has direct fields property
        if (form.fields && Array.isArray(form.fields)) {
            for (const field of form.fields) {
                if (field && field.type) {
                    fields.push(field);
                }
            }
        }
        
        // Method 2: If no fields found, scan all elements and filter
        if (fields.length === 0) {
            const allElements = await webflow.getAllElements();
            
            // Look for form fields that might belong to this form
            const potentialFields = allElements.filter(element => {
                const elementType = element.type;
                return elementType === 'FormTextInput' ||
                       elementType === 'FormTextarea' ||
                       elementType === 'FormSelect' ||
                       elementType === 'FormCheckboxInput' ||
                       elementType === 'FormRadioInput' ||
                       elementType === 'FormFileUploadWrapper';
            });
            
            // Add all potential fields (we'll filter by requirement later)
            fields.push(...potentialFields);
        }
        
        return fields;
        
    } catch (error) {
        console.error('❌ Failed to get form fields:', error);
        return [];
    }
}



// ============================================================================
// OPTION A: MANUAL EMBED ELEMENT CONFIGURATION
// ============================================================================

/**
 * Configure manually added embed elements for error display
 */
async function configureManualEmbedElements() {
    console.log('🎯 Configuring manually added embed elements...');
    
    try {
        // Get all elements on the page
        const allElements = await webflow.getAllElements();
        console.log(`📋 Total elements found: ${allElements.length}`);
        
        // Find all embed elements (including nested ones)
        const embedElements = allElements.filter(element => {
            const elementType = element.type;
            const isEmbed = elementType === 'Embed' || 
                           elementType === 'HtmlEmbed' ||
                           elementType === 'FormEmbed' ||
                           elementType === 'CodeEmbed';
            
            if (isEmbed) {
                console.log(`📋 Found embed element: type=${elementType}, id=${element.id}`);
            }
            
            return isEmbed;
        });
        
        console.log(`📋 Found ${embedElements.length} embed elements on the page`);
        
        if (embedElements.length === 0) {
            showInfoNotification('No embed elements found. Please add embed elements after your form fields first.');
            return;
        }
        
        // Get selected forms to find fields that need error containers
        const selectedForms = getSelectedForms();
        if (selectedForms.length === 0) {
            showWarningNotification('Please select at least one form first.');
            return;
        }
        
        // Get all fields from selected forms
        const allFields = [];
        for (const form of selectedForms) {
            const formFields = await getFormFields(form);
            allFields.push(...formFields);
        }
        
        console.log(`📋 Found ${allFields.length} total fields in selected forms`);
        
        // Find fields that need error containers using the same logic as successful initial scan
        const fieldsNeedingErrorContainers = [];
        for (const field of allFields) {
            console.log(`🔍 Checking if field needs error container: ${field.label || field.name || field.id}`);
            
            // Use the same logic as the successful initial scan to find the field element
            let fieldElement = null;
            const allElements = await webflow.getAllElements();
            const fieldLabel = field.label || field.name || '';
            
            // Find the field element using the same logic as initial scan
                        // Use the EXACT SAME field finding logic that works in applyEnhancedFieldValidation
            for (const element of allElements) {
                const elementType = element.type;
                const isFormField = elementType === 'FormTextInput' || 
                                    elementType === 'FormTextarea' || 
                                    elementType === 'FormSelect' || 
                                    elementType === 'FormCheckboxInput' || 
                                    elementType === 'FormRadioInput';
                
                if (isFormField) {
                    let elementLabel = '';
                    let elementName = '';
                    
                    // Try to get label (same as working validation logic)
                    if (element.getLabel) {
                        try {
                            elementLabel = await element.getLabel();
                        } catch (e) {
                            // Ignore label errors
                        }
                    }
                    
                    // Try to get name (same as working validation logic)
                    if (element.getName) {
                        try {
                            elementName = await element.getName();
                        } catch (e) {
                            // Ignore name errors
                        }
                    }
                    
                    // Match by label or name (EXACT same logic as working validation)
                    if (elementLabel === fieldLabel || elementName === fieldLabel) {
                        fieldElement = element;
                        console.log(`✅ Found field element for requirement check: ${fieldLabel}`);
                        break;
                    }
                }
            }
            
            if (fieldElement) {
                // Now check if this field is required using Webflow API
                let isRequired = false;
                try {
                    if (fieldElement.getCustomAttribute) {
                        const requiredAttr = await fieldElement.getCustomAttribute('required');
                        const ariaRequiredAttr = await fieldElement.getCustomAttribute('aria-required');
                        const needsErrorAttr = await fieldElement.getCustomAttribute('data-needs-error-container');
                        const typeAttr = await fieldElement.getCustomAttribute('type');
                        
                        isRequired = requiredAttr === 'required' || 
                                   requiredAttr === 'true' ||
                                   ariaRequiredAttr === 'true' ||
                                   needsErrorAttr === 'true' ||
                                   typeAttr === 'email';
                    }
                } catch (error) {
                    console.warn(`⚠️ Error checking field requirements:`, error);
                }
                
                if (isRequired) {
                    // Store both the field metadata and the actual element
                    fieldsNeedingErrorContainers.push({
                        ...field,
                        element: fieldElement
                    });
                    console.log(`✅ Field ${field.label} needs error container`);
                } else {
                    console.log(`⏭️ Field ${field.label} does not need error container`);
                }
            } else {
                console.log(`⚠️ Could not find field element for requirement check: ${fieldLabel}`);
            }
        }
        
        console.log(`📋 Found ${fieldsNeedingErrorContainers.length} fields needing error containers`);
        
        if (fieldsNeedingErrorContainers.length === 0) {
            showInfoNotification('No required fields found. Apply validation to your forms first to mark fields as required.');
            return;
        }
        
        // Process each embed element
        let configuredCount = 0;
        
        for (const embed of embedElements) {
            console.log(`🔧 Processing embed element: ${embed.type} with ID: ${embed.id}`);
            
            // Try to find a field that this embed should be linked to
            let linkedField = null;
            
            // Method 1: Check if embed has a custom attribute linking it to a field
            try {
                const linkedFieldId = embed.getCustomAttribute && embed.getCustomAttribute('data-field-id');
                if (linkedFieldId) {
                    linkedField = fieldsNeedingErrorContainers.find(field => field.id === linkedFieldId);
                }
            } catch (error) {
                // Ignore attribute errors
            }
            
            // Method 2: Try to match by position and naming convention
            if (!linkedField) {
                console.log(`🔍 Trying to match embed to field by name/position...`);
                
                // Look for embed elements that might be positioned after form fields
                for (const field of fieldsNeedingErrorContainers) {
                    const fieldLabel = field.label || field.name || field.id;
                    const expectedEmbedId = `${fieldLabel}-error-embed`;
                    
                    // Check if this embed might be for this field
                    try {
                        const embedId = embed.id;
                        const embedIdStr = embedId ? embedId.toString() : '';
                        
                        console.log(`🔍 Checking if embed ${embedIdStr} matches field ${fieldLabel}`);
                        
                        // Try multiple matching strategies
                        const matches = embedIdStr.toLowerCase().includes(fieldLabel.toLowerCase()) ||
                                       embedIdStr.toLowerCase().includes('error') ||
                                       embedIdStr.toLowerCase().includes('embed');
                        
                        if (matches) {
                            linkedField = field;
                            console.log(`✅ Matched embed ${embedIdStr} to field ${fieldLabel}`);
                            break;
                        }
                    } catch (error) {
                        console.warn(`⚠️ Error checking embed ID:`, error);
                    }
                }
            }
            
            // Method 3: If no specific field found, assign to first unassigned field
            if (!linkedField) {
                console.log(`🔍 No specific field found, trying to assign to unassigned field...`);
                
                const unassignedFields = fieldsNeedingErrorContainers.filter(field => {
                    // Check if this field already has an embed assigned
                    return !embedElements.some(emb => {
                        try {
                            const embFieldId = emb.getCustomAttribute && emb.getCustomAttribute('data-field-id');
                            return embFieldId === field.id;
                        } catch (error) {
                            return false;
                        }
                    });
                });
                
                if (unassignedFields.length > 0) {
                    linkedField = unassignedFields[0];
                    console.log(`✅ Assigned embed to unassigned field: ${linkedField.label}`);
                }
            }
            
            if (linkedField) {
                // Configure this embed for the linked field
                console.log(`🔧 Configuring embed for field: ${linkedField.label}`);
                // Use the actual field element, not the metadata
                const success = await configureEmbedElementForErrorDisplay(embed, linkedField.element);
                if (success) {
                    configuredCount++;
                    console.log(`✅ Successfully configured embed for field: ${linkedField.label}`);
                } else {
                    console.warn(`⚠️ Failed to configure embed for field: ${linkedField.label}`);
                }
            } else {
                console.log(`⚠️ No suitable field found for embed: ${embed.id}`);
            }
        }
        
        if (configuredCount > 0) {
            showSuccessNotification(`Successfully configured ${configuredCount} embed elements for error display!`);
            

        } else {
            showInfoNotification('No embed elements were configured. Make sure embed elements are positioned after form fields.');
        }
        
    } catch (error) {
        console.error('❌ Failed to configure manual embed elements:', error);
        showErrorNotification('Failed to configure embed elements.');
    }
}

/**
 * Configure a specific embed element for error display
 * @param {Object} embedElement - The embed element to configure
 * @param {Object} fieldElement - The field element this embed is for
 */
async function configureEmbedElementForErrorDisplay(embedElement, fieldElement) {
    try {
        // Get pre-set attributes from the field element
        const rawFieldLabel = await fieldElement.getCustomAttribute('data-field-label') || 'Field';
        const fieldLabel = rawFieldLabel.toLowerCase()
            .replace(/[\s\-_]+/g, '-')  // Replace spaces, underscores, and multiple hyphens with single hyphen
            .replace(/[^a-z0-9\-]/g, '') // Remove all non-alphanumeric characters except hyphens
            .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
        const errorId = await fieldElement.getCustomAttribute('data-error-id') || 'error';
        const embedId = await fieldElement.getCustomAttribute('data-embed-id') || `${errorId}-embed`;
        const embedClass = await fieldElement.getCustomAttribute('data-embed-class') || 'a11y-error-embed';
        const embedFieldId = await fieldElement.getCustomAttribute('data-embed-field-id') || fieldElement.id;
        const embedErrorContainerId = await fieldElement.getCustomAttribute('data-embed-error-container-id') || errorId;
        
        console.log(`🔧 Configuring embed element for field: ${fieldLabel}`);
        console.log(`🔧 Using pre-set embed ID: ${embedId}`);
        
        // Configure the embed element with error display JavaScript
        try {
            // Set embed element attributes using Webflow Custom Attributes API
            await embedElement.setCustomAttribute('id', embedId);
            await embedElement.setCustomAttribute('class', embedClass);
            await embedElement.setCustomAttribute('data-embed-id', embedId);
            await embedElement.setCustomAttribute('data-embed-class', embedClass);
            await embedElement.setCustomAttribute('data-embed-field-id', embedFieldId);
            await embedElement.setCustomAttribute('data-embed-error-container-id', embedErrorContainerId);
            await embedElement.setCustomAttribute('data-field-label', fieldLabel);
            await embedElement.setCustomAttribute('data-field-id', embedFieldId);
            await embedElement.setCustomAttribute('data-error-container-id', embedErrorContainerId);
            
            // Create error display JavaScript
            const errorDisplayScript = generateErrorDisplayScript(errorId, fieldElement.id, fieldLabel);
            await embedElement.setCustomAttribute('data-error-display-script', errorDisplayScript);
            
            // Since Webflow doesn't support direct HTML insertion into embed elements,
            // we'll use a different approach: inject the error display script into the page
            // and let it create the error containers dynamically
            
            // Store the error container configuration for dynamic creation
            const errorContainerConfig = {
                errorId: errorId,
                fieldId: embedFieldId,
                fieldLabel: fieldLabel,
                embedId: embedId
            };
            
            await embedElement.setCustomAttribute('data-error-config', JSON.stringify(errorContainerConfig));
            
            // Inject the error display script into the page head
            await injectErrorDisplayScript(errorId, embedFieldId, fieldLabel);
            
            console.log(`✅ Configured embed element for ${fieldLabel} with error display script`);
            console.log(`📋 Embed attributes set: id="${embedId}", class="${embedClass}", data-field-id="${embedFieldId}"`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to configure embed element for ${fieldLabel}:`, error);
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Failed to configure embed element:`, error);
        return false;
    }
}

/**
 * Generate error display JavaScript for embed elements
 * @param {string} errorId - The error container ID
 * @param {string} fieldId - The field ID
 * @param {string} fieldLabel - The field label
 * @returns {string} - JavaScript code for error display
 */
function generateErrorDisplayScript(errorId, fieldId, fieldLabel) {
    // Normalize the field label for consistent data attribute usage
    const normalizedFieldLabel = fieldLabel.toLowerCase()
        .replace(/[\s\-_]+/g, '-')  // Replace spaces, underscores, and multiple hyphens with single hyphen
        .replace(/[^a-z0-9\-]/g, '') // Remove all non-alphanumeric characters except hyphens
        .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
    
    return `
<script>
(function() {
    'use strict';
    
    console.log('🔧 Error display script loading for field: ${normalizedFieldLabel}');
    
    // Find the field and error container
    const field = document.querySelector('[data-field-id="${fieldId}"]') || 
                  document.querySelector('#${fieldId}') ||
                  document.querySelector('[name="${normalizedFieldLabel}"]');
    
    const errorContainer = document.getElementById('${errorId}') ||
                          document.querySelector('[data-error-container-id="${errorId}"]');
    
    if (!field) {
        console.warn('❌ Field not found for error display:', '${normalizedFieldLabel}');
        return;
    }
    
    if (!errorContainer) {
        console.warn('❌ Error container not found for field:', '${normalizedFieldLabel}');
        return;
    }
    
    // Set up error display functionality
    function showError(message, errorType = 'required') {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        errorContainer.style.color = '#dc3545';
        errorContainer.style.fontSize = '14px';
        errorContainer.style.marginTop = '8px';
        errorContainer.style.fontWeight = '500';
        errorContainer.style.lineHeight = '1.4';
        errorContainer.style.padding = '8px 12px';
        errorContainer.style.borderRadius = '4px';
        errorContainer.style.backgroundColor = '#f8d7da';
        errorContainer.style.border = '1px solid #f5c6cb';
        errorContainer.style.marginBottom = '8px';
        
        // Add error state to field
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', '${errorId}');
        field.classList.add('a11y-field-error');
        
        console.log('✅ Error displayed for ${fieldLabel}:', message);
    }
    
    function hideError() {
        errorContainer.style.display = 'none';
        errorContainer.textContent = '';
        
        // Remove error state from field
        field.removeAttribute('aria-invalid');
        field.classList.remove('a11y-field-error');
        
        console.log('✅ Error hidden for ${fieldLabel}');
    }
    
    // Set up event listeners
    field.addEventListener('blur', function() {
        // Check for validation errors
        const errorMessage = field.getAttribute('data-error-message');
        const errorType = field.getAttribute('data-error-type');
        const errorDisplay = field.getAttribute('data-error-display');
        
        if (errorMessage && errorDisplay === 'show') {
            showError(errorMessage, errorType);
        } else {
            hideError();
        }
    });
    
    field.addEventListener('input', function() {
        hideError();
    });
    
    field.addEventListener('focus', function() {
        hideError();
    });
    
    // Make functions globally available for external calls
    window.showErrorFor${errorId.replace(/[^a-zA-Z0-9]/g, '')} = showError;
    window.hideErrorFor${errorId.replace(/[^a-zA-Z0-9]/g, '')} = hideError;
    
    console.log('✅ Error display script loaded for ${fieldLabel}');
})();
</script>
    `;
}

/**
 * Inject error display script into the page head
 * @param {string} errorId - The error container ID
 * @param {string} fieldId - The field ID
 * @param {string} fieldLabel - The field label
 */
async function injectErrorDisplayScript(errorId, fieldId, fieldLabel) {
    try {
        // Create the error display script
        const errorDisplayScript = `
<script>
(function() {
    'use strict';
    
    console.log('🔧 Error display script loading for field: ${fieldLabel}');
    
    // Create error container dynamically
    function createErrorContainer() {
        const existingContainer = document.getElementById('${errorId}');
        if (existingContainer) {
            return existingContainer;
        }
        
        const errorContainer = document.createElement('div');
        errorContainer.id = '${errorId}';
        errorContainer.className = 'a11y-error-container';
        errorContainer.style.cssText = 'display: none; color: #dc3545; font-size: 14px; margin-top: 8px; font-weight: 500; line-height: 1.4; padding: 8px 12px; border-radius: 4px; background-color: #f8d7da; border: 1px solid #f5c6cb; margin-bottom: 8px;';
        
        // Find the field and insert the error container after it
        const field = document.querySelector('[data-field-id="${fieldId}"]') || 
                      document.querySelector('#${fieldId}') ||
                      document.querySelector('[name="${fieldLabel}"]');
        
        if (field && field.parentNode) {
            field.parentNode.insertBefore(errorContainer, field.nextSibling);
            console.log('✅ Error container created for field: ${fieldLabel}');
        } else {
            console.warn('❌ Field not found for error container: ${fieldLabel}');
        }
        
        return errorContainer;
    }
    
    // Set up error display functionality
    function showError(message, errorType = 'required') {
        const errorContainer = createErrorContainer();
        if (!errorContainer) return;
        
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        
        // Find the field and add error state
        const field = document.querySelector('[data-field-id="${fieldId}"]') || 
                      document.querySelector('#${fieldId}') ||
                      document.querySelector('[name="${fieldLabel}"]');
        
        if (field) {
            field.setAttribute('aria-invalid', 'true');
            field.setAttribute('aria-describedby', '${errorId}');
            field.classList.add('a11y-field-error');
        }
        
        console.log('✅ Error displayed for ${fieldLabel}:', message);
    }
    
    function hideError() {
        const errorContainer = document.getElementById('${errorId}');
        if (errorContainer) {
            errorContainer.style.display = 'none';
            errorContainer.textContent = '';
        }
        
        // Find the field and remove error state
        const field = document.querySelector('[data-field-id="${fieldId}"]') || 
                      document.querySelector('#${fieldId}') ||
                      document.querySelector('[name="${fieldLabel}"]');
        
        if (field) {
            field.removeAttribute('aria-invalid');
            field.classList.remove('a11y-field-error');
        }
        
        console.log('✅ Error hidden for ${fieldLabel}');
    }
    
    // Set up event listeners when DOM is ready
    function setupEventListeners() {
        const field = document.querySelector('[data-field-id="${fieldId}"]') || 
                      document.querySelector('#${fieldId}') ||
                      document.querySelector('[name="${fieldLabel}"]');
        
        if (!field) {
            console.warn('❌ Field not found for event listeners: ${fieldLabel}');
            return;
        }
        
        // Validation on blur
        field.addEventListener('blur', function() {
            // Check for validation errors
            const errorMessage = field.getAttribute('data-error-message');
            const errorType = field.getAttribute('data-error-type');
            const errorDisplay = field.getAttribute('data-error-display');
            
            if (errorMessage && errorDisplay === 'show') {
                showError(errorMessage, errorType);
            } else {
                hideError();
            }
        });
        
        // Clear errors on input
        field.addEventListener('input', function() {
            hideError();
        });
        
        // Clear errors on focus
        field.addEventListener('focus', function() {
            hideError();
        });
        
        console.log('✅ Event listeners set up for field: ${fieldLabel}');
    }
    
    // Make functions globally available for external calls
    window.showErrorFor${errorId.replace(/[^a-zA-Z0-9]/g, '')} = showError;
    window.hideErrorFor${errorId.replace(/[^a-zA-Z0-9]/g, '')} = hideError;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
        setupEventListeners();
    }
    
    console.log('✅ Error display script loaded for ${fieldLabel}');
})();
</script>
        `;
        
        // Create a script element and inject it into the page head
        const scriptElement = document.createElement('script');
        scriptElement.textContent = errorDisplayScript;
        scriptElement.setAttribute('data-a11y-error-display', 'true');
        scriptElement.setAttribute('data-field-label', fieldLabel);
        
        // Inject into page head
        document.head.appendChild(scriptElement);
        
        console.log(`✅ Error display script injected for field: ${fieldLabel}`);
        
    } catch (error) {
        console.error(`❌ Failed to inject error display script for ${fieldLabel}:`, error);
    }
}

/**
 * Show guidance for manual embed element setup
 */
function showManualEmbedGuidance() {
    const guidanceContent = `
        <div class="embed-guidance">
            <h3>📖 Manual Embed Element Setup Guide</h3>
            
            <div class="guidance-section">
                <h4>🎯 Where to Place Embed Elements</h4>
                <p><strong>Important:</strong> Embed elements must be placed <strong>INSIDE</strong> your form structure, not outside the form.</p>
                
                <div class="placement-example">
                    <h5>✅ Correct Placement:</h5>
                    <pre>
Form Block
├── Form Field (Name)
├── Embed Element ← Place here
├── Form Field (Email)  
├── Embed Element ← Place here
├── Form Field (Message)
└── Embed Element ← Place here
                    </pre>
                </div>
                
                <div class="placement-example">
                    <h5>❌ Incorrect Placement:</h5>
                    <pre>
Form Block
├── Form Field (Name)
├── Form Field (Email)
└── Form Field (Message)

Embed Element ← Don't place here (outside form)
                    </pre>
                </div>
            </div>
            
            <div class="guidance-section">
                <h4>🔧 Step-by-Step Instructions</h4>
                <ol>
                    <li><strong>Select your form</strong> in the extension</li>
                    <li><strong>Apply validation</strong> to mark fields as required</li>
                    <li><strong>Enable field-level messaging</strong> to see which fields need embeds</li>
                    <li><strong>Add embed elements</strong> inside your form after each required field</li>
                    <li><strong>Click "Configure Manual Embeds"</strong> to link embeds to fields</li>
                </ol>
            </div>
            
            <div class="guidance-section">
                <h4>🎨 Embed Element Configuration</h4>
                <p>Each embed element will be automatically configured with:</p>
                <ul>
                    <li><strong>Error display script</strong> for showing validation messages</li>
                    <li><strong>Field linking</strong> to connect to the correct form field</li>
                    <li><strong>Accessibility features</strong> for screen readers</li>
                </ul>
            </div>
            
            <div class="guidance-section">
                <h4>🔍 Troubleshooting</h4>
                <div class="troubleshooting-tips">
                    <p><strong>If embeds aren't detected:</strong></p>
                    <ul>
                        <li>Make sure embed elements are <strong>inside the form</strong></li>
                        <li>Check that you've <strong>applied validation</strong> to mark fields as required</li>
                        <li>Try <strong>refreshing the page</strong> after adding embeds</li>
                        <li>Use the <strong>"Refresh Status"</strong> button to update the display</li>
                    </ul>
                </div>
            </div>
            
            <div class="guidance-section">
                <h4>💡 Pro Tips</h4>
                <ul>
                    <li><strong>One embed per field:</strong> Each required field needs its own embed element</li>
                    <li><strong>Position matters:</strong> Place embeds immediately after the field they're for</li>
                    <li><strong>Test on live site:</strong> Embed configuration works best on published sites</li>
                    <li><strong>Use the status display:</strong> The UI shows exactly which fields need embeds</li>
                </ul>
            </div>
        </div>
    `;
    
    // Create modal for guidance
    const modal = document.createElement('div');
    modal.className = 'guidance-modal';
    modal.innerHTML = `
        <div class="guidance-modal-content">
            <div class="guidance-modal-header">
                <h3>📖 Embed Element Setup Guide</h3>
                <button class="close-guidance-modal" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="guidance-modal-body">
                ${guidanceContent}
            </div>
            <div class="guidance-modal-footer">
                <button class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.remove()">Got it!</button>
            </div>
        </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .guidance-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        
        .guidance-modal-content {
            background: var(--bg-primary);
            border-radius: 12px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        
        .guidance-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .guidance-modal-header h3 {
            margin: 0;
            color: var(--text-primary);
        }
        
        .close-guidance-modal {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }
        
        .close-guidance-modal:hover {
            background: var(--bg-secondary);
        }
        
        .guidance-modal-body {
            padding: 20px;
        }
        
        .guidance-modal-footer {
            padding: 20px;
            border-top: 1px solid var(--border-color);
            text-align: right;
        }
        
        .embed-guidance h3 {
            margin: 0 0 20px 0;
            color: var(--text-primary);
        }
        
        .guidance-section {
            margin-bottom: 25px;
        }
        
        .guidance-section h4 {
            margin: 0 0 10px 0;
            color: var(--text-primary);
            font-size: 16px;
        }
        
        .guidance-section h5 {
            margin: 10px 0 5px 0;
            color: var(--text-primary);
            font-size: 14px;
        }
        
        .guidance-section p {
            margin: 0 0 10px 0;
            color: var(--text-secondary);
            line-height: 1.5;
        }
        
        .guidance-section ul, .guidance-section ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .guidance-section li {
            margin: 5px 0;
            color: var(--text-secondary);
            line-height: 1.4;
        }
        
        .placement-example {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        
        .placement-example pre {
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0 0 0;
            font-size: 12px;
            color: var(--text-secondary);
            overflow-x: auto;
        }
        
        .troubleshooting-tips {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 15px;
        }
        
        .troubleshooting-tips ul {
            margin: 10px 0 0 0;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
}

// ============================================================================
// END OPTION A: MANUAL EMBED ELEMENT CONFIGURATION
// ============================================================================

// ============================================================================
// END v2.7.0 FIELD-LEVEL ERROR MESSAGING SYSTEM
// ============================================================================

// ============================================================================
// ADVANCED FEATURES (Core Functionality)
// ============================================================================



// ============================================================================
// END ADVANCED FEATURES
// ============================================================================

// ============================================================================
// PLAN TIER TESTING FUNCTIONS
// ============================================================================



/**
 * Update responsive layout based on extension size
 * Add/remove expanded-view class to panel-header for proper layout switching
 */
function updateResponsiveLayout(size) {
    const panelHeader = document.querySelector('.panel-header');
    
    if (panelHeader) {
        if (size === 'large') {
            panelHeader.classList.add('expanded-view');
            console.log(`📱 Extension size changed to: ${size} - Added expanded-view class`);
        } else {
            panelHeader.classList.remove('expanded-view');
            console.log(`📱 Extension size changed to: ${size} - Removed expanded-view class`);
        }
    } else {
        console.warn('⚠️ Panel header not found for layout update');
    }
}

/**
 * Initialize collapsible sections functionality
 */
function initializeCollapsibleSections() {
    const collapsibleSections = document.querySelectorAll('.collapsible-section');
    
    collapsibleSections.forEach(section => {
        const header = section.querySelector('.section-header');
        const toggle = section.querySelector('.section-toggle');
        
        // Remove existing event listeners to prevent duplicates
        if (header) {
            header.removeEventListener('click', header._toggleHandler);
            header._toggleHandler = (e) => {
                if (e.target.closest('.section-toggle')) return;
                toggleSection(section);
            };
            header.addEventListener('click', header._toggleHandler);
        }
        
        if (toggle) {
            toggle.removeEventListener('click', toggle._toggleHandler);
            toggle._toggleHandler = (e) => {
                e.stopPropagation();
                toggleSection(section);
            };
            toggle.addEventListener('click', toggle._toggleHandler);
        }
    });
    
    // Initialize collapsible subsections
    const collapsibleSubsections = document.querySelectorAll('.collapsible-subsection');
    
    collapsibleSubsections.forEach(subsection => {
        const header = subsection.querySelector('.subsection-header');
        const toggle = subsection.querySelector('.subsection-toggle');
        
        if (header) {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.subsection-toggle')) return;
                toggleSubsection(subsection);
            });
        }
        
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSubsection(subsection);
            });
        }
    });
    
    // Initialize collapsible plan sections
    const collapsiblePlanSections = document.querySelectorAll('.plan-section');
    
    collapsiblePlanSections.forEach(planSection => {
        const header = planSection.querySelector('.plan-section-header');
        const toggle = planSection.querySelector('.plan-section-toggle');
        
        // Remove existing event listeners to prevent duplicates
        if (header) {
            header.removeEventListener('click', header._toggleHandler);
            header._toggleHandler = (e) => {
                if (e.target.closest('.plan-section-toggle')) return;
                toggleSection(planSection);
            };
            header.addEventListener('click', header._toggleHandler);
        }
        
        if (toggle) {
            toggle.removeEventListener('click', toggle._toggleHandler);
            toggle._toggleHandler = (e) => {
                e.stopPropagation();
                toggleSection(planSection);
            };
            toggle.addEventListener('click', toggle._toggleHandler);
        }
    });
    
    console.log(`✅ Collapsible sections initialized - Found ${collapsibleSections.length} sections`);
}

/**
 * Toggle a collapsible section
 */
function toggleSection(section) {
    const isCollapsed = section.classList.contains('collapsed');
    const sectionId = section.id || 'unknown';
    
    if (isCollapsed) {
        section.classList.remove('collapsed');
    } else {
        section.classList.add('collapsed');
    }
    
    console.log(`📋 Section toggled: ${sectionId} - ${isCollapsed ? 'expanded' : 'collapsed'}`);
}

/**
 * Toggle a collapsible subsection
 */
function toggleSubsection(subsection) {
    const isCollapsed = subsection.classList.contains('collapsed');
    
    if (isCollapsed) {
        subsection.classList.remove('collapsed');
    } else {
        subsection.classList.add('collapsed');
    }
    
    console.log(`📋 Subsection toggled: ${isCollapsed ? 'expanded' : 'collapsed'}`);
}

window.A11yFormValidator = {
    initializeExtension,
    handleScanPage,
    handleApplyValidation,
    resetValidation,
    toggleDemoMode,
    handleCloseExtension,
    // v2.7.0 Field-level error messaging functions
    enableFieldLevelErrorMessaging,
    disableFieldLevelErrorMessaging,
    processRequiredFieldsForErrorMessaging,
    applyErrorMessagingToField,
    removeErrorMessagingFromField,
    showFieldError,
    hideFieldError,
    getErrorMessage,
    checkFieldRequirement,
    getRequiredFields,
    // Advanced features
    initializeAdvancedUI,

    // Option A: Manual embed configuration functions
    configureManualEmbedElements,
    configureEmbedElementForErrorDisplay,
    generateErrorDisplayScript,
    showManualEmbedGuidance,

};
/**
 * Update the required fields display in the UI
 * Shows which fields are required and their embed status
 */





