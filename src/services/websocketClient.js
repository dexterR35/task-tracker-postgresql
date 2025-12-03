/**
 * WebSocket Client Service
 * 
 * @fileoverview WebSocket client for real-time updates
 * @author Senior Developer
 * @version 1.0.0
 */

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.subscriptions = new Set();
    this.token = null;
  }

  setToken(token) {
    this.token = token;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Reconnect with new token if already connected
      this.disconnect();
      this.connect();
    }
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const token = this.getToken();
    if (!token) {
      console.warn('WebSocket: No token available, skipping connection');
      return;
    }

    const url = `${WS_BASE_URL}?token=${token}`;
    
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Resubscribe to all channels when connection opens
        // Use setTimeout to ensure WebSocket is fully ready
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN && this.subscriptions.size > 0) {
            const channels = Array.from(this.subscriptions);
            try {
              this.ws.send(JSON.stringify({
                type: 'subscribe',
                channels: channels
              }));
              console.log('📡 WebSocket: Resubscribed to channels:', channels);
            } catch (error) {
              console.error('WebSocket: Error sending subscription:', error);
            }
          }
        }, 100); // Small delay to ensure WebSocket is fully ready
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('WebSocket: Error parsing message', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        this.ws = null;
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.connect(), delay);
        }
      };
    } catch (error) {
      console.error('WebSocket: Connection error', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.subscriptions.clear();
  }

  subscribe(channels) {
    if (!Array.isArray(channels)) {
      channels = [channels];
    }

    channels.forEach(channel => this.subscriptions.add(channel));

    // If WebSocket is open, subscribe immediately
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channels: channels
      }));
      console.log('📡 WebSocket: Subscribed to channels:', channels);
    } else {
      // If not connected, try to connect first
      // This ensures subscriptions happen even if called before connection
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
      // Subscription will be sent when connection opens (see onopen handler)
    }
  }

  // Check if WebSocket is connected
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  unsubscribe(channels) {
    if (!Array.isArray(channels)) {
      channels = [channels];
    }

    channels.forEach(channel => this.subscriptions.delete(channel));
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  handleMessage(data) {
    // Handle system messages
    if (data.type === 'connected' || data.type === 'subscribed') {
      return;
    }

    // Handle task changes
    if (data.type === 'task_change') {
      this.emit('task_change', data);
      return;
    }

    // Handle month changes
    if (data.type === 'month_change') {
      this.emit('month_change', data);
      return;
    }

    // Handle user changes
    if (data.type === 'user_change') {
      this.emit('user_change', data);
      return;
    }

    // Handle deliverable changes
    if (data.type === 'deliverable_change') {
      this.emit('deliverable_change', data);
      return;
    }

    // Handle reporter changes
    if (data.type === 'reporter_change') {
      this.emit('reporter_change', data);
      return;
    }

    // Handle team days off changes
    if (data.type === 'team_days_off_change') {
      this.emit('team_days_off_change', data);
      return;
    }

    // Emit generic message event
    this.emit('message', data);
  }

  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`WebSocket: Error in ${eventType} callback`, error);
        }
      });
    }
  }
}

// Create singleton instance
const wsClient = new WebSocketClient();

export default wsClient;

