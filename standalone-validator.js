/**
 * A11y Form Validator - Standalone Field-Level Validation Script
 * 
 * This script provides field-level validation for Webflow forms that have been
 * configured with the A11y Form Validator Extension. It reads the custom attributes
 * added by the extension and applies appropriate validation rules.
 * 
 * Version: 1.0.2
 * CDN: https://cdn.jsdelivr.net/npm/a11y-form-validator@latest/standalone-validator.js
 */

(function() {
    'use strict';
    
    console.log('🔧 A11y Form Validator - Standalone Script Loading... v1.0.2');
    
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
     * Validate individual field based on its attributes
     */
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
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('email', fieldLabel);
            }
        }
        
        // Phone validation
        if (field.type === 'tel' && field.value) {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            const cleanPhone = field.value.replace(/[\s\-\(\)\.]/g, '');
            if (!phoneRegex.test(cleanPhone)) {
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
        
        // Number validation
        if (field.type === 'number' && field.value) {
            if (isNaN(field.value)) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('number', fieldLabel);
            }
        }
        
        // Date validation
        if (field.type === 'date' && field.value) {
            const date = new Date(field.value);
            if (isNaN(date.getTime())) {
                isValid = false;
                errorMessage = getFieldSpecificMessage('date', fieldLabel);
            }
        }
        
        // Minlength validation
        const minLength = field.getAttribute('data-min-length');
        if (minLength && field.value.length < parseInt(minLength)) {
            isValid = false;
            errorMessage = getFieldSpecificMessage('minlength', fieldLabel, { min: minLength });
        }
        
        // Maxlength validation
        const maxLength = field.getAttribute('data-max-length');
        if (maxLength && field.value.length > parseInt(maxLength)) {
            isValid = false;
            errorMessage = getFieldSpecificMessage('maxlength', fieldLabel, { max: maxLength });
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
     * Validate all fields in a form
     */
    function validateForm(form) {
        const fields = form.querySelectorAll('input, textarea, select');
        let isValid = true;
        
        fields.forEach(field => {
            if (!validateField(field)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    /**
     * Initialize validation for a form
     */
    function initializeFormValidation(form) {
        console.log('📋 Initializing validation for form:', form.id || 'unnamed');
        
        // Add real-time validation
        const fields = form.querySelectorAll('input, textarea, select');
        fields.forEach(field => {
            // Validate on blur (when user leaves field)
            field.addEventListener('blur', () => {
                validateField(field);
            });
            
            // Validate on input (for real-time feedback)
            field.addEventListener('input', () => {
                // Only validate if field has been touched (has focus history)
                if (field.dataset.touched === 'true') {
                    validateField(field);
                }
            });
            
            // Mark field as touched when it receives focus
            field.addEventListener('focus', () => {
                field.dataset.touched = 'true';
            });
        });
        
        // Validate on form submit
        form.addEventListener('submit', (e) => {
            if (!validateForm(form)) {
                e.preventDefault();
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
