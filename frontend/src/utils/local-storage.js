class LocalStorage {

  constructor(storageName) {
    this.key = storageName || 'sea_qa';
  }

  getStorage() {
    try {
      return JSON.parse(window.localStorage.getItem(this.key) || '{}');
    } catch (err) {
      return {};
    }
  }

  setItem(key, value) {
    const oldValue = this.getStorage();
    const newValue = { ...oldValue, [key]: value };
    return window.localStorage.setItem(this.key, JSON.stringify(newValue));
  }

  getItem(key) {
    const storage = this.getStorage();
    return storage[key];
  }

}

export default LocalStorage;
