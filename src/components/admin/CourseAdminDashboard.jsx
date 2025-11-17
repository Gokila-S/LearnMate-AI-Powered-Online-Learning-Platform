import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCourse } from '../../context/CourseContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../common/LoadingSpinner';
import api from '../../services/api';
import moduleService from '../../services/moduleService';

const CourseAdminDashboard = () => {
  const { user } = useAuth();
  const { createLesson } = useCourse();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('courses');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({
    title: '',
    shortDescription: '',
    category: '',
    level: 'beginner',
    price: 0,
    thumbnail: '',
    isPublished: false
  });
  // Module management state (only when editing existing course)
  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [showAddModule, setShowAddModule] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: '', order: '' });
  const [creatingModule, setCreatingModule] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [moduleEditValues, setModuleEditValues] = useState({ title: '', order: '' });
  const [editingCourseLoading, setEditingCourseLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'course_admin' || user?.role === 'website_admin') {
      fetchCourseManagement();
    }
  }, [user]);

  const fetchCourseManagement = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/courses-management');
      setCourses(response.data.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCourseForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmitCourse = async (e) => {
    e.preventDefault();
    try {
      // Normalize values to match backend enums
      const levelMap = {
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced'
      };
      const allowedCategories = [
        'Programming', 'Design', 'Business', 'Marketing', 'Data Science',
        'Mobile Development', 'Web Development', 'DevOps', 'AI/ML', 'Other'
      ];
      const normalizedLevel = levelMap[String(courseForm.level).toLowerCase()] || courseForm.level;
      const normalizedCategory =
        allowedCategories.find(c => c.toLowerCase() === String(courseForm.category).toLowerCase()) || courseForm.category;

      const payload = { ...courseForm, level: normalizedLevel, category: normalizedCategory };

      if (editingCourse) {
        await api.put(`/courses/${editingCourse._id}`, payload);
      } else {
        await api.post('/courses', payload);
      }
      setShowCourseForm(false);
      setEditingCourse(null);
      setCourseForm({
        title: '',
        shortDescription: '',
        category: '',
        level: 'beginner',
        price: 0,
        thumbnail: '',
        isPublished: false
      });
      fetchCourseManagement();
    } catch (error) {
      console.error('Error saving course:', error);
      const msg = error?.response?.data?.message || error?.message || 'Save failed';
      window.alert(`Could not save course: ${msg}`);
    }
  };

  const handleEditCourse = async (course) => {
    setEditingCourse(course);
    setShowCourseForm(true);
    setEditingCourseLoading(true);
    try {
      // Fetch full course details to avoid missing fields from admin projection
      const res = await api.get(`/courses/${course._id}`);
      const full = res.data?.data || res.data || {};
      setCourseForm({
        title: full.title || course.title || '',
        shortDescription: full.shortDescription || course.shortDescription || '',
        category: full.category || course.category || '',
        level: (full.level || course.level || 'beginner').toString().toLowerCase(),
        price: full.price ?? course.price ?? 0,
        thumbnail: full.thumbnail || course.thumbnail || '',
        isPublished: !!(full.isPublished ?? course.isPublished)
      });
    } catch (error) {
      console.error('Error loading course details:', error);
      setCourseForm({
        title: course.title || '',
        shortDescription: course.shortDescription || '',
        category: course.category || '',
        level: course.level || 'beginner',
        price: course.price || 0,
        thumbnail: course.thumbnail || '',
        isPublished: course.isPublished || false
      });
    } finally {
      setEditingCourseLoading(false);
      fetchModules(course._id);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        await api.delete(`/courses/${courseId}`);
        fetchCourseManagement();
      } catch (error) {
        console.error('Error deleting course:', error);
      }
    }
  };

  const handleTogglePublish = async (courseId, currentStatus) => {
    try {
      await api.put(`/courses/${courseId}`, { isPublished: !currentStatus });
      fetchCourseManagement();
    } catch (error) {
      console.error('Error updating course status:', error);
    }
  };

  // -------- Module Management --------
  const fetchModules = async (courseId) => {
    try {
      setLoadingModules(true);
      const res = await moduleService.getModules(courseId);
      if (res.success) setModules(res.data);
    } catch (e) {
      console.error('Error loading modules', e);
    } finally {
      setLoadingModules(false);
    }
  };

  const handleModuleFormChange = (e) => {
    const { name, value } = e.target;
    setModuleForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!editingCourse) return;
    if (!moduleForm.title) return;
    try {
      setCreatingModule(true);
  const payload = { title: moduleForm.title };
      if (moduleForm.order) payload.order = Number(moduleForm.order);
      const res = await moduleService.createModule(editingCourse._id, payload);
      if (res.success) {
  setModuleForm({ title: '', order: '' });
        setShowAddModule(false);
        fetchModules(editingCourse._id);
      }
    } catch (e) {
      console.error('Create module failed', e);
    } finally {
      setCreatingModule(false);
    }
  };

  const startEditModule = (m) => {
    setEditingModuleId(m._id);
    setModuleEditValues({ title: m.title, order: m.order });
  };
  const cancelEditModule = () => {
    setEditingModuleId(null);
    setModuleEditValues({ title: '', order: '' });
  };
  const handleModuleEditChange = (e) => {
    const { name, value } = e.target;
    setModuleEditValues(prev => ({ ...prev, [name]: value }));
  };
  const saveModuleEdit = async (moduleId) => {
    try {
  const payload = { title: moduleEditValues.title };
      if (moduleEditValues.order) payload.order = Number(moduleEditValues.order);
      const res = await moduleService.updateModule(moduleId, payload);
      if (res.success) {
        cancelEditModule();
        fetchModules(editingCourse._id);
      }
    } catch (e) {
      console.error('Update module failed', e);
    }
  };
  const deleteModule = async (moduleId) => {
    if (!window.confirm('Delete this module (its lessons will also be removed)?')) return;
    try {
      const res = await moduleService.deleteModule(moduleId);
      if (res.success) fetchModules(editingCourse._id);
    } catch (e) {
      console.error('Delete module failed', e);
    }
  };

  if (!user || (!['course_admin', 'website_admin'].includes(user.role))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Course Administration</h1>
          <p className="text-gray-600 mt-2">Manage courses, lessons, and educational content</p>
        </div>

        {/* Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('courses')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'courses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Course Management
            </button>
          </nav>
        </div>

        {/* Course Management */}
        {activeTab === 'courses' && (
          <div>
            {/* Header Actions */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Courses</h2>
              <button
                onClick={() => {
                  setShowCourseForm(true);
                  setEditingCourse(null);
                  setCourseForm({
                    title: '',
                    shortDescription: '',
                    category: '',
                    level: 'beginner',
                    price: 0,
                    thumbnail: '',
                    isPublished: false
                  });
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Add New Course
              </button>
            </div>

            {/* Course Form Modal */}
            {showCourseForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingCourse ? 'Edit Course' : 'Add New Course'}
                  </h3>
                  <form onSubmit={handleSubmitCourse} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        name="title"
                        value={courseForm.title}
                        onChange={handleCourseFormChange}
                        className="w-full border rounded-lg px-3 py-2"
                        required
                        disabled={editingCourseLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                      <input
                        type="text"
                        name="shortDescription"
                        value={courseForm.shortDescription}
                        onChange={handleCourseFormChange}
                        className="w-full border rounded-lg px-3 py-2"
                        required={!editingCourse}
                        disabled={editingCourseLoading}
                      />
                    </div>

                    {/* Course long description removed */}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <input
                          type="text"
                          name="category"
                          value={courseForm.category}
                          onChange={handleCourseFormChange}
                          placeholder="e.g., Programming, Design, Business"
                          className="w-full border rounded-lg px-3 py-2"
                          required
                          disabled={editingCourseLoading}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                        <select
                          name="level"
                          value={courseForm.level}
                          onChange={handleCourseFormChange}
                          className="w-full border rounded-lg px-3 py-2"
                          disabled={editingCourseLoading}
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                        <input
                          type="number"
                          name="price"
                          value={courseForm.price}
                          onChange={handleCourseFormChange}
                          min="0"
                          step="0.01"
                          className="w-full border rounded-lg px-3 py-2"
                          disabled={editingCourseLoading}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                        <input
                          type="url"
                          name="thumbnail"
                          value={courseForm.thumbnail}
                          onChange={handleCourseFormChange}
                          placeholder="https://example.com/image.jpg"
                          className="w-full border rounded-lg px-3 py-2"
                          disabled={editingCourseLoading}
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isPublished"
                        name="isPublished"
                        checked={courseForm.isPublished}
                        onChange={handleCourseFormChange}
                        className="mr-2"
                      />
                      <label htmlFor="isPublished" className="text-sm font-medium text-gray-700">
                        Publish course immediately
                      </label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      {editingCourse && (
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/courses/${editingCourse._id}/edit-content`)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Edit Course Content
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowCourseForm(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        disabled={editingCourseLoading}
                      >
                        {editingCourseLoading ? 'Loading...' : (editingCourse ? 'Update Course' : 'Create Course')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Courses Table */}
            {loading ? (
              <LoadingSpinner size="lg" text="Loading courses..." />
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Course
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lessons
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Enrollments
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {courses.map((course) => (
                      <tr key={course._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{course.title}</div>
                          <div className="text-sm text-gray-500">{course.level}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${course.price}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.totalLessons || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.enrollmentCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            course.isPublished 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {course.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEditCourse(course)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleTogglePublish(course._id, course.isPublished)}
                            className="text-green-600 hover:text-green-900"
                          >
                            {course.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(course._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {courses.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No courses found. Create your first course!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseAdminDashboard;
