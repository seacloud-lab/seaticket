export default class AutoFillObserver {

  constructor(inputElement, onAutoFillCallback) {
    this.inputElement = inputElement;
    this.onAutoFillCallback = onAutoFillCallback;
    this.observer = null;
    this.isFocusTriggered = false;

    this.init();
  }

  init() {
    this.inputElement.addEventListener('focus', this.handleFocus.bind(this));
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    const config = {
      attributes: true,
      attributeFilter: ['value', 'autocomplete'],
    };
    this.observer.observe(this.inputElement, config);
  }

  handleFocus() {
    this.isFocusTriggered = true;
  }

  handleMutations(mutations) {
    mutations.forEach(mutation => {
      if (mutation.attributeName === 'value' || mutation.attributeName === 'autocomplete') {
        if (!this.isFocusTriggered) {
          this.onAutoFillCallback();
        }
      }
    });
  }

  destroy() {
    this.inputElement.removeEventListener('focus', this.handleFocus.bind(this));
    if (this.observer) this.observer.disconnect();
  }
}
