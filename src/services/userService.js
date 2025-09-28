import api from './api.js';

export const userService = {
  // Get user profile
  getUserProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  // Update user profile
  updateUserProfile: async (profileData) => {
    const response = await api.put('/users/profile', profileData);
    return response.data;
  },

  // Add bookmark
  addBookmark: async (lessonId) => {
    const response = await api.post(`/users/bookmarks/${lessonId}`);
    return response.data;
  },

  // Remove bookmark
  removeBookmark: async (lessonId) => {
    const response = await api.delete(`/users/bookmarks/${lessonId}`);
    return response.data;
  },

  // Get user bookmarks
  getUserBookmarks: async () => {
    const response = await api.get('/users/bookmarks');
    return response.data;
  }
};

export default userService;
