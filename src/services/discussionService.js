import api from './api.js';

export const discussionService = {
  // Get course discussions
  getCourseDiscussions: async (courseId, params = {}) => {
    const searchParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] && params[key] !== 'all') {
        searchParams.append(key, params[key]);
      }
    });

    const response = await api.get(`/courses/${courseId}/discussions?${searchParams.toString()}`);
    return response.data;
  },

  // Create new discussion
  createDiscussion: async (courseId, discussionData) => {
    const response = await api.post(`/courses/${courseId}/discussions`, discussionData);
    return response.data;
  },

  // Get single discussion with messages
  getDiscussion: async (courseId, discussionId, params = {}) => {
    const searchParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key]) {
        searchParams.append(key, params[key]);
      }
    });

    const response = await api.get(`/courses/${courseId}/discussions/${discussionId}?${searchParams.toString()}`);
    return response.data;
  },

  // Vote on discussion
  voteOnDiscussion: async (discussionId, voteType) => {
    const response = await api.post(`/courses/discussions/${discussionId}/vote`, {
      type: voteType // 'up', 'down', or 'remove'
    });
    return response.data;
  },

  // Create message in discussion
  createMessage: async (discussionId, messageData) => {
    const response = await api.post(`/courses/discussions/${discussionId}/messages`, messageData);
    return response.data;
  },

  // Vote on message
  voteOnMessage: async (messageId, voteType) => {
    const response = await api.post(`/courses/messages/${messageId}/vote`, {
      type: voteType // 'up', 'down', or 'remove'
    });
    return response.data;
  },

  // Mark message as best answer
  markBestAnswer: async (messageId) => {
    const response = await api.post(`/courses/messages/${messageId}/best-answer`);
    return response.data;
  },

  // Get online users
  getOnlineUsers: async (courseId) => {
    const response = await api.get(`/courses/${courseId}/online-users`);
    return response.data;
  },

  // Real-time message polling (fallback for real-time updates)
  pollDiscussionUpdates: async (courseId, discussionId, lastFetched) => {
    const response = await api.get(
      `/courses/${courseId}/discussions/${discussionId}?since=${lastFetched}&poll=true`
    );
    return response.data;
  },

  // Moderation endpoints
  moderateDiscussion: async (discussionId, moderationData) => {
    const response = await api.post(`/courses/discussions/${discussionId}/moderate`, moderationData);
    return response.data;
  },

  deleteDiscussion: async (discussionId) => {
    const response = await api.delete(`/courses/discussions/${discussionId}`);
    return response.data;
  },

  deleteMessage: async (messageId) => {
    const response = await api.delete(`/courses/messages/${messageId}`);
    return response.data;
  },

  editMessage: async (messageId, content) => {
    const response = await api.put(`/courses/messages/${messageId}`, { content });
    return response.data;
  }
};

export default discussionService;