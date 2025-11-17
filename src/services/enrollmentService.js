import api from './api.js';

export const enrollmentService = {
  // Enroll in a course
  enrollInCourse: async (courseId) => {
    const response = await api.post(`/enrollments/${courseId}`);
    return response.data;
  },

  // Get user enrollments
  getUserEnrollments: async () => {
    const response = await api.get('/enrollments');
    return response.data;
  },

  // Get enrollment details for a specific course
  getEnrollmentDetails: async (courseId) => {
    const response = await api.get(`/enrollments/${courseId}`);
    return response.data;
  },

  // Mark lesson as complete
  markLessonComplete: async (courseId, lessonId) => {
    const response = await api.put(`/enrollments/${courseId}/lessons/${lessonId}/complete`);
    return response.data;
  },

  // Update current lesson
  updateCurrentLesson: async (courseId, lessonId) => {
    const response = await api.put(`/enrollments/${courseId}/current-lesson/${lessonId}`);
    return response.data;
  },
  // Update lesson watch progress (video / youtube)
  updateLessonProgress: async (courseId, lessonId, payload) => {
    const response = await api.put(`/enrollments/${courseId}/lessons/${lessonId}/progress`, payload);
    return response.data;
  },
  // Download completion certificate (returns blob)
  downloadCertificate: async (courseId) => {
    const response = await api.get(`/enrollments/${courseId}/certificate`, { responseType: 'blob' });
    return response.data;
  },
  // Unenroll from a course
  unenrollCourse: async (courseId) => {
    const response = await api.delete(`/enrollments/${courseId}`);
    return response.data;
  }
};

export default enrollmentService;
