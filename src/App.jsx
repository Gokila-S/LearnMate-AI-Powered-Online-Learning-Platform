import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Context imports
import { AuthProvider, useAuth } from './context/AuthContext';
import { CourseProvider } from './context/CourseContext';

// Components
import Header from './components/common/Header';
import ErrorBoundary from './components/common/ErrorBoundary';
import Footer from './components/common/Footer';

// Pages
import Home from './pages/Home';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminCourseContentEditor from './pages/AdminCourseContentEditor';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Styles
import './App.css';

function App() {
  // Simple role helpers used inside Route elements
  const AdminRedirect = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    if (isAuthenticated && user?.role !== 'user') {
      return <Navigate to="/admin" replace />;
    }
    return children;
  };

  const StudentOnly = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.role !== 'user') return <Navigate to="/admin" replace />;
    return children;
  };

  return (
    <AuthProvider>
      <CourseProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary>
            <div className="min-h-screen flex flex-col bg-gray-50">
              <Header />
              <main className="flex-1">
                <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/courses" element={<AdminRedirect><Courses /></AdminRedirect>} />
                <Route path="/courses/:id" element={<AdminRedirect><CourseDetail /></AdminRedirect>} />
                <Route path="/dashboard" element={<StudentOnly><Dashboard /></StudentOnly>} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/courses/:courseId/edit-content" element={<AdminCourseContentEditor />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                
                {/* Fallback route */}
                <Route path="*" element={
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                      <p className="text-gray-600 mb-6">Page not found</p>
                      <a 
                        href="/" 
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                      >
                        Go Home
                      </a>
                    </div>
                  </div>
                } />
                </Routes>
              </main>
              <Footer />
            </div>
          </ErrorBoundary>
        </Router>
      </CourseProvider>
    </AuthProvider>
  );
}

export default App;
