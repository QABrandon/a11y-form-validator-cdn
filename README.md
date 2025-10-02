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


### CDN
```html
<script src="https://cdn.jsdelivr.net/npm/a11y-form-validator@latest/standalone-validator.js"></script>
```

## 🚀 Quick Start

### Add to Page Settings
<html>
    <!-- Required dependencies -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-validate/1.21.0/jquery.validate.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-validate/1.21.0/additional-methods.min.js"></script>
    
    <!-- A11y Form Validator -->
    <script src="https://cdn.jsdelivr.net/npm/a11y-form-validator@latest/standalone-validator.js"></script>

</html>


### Webflow Integration
1. Add the script to your Webflow site's custom code
2. Ensure your forms have proper field types and required attributes
3. The validator will automatically detect and validate forms

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
