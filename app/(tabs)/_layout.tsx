import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Image, StyleSheet } from 'react-native';

export default function TabLayout() {
  const router = useRouter();

  useEffect(() => {
    // Force navigation to channels on first load
    router.replace('/channels');
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1DA1F2',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#222',
          height: 70,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="channels"
        options={{
          title: 'Channels',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="meeting-room" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="logo"
        options={{
          title: '',
          tabBarIcon: ({ size }) => (
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/ghost-icon.svg')} 
                style={[styles.logo, { width: size + 8, height: size + 8 }]}
                resizeMode="contain"
              />
            </View>
          ),
          tabBarButton: (props) => (
            <View style={styles.logoButton}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/images/ghost-icon.svg')} 
                  style={[styles.logo, { width: 40, height: 40 }]}
                  resizeMode="contain"
                />
              </View>
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logoButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 30,
    width: 60,
    height: 60,
    marginTop: -15,
    shadowColor: '#00FF41',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#00FF41',
  },
  logo: {
    // No tint color needed, SVG has its own colors
  },
});