import api from './api.js';

export const courseService = {
  // Get all courses with filters
  getCourses: async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== 'all') {
        params.append(key, filters[key]);
      }
    });

    const response = await api.get(`/courses?${params.toString()}`);
    return response.data;
  },

  // Get single course by ID
  getCourse: async (courseId) => {
    const response = await api.get(`/courses/${courseId}`);
    return response.data;
  },

  // Get course categories
  getCategories: async () => {
    const response = await api.get('/courses/categories');
    return response.data;
  },

  // Search courses
  searchCourses: async (searchTerm, filters = {}) => {
    const params = new URLSearchParams({
      search: searchTerm,
      ...filters
    });

    const response = await api.get(`/courses?${params.toString()}`);
    return response.data;
  },

  // Create lesson with optional video upload
  createLesson: async (courseId, formData) => {
    const response = await api.post(`/courses/${courseId}/lessons`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Get full lesson
  getLesson: async (courseId, lessonId) => {
    const response = await api.get(`/courses/${courseId}/lessons/${lessonId}`);
    return response.data;
  }
};

export default courseService;
