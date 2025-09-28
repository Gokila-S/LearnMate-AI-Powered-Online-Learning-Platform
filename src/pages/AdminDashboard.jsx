import React from 'react';
import { useAuth } from '../context/AuthContext';
import WebsiteAdminDashboard from '../components/admin/WebsiteAdminDashboard';
import CourseAdminDashboard from '../components/admin/CourseAdminDashboard';

const AdminDashboard = () => {
  const { user } = useAuth();

  if (!user || !['course_admin', 'website_admin'].includes(user.role)) {
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
    <div>
      {user.role === 'website_admin' ? (
        <WebsiteAdminDashboard />
      ) : (
        <CourseAdminDashboard />
      )}
    </div>
  );
};

export default AdminDashboard;
