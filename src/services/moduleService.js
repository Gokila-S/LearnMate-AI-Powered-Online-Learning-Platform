import api from './api.js';

// Service for course modules CRUD
const moduleService = {
  getModules: async (courseId) => {
    const res = await api.get(`/modules/${courseId}`);
    return res.data; // { success, data: [...] }
  },
  createModule: async (courseId, payload) => {
    const res = await api.post(`/modules/${courseId}`, payload);
    return res.data; // { success, data }
  },
  updateModule: async (moduleId, payload) => {
    const res = await api.put(`/modules/${moduleId}`, payload);
    return res.data;
  },
  deleteModule: async (moduleId) => {
    const res = await api.delete(`/modules/${moduleId}`);
    return res.data; // { success }
  },
  reorderModules: async (courseId, orderedIds) => {
    const res = await api.put(`/modules/${courseId}/reorder`, { orderedIds });
    return res.data;
  },
  reorderModuleLessons: async (moduleId, orderedIds) => {
    console.log('[frontend] reorderModuleLessons request', { moduleId, orderedIds });
    const res = await api.put(`/modules/module/${moduleId}/reorder`, { orderedIds });
    console.log('[frontend] reorderModuleLessons response', res.data);
    return res.data;
  }
};

export default moduleService;
