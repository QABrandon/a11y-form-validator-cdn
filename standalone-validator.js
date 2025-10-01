/**
 * A11y Form Validator - Standalone Field-Level Validation Script
 * 
 * This script provides field-level validation for Webflow forms that have been
 * configured with the A11y Form Validator Extension. It reads the custom attributes
 * added by the extension and applies appropriate validation rules from the database.
 * 
 * Version: 1.0.2
 * CDN: https://cdn.jsdelivr.net/npm/a11y-form-validator@latest/standalone-validator.js
 */

(function() {
    'use strict';
    
    console.log('🔧 A11y Form Validator - Standalone Script Loading... v1.0.2');
    
    // ===== SECURITY MIDDLEWARE =====
    
    // Domain validation middleware
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
    
    // License validation middleware
    function validateLicense() {
        const licenseKey = window.A11Y_LICENSE_KEY || 
                          document.querySelector('meta[name="a11y-license"]')?.content ||
                          document.querySelector('meta[name="a11y-form-validator-license"]')?.content;
        
        if (!licenseKey) {
            console.warn('⚠️ No license key found - using fallback validation only');
            return false;
        }
        
        // Basic license format validation (you can enhance this)
        if (licenseKey.length < 10) {
            console.warn('⚠️ Invalid license key format');
            return false;
        }
        
        console.log('✅ License validation passed');
        return true;
    }
    
    // Security initialization
    if (!validateDomain()) {
        console.error('🚫 A11y Form Validator blocked - unauthorized domain');
        return;
    }
    
    const hasValidLicense = validateLicense();
    
    // ===== CONFIGURATION =====
    
    // Supabase configuration (auto-detected from site or provided via extension)
    const SUPABASE_URL = window.SUPABASE_URL || null;
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || null;
    
    // Validation rules cache
    let validationRulesCache = new Map();
    let cacheExpiry = new Map();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    // ===== CONFIGURATION =====
    
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
    
    // ===== DATABASE INTEGRATION =====
    
    /**
     * Fetch validation rules for a form from the database
     */
    async function fetchValidationRules(formId) {
        // Check cache first
        const cacheKey = formId;
        const now = Date.now();
        
        if (validationRulesCache.has(cacheKey) && 
            cacheExpiry.has(cacheKey) && 
            now < cacheExpiry.get(cacheKey)) {
            console.log('📋 Using cached validation rules for form:', formId);
            return validationRulesCache.get(cacheKey);
        }
        
        try {
            console.log('🔍 Fetching validation rules for form:', formId);
            
            // Only fetch from database if we have a valid license
            if (SUPABASE_URL && SUPABASE_ANON_KEY && hasValidLicense) {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/validation_rules?form_id=eq.${formId}&is_active=eq.true&order=order_index.asc`, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const rules = await response.json();
                    console.log('✅ Fetched validation rules from database:', rules.length);
                    
                    // Transform database rules to our format
                    const transformedRules = rules.map(rule => ({
                        field_name: rule.field_name,
                        rules: [{
                            rule_type: rule.rule_type,
                            rule_config: rule.rule_config,
                            error_message: rule.error_message,
                            is_active: rule.is_active
                        }]
                    }));
                    
                    // Cache the results
                    validationRulesCache.set(cacheKey, transformedRules);
                    cacheExpiry.set(cacheKey, now + CACHE_DURATION);
                    
                    return transformedRules;
                } else {
                    console.warn('⚠️ Database fetch failed, falling back to attributes');
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to fetch validation rules from database:', error);
        }
        
        // Fallback to attribute-based rules
        const rules = await fetchValidationRulesFromAttributes(formId);
        
        // Cache the fallback results
        validationRulesCache.set(cacheKey, rules);
        cacheExpiry.set(cacheKey, now + CACHE_DURATION);
        
        return rules;
    }
    
    /**
     * Fallback: Extract validation rules from form attributes (set by extension)
     */
    async function fetchValidationRulesFromAttributes(formId) {
        const form = document.querySelector(`[data-form-id="${formId}"]`) || 
                    document.querySelector(`#${formId}`) ||
                    document.querySelector(`form[name="${formId}"]`);
        
        if (!form) {
            console.warn('⚠️ Form not found for ID:', formId);
            return [];
        }
        
        const rules = [];
        const fields = form.querySelectorAll('input, textarea, select');
        
        fields.forEach(field => {
            const fieldName = field.name || field.id || 'unnamed-field';
            const fieldRules = [];
            
            // Extract rules from data attributes (set by extension)
            if (field.hasAttribute('required')) {
                fieldRules.push({
                    rule_type: 'required',
                    error_message: field.getAttribute('data-error-required') || `${getFieldLabel(field)} is required`,
                    is_active: true
                });
            }
            
            if (field.type === 'email') {
                fieldRules.push({
                    rule_type: 'email',
                    error_message: field.getAttribute('data-error-email') || 'Please enter a valid email address',
                    is_active: true
                });
            }
            
            if (field.type === 'tel') {
                fieldRules.push({
                    rule_type: 'phone',
                    error_message: field.getAttribute('data-error-phone') || 'Please enter a valid phone number',
                    is_active: true
                });
            }
            
            if (field.type === 'url') {
                fieldRules.push({
                    rule_type: 'url',
                    error_message: field.getAttribute('data-error-url') || 'Please enter a valid URL',
                    is_active: true
                });
            }
            
            const minLength = field.getAttribute('minlength') || field.getAttribute('data-min-length');
            if (minLength) {
                fieldRules.push({
                    rule_type: 'min_length',
                    rule_config: { value: parseInt(minLength) },
                    error_message: field.getAttribute('data-error-minlength') || `Must be at least ${minLength} characters`,
                    is_active: true
                });
            }
            
            const maxLength = field.getAttribute('maxlength') || field.getAttribute('data-max-length');
            if (maxLength) {
                fieldRules.push({
                    rule_type: 'max_length',
                    rule_config: { value: parseInt(maxLength) },
                    error_message: field.getAttribute('data-error-maxlength') || `Must be no more than ${maxLength} characters`,
                    is_active: true
                });
            }
            
            const pattern = field.getAttribute('pattern') || field.getAttribute('data-pattern');
            if (pattern) {
                fieldRules.push({
                    rule_type: 'pattern',
                    rule_config: { pattern: pattern },
                    error_message: field.getAttribute('data-error-pattern') || 'Format is invalid',
                    is_active: true
                });
            }
            
            if (fieldRules.length > 0) {
                rules.push({
                    field_name: fieldName,
                    rules: fieldRules
                });
            }
        });
        
        console.log('📋 Extracted validation rules from attributes:', rules);
        return rules;
    }
    
    // ===== HELPER FUNCTIONS =====
    
    /**
     * Get field label with flexible matching
     */
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
            return fieldName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        // Final fallback
        return 'This field';
    }
    
    /**
     * Get field-specific error message
     */
    function getFieldSpecificMessage(messageType, fieldLabel, context = {}) {
        const templates = {
            required: '{fieldLabel} is required',
            email: '{fieldLabel} must be a valid email address (name@company.com)',
            phone: '{fieldLabel} must be a valid phone number (US & CA: (555) 123-4567)',
            url: '{fieldLabel} must be a valid URL (https://www.example.com)',
            minlength: '{fieldLabel} must be at least {min} characters long',
            maxlength: '{fieldLabel} must be no more than {max} characters long'
        };
        
        let message = templates[messageType] || 'Please check {fieldLabel}';
        
        // Replace placeholders
        message = message.replace('{fieldLabel}', fieldLabel);
        message = message.replace('{min}', context.min || '');
        message = message.replace('{max}', context.max || '');
        
        return message;
    }
    
    /**
     * Validate a single field against its rules
     */
    async function validateField(field) {
        const fieldName = field.getAttribute('name') || field.getAttribute('data-field-name');
        if (!fieldName) return true;
        
        const fieldLabel = getFieldLabel(field);
        let isValid = true;
        let errorMessage = '';
        
        // Get validation rules for this field
        const formId = field.closest('form')?.getAttribute('data-form-id') || 'default';
        const validationRules = await fetchValidationRules(formId);
        const fieldRules = validationRules.find(rule => rule.field_name === fieldName);
        
        if (fieldRules && fieldRules.rules) {
            // Use database rules
            for (const rule of fieldRules.rules) {
                if (!rule.is_active) continue;
                
                const fieldValue = field.value || '';
                const ruleType = rule.rule_type;
                const ruleConfig = rule.rule_config || {};
                
                let ruleValid = true;
                
                switch (ruleType) {
                    case 'required':
                        if (!fieldValue.trim()) {
                            ruleValid = false;
                        }
                        break;
                        
                    case 'email':
                        if (fieldValue && !isValidEmail(fieldValue)) {
                            ruleValid = false;
                        }
                        break;
                        
                    case 'phone':
                        if (fieldValue && !isValidPhone(fieldValue)) {
                            ruleValid = false;
                        }
                        break;
                        
                    case 'url':
                        if (fieldValue && !isValidUrl(fieldValue)) {
                            ruleValid = false;
                        }
                        break;
                        
                    case 'min_length':
                        if (fieldValue && fieldValue.length < ruleConfig.value) {
                            ruleValid = false;
                        }
                        break;
                        
                    case 'max_length':
                        if (fieldValue && fieldValue.length > ruleConfig.value) {
                            ruleValid = false;
                        }
                        break;
                        
                    case 'pattern':
                        if (fieldValue && !new RegExp(ruleConfig.pattern).test(fieldValue)) {
                            ruleValid = false;
                        }
                        break;
                }
                
                if (!ruleValid) {
                    isValid = false;
                    errorMessage = rule.error_message || getFieldSpecificMessage(ruleType, fieldLabel, ruleConfig);
                    break;
                }
            }
        } else {
            // Fallback to basic HTML5 validation
            if (field.hasAttribute('required') && !field.value.trim()) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('required', fieldLabel);
            }
            
            // Email validation
            if (field.type === 'email' && field.value) {
                if (!isValidEmail(field.value)) {
                    isValid = false;
                    errorMessage = getFieldSpecificMessage('email', fieldLabel);
                }
            }
            
            // Phone validation
            if (field.type === 'tel' && field.value) {
                if (!isValidPhone(field.value)) {
                    isValid = false;
                    errorMessage = getFieldSpecificMessage('phone', fieldLabel);
                }
            }
            
            // URL validation
            if (field.type === 'url' && field.value) {
                if (!isValidUrl(field.value)) {
                    isValid = false;
                    errorMessage = getFieldSpecificMessage('url', fieldLabel);
                }
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

    /**
     * Validate entire form
     */
    async function validateForm(form) {
        const fields = form.querySelectorAll('input, textarea, select');
        let isFormValid = true;
        
        for (const field of fields) {
            const isFieldValid = await validateField(field);
            if (!isFieldValid) {
                isFormValid = false;
            }
        }
        
        return isFormValid;
    }

    /**
     * Show error message by creating or updating error element
     */
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
    
    /**
     * Hide error message
     */
    function hideError(field) {
        const errorId = field.getAttribute('data-error-id');
        if (!errorId) return;
        
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
    
    /**
     * Validate individual field using database rules
     */
    async function validateField(field, formId) {
        let isValid = true;
        let errorMessage = '';
        
        // Get field name
        const fieldName = field.name || field.id || 'unnamed-field';
        
        // Get validation rules for this field
        const formRules = await fetchValidationRules(formId);
        const fieldRules = formRules.find(rule => rule.field_name === fieldName);
        
        if (!fieldRules || !fieldRules.rules) {
            console.warn('⚠️ No validation rules found for field:', fieldName);
            return true; // No rules = valid
        }
        
        // Apply each rule
        for (const rule of fieldRules.rules) {
            if (!rule.is_active) continue;
            
            const fieldValue = field.value || '';
            const ruleType = rule.rule_type;
            const ruleConfig = rule.rule_config || {};
            
            let ruleValid = true;
            
            switch (ruleType) {
                case 'required':
                    if (!fieldValue.trim()) {
                        ruleValid = false;
                    }
                    break;
                    
                case 'email':
                    if (fieldValue && !isValidEmail(fieldValue)) {
                        ruleValid = false;
                    }
                    break;
                    
                case 'phone':
                    if (fieldValue && !isValidPhone(fieldValue)) {
                        ruleValid = false;
                    }
                    break;
                    
                case 'url':
                    if (fieldValue && !isValidUrl(fieldValue)) {
                        ruleValid = false;
                    }
                    break;
                    
                case 'min_length':
                    if (fieldValue && fieldValue.length < ruleConfig.value) {
                        ruleValid = false;
                    }
                    break;
                    
                case 'max_length':
                    if (fieldValue && fieldValue.length > ruleConfig.value) {
                        ruleValid = false;
                    }
                    break;
                    
                case 'pattern':
                    if (fieldValue && !new RegExp(ruleConfig.pattern).test(fieldValue)) {
                        ruleValid = false;
                    }
                    break;
            }
            
            if (!ruleValid) {
                isValid = false;
                errorMessage = rule.error_message || `${fieldName} is invalid`;
                break; // Stop at first error
            }
        }
        
        // Show or hide error
        if (!isValid) {
            showError(field, errorMessage);
        } else {
            hideError(field);
        }
        
        return isValid;
    }
    
    /**
     * Validation helper functions
     */
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
    
    
    /**
     * Initialize validation for a single form
     */
    function initializeFormValidation(form) {
        const formId = form.getAttribute('data-form-id') || 'default';
        console.log('🔧 Initializing validation for form:', formId);
        
        // Get all form fields
        const fields = form.querySelectorAll('input, textarea, select');
        console.log('📋 Found', fields.length, 'field(s) in form');
        
        fields.forEach(field => {
            // Validate on blur (when user leaves field)
            field.addEventListener('blur', async () => {
                await validateField(field);
            });
            
            // Validate on input (for real-time feedback)
            field.addEventListener('input', async () => {
                // Only validate if field has been touched (has focus history)
                if (field.dataset.touched === 'true') {
                    await validateField(field);
                }
            });
            
            // Mark field as touched when it receives focus
            field.addEventListener('focus', () => {
                field.dataset.touched = 'true';
            });
        });
        
        // Validate on form submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // Always prevent default to allow async validation
            
            const isValid = await validateForm(form);
            
            if (!isValid) {
                console.log('❌ Form validation failed');
                
                // Focus first invalid field
                const firstInvalidField = form.querySelector('.a11y-error-message[style*="block"]');
                if (firstInvalidField) {
                    const field = document.querySelector(`[data-error-id="${firstInvalidField.id}"]`);
                    if (field) {
                        field.focus();
                    }
                }
            } else {
                console.log('✅ Form validation passed');
                
                // Re-enable form submission
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                Object.defineProperty(submitEvent, 'target', { value: form });
                Object.defineProperty(submitEvent, 'currentTarget', { value: form });
                
                // Remove our event listener temporarily
                form.removeEventListener('submit', arguments.callee);
                
                // Submit the form
                form.submit();
                
                // Re-add event listener for future submissions
                form.addEventListener('submit', arguments.callee);
            }
        });
    }

    /**
     * Initialize validation for all forms on the page
     */
    function initializeValidation() {
        const forms = document.querySelectorAll('form');
        if (forms.length === 0) {
            console.log('ℹ️ No forms found on page, skipping validation initialization');
            return;
        }
        
        console.log('📋 Found', forms.length, 'form(s) on page, initializing validation');
        
        forms.forEach(form => {
            initializeFormValidation(form);
        });
        
        console.log('✅ A11y Form Validator initialized successfully');
    }
    
    /**
     * Wait for DOM to be ready and initialize
     */
    function waitForDOM() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeValidation);
        } else {
            initializeValidation();
        }
    }
    
    // ===== INITIALIZATION =====
    
    // Start initialization
    waitForDOM();
    
})();
