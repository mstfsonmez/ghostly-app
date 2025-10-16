import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../../services/api';
import socketService from '../../services/socket';

interface Channel {
  _id: string;
  name: string;
  description: string;
  members: string[];
  admin_id: string;
  last_message?: {
    message: string;
    username: string;
    created_at: string;
  };
  unread_count: number;
  created_at: string;
}

export default function ChannelsScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'unread' | 'alpha'>('recent');

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadChannels();
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Initial load
    loadChannels();

    // Socket listeners for real-time updates
    const handleNewMessage = (data: any) => {
      console.log('📨 New message in channel - refreshing', data);
      loadChannels();
    };

    const handleRoomDeleted = (data: any) => {
      console.log('🗑️ Channel deleted - refreshing', data);
      loadChannels();
    };

    const handleRoomExpired = (data: any) => {
      console.log('⏰ Channel expired - refreshing', data);
      loadChannels();
    };

    const handleRoomListUpdated = (data: any) => {
      console.log('📋 Channel list updated - refreshing', data);
      loadChannels();
    };

    socketService.on('receive_room_message', handleNewMessage);
    socketService.on('room_deleted', handleRoomDeleted);
    socketService.on('room_expired', handleRoomExpired);
    socketService.on('room_list_updated', handleRoomListUpdated);

    return () => {
      socketService.off('receive_room_message', handleNewMessage);
      socketService.off('room_deleted', handleRoomDeleted);
      socketService.off('room_expired', handleRoomExpired);
      socketService.off('room_list_updated', handleRoomListUpdated);
    };
  }, [userId]);

  const loadUserId = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      if (id) {
        setUserId(id);
      } else {
        router.replace('/nickname');
      }
    } catch (error) {
      console.error('Error loading userId:', error);
      router.replace('/nickname');
    }
  };

  const loadChannels = async () => {
    if (!userId) return;
    
    try {
      const data = await api.getUserChannels(userId);
      setChannels(data);
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChannels();
    setRefreshing(false);
  };

  const getSortedChannels = () => {
    let filtered = channels;

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(channel =>
        channel.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    const sorted = [...filtered];
    if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    } else if (sortBy === 'unread') {
      sorted.sort((a, b) => b.unread_count - a.unread_count);
    } else if (sortBy === 'alpha') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const handleRoomPress = async (room: Channel) => {
    try {
      // Join room before navigating (add user to members list)
      await api.joinRoom(room._id, userId);
      router.push(`/room/${room._id}?name=${room.name}`);
    } catch (error) {
      console.error('Error joining room:', error);
      // Navigate anyway, user might already be a member
      router.push(`/room/${room._id}?name=${room.name}`);
    }
  };

  const renderChannel = ({ item }: { item: Channel }) => {
    const isAdmin = item.admin_id === userId;
    const lastMessageTime = item.last_message?.created_at || item.created_at;

    return (
      <TouchableOpacity
        style={[styles.channelCard, item.unread_count > 0 && styles.channelCardUnread]}
        onPress={() => handleRoomPress(item)}
      >
        <View style={styles.channelIcon}>
          <MaterialIcons 
            name={isAdmin ? "admin-panel-settings" : "tag"} 
            size={32} 
            color={item.unread_count > 0 ? "#1DA1F2" : "#666"} 
          />
        </View>

        <View style={styles.channelContent}>
          <View style={styles.channelHeader}>
            <Text style={[styles.channelName, item.unread_count > 0 && styles.channelNameUnread]}>
              {item.name}
            </Text>
            <Text style={styles.channelTime}>{formatTime(lastMessageTime)}</Text>
          </View>

          <View style={styles.channelMessage}>
            {item.last_message && item.last_message.message ? (
              <Text style={styles.lastMessage} numberOfLines={1}>
                <Text style={styles.lastMessageUser}>{item.last_message.username || 'Unknown'}: </Text>
                {item.last_message.message || ''}
              </Text>
            ) : (
              <Text style={styles.noMessage}>No messages yet</Text>
            )}
          </View>

          <View style={styles.channelFooter}>
            <View style={styles.memberCount}>
              <MaterialIcons name="people" size={16} color="#666" />
              <Text style={styles.memberCountText}>{item.members.length}</Text>
            </View>

            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with room count */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Rooms</Text>
        <View style={styles.roomCountBadge}>
          <Text style={styles.roomCountText}>{channels.length}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search rooms..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          nativeID="rooms_search_input"
        />
      </View>

      {/* Channels List */}
      <FlatList
        data={getSortedChannels()}
        renderItem={renderChannel}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DA1F2" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="chat-bubble-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No rooms yet</Text>
            <Text style={styles.emptySubtext}>Send a message in a room to see it here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  roomCountBadge: {
    backgroundColor: '#1DA1F2',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  controls: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 8 },
  sortButtons: { flexDirection: 'row', justifyContent: 'space-around' },
  sortButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#1a1a1a',
  },
  sortButtonActive: { backgroundColor: '#1DA1F220' },
  listContent: { padding: 16 },
  channelCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  channelCardUnread: { borderLeftColor: '#1DA1F2', backgroundColor: '#1a1a1a' },
  channelIcon: { marginRight: 12, justifyContent: 'center' },
  channelContent: { flex: 1 },
  channelHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  channelName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  channelNameUnread: { fontWeight: '700' },
  channelTime: { fontSize: 12, color: '#666' },
  channelMessage: { marginBottom: 8 },
  lastMessage: { fontSize: 14, color: '#999' },
  lastMessageUser: { color: '#1DA1F2', fontWeight: '600' },
  noMessage: { fontSize: 14, color: '#666', fontStyle: 'italic' },
  channelFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberCount: { flexDirection: 'row', alignItems: 'center' },
  memberCountText: { color: '#666', fontSize: 12, marginLeft: 4 },
  unreadBadge: {
    backgroundColor: '#1DA1F2',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: '#666', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
