import { SEAQA, MESSAGE_STORAGE_TABLE_NAME } from '../constants';

class IndexedDB {
  constructor({ historyStorageTableName = '', historyStorageBaseName = '' } = {}) {
    this.baseName = historyStorageBaseName || SEAQA;
    this.tableName = historyStorageTableName || MESSAGE_STORAGE_TABLE_NAME;
    this.store = this._createStore(this.baseName, this.tableName);
  }

  _promisifyRequest = (request) => {
    return new Promise((resolve, reject) => {
      request.oncomplete = request.onsuccess = () => resolve(request.result);
      request.onabort = request.onerror = () => reject(request.error);
    });
  };

  _createStore = (dbName, storeName) => {
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    const dbp = this._promisifyRequest(request);

    return (txMode, callback) =>
      dbp.then((db) =>
        callback(db.transaction(storeName, txMode).objectStore(storeName)),
      );
  };

  _defaultGetStore = () => {
    if (this.store) return this.store;
    return this._createStore(this.baseName, this.tableName);
  };

  /**
   * Get a value by its key.
   *
   * @param key
   */
  get = (key) => {
    const customStore = this._defaultGetStore();
    return customStore('readonly', (store) => this._promisifyRequest(store.get(key)));
  };

  /**
   * Set a value with a key.
   *
   * @param key
   * @param value
   */
  set = (key, value) => {
    const customStore = this._defaultGetStore();
    return customStore('readwrite', (store) => {
      store.put(value, key);
      return this._promisifyRequest(store.transaction);
    });
  };

  /**
   * Set multiple values at once. This is faster than calling set() multiple times.
   * It's also atomic – if one of the pairs can't be added, none will be added.
   *
   * @param entries Array of entries, where each entry is an array of `[key, value]`.
   */
  setMany = (entries) => {
    const customStore = this._defaultGetStore();
    return customStore('readwrite', (store) => {
      entries.forEach((entry) => store.put(entry[1], entry[0]));
      return this._promisifyRequest(store.transaction);
    });
  };

  /**
   * Get multiple values by their keys
   *
   * @param keys
   */
  getMany = (keys) => {
    const customStore = this._defaultGetStore();
    return customStore('readonly', (store) =>
      Promise.all(keys.map((key) => this._promisifyRequest(store.get(key)))),
    );
  };

  /**
   * Update a value. This lets you see the old value and update it as an atomic operation.
   *
   * @param key
   * @param updater A callback that takes the old value and returns a new value.
   */
  update = (key, updater) => {
    const customStore = this._defaultGetStore();
    return customStore(
      'readwrite',
      (store) =>
        // Need to create the promise manually.
        // If I try to chain promises, the transaction closes in browsers
        // that use a promise polyfill (IE10/11).
        new Promise((resolve, reject) => {
          store.get(key).onsuccess = function () {
            try {
              store.put(updater(this.result), key);
              resolve(this._promisifyRequest(store.transaction));
            } catch (err) {
              reject(err);
            }
          };
        }),
    );
  };

  /**
   * Delete a particular key from the store.
   *
   * @param key
   */
  del = (key) => {
    const customStore = this._defaultGetStore();
    return customStore('readwrite', (store) => {
      store.delete(key);
      return this._promisifyRequest(store.transaction);
    });
  };

  /**
   * Delete multiple keys at once.
   *
   * @param keys List of keys to delete.
   */
  delMany = (keys) => {
    const customStore = this._defaultGetStore();
    return customStore('readwrite', (store) => {
      keys.forEach((key) => store.delete(key));
      return this._promisifyRequest(store.transaction);
    });
  };

  /**
   * Clear all values in the store.
   */
  clear = () => {
    const customStore = this._defaultGetStore();
    return customStore('readwrite', (store) => {
      store.clear();
      return this._promisifyRequest(store.transaction);
    });
  };

  _eachCursor = (store, callback) => {
    store.openCursor().onsuccess = function () {
      if (!this.result) return;
      callback(this.result);
      this.result.continue();
    };
    return this._promisifyRequest(store.transaction);
  };

  /**
   * Get all keys in the store.
   */
  keys = () => {
    const customStore = this._defaultGetStore();
    return customStore('readonly', (store) => {
      // Fast path for modern browsers
      if (store.getAllKeys) {
        return this._promisifyRequest(
          store.getAllKeys(),
        );
      }

      const items = [];

      return this._eachCursor(store, (cursor) =>
        items.push(cursor.key),
      ).then(() => items);
    });
  };

  /**
   * Get all values in the store.
   */
  values = () => {
    const customStore = this._defaultGetStore();
    return customStore('readonly', (store) => {
      // Fast path for modern browsers
      if (store.getAll) {
        return this._promisifyRequest(store.getAll());
      }

      const items = [];
      return this._eachCursor(store, (cursor) => items.push(cursor.value)).then(
        () => items,
      );
    });
  };

  /**
   * Get all entries in the store. Each entry is an array of `[key, value]`.
   */
  entries = () => {
    const customStore = this._defaultGetStore();
    return customStore('readonly', (store) => {
      // Fast path for modern browsers
      // (although, hopefully we'll get a simpler path some day)
      if (store.getAll && store.getAllKeys) {
        return Promise.all([
          this._promisifyRequest(store.getAllKeys()),
          this._promisifyRequest(store.getAll()),
        ]).then(([keys, values]) => keys.map((key, i) => [key, values[i]]));
      }

      const items = [];

      return customStore('readonly', (store) =>
        this._eachCursor(store, (cursor) =>
          items.push([cursor.key, cursor.value]),
        ).then(() => items),
      );
    });
  };

}

export default IndexedDB;
