import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, BackHandler, Alert, Modal, ScrollView } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../../services/socket';
import api from '../../services/api';

export default function RoomChatScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const [nickname, setNickname] = useState('');
  const [userId, setUserId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [roomCreatedAt, setRoomCreatedAt] = useState<Date | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [roomMembers, setRoomMembers] = useState<string[]>([]);
  const [adminId, setAdminId] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const loadNickname = async () => {
    try {
      const nick = await AsyncStorage.getItem('nickname');
      const id = await AsyncStorage.getItem('userId');
      
      console.log('📱 Room: Loading user data:', { nickname: nick, userId: id });
      
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

  const handleLeaveRoom = async () => {
    console.log('🔵 handleLeaveRoom called');
    console.log('🔵 Current userId:', userId);
    console.log('🔵 Current room id:', id);
    
    // Check if current user is admin (real-time check)
    try {
      const currentRoom = await api.getRoom(id as string);
      console.log('🔵 Current room:', currentRoom);
      
      const isCurrentUserAdmin = currentRoom?.admin_id === userId;
      console.log('🔵 Is admin?', isCurrentUserAdmin, 'admin_id:', currentRoom?.admin_id, 'userId:', userId);

      // If admin, show warning
      if (isCurrentUserAdmin) {
        console.log('✅ Showing admin alert...');
        
        // Platform-specific confirmation
        if (Platform.OS === 'web') {
          // Use window.confirm for web
          const confirmed = window.confirm(
            '⚠️ Room Owner\n\nYou are the room owner. If you leave, the room and all messages will be permanently deleted. Are you sure?'
          );
          if (confirmed) {
            console.log('✅ Confirmed leave (web)');
            await performLeaveRoom();
          } else {
            console.log('❌ Cancelled (web)');
          }
        } else {
          // Use Alert.alert for mobile
          Alert.alert(
            '⚠️ Room Owner',
            'You are the room owner. If you leave, the room and all messages will be permanently deleted. Are you sure?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => console.log('❌ Cancelled') },
              { 
                text: 'Yes, Leave', 
                style: 'destructive',
                onPress: async () => {
                  console.log('✅ Confirmed leave');
                  await performLeaveRoom();
                }
              }
            ]
          );
        }
      } else {
        console.log('⚠️ Not admin, leaving directly...');
        await performLeaveRoom();
      }
    } catch (error) {
      console.error('❌ Error checking admin status:', error);
      await performLeaveRoom();
    }
  };

  const performLeaveRoom = async () => {
    try {
      console.log('🚪 Leaving room with userId:', userId);
      // Call backend API to leave room (admin leave will delete room)
      const response = await api.leaveRoom(id as string, userId);
      console.log('✅ Left room, response:', response);
      
      // Socket leave
      socketService.emit('leave_room', { room_id: id });
      
      // Navigate back
      router.back();
    } catch (error) {
      console.error('❌ Error leaving room:', error);
      // Still navigate back even if API call fails
      router.back();
    }
  };

  // Hardware back button handler (Mobile) + Browser back (Web)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        console.log('🔵 Back button pressed (hardware/browser)');
        // Call async function properly
        handleLeaveRoom().catch((error) => {
          console.error('Error handling back press:', error);
        });
        return true; // Prevent default back action
      };

      // Mobile: Hardware back button
      let backHandlerSubscription: any = null;
      if (Platform.OS !== 'web') {
        backHandlerSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      }

      // Web: Browser history (popstate event)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const handlePopState = (event: PopStateEvent) => {
          event.preventDefault();
          console.log('🔵 Browser back button pressed');
          handleLeaveRoom();
        };
        
        window.addEventListener('popstate', handlePopState);
        // Push a dummy state to intercept back button
        window.history.pushState(null, '', window.location.href);
        
        return () => {
          window.removeEventListener('popstate', handlePopState);
          if (backHandlerSubscription) {
            backHandlerSubscription.remove();
          }
        };
      }

      return () => {
        if (backHandlerSubscription) {
          backHandlerSubscription.remove();
        }
      };
    }, [handleLeaveRoom])
  );

  useEffect(() => {
    loadNickname();
  }, []);

  useEffect(() => {
    if (!userId || !nickname) return;
    
    // Define handleUserKicked inside useEffect to avoid dependency issues
    const handleUserKickedLocal = (data: any) => {
      console.log('🔴 User kicked event received:', data);
      console.log('🔴 Current userId:', userId);
      
      // Check if current user was kicked
      if (data.user_id === userId) {
        console.log('🔴 CURRENT USER WAS KICKED! Redirecting...');
        
        // Parse ban duration
        let banMessage = 'You have been removed from the room.';
        if (data.banned_until) {
          banMessage += '\n\nYou are banned from this room for 5 minutes.';
        }
        
        // Platform-specific alert
        if (Platform.OS === 'web') {
          window.alert(`👢 Kicked from Room\n\n${banMessage}`);
          router.replace('/rooms');
        } else {
          Alert.alert(
            '👢 Kicked from Room',
            banMessage,
            [
              {
                text: 'OK',
                onPress: () => router.replace('/rooms')
              }
            ]
          );
        }
      } else {
        console.log('🔴 Another user was kicked, refreshing member list');
        // Another user was kicked, refresh member list
        loadMessages();
      }
    };
    
    // Handle messages cleared event (when user is kicked and their messages deleted)
    const handleMessagesCleared = (data: any) => {
      console.log('🗑️ Messages cleared event:', data);
      if (data.room_id === id) {
        console.log('🗑️ Refreshing messages due to kick');
        // Reload messages to reflect deleted messages
        loadMessages();
      }
    };
    
    const joinRoomWithNickname = async () => {
      await loadMessages();
      
      socketService.emit('join_room', { 
        room_id: id,
        nickname: nickname,
        user_id: userId
      });
    };

    joinRoomWithNickname();
    
    // Handle room time updates
    const handleRoomTimeUpdate = (data: any) => {
      if (data.room_id === id) {
        setTimeRemaining(data.time_remaining);
      }
    };

    socketService.on('receive_room_message', handleReceiveMessage);
    socketService.on('user_joined_room', handleUserJoined);
    socketService.on('user_left_room', handleUserLeft);
    socketService.on('room_deleted', handleRoomDeleted);
    socketService.on('room_expired', handleRoomExpired);
    socketService.on('room_time_update', handleRoomTimeUpdate);
    socketService.on('user_kicked', handleUserKickedLocal);
    socketService.on('messages_cleared', handleMessagesCleared);
    
    return () => {
      // Don't call API in cleanup - use explicit leave button
      socketService.emit('leave_room', { room_id: id });
      socketService.off('receive_room_message', handleReceiveMessage);
      socketService.off('user_joined_room', handleUserJoined);
      socketService.off('user_left_room', handleUserLeft);
      socketService.off('room_deleted', handleRoomDeleted);
      socketService.off('room_expired', handleRoomExpired);
      socketService.off('room_time_update', handleRoomTimeUpdate);
      socketService.off('user_kicked', handleUserKickedLocal);
      socketService.off('messages_cleared', handleMessagesCleared);
    };
  }, [userId, nickname]);

  const loadMessages = async () => {
    try {
      const data = await api.getRoomMessages(id as string);
      setMessages(data);
      
      // Get room details directly (more accurate than searching in list)
      const currentRoom = await api.getRoom(id as string);
      if (currentRoom) {
        if (currentRoom.admin_id === userId) {
          setIsAdmin(true);
        }
        if (currentRoom.created_at) {
          setRoomCreatedAt(new Date(currentRoom.created_at));
        }
        // Store members and admin info
        setRoomMembers(currentRoom.members || []);
        setAdminId(currentRoom.admin_id || '');
        
        console.log('🏠 Room data loaded:', {
          isAdmin: currentRoom.admin_id === userId,
          admin_id: currentRoom.admin_id,
          userId: userId,
          members: currentRoom.members,
          memberCount: currentRoom.members?.length
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleShowMembers = async () => {
    // Refresh member list before showing
    try {
      const currentRoom = await api.getRoom(id as string);
      if (currentRoom) {
        setRoomMembers(currentRoom.members || []);
        setAdminId(currentRoom.admin_id || '');
        setIsAdmin(currentRoom.admin_id === userId);
        
        console.log('👥 Members modal opened:', {
          members: currentRoom.members,
          memberCount: currentRoom.members?.length,
          currentUserId: userId,
          isInList: currentRoom.members?.includes(userId)
        });
      }
    } catch (error) {
      console.error('Error loading members:', error);
    }
    setShowMembersModal(true);
  };

  const handleKickUser = async (kickUserId: string) => {
    // Platform-specific confirmation
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `⚠️ Kick User\n\nRemove ${kickUserId} from this room?`
      );
      if (confirmed) {
        try {
          console.log('👢 Kicking user:', { roomId: id, adminId: userId, kickUserId });
          await api.kickUser(id as string, userId, kickUserId);
          window.alert(`✅ Success\n\nUser removed from room`);
          loadMessages(); // Refresh member list
        } catch (error) {
          console.error('Error kicking user:', error);
          window.alert('❌ Error\n\nFailed to kick user');
        }
      }
    } else {
      Alert.alert(
        '⚠️ Kick User',
        `Remove ${kickUserId} from this room?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Kick',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('👢 Kicking user:', { roomId: id, adminId: userId, kickUserId });
                await api.kickUser(id as string, userId, kickUserId);
                Alert.alert('Success', 'User removed from room');
                loadMessages(); // Refresh member list
              } catch (error) {
                console.error('Error kicking user:', error);
                Alert.alert('Error', 'Failed to kick user');
              }
            }
          }
        ]
      );
    }
  };

  const handleTransferAdmin = async (newAdminId: string) => {
    // Platform-specific confirmation
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `⚠️ Transfer Ownership\n\nTransfer room ownership to ${newAdminId}? You will no longer be the admin.`
      );
      if (confirmed) {
        try {
          console.log('🔄 Transferring admin:', { from: userId, to: newAdminId });
          await api.transferAdmin(id as string, userId, newAdminId);
          setIsAdmin(false);
          setAdminId(newAdminId);
          window.alert(`✅ Success\n\nRoom ownership transferred to ${newAdminId}`);
          setShowMembersModal(false);
          loadMessages();
        } catch (error) {
          console.error('Error transferring admin:', error);
          window.alert('❌ Error\n\nFailed to transfer ownership');
        }
      }
    } else {
      Alert.alert(
        '⚠️ Transfer Ownership',
        `Transfer room ownership to ${newAdminId}? You will no longer be the admin.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Transfer',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('🔄 Transferring admin:', { from: userId, to: newAdminId });
                await api.transferAdmin(id as string, userId, newAdminId);
                setIsAdmin(false);
                setAdminId(newAdminId);
                Alert.alert('Success', `Room ownership transferred to ${newAdminId}`);
                setShowMembersModal(false);
                loadMessages();
              } catch (error) {
                console.error('Error transferring admin:', error);
                Alert.alert('Error', 'Failed to transfer ownership');
              }
            }
          }
        ]
      );
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (!roomCreatedAt) return;

    const updateCountdown = () => {
      const now = new Date();
      // Use UTC to avoid timezone issues
      const createdTime = new Date(roomCreatedAt).getTime();
      const expiryTime = createdTime + (12 * 60 * 60 * 1000); // 12 hours in milliseconds
      const remaining = expiryTime - now.getTime();

      if (remaining <= 0) {
        setTimeRemaining('Room expired');
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [roomCreatedAt]);

  const handleReceiveMessage = (message: any) => {
    if (message.room_id === id) {
      setMessages(prev => {
        // Remove temp message if exists (optimistic update)
        const withoutTemp = prev.filter(m => !m._id.startsWith('temp_'));
        
        // Check if this message already exists (by _id)
        const exists = withoutTemp.some(m => m._id === message._id);
        
        if (exists) {
          return prev; // Don't add duplicate
        }
        
        // Add new message
        return [...withoutTemp, message];
      });
      flatListRef.current?.scrollToEnd();
    }
  };

  const handleUserJoined = (data: any) => {
    if (data.room_id === id) {
      console.log(`${data.username} joined the room`);
    }
  };

  const handleUserLeft = (data: any) => {
    if (data.room_id === id) {
      console.log(`${data.username} left the room`);
    }
  };

  const handleRoomDeleted = (data: any) => {
    console.log('Room deleted:', data);
    
    // Platform-specific alert
    if (Platform.OS === 'web') {
      window.alert('🚪 Room Deleted\n\nThe room has been deleted because the owner left.');
      router.replace('/rooms');
    } else {
      Alert.alert(
        '🚪 Room Deleted',
        'The room has been deleted because the owner left.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/rooms')
          }
        ]
      );
    }
  };

  const handleRoomExpired = (data: any) => {
    console.log('⏰ Room expired:', data);
    if (data.room_id === id) {
      // Leave the socket room
      socketService.emit('leave_room', { room_id: id });
      
      // Show alert
      if (Platform.OS === 'web') {
        window.alert('⏰ Room Expired\n\n' + (data.message || 'This room has expired and been deleted. All messages have been removed.'));
        router.replace('/rooms');
      } else {
        Alert.alert(
          '⏰ Room Expired',
          data.message || 'This room has expired and been deleted. All messages have been removed.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/rooms')
            }
          ]
        );
      }
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !nickname || !userId) return;

    console.log('📤 Sending message with userId:', userId, 'nickname:', nickname);

    socketService.emit('send_room_message', {
      room_id: id,
      message: inputText,
      nickname: nickname,
      user_id: userId,
    });

    const tempMessage = {
      _id: `temp_${Date.now()}`,
      user_id: userId,
      username: nickname,
      message: inputText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      // Save message - backend expects userId in request body
      await api.saveRoomMessage(id as string, userId, inputText);
    } catch (error) {
      console.error('Error saving message:', error);
    }

    setInputText('');
    flatListRef.current?.scrollToEnd();
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isOwnMessage = item.user_id === userId;

    return (
      <View style={styles.messageContainer}>
        {!isOwnMessage ? (
          <Text style={styles.username}>{item.username || 'Unknown'}</Text>
        ) : null}
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
          <Text style={styles.messageText}>{item.message || ''}</Text>
          <Text style={styles.messageTime}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLeaveRoom}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{name}</Text>
          <TouchableOpacity onPress={handleShowMembers}>
            <MaterialIcons name="info" size={24} color="#1DA1F2" />
          </TouchableOpacity>
        </View>
        
        {timeRemaining ? (
          <View style={styles.countdown}>
            <MaterialIcons name="timer" size={16} color="#FFD700" />
            <Text style={styles.countdownText}>
              Room closes in {timeRemaining}
            </Text>
          </View>
        ) : null}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor="#8e8e93"
            multiline
            maxLength={1000}
            nativeID="room_message_input"
          />
        </View>
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() ? styles.sendButtonDisabled : null]}
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <MaterialIcons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Members Modal */}
      <Modal visible={showMembersModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Room Members ({roomMembers.length})</Text>
              <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.membersList}>
              {roomMembers.map((member, index) => (
                <View key={index} style={styles.memberItem}>
                  <View style={styles.memberInfo}>
                    <MaterialIcons 
                      name="person" 
                      size={24} 
                      color={member === adminId ? "#FFD700" : "#1DA1F2"} 
                    />
                    <View style={styles.memberTextContainer}>
                      <Text style={styles.memberName}>{member}</Text>
                      {member === adminId ? (
                        <View style={styles.adminBadge}>
                          <MaterialIcons name="star" size={14} color="#FFD700" />
                          <Text style={styles.adminBadgeText}>Owner</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  
                  {isAdmin && member !== userId && member !== adminId ? (
                    <View style={styles.memberActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => handleTransferAdmin(member)}
                      >
                        <MaterialIcons name="swap-horiz" size={24} color="#1DA1F2" />
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => handleKickUser(member)}
                      >
                        <MaterialIcons name="close" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerContainer: { backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#333' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, marginLeft: 16 },
  countdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  countdownText: { color: '#FFD700', fontSize: 12, marginLeft: 4, fontWeight: '500' },
  messagesList: { padding: 16 },
  messageContainer: { marginBottom: 12 },
  username: { color: '#1DA1F2', fontSize: 12, marginBottom: 4, marginLeft: 4 },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  ownMessage: { alignSelf: 'flex-end', backgroundColor: '#1DA1F2' },
  otherMessage: { alignSelf: 'flex-start', backgroundColor: '#222' },
  messageText: { color: '#fff', fontSize: 16 },
  messageTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
  inputContainer: { flexDirection: 'row', padding: 12, alignItems: 'flex-end', backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#333' },
  inputWrapper: { flex: 1, backgroundColor: '#222', borderRadius: 20, marginRight: 8, paddingHorizontal: 4, paddingVertical: 4 },
  input: { backgroundColor: 'transparent', color: '#fff', paddingHorizontal: 12, paddingVertical: 8, maxHeight: 100, fontSize: 16 },
  sendButton: { backgroundColor: '#1DA1F2', borderRadius: 20, padding: 8, justifyContent: 'center', alignItems: 'center', width: 40, height: 40 },
  sendButtonDisabled: { backgroundColor: '#666', opacity: 0.5 },
  
  // Members Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  membersList: { padding: 16 },
  memberItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#1a1a1a', borderRadius: 12, marginBottom: 8 },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  memberTextContainer: { marginLeft: 12, flex: 1 },
  memberName: { color: '#fff', fontSize: 16, fontWeight: '500' },
  adminBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  adminBadgeText: { color: '#FFD700', fontSize: 12, marginLeft: 4, fontWeight: '600' },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
});