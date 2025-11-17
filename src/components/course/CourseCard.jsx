import React from 'react';
import { useCourse } from '../../context/CourseContext';
import paymentService from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';

const CourseCard = ({ course, showEnrollButton = true }) => {
  const { enrollInCourse, enrollments } = useCourse();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const isEnrolled = enrollments?.some(e => e.course?._id === course._id || e.course === course._id);

  const handleEnroll = async () => {
    if (!isAuthenticated) return alert('Please log in first');
    if (course.price > 0) return alert('This is a paid course. Please purchase first.');
    const result = await enrollInCourse(course._id);
    if (result.success) {
      window.location.href = `/courses/${course._id}`;
    } else {
      alert(result.error || 'Failed to enroll');
    }
  };

  const handlePurchase = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      return window.location.href = '/login?next=' + encodeURIComponent(`/courses/${course._id}`);
    }
    if (isEnrolled) return (window.location.href = `/courses/${course._id}`);
  // Confirm intent (especially important in demo mode where purchase auto-enrolls)
  const proceed = window.confirm('Proceed to purchase this course? (In demo mode this will auto-enroll you)');
  if (!proceed) return;
    try {
      const orderRes = await paymentService.createOrder(course._id);
      if (!orderRes.success) {
        if (orderRes.unauthorized) {
          return window.location.href = '/login?next=' + encodeURIComponent(`/courses/${course._id}`);
        }
        return alert(orderRes.message || 'Order creation failed');
      }
      // Demo mode path (no gateway configured)
      if (orderRes.data?.demo) {
    alert(orderRes.data.message || 'Demo purchase successful');
        window.location.href = `/courses/${orderRes.data.courseId}`;
        return;
      }
      const { orderId, amount, currency, key, courseId } = orderRes.data;
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise(r => { script.onload = r; script.onerror = r; });
      }
      const options = {
        key: key || 'rzp_test_placeholder',
        amount: Math.round(amount * 100),
        currency,
        name: 'LearnMate',
        description: course.title,
        order_id: orderId,
        handler: async function (response) {
          try {
            const verifyRes = await paymentService.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              courseId
            });
            if (verifyRes.success) {
              window.location.href = `/courses/${courseId}`;
            } else {
              if (verifyRes.unauthorized) {
                return window.location.href = '/login?next=' + encodeURIComponent(`/courses/${courseId}`);
              }
              alert(verifyRes.message || 'Verification failed');
            }
          } catch (e) { alert('Verification error'); }
        },
        modal: {
          ondismiss: function () {
            // Optionally notify user they cancelled
          }
        },
        prefill: {},
        theme: { color: '#2563eb' }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      if (err.response?.status === 401) return; // handled globally
      alert(err.response?.data?.message || 'Payment initialization failed');
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatPrice = (price) => {
    if (price === 0) return 'Free';
    if (price == null || isNaN(price)) return 'Free';
    return `$${Number(price).toFixed(2).replace(/\.00$/, '')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* Course Thumbnail */}
      <div className="relative">
        <img
          src={course.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'}
          alt={course.title}
          className="w-full h-48 object-cover"
        />
        <div className="absolute top-4 left-4">
          <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
            {course.level}
          </span>
        </div>
        <div className="absolute top-4 right-4 flex flex-col items-end space-y-1">
          <span className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            {formatDuration(course.duration)}
          </span>
          {isEnrolled && (
            <span className="bg-green-600 text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">Owned</span>
          )}
        </div>
      </div>

      {/* Course Content */}
      <div className="p-6">
        {/* Category */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-blue-600 font-medium">{course.category}</span>
          <div className="flex items-center">
            <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
            </svg>
            <span className="ml-1 text-sm text-gray-600">
              {course.rating ? course.rating.toFixed(1) : 'New'}
            </span>
            {course.totalRatings && (
              <span className="ml-1 text-sm text-gray-500">
                ({course.totalRatings})
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {course.title}
        </h3>

        {/* Description removed per requirements */}

        {/* Instructor */}
        <div className="flex items-center mb-4">
          <img
            src={course.instructor?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100'}
            alt={course.instructor?.name}
            className="w-8 h-8 rounded-full object-cover"
          />
          <span className="ml-2 text-sm text-gray-700">{course.instructor?.name}</span>
        </div>

        {/* Course Stats */}
        <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>{course.totalLessons || 0} lessons</span>
            <span>{course.totalEnrollments || 0} students</span>
          </div>
        </div>

        {/* Price and Action */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-gray-900 mr-4">
            {formatPrice(course.price)}
          </div>
          {showEnrollButton && (
            <div className="flex space-x-2">
              <a
                href={`/courses/${course._id}`}
                className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium"
              >
                View Details
              </a>
              {!isEnrolled && course.price === 0 && (
                <button
                  onClick={handleEnroll}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Enroll Free
                </button>
              )}
        {!isEnrolled && course.price > 0 && (
                <button
          onClick={handlePurchase}
          disabled={authLoading}
          className={`px-4 py-2 text-sm font-medium rounded-lg text-white ${authLoading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                >
          {authLoading ? 'Checking...' : 'Buy Now'}
                </button>
              )}
              {isEnrolled && (
                <button
                  onClick={() => (window.location.href = `/courses/${course._id}`)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  Continue
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
