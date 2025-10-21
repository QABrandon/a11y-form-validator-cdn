# A11y Form Validator

A WCAG 2.2 AA conformant form validation library designed specifically for Webflow forms. This library provides custom validation that overrides browser default HTML5 validation with accessible, user-friendly error messages.

## 🎯 Features

- **WCAG 2.2 AA Compliant** - Meets accessibility standards
- **Custom Validation** - Overrides browser default HTML5 validation
- **Field-Level Validation** - Real-time validation with proper error handling
- **Accessible Error Messages** - Screen reader friendly with ARIA attributes
- **Webflow Optimized** - Designed specifically for Webflow form structures
- **Lightweight** - Minimal dependencies, optimized for performance

## 📦 Installation


### CDN (Recommended)
```html
<!-- Site Authentication Key -->
<meta name="a11y-site-key" content="YOUR_SITE_KEY_HERE">

<!-- A11y Form Validator -->
<script defer src="https://cdn.a11yformvalidator.com/latest/standalone-validator-v2.js" crossorigin="anonymous"></script>
```

**Note:** Get your site key from the [A11y Form Validator Extension](https://webflow.com/apps) or [Dashboard](https://app.a11yformvalidator.com).

## 🚀 Quick Start

### Add to Site Settings (Recommended for Site-Wide Validation)
```html
<!-- Step 1: Add your site authentication key -->
<meta name="a11y-site-key" content="YOUR_SITE_KEY_HERE">

<!-- Step 2: Load A11y Form Validator from CDN -->
<script 
    defer 
    src="https://cdn.a11yformvalidator.com/latest/standalone-validator-v2.js"
    crossorigin="anonymous">
</script>
```

### Webflow Integration
1. Install the [A11y Form Validator Extension](https://webflow.com/apps) from the Webflow marketplace
2. Click "Generate & Copy Validation Script" button in the extension
3. Open Site Settings in Webflow Designer (gear icon in left sidebar)
4. Navigate to the "Custom Code" tab
5. Paste the script into the "Footer Code" section (applies to all pages)
6. Save and publish your site
7. The validator will automatically detect and validate all forms across your site

**The extension automatically generates and includes your site key!**

## 🔧 Supported Field Types

- **Email** (`type="email"`) - Email format validation
- **Phone** (`type="tel"`) - Phone number validation
- **URL** (`type="url"`) - URL format validation
- **Text** (`type="text"`) - Basic text validation
- **Textarea** - Message/comment validation

## 🛡️ Security Features

- **Domain Validation** - Only works on authorized domains
- **License Validation** - Supports license key validation

## 📋 Validation Rules

### Required Fields
- Validates required fields and shows appropriate error messages
- Supports both Text (name) and TextArea (message) fields
- Supports both `required` attribute and `aria-required="true"`

### Email Validation
- Validates proper email format
- Shows user-friendly error messages

### Phone Validation
- Supports various phone number formats
- Validates minimum length and format

### URL Validation
- Validates proper URL format
- Supports http/https protocols

## 🎨 Styling

The validator includes built-in accessible styling for error messages:
- High contrast colors for visibility
- Proper spacing and typography
- ARIA attributes for screen readers

## 🔗 Dependencies

- **jQuery** (>=3.0.0) - Required for enhanced features
- **jQuery Validation** (>=1.19.0) - Required for validation methods

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our [GitHub repository](https://github.com/QABrandon/a11y-form-validator-cdn).

## 📞 Support

- **Documentation**: [Full Documentation](https://github.com/QABrandon/a11y-form-validator-app#readme)

## 🔄 Version History

- **v1.0.17** - Fixed CDN HTML5 validation issue, synchronized with direct inject version
- **v1.0.16** - Initial npm package release with standalone validator

---

**Made with ❤️ for accessibility and Webflow**
