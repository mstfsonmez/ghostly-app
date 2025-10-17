import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NicknameScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const handleJoin = async () => {
    console.log('🔵 handleJoin called, nickname:', nickname);
    setError('');

    if (!nickname.trim()) {
      console.log('❌ Nickname is empty');
      setError('Please enter a nickname');
      return;
    }

    if (nickname.trim().length < 3) {
      console.log('❌ Nickname too short');
      setError('Nickname must be at least 3 characters');
      return;
    }

    if (nickname.trim().length > 20) {
      console.log('❌ Nickname too long');
      setError('Nickname must be less than 20 characters');
      return;
    }

    try {
      console.log('💾 Saving nickname to AsyncStorage...');
      
      // Generate unique user ID: nickname + timestamp + random
      const uniqueId = `${nickname.trim()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Save both nickname and unique ID
      await AsyncStorage.setItem('nickname', nickname.trim());
      await AsyncStorage.setItem('userId', uniqueId);
      
      console.log('✅ Nickname and userId saved:', uniqueId);
      router.replace('/(tabs)/channels');
      console.log('✅ Navigation called');
    } catch (error) {
      console.error('❌ Error saving nickname:', error);
      setError('Failed to save nickname');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <MaterialIcons name="forum" size={100} color="#1DA1F2" />
          <Text style={styles.title}>ChatRoom</Text>
          <Text style={styles.subtitle}>Anonymous IRC-style Chat</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Choose Your Nickname</Text>
          
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Enter nickname..."
            placeholderTextColor="#666"
            value={nickname}
            onChangeText={(text) => {
              setNickname(text);
              setError('');
            }}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <Pressable 
            style={({ pressed }) => [
              styles.joinButton,
              pressed && styles.joinButtonPressed
            ]}
            onPress={handleJoin}
          >
            <MaterialIcons name="login" size={24} color="#fff" />
            <Text style={styles.joinButtonText}>Join Chat</Text>
          </Pressable>
        </View>

        <View style={styles.info}>
          <View style={styles.infoItem}>
            <MaterialIcons name="security" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>Anonymous - No registration</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="speed" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>Instant access to channels</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="lock-open" size={20} color="#4CAF50" />
            <Text style={styles.infoText}>No data stored</Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 60 },
  title: { color: '#fff', fontSize: 40, fontWeight: 'bold', marginTop: 20 },
  subtitle: { color: '#666', fontSize: 16, marginTop: 8 },
  form: { marginBottom: 40 },
  label: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: '#111', color: '#fff', fontSize: 18, padding: 20, borderRadius: 16, borderWidth: 2, borderColor: '#333', textAlign: 'center' },
  inputError: { borderColor: '#E91E63' },
  errorText: { color: '#E91E63', fontSize: 14, marginTop: 8, textAlign: 'center' },
  joinButton: { flexDirection: 'row', backgroundColor: '#1DA1F2', padding: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  joinButtonPressed: { opacity: 0.7 },
  joinButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 12 },
  info: { marginTop: 20 },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoText: { color: '#999', fontSize: 14, marginLeft: 12 },
});