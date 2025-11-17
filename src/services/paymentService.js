import api from './api.js';

const paymentService = {
  createOrder: async (courseId) => {
    // Prevent call if token missing to avoid interceptor redirect flicker
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Not authenticated', unauthorized: true };
    }
    try {
      console.log('[PAYMENT][client] createOrder start courseId', courseId, 'tokenPresent', !!token);
      const res = await api.post('/payments/order', { courseId });
  console.log('[PAYMENT][client] createOrder response', res.status, res.data);
      return res.data; // { success, data: { orderId, amount, currency, key, courseId }}
    } catch (err) {
      if (err.response?.status === 401) {
        return { success: false, message: err.response?.data?.message || 'Unauthorized', unauthorized: true, suppressed: err.suppressedAuthRedirect };
      }
      return { success: false, message: err.response?.data?.message || 'Order creation failed', raw: err.response?.data };
    }
  },
  verify: async (payload) => {
    try {
      const res = await api.post('/payments/verify', payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 401) {
        return { success: false, message: 'Session expired. Please log in again.', unauthorized: true };
      }
      return { success: false, message: err.response?.data?.message || 'Verification failed' };
    }
  }
};

export default paymentService;
