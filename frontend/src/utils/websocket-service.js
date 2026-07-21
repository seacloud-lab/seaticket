import { enableNotificationServer, server } from './../constants';
import projectAPI from '@/project/api/project-api';

const getNotificationServerUrl = () => {
  return `${server.replace(/^http/, 'ws')}/notification/`;
};

class WebSocketClient {
  constructor() {
    this.url = getNotificationServerUrl();
    this.socket = null;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.socketId = 0;
    this.listeners = new Set();
    this.subscriptions = new Map();

    if (enableNotificationServer) {
      this.connect();
    }
  }

  _formatSubscriptionMsg(projectUuid) {
    if (!projectUuid) return null;
    return projectAPI.getNotificationToken(projectUuid).then(res => {
      const token = res?.data?.token || '';
      if (!token) {
        console.warn(`Empty notification token for project ${projectUuid}`);
        return null;
      }
      return {
        type: 'subscribe',
        content: {
          project_uuid: projectUuid,
          token: token,
        },
      };
    }).catch(error => {
      console.error('Failed to get websocket notification token: ', error);
      return null;
    });
  }

  _formatUnSubscriptionMsg(projectUuid) {
    if (!projectUuid) return null;
    return {
      type: 'unsubscribe',
      content: {
        project_uuid: projectUuid,
      },
    };
  }

  addMessageListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
  }

  removeMessageListener(callback) {
    this.listeners.delete(callback);
  }

  connect() {
    if (!enableNotificationServer) return;

    if (this.socket) return;

    const socket = new WebSocket(this.url);
    const socketId = ++this.socketId; // Used to prevent old connections from interfering with new connections.
    this.socket = socket;

    const isCurrentSocket = () => this.socket === socket && this.socketId === socketId;
    const sendIfOpen = (msg) => {
      if (isCurrentSocket() && socket.readyState === WebSocket.OPEN && msg) {
        socket.send(JSON.stringify(msg));
        return true;
      }

      return false;
    };

    const resubscribeActiveProjects = async () => {
      for (const [projectUuid, count] of this.subscriptions.entries()) {
        if (count > 0) {
          const msg = await this._formatSubscriptionMsg(projectUuid);
          sendIfOpen(msg);
        }
      }
    };

    socket.onopen = async () => {
      if (!isCurrentSocket()) {
        return;
      }
      this.reconnectAttempts = 0;
      resubscribeActiveProjects().catch((error) => {
        console.error('Failed to subscribe websocket', error);
      });
    };

    // listen message from WebSocket server
    socket.onmessage = async (event) => {
      if (!isCurrentSocket()) {
        return;
      }

      let parsedData;
      try {
        parsedData = JSON.parse(event.data);
      } catch (error) {
        console.error('Failed to parse websocket message', error, event.data);
        return;
      }

      this.listeners.forEach((callback) => {
        try {
          callback(parsedData);
        } catch (error) {
          console.error('Failed to handle websocket message', error);
        }
      });
    };

    socket.onerror = (error) => {
      console.error('WebSocket error', error);
    };

    // reconnect WebSocket
    socket.onclose = () => {
      const shouldReconnect = this.shouldReconnect && isCurrentSocket();
      if (isCurrentSocket()) {
        this.socket = null;
      }
      if (shouldReconnect) {
        this.reconnect();
      }
    };
  }

  async subscribe(projectUuid) {
    if (!projectUuid) return;

    const count = this.subscriptions.get(projectUuid) || 0;
    this.subscriptions.set(projectUuid, count + 1);

    if (count === 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
      const msg = await this._formatSubscriptionMsg(projectUuid);
      if (msg && this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(msg));
      }
    }
  }

  unsubscribe(projectUuid) {
    if (!projectUuid) return null;

    const count = this.subscriptions.get(projectUuid) || 0;
    if (count <= 1) {
      this.subscriptions.delete(projectUuid);
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const msg = this._formatUnSubscriptionMsg(projectUuid);
        if (msg) {
          this.socket.send(JSON.stringify(msg));
        }
      }
      return;
    }

    this.subscriptions.set(projectUuid, Math.max(0, count - 1));
  }

  close() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socketId += 1;
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        for (const projectUuid of this.subscriptions.keys()) {
          const msg = this._formatUnSubscriptionMsg(projectUuid);
          if (msg) {
            this.socket.send(JSON.stringify(msg));
          }
        }
      }
      this.socket.close();
      this.socket = null;
    }
    this.subscriptions.clear();
    this.listeners.clear();

  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
}

const sharedWsClient = new WebSocketClient();

export default sharedWsClient;
