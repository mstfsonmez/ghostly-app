import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || 'https://ghostly-backend.onrender.com';

class SocketService {
  socket: Socket | null = null;
  isConnected: boolean = false;
  connectionListeners: ((isConnected: boolean) => void)[] = [];
  pendingListeners: { event: string; callback: (data: any) => void }[] = [];
  registeredListeners: { event: string; callback: (data: any) => void }[] = [];
  
  async connect() {
    try {
      console.log('🔵 Connecting to Socket.IO server:', API_URL);
      
      // Force polling transport only (WebSocket blocked by Kubernetes proxy)
      // Socket.IO path must be under /api/ to work with Kubernetes ingress
      this.socket = io(API_URL, {
        path: '/socket.io',
        transports: ['polling'], // Only use polling, not websocket
        reconnection: false, // Disable reconnection to prevent crashes
        timeout: 5000, // Shorter timeout
        forceNew: true, // Force new connection
        autoConnect: false, // Manual connect
      });
      
      // Manual connect with error handling
      this.socket.connect();
      
      this.socket.on('connect', () => {
        try {
          console.log('✅ Socket connected:', this.socket?.id);
          this.isConnected = true;
          this.notifyConnectionListeners(true);
          
          // Register all pending listeners
          console.log(`📝 Registering ${this.pendingListeners.length} pending listeners`);
          this.pendingListeners.forEach(({ event, callback }) => {
            try {
              if (this.socket) {
                this.socket.on(event, callback);
                this.registeredListeners.push({ event, callback });
                console.log(`✅ Registered listener for: ${event}`);
              }
            } catch (e) {
              console.warn('⚠️ Failed to register listener:', event);
            }
          });
          this.pendingListeners = [];
          
          // Re-register all previously registered listeners (for reconnect)
          console.log(`🔄 Re-registering ${this.registeredListeners.length} existing listeners`);
          this.registeredListeners.forEach(({ event, callback }) => {
            try {
              if (this.socket) {
                this.socket.on(event, callback);
              }
            } catch (e) {
              console.warn('⚠️ Failed to re-register listener:', event);
            }
          });
        } catch (error) {
          console.warn('⚠️ Error in connect handler, app continues:', error);
        }
      });
      
      this.socket.on('disconnect', (reason: string) => {
        try {
          console.log('❌ Socket disconnected:', reason);
          this.isConnected = false;
          this.notifyConnectionListeners(false);
        } catch (error) {
          console.warn('⚠️ Error in disconnect handler:', error);
        }
      });
      
      this.socket.on('connect_error', (error: Error) => {
        try {
          console.warn('⚠️ Connection error (app continues):', error.message);
          this.isConnected = false;
          this.notifyConnectionListeners(false);
        } catch (err) {
          console.warn('⚠️ Error in connect_error handler:', err);
        }
      });
      
      return true;
      
    } catch (error) {
      console.warn('⚠️ Socket connection failed, app continues normally:', error);
      return false;
    }
  }
  
  disconnect() {
    try {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
        this.isConnected = false;
      }
    } catch (error) {
      console.warn('⚠️ Error disconnecting socket:', error);
    }
  }
  
  emit(event: string, data: any) {
    try {
      if (this.socket && this.isConnected) {
        console.log(`📤 Emitting: ${event}`, data);
        this.socket.emit(event, data);
      } else {
        console.warn('⚠️ Socket not connected, cannot emit:', event);
      }
    } catch (error) {
      console.warn('⚠️ Error emitting event:', event, error);
    }
  }
  
  on(event: string, callback: (data: any) => void) {
    try {
      // Wrap callback with error handling
      const safeCallback = (data: any) => {
        try {
          callback(data);
        } catch (error) {
          console.warn(`⚠️ Error in socket event handler for ${event}:`, error);
        }
      };

      if (this.socket && this.isConnected) {
        // Socket is already connected, register immediately
        console.log(`✅ Registering listener immediately for: ${event}`);
        this.socket.on(event, safeCallback);
        // Store for reconnection
        this.registeredListeners.push({ event, callback: safeCallback });
      } else {
        // Socket not connected yet, queue the listener
        console.log(`⏳ Queuing listener for: ${event}`);
        this.pendingListeners.push({ event, callback: safeCallback });
      }
    } catch (error) {
      console.warn(`⚠️ Error registering listener for ${event}:`, error);
    }
  }
  
  off(event: string, callback?: (data: any) => void) {
    try {
      if (this.socket) {
        this.socket.off(event, callback);
      }
      // Remove from registered listeners
      this.registeredListeners = this.registeredListeners.filter(
        listener => listener.event !== event || (callback && listener.callback !== callback)
      );
      // Also remove from pending listeners
      this.pendingListeners = this.pendingListeners.filter(
        listener => listener.event !== event || (callback && listener.callback !== callback)
      );
    } catch (error) {
      console.warn(`⚠️ Error removing listener for ${event}:`, error);
    }
  }
  
  addConnectionListener(callback: (isConnected: boolean) => void) {
    try {
      this.connectionListeners.push(callback);
    } catch (error) {
      console.warn('⚠️ Error adding connection listener:', error);
    }
  }
  
  removeConnectionListener(callback: (isConnected: boolean) => void) {
    try {
      this.connectionListeners = this.connectionListeners.filter(
        listener => listener !== callback
      );
    } catch (error) {
      console.warn('⚠️ Error removing connection listener:', error);
    }
  }
  
  notifyConnectionListeners(isConnected: boolean) {
    try {
      this.connectionListeners.forEach(callback => {
        try {
          callback(isConnected);
        } catch (error) {
          console.warn('⚠️ Error in connection listener callback:', error);
        }
      });
    } catch (error) {
      console.warn('⚠️ Error notifying connection listeners:', error);
    }
  }
}

export default new SocketService();