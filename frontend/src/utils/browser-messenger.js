import { isFunction, isString } from './type-detection';

class BrowserMessenger {
  constructor(channelName = 'seaqa_notification_channel', options = {}) {
    if (!channelName || !isString(channelName)) {
      throw new Error('BrowserMessenger: channelName must be string');
    }

    if (typeof BroadcastChannel === 'undefined') {
      throw new Error('BrowserMessenger: current browser not support BroadcastChannel');
    }

    this.channelName = channelName;
    this.selfReceive = options.selfReceive === true;
    this._heartbeatIntervalMs = options.heartbeatInterval || 3000;
    this._heartbeatTimeoutMs = options.heartbeatTimeout || 10000;
    this.channel = new BroadcastChannel(channelName);

    this._listeners = new Map();
    this._typeListeners = new Map();

    this._handleMessage = this._handleMessage.bind(this);
    this.channel.onmessage = this._handleMessage;
    this.channel.onmessageerror = this._handleError.bind(this);

    this.tabId = this._generateTabId();

    this._heartbeatInterval = null;
    this._onlineTabs = new Set();
    this._onlineTabs.add(this.tabId);
    this._tabLastSeen = new Map([[this.tabId, Date.now()]]);

    this._closed = false;

    if (options.enableHeartbeat !== false) {
      this._startHeartbeat();
    }
  }

  send(data, options = {}) {
    if (this._closed) return this;

    let message = {
      _meta: {
        fromTabId: this.tabId,
        timestamp: Date.now(),
        channel: this.channelName
      },
      data: data
    };

    if (options.targetTabId) {
      message._meta.targetTabId = options.targetTabId;
    }

    const excludeSelf = options.excludeSelf !== undefined ? options.excludeSelf : !this.selfReceive;

    if (excludeSelf) {
      message._meta.excludeSelf = true;
    }

    try {
      this.channel.postMessage(message);
    } catch (error) {
      console.error('Send error: ', error);
    }

    return this;
  }

  on(typeOrCallback, callback) {
    if (this._closed) return this;

    if (isFunction(typeOrCallback)) {
      const id = this._generateListenerId();
      this._listeners.set(id, typeOrCallback);
      return this;
    }

    if (isString(typeOrCallback) && isFunction(callback)) {
      if (!this._typeListeners.has(typeOrCallback)) {
        this._typeListeners.set(typeOrCallback, new Set());
      }
      this._typeListeners.get(typeOrCallback).add(callback);
      return this;
    }

    throw new Error('Params error');
  }

  off(typeOrCallback, callback) {
    if (typeOrCallback === undefined) {
      this._listeners.clear();
      this._typeListeners.clear();
      return this;
    }

    if (isFunction(typeOrCallback)) {
      for (const [id, fn] of this._listeners) {
        if (fn === typeOrCallback) {
          this._listeners.delete(id);
        }
      }
      return this;
    }

    if (isString(typeOrCallback)) {
      if (callback === undefined) {
        this._typeListeners.delete(typeOrCallback);
        return this;
      }
      const listeners = this._typeListeners.get(typeOrCallback);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this._typeListeners.delete(typeOrCallback);
        }
      }
      return this;
    }

    return this;
  }

  once(typeOrCallback, callback) {
    const onceWrapper = (data, event) => {
      if (isFunction(typeOrCallback)) {
        typeOrCallback(data, event);
      } else {
        callback(data, event);
      }
      this.off(typeOrCallback, onceWrapper);
    };

    if (isFunction(typeOrCallback)) {
      this.on(onceWrapper);
    } else {
      this.on(typeOrCallback, onceWrapper);
    }

    return this;
  }

  getOnlineTabs() {
    return Array.from(this._onlineTabs);
  }

  getOnlineCount() {
    return this._onlineTabs.size;
  }

  close() {
    if (this._closed) return;

    try {
      this.channel.postMessage({
        _meta: {
          fromTabId: this.tabId,
          type: '_tab_offline',
          timestamp: Date.now()
        },
        data: null
      });
    } catch (e) {
      // ignore
    }

    this._closed = true;
    this.channel.close();
    this._listeners.clear();
    this._typeListeners.clear();

    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }

  }

  _handleMessage(event) {
    const message = event.data;

    if (!message || typeof message !== 'object' || !message._meta) {
      this._dispatchMessage(event.data, event);
      return;
    }

    const meta = message._meta;

    if (meta.excludeSelf && meta.fromTabId === this.tabId) {
      return;
    }

    if (meta.targetTabId && meta.targetTabId !== this.tabId) {
      return;
    }

    if (meta.type === '_tab_heartbeat') {
      this._markTabOnline(meta.fromTabId);
      if (meta.fromTabId !== this.tabId) {
        try {
          this.channel.postMessage({
            _meta: {
              fromTabId: this.tabId,
              type: '_tab_heartbeat_ack',
              timestamp: Date.now()
            },
            data: null
          });
        } catch (error) {
          console.error('Heartbeat ack error: ', error);
        }
      }
      return;
    }

    if (meta.type === '_tab_heartbeat_ack') {
      this._markTabOnline(meta.fromTabId);
      return;
    }

    if (meta.type === '_tab_offline') {
      this._onlineTabs.delete(meta.fromTabId);
      this._tabLastSeen.delete(meta.fromTabId);
      return;
    }

    this._dispatchMessage(message.data, event);
  }

  _dispatchMessage(data, event) {
    for (const callback of this._listeners.values()) {
      try {
        callback(data, event);
      } catch (error) {
        console.error('Error: ', error);
      }
    }

    if (data && typeof data === 'object' && data.type) {
      const type = data.type;
      const listeners = this._typeListeners.get(type);
      if (listeners) {
        for (const callback of listeners) {
          try {
            callback(data, event);
          } catch (error) {
            console.error('Error: ', error);
          }
        }
      }
    }
  }

  _handleError(event) {
    console.error('Error: ', event);
  }

  _generateTabId() {
    return 'tab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  _generateListenerId() {
    return 'listener_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  }

  _markTabOnline(tabId) {
    if (!tabId) return;
    this._onlineTabs.add(tabId);
    this._tabLastSeen.set(tabId, Date.now());
  }

  _removeStaleTabs() {
    const now = Date.now();
    for (const tabId of this._onlineTabs) {
      const lastSeen = this._tabLastSeen.get(tabId);
      if (tabId !== this.tabId && lastSeen && now - lastSeen > this._heartbeatTimeoutMs) {
        this._onlineTabs.delete(tabId);
        this._tabLastSeen.delete(tabId);
      }
    }
  }

  _startHeartbeat() {
    this._broadcastHeartbeat();

    this._heartbeatInterval = setInterval(() => {
      if (this._closed) {
        clearInterval(this._heartbeatInterval);
        this._heartbeatInterval = null;
        return;
      }

      this._broadcastHeartbeat();
      this._removeStaleTabs();
    }, this._heartbeatIntervalMs);
  }

  _broadcastHeartbeat() {
    try {
      this.channel.postMessage({
        _meta: {
          fromTabId: this.tabId,
          type: '_tab_heartbeat',
          timestamp: Date.now()
        },
        data: null
      });
    } catch (error) {
      if (!this._closed) {
        console.error('Heartbeat error: ', error);
      }
    }
  }
}

export default BrowserMessenger;
