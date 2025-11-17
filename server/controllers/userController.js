import User from '../models/User.js';
import Lesson from '../models/Lesson.js';

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('enrolledCourses', 'title thumbnail category')
      .populate('bookmarkedLessons', 'title course');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      bio: req.body.bio
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => 
      fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add lesson to bookmarks
// @route   POST /api/users/bookmarks/:lessonId
// @access  Private
export const addBookmark = async (req, res, next) => {
  try {
    const { lessonId } = req.params;

    // Check if lesson exists
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { bookmarkedLessons: lessonId } },
      { new: true }
    ).select('bookmarkedLessons');

    res.status(200).json({
      success: true,
      message: 'Lesson bookmarked successfully',
      data: user.bookmarkedLessons
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove lesson from bookmarks
// @route   DELETE /api/users/bookmarks/:lessonId
// @access  Private
export const removeBookmark = async (req, res, next) => {
  try {
    const { lessonId } = req.params;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { bookmarkedLessons: lessonId } },
      { new: true }
    ).select('bookmarkedLessons');

    res.status(200).json({
      success: true,
      message: 'Bookmark removed successfully',
      data: user.bookmarkedLessons
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user bookmarks
// @route   GET /api/users/bookmarks
// @access  Private
export const getUserBookmarks = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'bookmarkedLessons',
        populate: {
          path: 'course',
          select: 'title thumbnail'
        }
      })
      .select('bookmarkedLessons');

    res.status(200).json({
      success: true,
      data: user.bookmarkedLessons
    });
  } catch (error) {
    next(error);
  }
};
