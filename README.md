# A11y Form Validator

A comprehensive, WCAG 2.2 AA compliant form validation library designed specifically for Webflow forms.

## 🚀 Quick Start

### CDN Usage (Recommended)

```html
<!-- A11y Form Validator - Auto-detects site configuration -->
<script src="https://cdn.jsdelivr.net/npm/a11y-form-validator@latest/index.js"></script>
```

### NPM Installation

```bash
npm install a11y-form-validator
```

```javascript
import 'a11y-form-validator';
// or
require('a11y-form-validator');
```

## ✨ Features

- ✅ **WCAG 2.2 AA Compliant** - Meets accessibility standards
- ✅ **Real-time Validation** - Instant feedback as users type
- ✅ **Custom Error Messages** - Personalized validation messages
- ✅ **Plan-based Features** - Starter, Pro, and Agency tiers
- ✅ **Webflow Optimized** - Designed specifically for Webflow forms
- ✅ **Lightweight** - Minimal impact on page performance
- ✅ **Auto-Configuration** - Automatically detects site settings

## 📋 Usage

### Basic Implementation

```html
<form>
  <input type="text" name="name" required>
  <input type="email" name="email" required>
  <button type="submit">Submit</button>
</form>

<script src="https://cdn.jsdelivr.net/npm/a11y-form-validator@latest/index.js"></script>
```

### Advanced Configuration

```html
<script 
  src="https://cdn.jsdelivr.net/npm/a11y-form-validator@latest/index.js"
  data-plan="pro"
  data-real-time="true"
  data-accessibility-mode="wcag-aa">
</script>
```

## 🔧 API

### Global Methods

```javascript
// Initialize validation
window.A11yFormValidator.initialize();

// Validate a specific form
const form = document.querySelector('form');
const isValid = window.A11yFormValidator.validateForm(form);

// Validate a specific field
const field = document.querySelector('input[name="email"]');
const isValid = window.A11yFormValidator.validateField(field);

// Show custom error
window.A11yFormValidator.showError(field, 'Custom error message');

// Hide error
window.A11yFormValidator.hideError(field);
```

## 🔗 Links

- **Documentation**: [GitHub Repository](https://github.com/QABrandon/a11y-form-validator-app)
- **Issues**: [Report Issues](https://github.com/QABrandon/a11y-form-validator-app/issues)
- **Website**: [A11y Form Validator](https://app.a11yformvalidator.com)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](https://github.com/QABrandon/a11y-form-validator-app/blob/main/CONTRIBUTING.md) for details.

---

**Made with ❤️ for accessibility and Webflow**
