import React, { createContext, useContext, useReducer, useEffect } from 'react';
import courseService from '../services/courseService.js';
import moduleService from '../services/moduleService.js';
import enrollmentService from '../services/enrollmentService.js';

const CourseContext = createContext();

// Course reducer
const courseReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    case 'SET_COURSES':
      return {
        ...state,
        courses: action.payload.data,
        totalCourses: action.payload.total,
        currentPage: action.payload.currentPage,
        totalPages: action.payload.totalPages,
        loading: false,
        error: null
      };
    case 'SET_CURRENT_COURSE':
      return {
        ...state,
        currentCourse: action.payload,
        loading: false,
        error: null
      };
    case 'SET_MODULES':
      return {
        ...state,
        modules: action.payload,
        loading: false,
        error: null
      };
    case 'SET_CATEGORIES':
      return {
        ...state,
        categories: action.payload,
        loading: false,
        error: null
      };
    case 'SET_ENROLLMENTS':
      return {
        ...state,
        enrollments: action.payload,
        loading: false,
        error: null
      };
    case 'SET_CURRENT_ENROLLMENT':
      return {
        ...state,
        currentEnrollment: action.payload,
        loading: false,
        error: null
      };
    case 'UPDATE_ENROLLMENT_PROGRESS':
      return {
        ...state,
        currentEnrollment: {
          ...state.currentEnrollment,
          progress: { ...state.currentEnrollment.progress, ...action.payload }
        }
      };
    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      };
    default:
      return state;
  }
};

// Initial state
const initialState = {
  courses: [],
  currentCourse: null,
  modules: [],
  categories: [],
  enrollments: [],
  currentEnrollment: null,
  totalCourses: 0,
  currentPage: 1,
  totalPages: 1,
  loading: false,
  error: null,
  filters: {
    category: 'all',
    level: 'all',
    search: '',
    sort: 'createdAt'
  }
};

// CourseProvider component
export const CourseProvider = ({ children }) => {
  const [state, dispatch] = useReducer(courseReducer, initialState);

  // Fetch courses
  const fetchCourses = async (filters = {}) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await courseService.getCourses({ ...state.filters, ...filters });
      dispatch({ type: 'SET_COURSES', payload: response });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to fetch courses' });
    }
  };

  // Fetch single course
  const fetchCourse = async (courseId) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await courseService.getCourse(courseId);
      dispatch({ type: 'SET_CURRENT_COURSE', payload: response.data });
      // Load modules separately (may include lessons summary)
      try {
        const modRes = await moduleService.getModules(courseId);
        if (modRes.success) dispatch({ type: 'SET_MODULES', payload: modRes.data });
      } catch (e) { /* silent */ }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to fetch course' });
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await courseService.getCategories();
      dispatch({ type: 'SET_CATEGORIES', payload: response.data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to fetch categories' });
    }
  };

  // Search courses
  const searchCourses = async (searchTerm, filters = {}) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await courseService.searchCourses(searchTerm, filters);
      dispatch({ type: 'SET_COURSES', payload: response });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to search courses' });
    }
  };

  // Enroll in course
  const enrollInCourse = async (courseId) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await enrollmentService.enrollInCourse(courseId);
      dispatch({ type: 'SET_LOADING', payload: false });
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to enroll in course' });
      return { success: false, error: error.response?.data?.message };
    }
  };

  // Fetch user enrollments
  const fetchEnrollments = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await enrollmentService.getUserEnrollments();
      dispatch({ type: 'SET_ENROLLMENTS', payload: response.data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to fetch enrollments' });
    }
  };

  // Fetch enrollment details
  const fetchEnrollmentDetails = async (courseId) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await enrollmentService.getEnrollmentDetails(courseId);
      dispatch({ type: 'SET_CURRENT_ENROLLMENT', payload: response.data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to fetch enrollment details' });
    }
  };

  // Mark lesson complete
  const markLessonComplete = async (courseId, lessonId) => {
    try {
      const response = await enrollmentService.markLessonComplete(courseId, lessonId);
      dispatch({ type: 'UPDATE_ENROLLMENT_PROGRESS', payload: response.data });
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to mark lesson complete' });
      return { success: false };
    }
  };

  // Update current lesson
  const updateCurrentLesson = async (courseId, lessonId) => {
    try {
      const response = await enrollmentService.updateCurrentLesson(courseId, lessonId);
      dispatch({ type: 'UPDATE_ENROLLMENT_PROGRESS', payload: response.data });
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to update current lesson' });
      return { success: false };
    }
  };

  // Unenroll (drop) from course
  const unenrollCourse = async (courseId) => {
    try {
      const res = await enrollmentService.unenrollCourse(courseId);
      // Refresh enrollments list
      await fetchEnrollments();
      return res;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to unenroll' });
      return { success:false };
    }
  };

  // Update filters
  const updateFilters = (newFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: newFilters });
  };

  // Create lesson (admin/instructor)
  const createLesson = async (courseId, data) => {
    try {
      const response = await courseService.createLesson(courseId, data);
      // Refresh course to include new lesson summary
      await fetchCourse(courseId);
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to create lesson' });
      return { success: false };
    }
  };

  // Get full lesson content (used when switching/selecting lessons)
  const getLesson = async (courseId, lessonId) => {
    try {
      const response = await courseService.getLesson(courseId, lessonId);
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Failed to load lesson' });
      return { success: false };
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  useEffect(() => {
    // Preload enrollments if logged in (token present)
    if (localStorage.getItem('token')) {
      fetchEnrollments();
    }
  }, []);

  const value = {
    ...state,
    fetchCourses,
    fetchCourse,
    // Expose modules array from state
    fetchCategories,
    searchCourses,
    enrollInCourse,
    fetchEnrollments,
    fetchEnrollmentDetails,
    markLessonComplete,
    updateCurrentLesson,
  unenrollCourse,
    updateFilters,
    createLesson,
    getLesson,
    clearError
  };

  return (
    <CourseContext.Provider value={value}>
      {children}
    </CourseContext.Provider>
  );
};

// Custom hook to use course context
export const useCourse = () => {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
};

export default CourseContext;
