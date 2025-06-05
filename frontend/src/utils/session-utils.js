class SessionStorage {

  setItem(key, value) {
    return sessionStorage.setItem(key, JSON.stringify(value));
  }

  getItem(key) {
    return JSON.parse(sessionStorage.getItem(key));
  }

  removeItem(key) {
    return sessionStorage.removeItem(key);
  }
}

export default SessionStorage;
