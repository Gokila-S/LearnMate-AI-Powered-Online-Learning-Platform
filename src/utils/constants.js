// API Configuration
export const API_BASE_URL = 'http://localhost:5000/api';

// Course Categories
export const COURSE_CATEGORIES = [
  'Programming',
  'Design',
  'Business',
  'Marketing',
  'Data Science',
  'Mobile Development',
  'Web Development',
  'DevOps',
  'AI/ML',
  'Other'
];

// Course Levels
export const COURSE_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced'
];

// Content Types
export const CONTENT_TYPES = {
  VIDEO: 'video',
  TEXT: 'text',
  QUIZ: 'quiz',
  ASSIGNMENT: 'assignment'
};

// User Roles
export const USER_ROLES = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
  ADMIN: 'admin'
};

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  THEME: 'theme'
};

// Pagination
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

// File Upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// Course Progress
export const PROGRESS_STATUS = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  COMPLETED: 100
};

// Time Formats
export const TIME_FORMATS = {
  SHORT_DATE: 'MMM dd, yyyy',
  LONG_DATE: 'MMMM dd, yyyy',
  DATE_TIME: 'MMM dd, yyyy HH:mm',
  TIME_AGO: 'relative'
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  ENROLLMENT_SUCCESS: 'Successfully enrolled in the course!',
  LESSON_COMPLETED: 'Lesson marked as completed!',
  BOOKMARK_ADDED: 'Lesson bookmarked successfully!',
  BOOKMARK_REMOVED: 'Bookmark removed successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!'
};

// Animation Durations (in milliseconds)
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
};

// Breakpoints (matching Tailwind CSS)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536
};
