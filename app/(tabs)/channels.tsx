import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Switch, Alert, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import socketService from '../../services/socket';

export default function RoomsScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [userId, setUserId] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [hasMaxMembers, setHasMaxMembers] = useState(false);
  
  // Password modal for joining
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [joinPassword, setJoinPassword] = useState('');

  useEffect(() => {
    loadNickname();
    loadRooms();

    // Named handlers for proper cleanup
    const handleRoomCreated = (data: any) => {
      console.log('🆕 New room created - refreshing list', data);
      loadRooms();
    };

    const handleRoomDeleted = (data: any) => {
      console.log('🗑️ Room deleted - refreshing list', data);
      loadRooms();
    };

    const handleRoomExpired = (data: any) => {
      console.log('⏰ Room expired - refreshing list', data);
      loadRooms();
    };

    const handleRoomUpdated = (data: any) => {
      console.log('🔄 Room updated', data);
      loadRooms();
    };

    const handleRoomListUpdated = (data: any) => {
      console.log('📋 Room list updated', data);
      loadRooms();
    };

    // Socket listeners for real-time updates
    socketService.on('room_created', handleRoomCreated);
    socketService.on('room_deleted', handleRoomDeleted);
    socketService.on('room_expired', handleRoomExpired);
    socketService.on('room_updated', handleRoomUpdated);
    socketService.on('room_list_updated', handleRoomListUpdated);

    return () => {
      socketService.off('room_created', handleRoomCreated);
      socketService.off('room_deleted', handleRoomDeleted);
      socketService.off('room_expired', handleRoomExpired);
      socketService.off('room_updated', handleRoomUpdated);
      socketService.off('room_list_updated', handleRoomListUpdated);
    };
  }, []);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      loadRooms();
    }, 500);
    
    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const loadNickname = async () => {
    try {
      const nick = await AsyncStorage.getItem('nickname');
      const id = await AsyncStorage.getItem('userId');
      
      console.log('📱 Loading user data:', { nickname: nick, userId: id });
      
      if (nick && id) {
        setNickname(nick);
        setUserId(id);
      } else {
        router.replace('/nickname');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      router.replace('/nickname');
    }
  };

  const loadRooms = async () => {
    try {
      const data = await api.getRooms(true, searchQuery || undefined);
      setRooms(data);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const changeNickname = async () => {
    Alert.alert(
      'Change Nickname',
      'This will log you out and you can choose a new nickname.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            await AsyncStorage.removeItem('nickname');
            router.replace('/nickname');
          },
        },
      ]
    );
  };

  const createRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    try {
      console.log('🏗️ Creating room with userId:', userId);
      
      const newRoom = await api.createRoom({
        name: roomName,
        description: roomDescription,
        creator_id: userId,
        is_public: true,
        password: hasPassword ? roomPassword : null,
        max_members: hasMaxMembers ? parseInt(maxMembers) : null,
      });

      console.log('✅ Room created:', newRoom);

      // Reset form
      setRoomName('');
      setRoomDescription('');
      setRoomPassword('');
      setMaxMembers('');
      setHasPassword(false);
      setHasMaxMembers(false);
      setShowCreateRoom(false);

      // Auto-join the created room
      await api.joinRoom(newRoom._id, userId, hasPassword ? roomPassword : undefined);
      
      // Navigate to the room
      router.push(`/room/${newRoom._id}?name=${newRoom.name}`);
    } catch (error) {
      console.error('Error creating room:', error);
      Alert.alert('Error', 'Failed to create room');
    }
  };

  const joinRoom = async (room: any) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found');
      return;
    }
    
    if (room.password) {
      setSelectedRoom(room);
      setShowPasswordModal(true);
    } else {
      if (room.max_members && room.members.length >= room.max_members) {
        Alert.alert('Error', 'This room is full');
        return;
      }
      
      try {
        console.log('👋 Joining room with userId:', userId);
        await api.joinRoom(room._id, userId);
        router.push(`/room/${room._id}?name=${room.name}`);
      } catch (error) {
        Alert.alert('Error', 'Failed to join room');
      }
    }
  };

  const handleJoinWithPassword = async () => {
    if (!joinPassword.trim()) {
      Alert.alert('Error', 'Please enter password');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    try {
      console.log('👋 Joining password-protected room with userId:', userId);
      await api.joinRoom(selectedRoom._id, userId, joinPassword);
      setShowPasswordModal(false);
      setJoinPassword('');
      router.push(`/room/${selectedRoom._id}?name=${selectedRoom.name}`);
    } catch (error: any) {
      console.error('Error joining room:', error);
      // Show specific error message from backend
      let errorMessage = 'Failed to join room';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.detail) {
        errorMessage = error.detail;
      }
      
      // Platform-specific alert
      if (Platform.OS === 'web') {
        window.alert(`❌ Error\n\n${errorMessage}`);
      } else {
        Alert.alert('❌ Error', errorMessage);
      }
      // Don't close modal so user can try again
    }
  };

  const renderRoom = ({ item }: { item: any }) => {
    const isFull = item.max_members && item.members.length >= item.max_members;
    const isAdmin = item.admin_id === userId;

    return (
      <TouchableOpacity 
        style={[styles.room, isFull && styles.roomFull]}
        onPress={() => joinRoom(item)}
        onLongPress={() => {
          if (isAdmin) {
            Alert.alert(
              'Room Options',
              `You are the admin of "${item.name}"`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Room',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      console.log('🗑️ Deleting room with userId:', userId);
                      await api.deleteRoom(item._id, userId);
                      loadRooms();
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete room');
                    }
                  },
                },
              ]
            );
          }
        }}
      >
        <View style={styles.roomIcon}>
          <MaterialIcons name="forum" size={32} color={isFull ? '#666' : '#1DA1F2'} />
          {item.password && (
            <MaterialIcons name="lock" size={16} color="#FFB300" style={styles.lockIcon} />
          )}
        </View>
        
        <View style={styles.roomContent}>
          <View style={styles.roomHeader}>
            <Text style={styles.roomName}>{item.name}</Text>
          </View>
          
          {item.description && (
            <Text style={styles.roomDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          
          <View style={styles.roomFooter}>
            <Text style={styles.roomMembers}>
              {item.members.length}
              {item.max_members ? `/${item.max_members}` : ''} members
            </Text>
            {isFull && (
              <View style={styles.fullBadge}>
                <Text style={styles.fullText}>FULL</Text>
              </View>
            )}
          </View>
        </View>

        <MaterialIcons name="chevron-right" size={24} color="#666" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Channels</Text>
          <View style={styles.headerStats}>
            <MaterialIcons name="forum" size={16} color="#1DA1F2" />
            <Text style={styles.statsText}>{rooms.length}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.nicknameButton} onPress={changeNickname}>
          <MaterialIcons name="person" size={20} color="#1DA1F2" />
          <Text style={styles.nicknameText}>{nickname}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search channels..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          nativeID="channels_search_input"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList data={rooms} renderItem={renderRoom} keyExtractor={(item) => item._id} ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="forum" size={80} color="#333" />
            <Text style={styles.emptyText}>{searchQuery ? 'No channels found' : 'No channels yet'}</Text>
            <Text style={styles.emptySubtext}>Create the first channel</Text>
          </View>
        } />

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreateRoom(true)}>
        <MaterialIcons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showPasswordModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Password Required</Text>
              <TouchableOpacity onPress={() => {
                setShowPasswordModal(false);
                setJoinPassword('');
              }}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordInfo}>
              Enter password for "{selectedRoom?.name}"
            </Text>

            <TextInput 
              style={styles.input} 
              placeholder="Enter Password" 
              placeholderTextColor="#666" 
              value={joinPassword} 
              onChangeText={setJoinPassword} 
              secureTextEntry 
              autoFocus
            />

            <TouchableOpacity style={styles.createButton} onPress={handleJoinWithPassword}>
              <Text style={styles.createButtonText}>Join Channel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateRoom} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Channel</Text>
              <TouchableOpacity onPress={() => setShowCreateRoom(false)}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <TextInput style={styles.input} placeholder="Channel Name *" placeholderTextColor="#666" value={roomName} onChangeText={setRoomName} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description (optional)" placeholderTextColor="#666" value={roomDescription} onChangeText={setRoomDescription} multiline />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Password Protected</Text>
              <Switch value={hasPassword} onValueChange={setHasPassword} trackColor={{ false: '#333', true: '#1DA1F2' }} />
            </View>

            {hasPassword && (
              <TextInput style={styles.input} placeholder="Enter Password" placeholderTextColor="#666" value={roomPassword} onChangeText={setRoomPassword} secureTextEntry />
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Limit Members</Text>
              <Switch value={hasMaxMembers} onValueChange={setHasMaxMembers} trackColor={{ false: '#333', true: '#1DA1F2' }} />
            </View>

            {hasMaxMembers && (
              <TextInput style={styles.input} placeholder="Max Members (e.g. 50)" placeholderTextColor="#666" value={maxMembers} onChangeText={setMaxMembers} keyboardType="number-pad" />
            )}

            <TouchableOpacity style={styles.createButton} onPress={createRoom}>
              <Text style={styles.createButtonText}>Create Channel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginRight: 12 },
  headerStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statsText: { color: '#1DA1F2', fontSize: 13, fontWeight: 'bold', marginLeft: 6 },
  nicknameButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#333' },
  nicknameText: { color: '#1DA1F2', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', margin: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: '#333' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 12 },
  room: { flexDirection: 'row', padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  roomFull: { opacity: 0.5 },
  roomIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 12, position: 'relative' },
  lockIcon: { position: 'absolute', top: 2, right: 2 },
  roomContent: { flex: 1 },
  roomHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  roomName: { color: '#fff', fontSize: 17, fontWeight: '600', flex: 1 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  adminText: { color: '#FFD700', fontSize: 11, marginLeft: 4, fontWeight: '600' },
  roomDescription: { color: '#999', fontSize: 14, marginBottom: 4 },
  roomFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomMembers: { color: '#666', fontSize: 13 },
  fullBadge: { backgroundColor: '#E91E63', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  fullText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { color: '#fff', fontSize: 20, marginTop: 20, fontWeight: '600' },
  emptySubtext: { color: '#666', fontSize: 15, marginTop: 8 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center', elevation: 8, boxShadow: '0 4px 8px rgba(29, 161, 242, 0.4)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  input: { backgroundColor: '#222', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  textArea: { height: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginBottom: 16 },
  switchLabel: { color: '#fff', fontSize: 16, fontWeight: '500' },
  passwordInfo: { color: '#999', fontSize: 15, marginBottom: 16, lineHeight: 22 },
  createButton: { backgroundColor: '#1DA1F2', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  createButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
