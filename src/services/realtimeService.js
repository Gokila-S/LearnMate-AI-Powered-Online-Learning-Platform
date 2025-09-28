import { io } from 'socket.io-client';

class RealtimeService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.eventListeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(token) {
    if (this.socket) {
      this.disconnect();
    }

    try {
      this.socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000', {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        retries: 3
      });

      this.socket.on('connect', () => {
        console.log('Connected to real-time server');
        this.connected = true;
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from real-time server');
        this.connected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.handleReconnect();
      });

      // Discussion-related events
      this.socket.on('new_discussion', (data) => {
        this.emit('new_discussion', data);
      });

      this.socket.on('new_message', (data) => {
        this.emit('new_message', data);
      });

      this.socket.on('message_voted', (data) => {
        this.emit('message_voted', data);
      });

      this.socket.on('discussion_voted', (data) => {
        this.emit('discussion_voted', data);
      });

      this.socket.on('user_typing', (data) => {
        this.emit('user_typing', data);
      });

      this.socket.on('user_online', (data) => {
        this.emit('user_online', data);
      });

      this.socket.on('user_offline', (data) => {
        this.emit('user_offline', data);
      });

    } catch (error) {
      console.error('Failed to initialize socket connection:', error);
      // Fall back to polling mode
      this.initPolling();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.clearPolling();
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      setTimeout(() => {
        if (!this.connected) {
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          this.socket?.connect();
        }
      }, delay);
    } else {
      console.log('Max reconnection attempts reached. Falling back to polling.');
      this.initPolling();
    }
  }

  // Event system for components to listen to real-time updates
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Course-specific methods
  joinCourse(courseId) {
    if (this.socket?.connected) {
      this.socket.emit('join_course', { courseId });
    }
  }

  leaveCourse(courseId) {
    if (this.socket?.connected) {
      this.socket.emit('leave_course', { courseId });
    }
  }

  joinDiscussion(discussionId) {
    if (this.socket?.connected) {
      this.socket.emit('join_discussion', { discussionId });
    }
  }

  leaveDiscussion(discussionId) {
    if (this.socket?.connected) {
      this.socket.emit('leave_discussion', { discussionId });
    }
  }

  // Typing indicators
  startTyping(discussionId) {
    if (this.socket?.connected) {
      this.socket.emit('start_typing', { discussionId });
    }
  }

  stopTyping(discussionId) {
    if (this.socket?.connected) {
      this.socket.emit('stop_typing', { discussionId });
    }
  }

  // Presence updates
  updatePresence(status, activity, courseId) {
    if (this.socket?.connected) {
      this.socket.emit('update_presence', {
        status,
        activity,
        courseId
      });
    }
  }

  // Polling fallback system
  initPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Poll every 10 seconds for updates
    this.pollingInterval = setInterval(() => {
      this.emit('poll_update', {});
    }, 10000);

    console.log('Initialized polling mode for real-time updates');
  }

  clearPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Utility methods
  isConnected() {
    return this.connected && this.socket?.connected;
  }

  getConnectionStatus() {
    if (this.isConnected()) {
      return 'connected';
    } else if (this.pollingInterval) {
      return 'polling';
    } else {
      return 'disconnected';
    }
  }
}

// Create singleton instance
const realtimeService = new RealtimeService();

export default realtimeService;