import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

class WebSocketManager {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.clients = new Map(); // Map<userId, Set<WebSocket>>
    this.setupConnection();
  }

  setupConnection() {
    this.wss.on('connection', (ws, req) => {
      // Extract token from query string or headers
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || req.headers.authorization?.split(' ')[1];

      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify token
      let user;
      try {
        user = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
      } catch (error) {
        ws.close(1008, 'Invalid token');
        return;
      }

      // Add client to map
      if (!this.clients.has(user.userId)) {
        this.clients.set(user.userId, new Set());
      }
      this.clients.get(user.userId).add(ws);

      ws.userId = user.userId;
      ws.userUID = user.userUID;

      console.log(`✅ WebSocket client connected: ${user.email} (${user.userId})`);

      // Handle messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        if (this.clients.has(ws.userId)) {
          this.clients.get(ws.userId).delete(ws);
          if (this.clients.get(ws.userId).size === 0) {
            this.clients.delete(ws.userId);
          }
        }
        console.log(`❌ WebSocket client disconnected: ${user.email}`);
      });

      // Send welcome message
      ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected successfully' }));
    });
  }

  handleMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      case 'subscribe':
        // Handle subscription to specific channels
        ws.subscriptions = ws.subscriptions || new Set();
        if (data.channels && Array.isArray(data.channels)) {
          data.channels.forEach(channel => ws.subscriptions.add(channel));
        }
        ws.send(JSON.stringify({ type: 'subscribed', channels: Array.from(ws.subscriptions) }));
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  // Broadcast to all clients
  broadcast(data, filter = null) {
    const message = JSON.stringify(data);
    this.clients.forEach((clientSet, userId) => {
      clientSet.forEach(ws => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          if (!filter || filter(ws)) {
            ws.send(message);
          }
        }
      });
    });
  }

  // Send to specific user
  sendToUser(userId, data) {
    const message = JSON.stringify(data);
    if (this.clients.has(userId)) {
      this.clients.get(userId).forEach(ws => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
        }
      });
    }
  }

  // Send to users by UID
  sendToUserByUID(userUID, data) {
    const message = JSON.stringify(data);
    this.clients.forEach((clientSet, userId) => {
      clientSet.forEach(ws => {
        if (ws.userUID === userUID && ws.readyState === 1) {
          ws.send(message);
        }
      });
    });
  }

  // Notify about task changes
  notifyTaskChange(type, task, monthId = null, userUID = null) {
    const data = {
      type: 'task_change',
      event: type, // 'created', 'updated', 'deleted'
      task,
      monthId,
      userUID
    };

    // Always broadcast to all subscribed clients (admins and task owners)
    // This ensures real-time updates for everyone viewing the tasks
    this.broadcast(data, (ws) => {
      // Only send to clients subscribed to tasks or this month
      return !ws.subscriptions || ws.subscriptions.has('tasks') || (monthId && ws.subscriptions.has(`month:${monthId}`));
    });
  }

  // Notify about month changes
  notifyMonthChange(type, month) {
    this.broadcast({
      type: 'month_change',
      event: type,
      month
    }, (ws) => {
      return !ws.subscriptions || ws.subscriptions.has('months');
    });
  }

  // Notify about user changes
  notifyUserChange(type, user) {
    this.broadcast({
      type: 'user_change',
      event: type,
      user
    }, (ws) => {
      return !ws.subscriptions || ws.subscriptions.has('users');
    });
  }

  // Notify about deliverable changes
  notifyDeliverableChange(type, deliverable) {
    this.broadcast({
      type: 'deliverable_change',
      event: type, // 'created', 'updated', 'deleted'
      deliverable
    }, (ws) => {
      return !ws.subscriptions || ws.subscriptions.has('deliverables');
    });
  }

  // Notify about reporter changes
  notifyReporterChange(type, reporter) {
    this.broadcast({
      type: 'reporter_change',
      event: type, // 'created', 'updated', 'deleted'
      reporter
    }, (ws) => {
      return !ws.subscriptions || ws.subscriptions.has('reporters');
    });
  }

  // Notify about team days off changes
  notifyTeamDaysOffChange(type, teamDaysOff) {
    this.broadcast({
      type: 'team_days_off_change',
      event: type, // 'created', 'updated', 'deleted'
      teamDaysOff
    }, (ws) => {
      return !ws.subscriptions || ws.subscriptions.has('team_days_off');
    });
  }
}

export default WebSocketManager;

