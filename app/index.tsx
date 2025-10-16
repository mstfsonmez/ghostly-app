// Global console filter - must be at the very top
if (typeof window !== 'undefined') {
  const originalConsole = { ...console };
  
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

  ['warn', 'error', 'log', 'info'].forEach(method => {
    console[method] = (...args) => {
      if (shouldFilter(args[0])) return;
      originalConsole[method].apply(console, args);
    };
  });
}

import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkNickname();
  }, []);

  const checkNickname = async () => {
    try {
      const nickname = await AsyncStorage.getItem('nickname');
      
      if (nickname) {
        router.replace('/(tabs)/channels');
      } else {
        router.replace('/nickname');
      }
    } catch (error) {
      console.error('Error checking nickname:', error);
      router.replace('/nickname');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1DA1F2" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
});