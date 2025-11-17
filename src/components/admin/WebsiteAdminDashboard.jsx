import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import api from '../../services/api';

const WebsiteAdminDashboard = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const [userFilters, setUserFilters] = useState({ role: 'all', search: '' });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [showAddCourseAdmin, setShowAddCourseAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });
  const [providerApps, setProviderApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsPage, setAppsPage] = useState(1);
  const [appsTotalPages, setAppsTotalPages] = useState(1);
  const [appsFilter, setAppsFilter] = useState('pending');

  useEffect(() => {
    if (user?.role === 'website_admin') {
      fetchAnalytics();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
    if (activeTab === 'providers') {
      fetchProviderApps();
    }
  }, [activeTab, userFilters, pagination.page]);

  useEffect(() => {
    if (activeTab === 'providers') {
      fetchProviderApps();
    }
  }, [appsPage, appsFilter]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/analytics');
      setAnalytics(response.data.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderApps = async () => {
    try {
      setAppsLoading(true);
      const params = new URLSearchParams({ page: appsPage, limit: 20, status: appsFilter });
      const res = await api.get(`/providers/applications?${params.toString()}`);
      setProviderApps(res.data.data || []);
      setAppsTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error('Error loading provider apps', err);
    } finally {
      setAppsLoading(false);
    }
  };

  const actOnApp = async (id, action) => {
    try {
      await api.post(`/providers/applications/${id}/${action}`);
      fetchProviderApps();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Action failed';
      window.alert(msg);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20,
        ...userFilters
      });
      const response = await api.get(`/admin/users?${params}`);
      setUsers(response.data.data);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.totalPages
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await api.delete(`/admin/users/${userId}`);
        fetchUsers(); // Refresh the list
      } catch (error) {
        const msg = error?.response?.data?.message || error?.message || 'Delete failed';
        window.alert(msg);
      }
    }
  };

  const handleCreateCourseAdmin = async (e) => {
    e.preventDefault();
    try {
      if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
        return window.alert('Name, email, and password are required');
      }
      // 1) Register the user
      const reg = await api.post('/auth/register', newAdmin);
      const createdUser = reg.data?.user || reg.data; // depending on response shape
      const id = createdUser?.id || createdUser?._id;
      if (!id) throw new Error('User created but ID not returned');
      // 2) Elevate role to course_admin
      await api.put(`/admin/users/${id}/role`, { role: 'course_admin' });
      setShowAddCourseAdmin(false);
      setNewAdmin({ name: '', email: '', password: '' });
      fetchUsers();
    } catch (error) {
      const msg = error?.response?.data?.msg || error?.response?.data?.message || error?.message || 'Create failed';
      window.alert(msg);
    }
  };

  if (user?.role !== 'website_admin') {
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
          <h1 className="text-3xl font-bold text-gray-900">Website Administration</h1>
          <p className="text-gray-600 mt-2">Manage platform analytics, users, and system settings</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'providers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Provider Requests
            </button>
          </nav>
        </div>

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div>
            {loading ? (
              <LoadingSpinner size="lg" text="Loading analytics..." />
            ) : analytics ? (
              <div className="space-y-6">
                {/* Stats Grid (Removed Total Lessons card per request) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">Total Users</p>
                        <p className="text-3xl font-bold text-gray-900">{analytics.users.total}</p>
                        <p className="text-sm text-green-600">+{analytics.users.recent} this month</p>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-full">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">Total Courses</p>
                        <p className="text-3xl font-bold text-gray-900">{analytics.courses.total}</p>
                        <p className="text-sm text-gray-600">{analytics.courses.published} published</p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-full">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">Total Enrollments</p>
                        <p className="text-3xl font-bold text-gray-900">{analytics.enrollments.total}</p>
                        <p className="text-sm text-green-600">+{analytics.enrollments.recent} this month</p>
                      </div>
                      <div className="p-3 bg-yellow-100 rounded-full">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Total Lessons card removed */}
                </div>

                {/* User Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">User Distribution</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Students</span>
                        <span className="font-semibold">{analytics.users.students}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Course Admins</span>
                        <span className="font-semibold">{analytics.users.courseAdmins}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Website Admins</span>
                        <span className="font-semibold">{analytics.users.websiteAdmins}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Courses</h3>
                    <div className="space-y-3">
                      {analytics.courses.popular.map((course, index) => (
                        <div key={course._id} className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">{course.title}</p>
                            <p className="text-sm text-gray-600">{course.category}</p>
                          </div>
                          <span className="text-sm font-semibold text-blue-600">
                            {course.enrollmentCount} students
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No analytics data available</p>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
  {activeTab === 'users' && (
          <div>
            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userFilters.search}
                    onChange={(e) => setUserFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <select
                    value={userFilters.role}
                    onChange={(e) => setUserFilters(prev => ({ ...prev, role: e.target.value }))}
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="all">All Roles</option>
                    <option value="user">Students</option>
                    <option value="course_admin">Course Admins</option>
                    <option value="website_admin">Website Admins</option>
                  </select>
                </div>
              </div>
              {/* Add Course Admin CTA */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddCourseAdmin(s => !s)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {showAddCourseAdmin ? 'Close' : 'Add Course Administrator'}
                </button>
              </div>
              {showAddCourseAdmin && (
                <form onSubmit={handleCreateCourseAdmin} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    placeholder="Full name"
                    value={newAdmin.name}
                    onChange={e => setNewAdmin(a => ({ ...a, name: e.target.value }))}
                    className="border rounded px-3 py-2"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newAdmin.email}
                    onChange={e => setNewAdmin(a => ({ ...a, email: e.target.value }))}
                    className="border rounded px-3 py-2"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Temporary password"
                    value={newAdmin.password}
                    onChange={e => setNewAdmin(a => ({ ...a, password: e.target.value }))}
                    className="border rounded px-3 py-2"
                    required
                  />
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Create</button>
                </form>
              )}
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <LoadingSpinner size="lg" text="Loading users..." />
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Enrollments
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              <img
                                className="h-10 w-10 rounded-full"
                                src={user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3B82F6&color=fff`}
                                alt=""
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                              user.role === 'website_admin'
                                ? 'bg-purple-100 text-purple-800'
                                : user.role === 'course_admin'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {user.role === 'website_admin'
                              ? 'Website Admin'
                              : user.role === 'course_admin'
                              ? 'Course Admin'
                              : 'Student'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.enrolledCourses?.length || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {user.role !== 'website_admin' ? (
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.totalPages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Page <span className="font-medium">{pagination.page}</span> of{' '}
                          <span className="font-medium">{pagination.totalPages}</span>
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                          <button
                            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                            disabled={pagination.page === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                            disabled={pagination.page === pagination.totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Provider Requests Tab */}
        {activeTab === 'providers' && (
          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6 flex items-center gap-4">
              <select
                value={appsFilter}
                onChange={(e) => setAppsFilter(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
                <option value="all">All</option>
              </select>
            </div>

            {appsLoading ? (
              <LoadingSpinner size="lg" text="Loading provider applications..." />
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {providerApps.map(app => (
                      <tr key={app._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{app.name}</div>
                          <div className="text-sm text-gray-500">{app.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{app.organization}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {app.website ? <a href={app.website} target="_blank" rel="noreferrer">{app.website}</a> : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            app.status === 'approved' ? 'bg-green-100 text-green-800' : app.status === 'denied' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(app.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {app.status === 'pending' ? (
                            <>
                              <button onClick={() => actOnApp(app._id, 'approve')} className="text-green-600 hover:text-green-900">Approve</button>
                              <button onClick={() => actOnApp(app._id, 'deny')} className="text-red-600 hover:text-red-900">Deny</button>
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {appsTotalPages > 1 && (
                  <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">Page <span className="font-medium">{appsPage}</span> of <span className="font-medium">{appsTotalPages}</span></p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                          <button onClick={() => setAppsPage(p => Math.max(1, p - 1))} disabled={appsPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Previous</button>
                          <button onClick={() => setAppsPage(p => Math.min(appsTotalPages, p + 1))} disabled={appsPage === appsTotalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Next</button>
                        </nav>
                      </div>
                    </div>
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

export default WebsiteAdminDashboard;
