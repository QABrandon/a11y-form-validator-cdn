(function() {
    'use strict';
    
    console.log('🔧 A11y Form Validator - Standalone Script Loading... v1.0.30');
    
    // Check for jQuery dependency
    if (typeof window.jQuery === 'undefined') {
        console.warn('⚠️ jQuery not detected. Enhanced validation features may not work properly.');
        console.warn('⚠️ Please ensure jQuery and jQuery Validation are loaded before this script.');
        console.warn('⚠️ Required dependencies:');
        console.warn(' - https://code.jquery.com/jquery-3.7.1.min.js');
        console.warn(' - https://cdn.jsdelivr.net/npm/jquery-validation@1.21.0/dist/jquery.validate.min.js');
    } else {
        console.log('✅ jQuery detected, enhanced validation features available');
    }
    
    // Domain validation
    const ALLOWED_DOMAINS = [
        'webflow.io',
        'webflow.com',
        'netlify.app',
        'vercel.app',
        'github.io'
    ];
    
    function validateDomain() {
        const hostname = window.location.hostname;
        const isAllowed = ALLOWED_DOMAINS.some(domain => hostname.includes(domain));
        
        if (!isAllowed) {
            console.error('🚫 Unauthorized domain:', hostname);
            console.warn('A11y Form Validator is only authorized for specific domains');
            return false;
        }
        
        console.log('✅ Domain validation passed:', hostname);
        return true;
    }
    
    // License validation
    function validateLicense() {
        const licenseKey = window.A11Y_LICENSE_KEY || 
            document.querySelector('meta[name="a11y-license"]')?.content ||
            document.querySelector('meta[name="a11y-form-validator-license"]')?.content;
        
        if (!licenseKey) {
            console.warn('⚠️ No license key found - using fallback validation only');
            return false;
        }
        
        if (licenseKey.length < 10) {
            console.warn('⚠️ Invalid license key format');
            return false;
        }
        
        console.log('✅ License validation passed');
        return true;
    }
    
    // Enhanced initialization with API calls
    async function initializeWithApiCalls() {
        // Validate domain with custom domains
        const domainValid = await validateDomainWithCustomDomains();
        if (!domainValid) {
            console.error('🚫 A11y Form Validator blocked - unauthorized domain');
            return false;
        }
        
        // Fetch user configuration for plan features
        const userConfig = await fetchUserConfig();
        if (userConfig) {
            console.log('✅ User configuration loaded:', userConfig);
            // Apply user-specific features based on plan
        }
        
        return true;
    }
    
    const hasValidLicense = validateLicense();
    
    // Configuration - Essential API calls for domain validation and user features
    const API_BASE_URL = 'https://app.a11yformvalidator.com';
    
    // Cache management for API calls
    let domainCache = null;
    let userConfigCache = null;
    
    // Error messages
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
    
    // ===== ESSENTIAL API FUNCTIONS =====
    
    // Extract site ID from URL
    function extractSiteIdFromUrl() {
        const hostname = window.location.hostname;
        return hostname.endsWith('.webflow.io') ? hostname.replace('.webflow.io', '') : null;
    }
    
    // Fetch custom domains for site validation
    async function fetchCustomDomains() {
        if (domainCache) return domainCache;
        
        try {
            const siteId = window.WEBFLOW_SITE_ID || 
                          document.querySelector('meta[name="webflow-site-id"]')?.content ||
                          extractSiteIdFromUrl();
            
            if (!siteId) {
                console.warn('⚠️ No site ID found for domain validation');
                return [];
            }
            
            console.log('🔍 Fetching custom domains for site:', siteId);
            
            const response = await fetch(`${API_BASE_URL}/api/sites/domain-info/${siteId}`);
            
            if (!response.ok) {
                console.warn('⚠️ Failed to fetch custom domains:', response.status);
                return [];
            }
            
            const data = await response.json();
            const domains = [];
            
            // Extract domain names
            (data.custom_domains || []).forEach(d => {
                if (typeof d === 'string') domains.push(d);
                else if (d && d.name) domains.push(d.name);
            });
            
            (data.domains || []).forEach(d => {
                if (typeof d === 'string' && !domains.includes(d)) domains.push(d);
            });
            
            domainCache = domains;
            console.log('✅ Fetched custom domains:', domains);
            return domains;
            
        } catch (error) {
            console.warn('⚠️ Error fetching custom domains:', error);
            return [];
        }
    }
    
    // Fetch user configuration and plan features
    async function fetchUserConfig() {
        if (userConfigCache) return userConfigCache;
        
        try {
            const siteId = window.WEBFLOW_SITE_ID || 
                          document.querySelector('meta[name="webflow-site-id"]')?.content ||
                          extractSiteIdFromUrl();
            
            if (!siteId) {
                console.warn('⚠️ No site ID found for user config');
                return null;
            }
            
            console.log('🔍 Fetching user configuration for site:', siteId);
            
            const response = await fetch(`${API_BASE_URL}/api/sites/${siteId}/config`);
            
            if (!response.ok) {
                console.warn('⚠️ Failed to fetch user config:', response.status);
                return null;
            }
            
            const config = await response.json();
            userConfigCache = config;
            console.log('✅ Fetched user configuration:', config);
            return config;
            
        } catch (error) {
            console.warn('⚠️ Error fetching user config:', error);
            return null;
        }
    }
    
    // Enhanced domain validation with custom domains
    async function validateDomainWithCustomDomains() {
        const baseAllowedDomains = [
            'webflow.io',
            'webflow.com', 
            'netlify.app',
            'vercel.app',
            'github.io'
        ];
        
        const customDomains = await fetchCustomDomains();
        const allAllowedDomains = [...baseAllowedDomains, ...customDomains];
        
        const hostname = window.location.hostname;
        const isAllowed = allAllowedDomains.some(domain => {
            if (domain === hostname) return true;
            return hostname.endsWith('.' + domain);
        });
        
        if (!isAllowed) {
            console.error('🚫 Unauthorized domain:', hostname);
            console.warn('Allowed domains:', allAllowedDomains);
            return false;
        }
        
        console.log('✅ Domain validation passed:', hostname);
        return true;
    }
    
    // ===== SIMPLIFIED VALIDATION (MATCHES WORKING DIRECT INJECT) =====
    // Attribute-based validation with essential API calls for domain/user validation
    
    // Get field label
    function getFieldLabel(field) {
        const fieldId = field.getAttribute('id');
        if (fieldId) {
            const labelElement = document.querySelector('label[for="' + fieldId + '"]');
            if (labelElement && labelElement.textContent.trim()) {
                return labelElement.textContent.trim();
            }
        }
        
        const ariaLabelledBy = field.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const labelElement = document.getElementById(ariaLabelledBy);
            if (labelElement && labelElement.textContent.trim()) {
                return labelElement.textContent.trim();
            }
        }
        
        const ariaLabel = field.getAttribute('aria-label');
        if (ariaLabel) {
            return ariaLabel;
        }
        
        const dataLabel = field.getAttribute('data-field-label');
        if (dataLabel) {
            return dataLabel;
        }
        
        const fieldName = field.getAttribute('name');
        if (fieldName) {
            return fieldName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        return 'This field';
    }
    
    // Get field-specific error message
    function getFieldSpecificMessage(messageType, fieldLabel, context = {}) {
        const templates = {
            required: '{fieldLabel} is required',
            email: '{fieldLabel} must be a valid email address (name@company.com)',
            phone: '{fieldLabel} must be a valid phone number (US & CA: (555) 123-4567)',
            url: '{fieldLabel} must be a valid URL (https://example.com)',
            minlength: '{fieldLabel} must be at least {min} characters long',
            maxlength: '{fieldLabel} must be no more than {max} characters long'
        };
        
        let message = templates[messageType] || 'Please check {fieldLabel}';
        message = message.replace('{fieldLabel}', fieldLabel);
        message = message.replace('{min}', context.min || '');
        message = message.replace('{max}', context.max || '');
        
        return message;
    }
    
    // Validate individual field
    function validateField(field) {
        clearFieldError(field);
        
        let isValid = true;
        let errorMessage = '';
        const fieldLabel = getFieldLabel(field);
        
        // Required field validation
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            errorMessage = getFieldSpecificMessage('required', fieldLabel);
        }
        
        // Email validation
        if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('email', fieldLabel);
            }
        }
        
        // Phone validation
        if (field.type === 'tel' && field.value) {
            const phoneRegex = /^[0-9\s\-\(\)\+]{10,}$/;
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
        
        // Textarea validation
        if (field.tagName.toLowerCase() === 'textarea' && 
            field.hasAttribute('required') && 
            !field.value.trim()) {
            isValid = false;
            errorMessage = getFieldSpecificMessage('required', fieldLabel);
        }
        
        if (!isValid && errorMessage) {
            showError(field, errorMessage);
        }
        
        return isValid;
    }
    
    // Clear field error
    function clearFieldError(field) {
        hideError(field);
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
    }
    
    // Show error message
    function showError(field, message) {
        let errorId = field.getAttribute('data-error-id');
        if (!errorId) {
            errorId = `a11y-error-${field.name || field.id || 'field'}-${Date.now()}`;
            field.setAttribute('data-error-id', errorId);
        }
        
        let errorElement = document.getElementById(errorId);
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = errorId;
            errorElement.setAttribute('role', 'alert');
            errorElement.className = 'a11y-error-message';
            
            const fieldParent = field.parentElement;
            if (fieldParent) {
                fieldParent.insertBefore(errorElement, field.nextSibling);
            }
        }
        
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
        errorElement.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
        
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', errorId);
        
        console.log('✅ Error message displayed:', message, 'for field:', field.name || field.id);
    }
    
    // Hide error message
    function hideError(field) {
        const errorId = field.getAttribute('data-error-id');
        if (!errorId) return;
        
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
        
        console.log('✅ Error message hidden for field:', field.name || field.id);
    }
    
    // Update character count (placeholder for future functionality)
    function updateCharacterCount(field) {
        return;
    }
    
    // Announce to screen reader
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
        
        setTimeout(() => {
            if (announcement.parentNode) {
                announcement.parentNode.removeChild(announcement);
            }
        }, 1000);
    }
    
    // Validation helper functions
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    function isValidPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
        return phoneRegex.test(cleanPhone);
    }
    
    function isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    // Initialize form validation
    function initializeFormValidation(form) {
        const formId = form.id || form.name || 'default';
        console.log('🔧 Initializing validation for form:', formId);
        
        // Disable HTML5 validation
        form.setAttribute('novalidate', 'novalidate');
        console.log('✅ Disabled HTML5 validation for form:', formId);
        
        const allFields = form.querySelectorAll('input, textarea, select');
        console.log('🔍 Found', allFields.length, 'total fields in form:', formId);
        
        // Remove autofocus attributes
        allFields.forEach(field => {
            if (field.hasAttribute('autofocus')) {
                field.removeAttribute('autofocus');
                console.log('🔧 Removed autofocus from field:', field.name || field.id);
            }
        });
        
        // Filter fields that need validation - match working direct inject logic
        const fields = [];
        for (const field of allFields) {
            const isAllowedType = field.type === 'email' || 
                                 field.type === 'tel' || 
                                 field.type === 'url' || 
                                 field.type === 'text' || 
                                 field.tagName.toLowerCase() === 'textarea';
            
            const hasRequired = field.hasAttribute('required');
            const hasDataLabel = field.hasAttribute('data-field-label');
            const hasDataErrorId = field.hasAttribute('data-error-id');
            const hasAutoError = field.hasAttribute('data-auto-error-messaging');
            const hasErrorContainer = field.hasAttribute('data-needs-error-container');
            
            // Only include fields that have validation attributes (match working direct inject logic + error container)
            if (isAllowedType && (hasRequired || hasDataLabel || hasDataErrorId || hasAutoError || hasErrorContainer)) {
                fields.push(field);
            }
        }
        
        console.log('📋 Found', fields.length, 'fields that need validation in form:', formId);
        
        // Setup field validation
        fields.forEach((field, fieldIndex) => {
            const fieldName = field.name || field.id || `field-${fieldIndex}`;
            
            if (!field.getAttribute('data-error-id')) {
                const errorId = `a11y-error-${fieldName}-${Date.now()}`;
                field.setAttribute('data-error-id', errorId);
            }
            
            console.log('🔧 Setting up validation for field:', fieldName, 'in form:', formId);
            
            field.addEventListener('blur', function() {
                validateField(this);
            });
            
            field.addEventListener('input', function() {
                clearFieldError(this);
            });
            
            field.addEventListener('focus', function() {
                clearFieldError(this);
            });
        });
        
        // Form submission handler
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('🔧 Form submission intercepted for form:', formId);
            
            if (validateForm()) {
                console.log('✅ Form validation passed, submitting form:', formId);
                form.removeEventListener('submit', arguments.callee);
                form.submit();
            } else {
                console.log('❌ Form validation failed for form:', formId);
                focusFirstError();
            }
        });
        
        // Validate entire form
        function validateForm() {
            let isValid = true;
            let firstErrorField = null;
            
            console.log('🔧 Validating form with', fields.length, 'allowed fields');
            
            fields.forEach(field => {
                if (!validateField(field)) {
                    isValid = false;
                    if (!firstErrorField) {
                        firstErrorField = field;
                    }
                }
            });
            
            if (!isValid && firstErrorField) {
                console.log('❌ Form validation failed, first error field:', firstErrorField.name || firstErrorField.id);
                
                // Remove autofocus from all fields
                const allFields = form.querySelectorAll('input, textarea, select');
                allFields.forEach(field => {
                    if (field.hasAttribute('autofocus')) {
                        field.removeAttribute('autofocus');
                        console.log('🔧 Removed autofocus from field:', field.name || field.id);
                    }
                });
                
                announceToScreenReader('Form submission failed. Please correct the errors and try again.');
            } else {
                console.log('✅ Form validation passed');
            }
            
            return isValid;
        }
        
        // Focus first error field
        function focusFirstError() {
            const firstErrorField = form.querySelector('[aria-invalid="true"]');
            if (firstErrorField) {
                console.log('🔧 First error field identified:', firstErrorField.name || firstErrorField.id);
                
                // Remove autofocus from all fields
                const allFields = form.querySelectorAll('input, textarea, select');
                allFields.forEach(field => {
                    if (field.hasAttribute('autofocus')) {
                        field.removeAttribute('autofocus');
                        console.log('🔧 Removed autofocus from field:', field.name || field.id);
                    }
                });
                
                console.log('ℹ️ User should interact with error field naturally');
            } else {
                console.log('ℹ️ No error fields found');
            }
        }
    }
    
    // Initialize validation for all forms
    function initializeValidation() {
        const forms = document.querySelectorAll('form');
        
        if (forms.length === 0) {
            console.log('ℹ️ No forms found on page, skipping validation initialization');
            return;
        }
        
        console.log('📋 Found', forms.length, 'form(s) on page, initializing validation for all forms');
        
        forms.forEach(form => {
            initializeFormValidation(form);
        });
        
        console.log('✅ A11y Form Validator initialized successfully for', forms.length, 'form(s)');
    }
    
    // Enhanced initialization with API calls
    async function initializeWithApiValidation() {
        // First, validate domain and fetch user config
        const apiInitialized = await initializeWithApiCalls();
        if (!apiInitialized) {
            console.error('❌ API initialization failed, skipping validation');
            return;
        }
        
        // Then initialize form validation
        initializeValidation();
    }
    
    // Wait for DOM to be ready
    function waitForDOM() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeWithApiValidation);
        } else {
            initializeWithApiValidation();
        }
    }
    
    waitForDOM();
})();