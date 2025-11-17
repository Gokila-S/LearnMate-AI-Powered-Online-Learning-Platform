import React, { useEffect, useState } from 'react';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import CourseCard from '../components/course/CourseCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import userService from '../services/userService';

const Dashboard = () => {
  const { enrollments, loading, error, fetchEnrollments, clearError, unenrollCourse } = useCourse();
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);
  const [activeTab, setActiveTab] = useState('courses');

  useEffect(() => {
    fetchEnrollments();
    fetchBookmarks();
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const fetchBookmarks = async () => {
    try {
      const response = await userService.getUserBookmarks();
      setBookmarks(response.data || []);
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getInProgressCourses = () => {
    if (!Array.isArray(enrollments)) return [];
    return enrollments.filter(enrollment => {
      if (!enrollment || !enrollment.progress) return false;
      return !enrollment.isCompleted && (enrollment.progress.progressPercentage || 0) > 0;
    });
  };

  const getCompletedCourses = () => {
    if (!Array.isArray(enrollments)) return [];
    return enrollments.filter(enrollment => enrollment && enrollment.isCompleted);
  };

  const getNotStartedCourses = () => {
    if (!Array.isArray(enrollments)) return [];
    return enrollments.filter(enrollment => {
      if (!enrollment || !enrollment.progress) return false;
      return (enrollment.progress.progressPercentage || 0) === 0 && !enrollment.isCompleted;
    });
  };

  const handleDrop = async (courseId) => {
    if (!window.confirm('Are you sure you want to drop this course? Your progress will be lost.')) return;
    const res = await unenrollCourse(courseId);
    if (!res.success) {
      alert(res.message || 'Failed to drop course');
    }
  };

  const formatLastAccessed = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  if (loading && (!enrollments || !Array.isArray(enrollments))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your dashboard..." />
      </div>
    );
  }

  // Guard if user not yet resolved (auth still initializing)
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your profile..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {getGreeting()}, {user?.name}! 👋
          </h1>
          <p className="text-gray-600 mt-2">
            Welcome back to your learning dashboard. Continue your journey!
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Courses</p>
                <p className="text-2xl font-semibold text-gray-900">{enrollments?.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">In Progress</p>
                <p className="text-2xl font-semibold text-gray-900">{getInProgressCourses().length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">{getCompletedCourses().length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Bookmarks</p>
                <p className="text-2xl font-semibold text-gray-900">{bookmarks.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('courses')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'courses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Courses
            </button>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bookmarks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Bookmarks
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'courses' && (
          <div>
            {enrollments && enrollments.length > 0 ? (
              <div className="space-y-8">
                {/* Continue Learning Section */}
                {getInProgressCourses().length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Continue Learning</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {getInProgressCourses().map((enrollment, idx) => {
                        if (!enrollment || !enrollment.course) return null;
                        const courseId = enrollment.course._id || `inprog-${idx}`;
                        const progressPct = enrollment.progress?.progressPercentage ?? 0;
                        return (
                        <div key={enrollment._id || courseId} className="relative">
                          <CourseCard course={enrollment.course} showEnrollButton={false} />
                          <div className="absolute top-4 right-4 bg-white rounded-full px-3 py-1 text-sm font-medium text-blue-600 shadow-sm">
                            {progressPct}%
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                              Last accessed: {enrollment.lastAccessedAt ? formatLastAccessed(enrollment.lastAccessedAt) : 'N/A'}
                            </p>
                            <div className="flex space-x-2">
                              <a
                                href={`/courses/${courseId}`}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                              >
                                Continue
                              </a>
                              <button
                                onClick={() => handleDrop(courseId)}
                                className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 text-sm font-medium border border-red-200"
                              >
                                Drop
                              </button>
                            </div>
                          </div>
                        </div>
                      );})}
                    </div>
                  </section>
                )}

                {/* Not Started Section */}
                {getNotStartedCourses().length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Start</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {getNotStartedCourses().map((enrollment, idx) => {
                        if (!enrollment || !enrollment.course) return null;
                        const courseId = enrollment.course._id || `notstarted-${idx}`;
                        return (
                        <div key={enrollment._id || courseId}>
                          <CourseCard course={enrollment.course} showEnrollButton={false} />
                          <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                              Enrolled: {enrollment.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleDateString() : '—'}
                            </p>
                            <div className="flex space-x-2">
                              <a
                                href={`/courses/${courseId}`}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                              >
                                Start Learning
                              </a>
                              <button
                                onClick={() => handleDrop(courseId)}
                                className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 text-sm font-medium border border-red-200"
                              >
                                Drop
                              </button>
                            </div>
                          </div>
                        </div>
                      );})}
                    </div>
                  </section>
                )}

                {/* Completed Section */}
                {getCompletedCourses().length > 0 && (
                  <section>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Completed Courses</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {getCompletedCourses().map((enrollment, idx) => {
                        if (!enrollment || !enrollment.course) return null;
                        const courseId = enrollment.course._id || `completed-${idx}`;
                        return (
                        <div key={enrollment._id || courseId} className="relative">
                          <CourseCard course={enrollment.course} showEnrollButton={false} />
                          <div className="absolute top-4 right-4 bg-green-100 rounded-full px-3 py-1 text-sm font-medium text-green-800 shadow-sm">
                            Completed ✓
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                              Completed: {enrollment.completedAt ? new Date(enrollment.completedAt).toLocaleDateString() : '—'}
                            </p>
                            <div className="flex space-x-2">
                              <a
                                href={`/courses/${courseId}`}
                                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium"
                              >
                                Review
                              </a>
                              <button
                                onClick={() => handleDrop(courseId)}
                                className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 text-sm font-medium border border-red-200"
                              >
                                Drop
                              </button>
                            </div>
                          </div>
                        </div>
                      );})}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-24 w-24 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No enrolled courses yet</h3>
                <p className="mt-2 text-gray-500">Start your learning journey by exploring our courses.</p>
                <a
                  href="/courses"
                  className="mt-4 inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Browse Courses
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div>
            {bookmarks && bookmarks.length > 0 ? (
              <div className="grid gap-4">
                {bookmarks.map((lesson) => (
                  <div key={lesson._id} className="bg-white rounded-lg p-6 shadow-sm border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {lesson.title}
                        </h3>
                        {/* Description removed per requirements */}
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Course: {lesson.course?.title}</span>
                          <span>•</span>
                          <span>Duration: {lesson.duration || 0} minutes</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <a
                          href={`/courses/${lesson.course?._id}`}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          Watch Lesson
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-24 w-24 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No bookmarks yet</h3>
                <p className="mt-2 text-gray-500">
                  Bookmark lessons while learning to save them for later review.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
