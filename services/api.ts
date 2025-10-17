import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || 'https://ghostly-backend.onrender.com';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_URL}/api`;
  }

  private async getAuthHeader() {
    const token = await AsyncStorage.getItem('session_token');
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const authHeader = await this.getAuthHeader();
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Try to get detailed error message from backend
      let errorMessage = `API Error: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (jsonError) {
        // If JSON parsing fails, keep default statusText
        console.log('Could not parse error JSON, using statusText');
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth
  async createSession(sessionId: string) {
    const response = await fetch(`${this.baseUrl}/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
      },
    });
    return response.json();
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  // Users
  async getUser(userId: string) {
    return this.request(`/users/${userId}`);
  }

  async updateUser(userId: string, data: any) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async searchUsers(query: string) {
    return this.request(`/users?q=${encodeURIComponent(query)}`);
  }

  async followUser(userId: string, followerId: string) {
    return this.request(`/users/${userId}/follow`, {
      method: 'POST',
      body: JSON.stringify({ follower_id: followerId }),
    });
  }

  async unfollowUser(userId: string, followerId: string) {
    return this.request(`/users/${userId}/unfollow`, {
      method: 'POST',
      body: JSON.stringify({ follower_id: followerId }),
    });
  }

  // Posts
  async createPost(data: any) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFeed(userId?: string, limit = 20, skip = 0) {
    let url = `/posts?limit=${limit}&skip=${skip}`;
    if (userId) url += `&user_id=${userId}`;
    return this.request(url);
  }

  async getPost(postId: string) {
    return this.request(`/posts/${postId}`);
  }

  async likePost(postId: string, userId: string) {
    return this.request(`/posts/${postId}/like`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async unlikePost(postId: string, userId: string) {
    return this.request(`/posts/${postId}/unlike`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async deletePost(postId: string, userId: string) {
    return this.request(`/posts/${postId}?user_id=${userId}`, {
      method: 'DELETE',
    });
  }

  // Comments
  async createComment(postId: string, content: string, userId: string) {
    return this.request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, user_id: userId }),
    });
  }

  async getComments(postId: string) {
    return this.request(`/posts/${postId}/comments`);
  }

  // Stories
  async createStory(data: any) {
    return this.request('/stories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStories(userId?: string) {
    let url = '/stories';
    if (userId) url += `?user_id=${userId}`;
    return this.request(url);
  }

  async viewStory(storyId: string, userId: string) {
    return this.request(`/stories/${storyId}/view`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  // Messages
  async getConversations(userId: string) {
    return this.request(`/messages/conversations?user_id=${userId}`);
  }

  async getMessages(otherUserId: string, userId: string, limit = 50) {
    return this.request(`/messages/${otherUserId}?user_id=${userId}&limit=${limit}`);
  }

  async saveMessage(data: any) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Chat Rooms
  async createRoom(data: any) {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserChannels(userId: string) {
    return this.request(`/users/${userId}/channels`);
  }

  async getRooms(isPublic = true, search?: string) {
    let url = `/rooms?is_public=${isPublic}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return this.request(url);
  }

  async getRoom(roomId: string) {
    return this.request(`/rooms/${roomId}`);
  }

  async joinRoom(roomId: string, userId: string, password?: string) {
    return this.request(`/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, password }),
    });
  }

  async leaveRoom(roomId: string, userId: string) {
    return this.request(`/rooms/${roomId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async deleteRoom(roomId: string, userId: string) {
    return this.request(`/rooms/${roomId}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async transferAdmin(roomId: string, currentAdminId: string, newAdminId: string) {
    return this.request(`/rooms/${roomId}/transfer-admin`, {
      method: 'POST',
      body: JSON.stringify({ 
        room_id: roomId,
        current_admin_id: currentAdminId, 
        new_admin_id: newAdminId 
      }),
    });
  }

  async kickUser(roomId: string, adminId: string, userId: string) {
    return this.request(`/rooms/${roomId}/kick`, {
      method: 'POST',
      body: JSON.stringify({ 
        room_id: roomId,
        admin_id: adminId, 
        user_id: userId 
      }),
    });
  }

  async getRoomMessages(roomId: string, limit = 50) {
    return this.request(`/rooms/${roomId}/messages?limit=${limit}`);
  }

  async saveRoomMessage(roomId: string, userId: string, message: string) {
    return this.request(`/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, message }),
    });
  }

  // Media
  async uploadMedia(data: any) {
    return this.request('/media', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMedia(userId?: string, mediaType?: string, limit = 20) {
    let url = `/media?limit=${limit}`;
    if (userId) url += `&user_id=${userId}`;
    if (mediaType) url += `&media_type=${mediaType}`;
    return this.request(url);
  }

  async getMediaDetail(mediaId: string) {
    return this.request(`/media/${mediaId}`);
  }

  async likeMedia(mediaId: string, userId: string) {
    return this.request(`/media/${mediaId}/like`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async unlikeMedia(mediaId: string, userId: string) {
    return this.request(`/media/${mediaId}/unlike`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async createMediaComment(mediaId: string, content: string, userId: string) {
    return this.request(`/media/${mediaId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, user_id: userId }),
    });
  }

  async getMediaComments(mediaId: string) {
    return this.request(`/media/${mediaId}/comments`);
  }
}

export default new ApiService();