declare global {
  interface Window {
    A11yFormValidator: {
      initialize(): void;
      validateForm(form: HTMLFormElement): boolean;
      validateField(field: HTMLElement): boolean;
      showError(field: HTMLElement, message: string): void;
      hideError(field: HTMLElement): void;
    };
  }
}
export {};
