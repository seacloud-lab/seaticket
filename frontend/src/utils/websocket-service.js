import { enableNotificationServer, server } from './../constants';
import projectAPI from '@/project/api/project-api';

const getNotificationServerUrl = () => {
  return `${server.replace(/^http/, 'ws')}/ws`;
};

class WebSocketClient {
  constructor(projectUuid, onMessageCallback) {
    this.url = getNotificationServerUrl();
    this.projectUuid = projectUuid;
    this.socket = null;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.onMessageCallback = onMessageCallback;
    this.reconnectTimer = null;
    this.socketId = 0;
    this.hasSubscribed = false;
    if (enableNotificationServer) {
      this.connect();
    }
  }

  connect() {
    this.hasSubscribed = false;
    const socket = new WebSocket(this.url);
    const socketId = ++this.socketId; // Used to prevent old connections from interfering with new connections.
    this.socket = socket;

    const isCurrentSocket = () => this.socket === socket && this.socketId === socketId;
    const sendIfOpen = (msg) => {
      if (isCurrentSocket() && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
        return true;
      }

      return false;
    };

    socket.onopen = async () => {
      if (!isCurrentSocket()) {
        return;
      }
      this.reconnectAttempts = 0;
      try {
        const msg = await this.formatSubscriptionMsg();
        this.hasSubscribed = sendIfOpen(msg);
      } catch (error) {
        console.error('Failed to subscribe websocket', error);
      }
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

      // jwt-expire reconnect
      if (parsedData.type === 'jwt-expired') {
        try {
          const msg = await this.formatSubscriptionMsg();
          this.hasSubscribed = sendIfOpen(msg);
        } catch (error) {
          console.error('Failed to refresh websocket subscription', error);
        }
        return;
      }

      this.onMessageCallback(parsedData);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error', error);
    };

    // reconnect WebSocket
    socket.onclose = () => {
      const shouldReconnect = this.shouldReconnect && isCurrentSocket();
      if (isCurrentSocket()) {
        this.socket = null;
        this.hasSubscribed = false;
      }
      if (shouldReconnect) {
        this.reconnect();
      }
    };
  }

  async getProjectNotificationJwtToken() {
    try {
      const response = await projectAPI.getNotificationToken(this.projectUuid);
      return response.data.token;
    } catch (error) {
      console.error('Failed to get websocket notification token', error);
      throw error;
    }
  }

  async formatSubscriptionMsg() {
    const notificationToken = await this.getProjectNotificationJwtToken();
    const jsonData = {
      type: 'subscribe',
      content: {
        projects: [
          {
            project_uuid: this.projectUuid,
            jwt_token: notificationToken,
          },
        ],
      },
    };
    return jsonData;
  }

  formatUnSubscriptionMsg() {
    const jsonData = {
      type: 'unsubscribe',
      content: {
        projects: [
          {
            project_uuid: this.projectUuid
          },
        ],
      },
    };
    return jsonData;
  }

  close() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socketId += 1;
    if (this.socket) {
      if (this.hasSubscribed && this.socket.readyState === WebSocket.OPEN) {
        const msg = this.formatUnSubscriptionMsg();
        this.socket.send(JSON.stringify(msg));
      }
      this.socket.close();
      this.socket = null;
    }
    this.hasSubscribed = false;

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

export default WebSocketClient;
