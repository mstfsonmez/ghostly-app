import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../services/socket';

export default function RootLayout() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Filter out annoying warnings - more aggressive approach
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalLog = console.log;
    
    const shouldFilter = (message) => {
      if (typeof message === 'string') {
        return (
          message.includes('React DevTools global hook') ||
          message.includes('shadow* style props are deprecated') ||
          message.includes('pointerEvents is deprecated') ||
          message.includes('Something has shimmed the React DevTools') ||
          message.includes('Fast Refresh is not compatible')
        );
      }
      return false;
    };

    console.warn = (...args) => {
      if (shouldFilter(args[0])) return;
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      if (shouldFilter(args[0])) return;
      originalError.apply(console, args);
    };

    console.log = (...args) => {
      if (shouldFilter(args[0])) return;
      originalLog.apply(console, args);
    };

    // Also filter console methods that might be used
    const originalInfo = console.info;
    console.info = (...args) => {
      if (shouldFilter(args[0])) return;
      originalInfo.apply(console, args);
    };

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
      console.log = originalLog;
      console.info = originalInfo;
    };
  }, []);

  useEffect(() => {
    // Initialize Socket.IO connection
    console.log('🔵 Initializing Socket.IO connection...');
    socketService.connect();
    
    return () => {
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    // Only clear session on background for mobile (not web)
    // Web tabs switching shouldn't clear the session
    if (Platform.OS !== 'web') {
      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (appState.current.match(/active|foreground/) && nextAppState === 'background') {
          // User moved app to background - clear session after 2 seconds
          setTimeout(async () => {
            const currentState = AppState.currentState;
            if (currentState === 'background') {
              await AsyncStorage.removeItem('nickname');
              await AsyncStorage.removeItem('userId');
              console.log('🔄 Nickname and userId cleared - app sent to background');
            }
          }, 2000);
        }
        
        appState.current = nextAppState;
      });

      return () => {
        subscription.remove();
        socketService.disconnect();
      };
    }

    // For web, just handle socket disconnect on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nickname" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}