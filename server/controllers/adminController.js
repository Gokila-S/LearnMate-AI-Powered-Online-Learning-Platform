import User from '../models/User.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Lesson from '../models/Lesson.js';

// @desc    Get website analytics (Website Admin only)
// @route   GET /api/admin/analytics
// @access  Private (Website Admin)
export const getWebsiteAnalytics = async (req, res, next) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'user' });
    const totalCourseAdmins = await User.countDocuments({ role: 'course_admin' });
    const totalWebsiteAdmins = await User.countDocuments({ role: 'website_admin' });

    // Get course statistics
    const totalCourses = await Course.countDocuments();
    const publishedCourses = await Course.countDocuments({ isPublished: true });
    const draftCourses = await Course.countDocuments({ isPublished: false });

    // Get enrollment statistics
    const totalEnrollments = await Enrollment.countDocuments();
    const activeEnrollments = await Enrollment.countDocuments({ status: 'active' });
    const completedEnrollments = await Enrollment.countDocuments({ status: 'completed' });

    // Get lesson statistics
    const totalLessons = await Lesson.countDocuments();
    const videoLessons = await Lesson.countDocuments({ 'content.type': 'video' });
    const youtubeLessons = await Lesson.countDocuments({ 'content.type': 'youtube' });
    const textLessons = await Lesson.countDocuments({ 'content.type': 'text' });

    // Get recent enrollments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentEnrollments = await Enrollment.countDocuments({
      enrolledAt: { $gte: thirtyDaysAgo }
    });

    // Get popular courses (by enrollment count)
    const popularCourses = await Course.aggregate([
      {
        $lookup: {
          from: 'enrollments',
          localField: '_id',
          foreignField: 'course',
          as: 'enrollments'
        }
      },
      {
        $addFields: {
          enrollmentCount: { $size: '$enrollments' }
        }
      },
      {
        $sort: { enrollmentCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          title: 1,
          enrollmentCount: 1,
          price: 1,
          category: 1
        }
      }
    ]);

    // Get recent users (last 30 days)
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          students: totalStudents,
          courseAdmins: totalCourseAdmins,
          websiteAdmins: totalWebsiteAdmins,
          recent: recentUsers
        },
        courses: {
          total: totalCourses,
          published: publishedCourses,
          draft: draftCourses,
          popular: popularCourses
        },
        enrollments: {
          total: totalEnrollments,
          active: activeEnrollments,
          completed: completedEnrollments,
          recent: recentEnrollments
        },
        lessons: {
          total: totalLessons,
          video: videoLessons,
          youtube: youtubeLessons,
          text: textLessons
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users with pagination (Website Admin only)
// @route   GET /api/admin/users
// @access  Private (Website Admin)
export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;

    // Build query
    let query = {};
    if (role && role !== 'all') {
      query.role = role;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('enrolledCourses', 'title');

    // Get total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role (Website Admin only)
// @route   PUT /api/admin/users/:id/role
// @access  Private (Website Admin)
export const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'course_admin', 'website_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get course management data (Course Admin)
// @route   GET /api/admin/courses-management
// @access  Private (Course Admin, Website Admin)
export const getCourseManagement = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;

    // Build query
    let query = {};
    if (status !== 'all') {
      query.isPublished = status === 'published';
    }

    // Scope to owner when requester is a course_admin
    if (req.user && req.user.role === 'course_admin') {
      query.owner = req.user._id;
    }

    // Get courses with lesson count and enrollment count
    const courses = await Course.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'enrollments',
          localField: '_id',
          foreignField: 'course',
          as: 'enrollments'
        }
      },
      {
        $addFields: {
          enrollmentCount: { $size: '$enrollments' },
          revenue: {
            $multiply: ['$price', { $size: '$enrollments' }]
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: (page - 1) * limit
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          title: 1,
          owner: 1,
          description: 1,
          shortDescription: 1,
          category: 1,
          level: 1,
          price: 1,
          thumbnail: 1,
          isPublished: 1,
          totalLessons: 1,
          duration: 1,
          enrollmentCount: 1,
          revenue: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);

    // Get total count
    const total = await Course.countDocuments(query);

    res.status(200).json({
      success: true,
      count: courses.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: courses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user (Website Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private (Website Admin)
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Do not allow deleting any website administrator
    if (user.role === 'website_admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete website administrators'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    // Clean up user's enrollments
    await Enrollment.deleteMany({ student: req.params.id });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
