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
        console.log('✅ Socket connected:', this.socket?.id);
        this.isConnected = true;
        this.notifyConnectionListeners(true);
        
        // Register all pending listeners
        console.log(`📝 Registering ${this.pendingListeners.length} pending listeners`);
        this.pendingListeners.forEach(({ event, callback }) => {
          if (this.socket) {
            this.socket.on(event, callback);
            this.registeredListeners.push({ event, callback });
            console.log(`✅ Registered listener for: ${event}`);
          }
        });
        this.pendingListeners = [];
        
        // Re-register all previously registered listeners (for reconnect)
        console.log(`🔄 Re-registering ${this.registeredListeners.length} existing listeners`);
        this.registeredListeners.forEach(({ event, callback }) => {
          if (this.socket) {
            this.socket.on(event, callback);
          }
        });
      });
      
      this.socket.on('disconnect', (reason: string) => {
        console.log('❌ Socket disconnected:', reason);
        this.isConnected = false;
        this.notifyConnectionListeners(false);
      });
      
      this.socket.on('connect_error', (error: Error) => {
        console.error('❌ Connection error:', error.message);
        this.isConnected = false;
        this.notifyConnectionListeners(false);
      });
      
      return true;
      
    } catch (error) {
      console.error('Socket connection error:', error);
      return false;
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
  
  emit(event: string, data: any) {
    if (this.socket && this.isConnected) {
      console.log(`📤 Emitting: ${event}`, data);
      this.socket.emit(event, data);
    } else {
      console.warn('⚠️ Socket not connected, cannot emit:', event);
    }
  }
  
  on(event: string, callback: (data: any) => void) {
    if (this.socket && this.isConnected) {
      // Socket is already connected, register immediately
      console.log(`✅ Registering listener immediately for: ${event}`);
      this.socket.on(event, callback);
      // Store for reconnection
      this.registeredListeners.push({ event, callback });
    } else {
      // Socket not connected yet, queue the listener
      console.log(`⏳ Queuing listener for: ${event}`);
      this.pendingListeners.push({ event, callback });
    }
  }
  
  off(event: string, callback?: (data: any) => void) {
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
  }
  
  addConnectionListener(callback: (isConnected: boolean) => void) {
    this.connectionListeners.push(callback);
  }
  
  removeConnectionListener(callback: (isConnected: boolean) => void) {
    this.connectionListeners = this.connectionListeners.filter(
      listener => listener !== callback
    );
  }
  
  notifyConnectionListeners(isConnected: boolean) {
    this.connectionListeners.forEach(callback => {
      callback(isConnected);
    });
  }
}

export default new SocketService();