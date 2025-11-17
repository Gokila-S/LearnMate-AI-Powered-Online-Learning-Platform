import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCourse } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import LessonPlayer from '../components/course/LessonPlayer';
import GroupDiscussion from '../components/course/GroupDiscussion';
import userService from '../services/userService';
import { enrollmentService } from '../services/enrollmentService';
import ChatWidget from '../components/common/ChatWidget';

const CourseDetail = () => {
  const { id } = useParams();
  const { 
    currentCourse, 
    currentEnrollment, 
    loading, 
    error, 
    fetchCourse, 
    fetchEnrollmentDetails, 
    enrollInCourse,
    updateCurrentLesson,
    getLesson,
    createLesson,
    modules
  } = useCourse();
  const { user, isAuthenticated } = useAuth();
  
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [expandedModules, setExpandedModules] = useState(new Set()); // Track expanded modules
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    duration: '',
    order: '',
    isPreview: false,
    video: null,
  youtubeUrl: '',
  moduleId: ''
  });
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // Helper: derive a display number relative to its container (module or ungrouped list)
  const getDisplayNumber = (lesson) => {
    if (!lesson || !currentCourse) return undefined;
    // If lesson is inside a module, number within that module
    if (modules && modules.length) {
      const parent = modules.find(m => m.lessons?.some(l => l._id === lesson._id));
      if (parent) {
        const idx = parent.lessons.findIndex(l => l._id === lesson._id);
        if (idx !== -1) return idx + 1;
      }
    }
    // Otherwise number among ungrouped lessons
    const ungrouped = currentCourse.lessons.filter(l => !modules || !modules.some(m => m.lessons?.some(ml => ml._id === l._id)));
    const idxUngrouped = ungrouped.findIndex(l => l._id === lesson._id);
    return idxUngrouped !== -1 ? idxUngrouped + 1 : undefined;
  };

  // Toggle module expansion
  const toggleModule = (moduleId) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (id) {
      fetchCourse(id);
      if (isAuthenticated) {
        fetchEnrollmentDetails(id).then(() => {
          setIsEnrolled(true);
        }).catch(() => {
          setIsEnrolled(false);
        });
      }
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    const init = async () => {
      if (currentCourse?.lessons?.length) {
        const defaultLesson = currentEnrollment?.progress?.currentLesson
          ? currentCourse.lessons.find(l => l._id === currentEnrollment.progress.currentLesson._id)
          : currentCourse.lessons[0];
        if (defaultLesson) {
          try {
            setLoadingLesson(true);
            const full = await getLesson(currentCourse._id, defaultLesson._id);
            const base = full.success ? full.data : defaultLesson;
            setSelectedLesson({ ...base, displayNumber: getDisplayNumber(defaultLesson) });
          } finally {
            setLoadingLesson(false);
          }
        }
      }
    };
    init();
  }, [currentCourse, currentEnrollment]);

  // Auto-expand first module when modules load
  useEffect(() => {
    if (modules && modules.length > 0 && expandedModules.size === 0) {
      // Use existing array order (no sort) so it reflects admin-configured order
      const firstModule = modules[0];
      if (firstModule) {
        setExpandedModules(new Set([firstModule._id]));
      }
    }
  }, [modules]);

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      alert('Please log in to enroll in courses');
      return;
    }

    setEnrolling(true);
    const result = await enrollInCourse(id);
    
    if (result.success) {
      setIsEnrolled(true);
      await fetchEnrollmentDetails(id);
      alert('Successfully enrolled in course!');
    } else {
      alert(result.error || 'Failed to enroll in course');
    }
    setEnrolling(false);
  };

  const handleLessonSelect = async (lesson) => {
    setLoadingLesson(true);
    try {
      // Always fetch full content to include videoUrl/data
      const full = await getLesson(currentCourse._id, lesson._id);
      const base = full.success ? full.data : lesson;
      setSelectedLesson({ ...base, displayNumber: getDisplayNumber(lesson) });
      if (isEnrolled && currentEnrollment) {
        await updateCurrentLesson(currentEnrollment.course._id, lesson._id);
      }
    } finally {
      setLoadingLesson(false);
    }
  };

  const handleLessonComplete = (lessonId) => {
    // Optionally auto-advance to next lesson
    if (currentCourse && currentCourse.lessons) {
      const currentIndex = currentCourse.lessons.findIndex(l => l._id === lessonId);
      if (currentIndex >= 0 && currentIndex < currentCourse.lessons.length - 1) {
        const nextLesson = currentCourse.lessons[currentIndex + 1];
        setSelectedLesson(nextLesson);
      }
    }
  };

  const handleBookmark = async (lessonId, isBookmarking) => {
    try {
      if (isBookmarking) {
        await userService.addBookmark(lessonId);
      } else {
        await userService.removeBookmark(lessonId);
      }
      return true;
    } catch (error) {
      console.error('Bookmark error:', error);
      return false;
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Weighted progress already stored from backend; fallback compute if absent
  const getProgressPercentage = () => {
    if (!currentEnrollment?.progress) return 0;
    if (typeof currentEnrollment.progress.progressPercentage === 'number') {
      return currentEnrollment.progress.progressPercentage;
    }
    // Fallback: simple ratio
    const total = currentCourse?.lessons?.length || 0;
    const completedUnique = new Set(currentEnrollment.progress.completedLessons?.map(c => c.lesson)).size;
    return total > 0 ? Math.round((completedUnique / total) * 100) : 0;
  };

  // Compute total lessons: prefer modules (sum their lessons) + ungrouped unique lessons
  const allLessonIds = (() => {
    if (!currentCourse?.lessons) return [];
    // Flatten module lessons ids
    const moduleIds = (modules || []).flatMap(m => (m.lessons || []).map(l => l._id));
    const baseIds = currentCourse.lessons.map(l => l._id);
    return Array.from(new Set([...baseIds, ...moduleIds]));
  })();
  const totalLessonsCount = allLessonIds.length;

  const completedCount = (() => {
    if (!currentEnrollment?.progress?.completedLessons) return 0;
    // Each entry might store either the lesson id directly or populated object reference
    const ids = currentEnrollment.progress.completedLessons.map(c => {
      if (typeof c.lesson === 'string') return c.lesson;
      if (c.lesson?._id) return c.lesson._id;
      return null;
    }).filter(Boolean);
    return new Set(ids).size;
  })();

  // Derive accurate total duration from distinct lessons (avoid double counting if modules also reference them)
  const totalDurationMinutes = (() => {
    if (!currentCourse?.lessons) return 0;
    // Map lesson id -> duration
    const map = new Map();
    currentCourse.lessons.forEach(l => {
      map.set(l._id, l.duration || 0);
    });
    // Ensure module lessons included (in case some only appear in modules populate)
    (modules || []).forEach(m => (m.lessons || []).forEach(l => {
      if (!map.has(l._id)) map.set(l._id, l.duration || 0);
    }));
    return Array.from(map.values()).reduce((a,b) => a + b, 0);
  })();

  const handleDownloadCertificate = async () => {
    try {
      const data = await enrollmentService.downloadCertificate(currentCourse._id);
      // data is a Blob (axios with responseType: 'blob')
      if (!(data instanceof Blob)) {
        throw new Error('Unexpected response while generating certificate');
      }
      if (data.type !== 'application/pdf') {
        // Attempt to read text for error message
        const text = await data.text();
        console.error('Certificate error response:', text);
        alert('Certificate generation failed: ' + (text.slice(0,120) || 'Unknown error'));
        return;
      }
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentCourse.title.replace(/[^a-z0-9-_ ]/gi,'')}-certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
    } catch (e) {
      alert('Failed to download certificate');
      console.error(e);
    }
  };

  const isLessonCompleted = (lessonId) => {
    return currentEnrollment?.progress?.completedLessons?.some(cl => cl.lesson === lessonId) || false;
  };

  const handleLessonFormChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') {
      setLessonForm(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'file') {
      setLessonForm(prev => ({ ...prev, video: files[0] }));
    } else {
      setLessonForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    if (!lessonForm.title || !lessonForm.description) return;
    const formData = new FormData();
    formData.append('title', lessonForm.title);
    formData.append('description', lessonForm.description);
    if (lessonForm.duration) formData.append('duration', lessonForm.duration);
    if (lessonForm.order) formData.append('order', lessonForm.order);
    formData.append('isPreview', lessonForm.isPreview);
    if (lessonForm.video) formData.append('video', lessonForm.video);
    if (lessonForm.youtubeUrl) formData.append('youtubeUrl', lessonForm.youtubeUrl);
    setCreatingLesson(true);
    const result = await createLesson(currentCourse._id, formData);
    setCreatingLesson(false);
    if (result.success) {
      // reset form
  setLessonForm({ title: '', description: '', duration: '', order: '', isPreview: false, video: null, youtubeUrl: '', moduleId: '' });
      setShowLessonForm(false);
    } else {
      alert('Failed to create lesson');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading course..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Course</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <a
            href="/courses"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Back to Courses
          </a>
        </div>
      </div>
    );
  }

  if (!currentCourse) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Course Not Found</h2>
          <a
            href="/courses"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Back to Courses
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Course Sidebar - Now smaller */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border sticky top-8 overflow-hidden">
              {/* Progress Bar (if enrolled) */}
              {isEnrolled && (
                <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex justify-between items-center text-sm text-gray-700 mb-3">
                    <span className="font-semibold">Your Progress</span>
                    <span className="font-bold text-blue-600 bg-white px-3 py-1 rounded-full shadow-sm">{getProgressPercentage()}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${getProgressPercentage()}%` }}
                    ></div>
                  </div>
                  <div className="mt-3 text-xs text-gray-600">
                    {completedCount} of {totalLessonsCount} lessons completed
                  </div>
                  {getProgressPercentage() === 100 && (
                    <button onClick={handleDownloadCertificate} className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm font-semibold shadow">
                      Download Certificate
                    </button>
                  )}
                </div>
              )}

              {/* Enroll Button */}
              {!isEnrolled && (
                <div className="p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-4 rounded-xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    {enrolling ? (
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Enrolling...</span>
                      </div>
                    ) : (
                      <span>Enroll Now - {currentCourse.price === 0 ? 'Free' : `$${currentCourse.price}`}</span>
                    )}
                  </button>
                </div>
              )}

                {/* Modules & Lessons List */}
                <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white shadow-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <span>Course Content</span>
                  </h3>
                  <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                    {totalLessonsCount} lessons • {formatDuration(totalDurationMinutes)}
                  </div>
                </div>
                {user && ['course_admin','website_admin'].includes(user.role) && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowLessonForm(s => !s)}
                      className="w-full mb-2 flex items-center justify-center space-x-2 text-sm px-3 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      <span>{showLessonForm ? 'Hide Lesson Form' : 'Add New Lesson'}</span>
                    </button>
                    {showLessonForm && (
                      <form onSubmit={handleCreateLesson} className="space-y-3 border p-3 rounded-lg text-sm">
                        <input
                          type="text"
                          name="title"
                          placeholder="Title"
                          value={lessonForm.title}
                          onChange={handleLessonFormChange}
                          className="w-full border rounded px-2 py-1"
                          required
                        />
                        <textarea
                          name="description"
                          placeholder="Description"
                          value={lessonForm.description}
                          onChange={handleLessonFormChange}
                          className="w-full border rounded px-2 py-1"
                          rows="2"
                          required
                        />
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            name="duration"
                            placeholder="Duration (min)"
                            value={lessonForm.duration}
                            onChange={handleLessonFormChange}
                            className="w-1/2 border rounded px-2 py-1"
                            min="0"
                          />
                          <input
                            type="number"
                            name="order"
                            placeholder="Order"
                            value={lessonForm.order}
                            onChange={handleLessonFormChange}
                            className="w-1/2 border rounded px-2 py-1"
                            min="1"
                          />
                        </div>
                        {modules && modules.length > 0 && (
                          <select
                            name="moduleId"
                            value={lessonForm.moduleId}
                            onChange={handleLessonFormChange}
                            className="w-full border rounded px-2 py-1"
                          >
                            <option value="">-- No Module (course-level) --</option>
                            {modules.map(m => (
                              <option key={m._id} value={m._id}>{m.order}. {m.title}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="isPreview"
                            name="isPreview"
                            checked={lessonForm.isPreview}
                            onChange={handleLessonFormChange}
                          />
                          <label htmlFor="isPreview">Free Preview</label>
                        </div>
                        <input
                          type="file"
                          name="video"
                          accept="video/mp4,video/webm,video/ogg,video/quicktime"
                          onChange={handleLessonFormChange}
                          className="w-full text-xs"
                        />
                        <input
                          type="url"
                          name="youtubeUrl"
                          placeholder="YouTube URL (alternative to video file)"
                          value={lessonForm.youtubeUrl || ''}
                          onChange={handleLessonFormChange}
                          className="w-full border rounded px-2 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          disabled={creatingLesson}
                          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {creatingLesson ? 'Uploading...' : 'Create Lesson'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                  {/* Modules first */}
                  {modules && modules.length > 0 && modules.map(mod => {
                    const isExpanded = expandedModules.has(mod._id);
                    return (
                    <div key={mod._id} className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                      <button
                        onClick={() => toggleModule(mod._id)}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 hover:from-blue-100 hover:to-indigo-100 transition-colors duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <h4 className="text-base font-bold text-gray-900">Module {mod.order}: {mod.title}</h4>
                              <p className="text-xs text-gray-600 mt-1 flex items-center space-x-2">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                                <span>{mod.totalLessons} lessons</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
      
                            <svg 
                              className={`w-4 h-4 text-gray-600 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </button>
                      
                      {/* Collapsible content */}
                      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="p-4 space-y-3">
                          {mod.lessons && mod.lessons.length > 0 ? mod.lessons.map((lesson, idx) => {
                          // Determine lesson type and styling
                          const lessonType = lesson.content?.type || 'text';
                          const isSelected = selectedLesson?._id === lesson._id;
                          const isCompleted = isLessonCompleted(lesson._id);
                          
                          const getTypeConfig = (type) => {
                            switch(type) {
                              case 'video':
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                      <path fillRule="evenodd" d="M9 9l3-2v6l-3-2V9z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-blue-600', 
                                  bg: 'bg-blue-50',
                                  label: 'Video'
                                };
                              case 'youtube':
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.5-2.5a1 1 0 011.555-.832l3 2a1 1 0 010 1.664l-3 2A1 1 0 018.5 11.5v-4z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-red-600', 
                                  bg: 'bg-red-50',
                                  label: 'YouTube'
                                };
                              case 'quiz':
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-amber-600', 
                                  bg: 'bg-amber-50',
                                  label: 'Quiz'
                                };
                              case 'assessment':
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM6 7a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-purple-600', 
                                  bg: 'bg-purple-50',
                                  label: 'Assessment'
                                };
                              default:
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-gray-600', 
                                  bg: 'bg-gray-50',
                                  label: 'Text'
                                };
                            }
                          };
                          
                          const typeConfig = getTypeConfig(lessonType);
                          
                          return (
                            <button
                              key={lesson._id}
                              onClick={() => handleLessonSelect(lesson)}
                              className={`w-full text-left p-3 rounded-lg border transition-all duration-200 group ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-200 shadow-md transform scale-[1.02]' 
                                  : 'hover:bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full min-w-0 shrink-0" title="Position within this module">
                                      {idx + 1}
                                    </span>
                                    <div className={`flex items-center justify-center w-6 h-6 rounded ${typeConfig.bg} shrink-0`}>
                                      <div className={typeConfig.color}>
                                        {typeConfig.icon}
                                      </div>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900 truncate">
                                      {lesson.title}
                                    </span>
                                    {isCompleted && (
                                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                                    <div className="flex items-center space-x-1">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                      </svg>
                                      <span>{lesson.duration || 0} min</span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}>
                                      {typeConfig.label}
                                    </span>
                                    {lesson.isPreview && (
                                      <span className="text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded-full">
                                        Free
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        }) : (
                          <p className="text-sm text-gray-500 px-3 py-8 text-center italic">No lessons in this module yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                  })}
                  {/* Ungrouped lessons (those not in a module) */}
                  {currentCourse.lessons && currentCourse.lessons.filter(l => !modules || !modules.some(m => m.lessons?.some(ml => ml._id === l._id))).length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <h4 className="text-sm font-bold text-gray-900">Individual Lessons</h4>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {currentCourse.lessons.filter(l => !modules || !modules.some(m => m.lessons?.some(ml => ml._id === l._id))).map((lesson, uIdx) => {
                          // Same lesson type logic as above
                          const lessonType = lesson.content?.type || 'text';
                          const isSelected = selectedLesson?._id === lesson._id;
                          const isCompleted = isLessonCompleted(lesson._id);
                          
                          const getTypeConfig = (type) => {
                            switch(type) {
                              case 'video':
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                      <path fillRule="evenodd" d="M9 9l3-2v6l-3-2V9z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-blue-600', 
                                  bg: 'bg-blue-50',
                                  label: 'Video'
                                };
                              case 'youtube':
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.5-2.5a1 1 0 011.555-.832l3 2a1 1 0 010 1.664l-3 2A1 1 0 018.5 11.5v-4z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-red-600', 
                                  bg: 'bg-red-50',
                                  label: 'YouTube'
                                };
                              case 'quiz':
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-amber-600', 
                                  bg: 'bg-amber-50',
                                  label: 'Quiz'
                                };
                              case 'assessment':
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM6 7a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-purple-600', 
                                  bg: 'bg-purple-50',
                                  label: 'Assessment'
                                };
                              default:
                                return { 
                                  icon: (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                  ), 
                                  color: 'text-gray-600', 
                                  bg: 'bg-gray-50',
                                  label: 'Text'
                                };
                            }
                          };
                          
                          const typeConfig = getTypeConfig(lessonType);
                          
                          return (
                            <button
                              key={lesson._id}
                              onClick={() => handleLessonSelect(lesson)}
                              className={`w-full text-left p-3 rounded-lg border transition-all duration-200 group ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-200 shadow-md transform scale-[1.02]' 
                                  : 'hover:bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full min-w-0 shrink-0" title="Position in list">{uIdx + 1}</span>
                                    <div className={`flex items-center justify-center w-6 h-6 rounded ${typeConfig.bg} shrink-0`}>
                                      <div className={typeConfig.color}>
                                        {typeConfig.icon}
                                      </div>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900 truncate">
                                      {lesson.title}
                                    </span>
                                    {isCompleted && (
                                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                                    <div className="flex items-center space-x-1">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                      </svg>
                                      <span>{lesson.duration || 0} min</span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}>
                                      {typeConfig.label}
                                    </span>
                                    {lesson.isPreview && (
                                      <span className="text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded-full">
                                        Free
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Now wider */}
          <div className="lg:col-span-3">
            {loadingLesson && (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center mb-4">
                <p className="text-gray-600">Loading lesson...</p>
              </div>
            )}
            {selectedLesson ? (
              <LessonPlayer
                lesson={selectedLesson}
                enrollment={currentEnrollment}
                onLessonComplete={handleLessonComplete}
                onBookmark={handleBookmark}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{currentCourse.title}</h2>
                {/* Course description removed per requirements */}
                
                {/* Instructor Info */}
                <div className="flex items-center justify-center space-x-4 mb-6">
                  <img
                    src={currentCourse.instructor?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100'}
                    alt={currentCourse.instructor?.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{currentCourse.instructor?.name}</p>
                    <p className="text-sm text-gray-600">{currentCourse.instructor?.bio}</p>
                  </div>
                </div>

                <p className="text-gray-500">Select a lesson from the sidebar to start learning</p>
              </div>
            )}
          </div>
        </div>

        {/* Group Discussion Section */}
        <div className="mt-8">
          <GroupDiscussion 
            courseId={id} 
            isEnrolled={isEnrolled} 
          />
        </div>
      </div>
      {isAuthenticated && (
        <ChatWidget 
          user={user}
          courseTitle={currentCourse?.title}
          lessonTitle={selectedLesson?.title}
        />
      )}
    </div>
  );
};

export default CourseDetail;
// Chat widget is appended after export so we keep existing export default. Below we augment rendering by adding the widget inside the JSX above.
