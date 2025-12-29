import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Enrollment from '../models/Enrollment.js';
import Module from '../models/Module.js';
import path from 'path';
import { uploadVideoToDrive } from '../utils/driveUploader.js';
import { deleteDriveFile } from '../utils/driveUploader.js';

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
export const getCourses = async (req, res, next) => {
  try {
  const { page = 1, limit = 12, category, level, search, sort = 'createdAt', startsWith } = req.query;

    // Build query
    let query = { isPublished: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (level && level !== 'all') {
      query.level = level;
    }

    if (startsWith) {
      // Prefix case-insensitive search on title
      query.title = { $regex: `^${startsWith.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`, $options: 'i' };
    } else if (search) {
      query.$text = { $search: search };
    }

    // Execute query with pagination
    const courses = await Course.find(query)
      .select('-lessons') // Don't include full lesson data in list
      .sort({ [sort]: sort === 'createdAt' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
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

// @desc    Get single course by ID
// @route   GET /api/courses/:id
// @access  Public
export const getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate({
        path: 'lessons',
        select: 'title description duration order isPreview content.type',
        options: { sort: { order: 1 } }
      });

    if (!course || !course.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      data: course
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get course categories
// @route   GET /api/courses/categories
// @access  Public
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Course.distinct('category', { isPublished: true });
    
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new course (Admin/Instructor only)
// @route   POST /api/courses
// @access  Private
export const createCourse = async (req, res, next) => {
  try {
    // If a course_admin creates a course, force owner to them
    if (req.user && req.user.role === 'course_admin') {
      req.body.owner = req.user._id;
    }
    // Website admins may optionally set owner via body; otherwise remains null
    const course = await Course.create(req.body);

    res.status(201).json({
      success: true,
      data: course
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private
export const updateCourse = async (req, res, next) => {
  try {
    // Enforce ownership for course_admins
    const existing = await Course.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    if (req.user && req.user.role === 'course_admin') {
      if (!existing.owner || String(existing.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to modify this course' });
      }
      // Prevent owner change by course_admins
      if ('owner' in req.body) delete req.body.owner;
    }

    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      data: course
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private
export const deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (req.user && req.user.role === 'course_admin') {
      if (!course.owner || String(course.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this course' });
      }
    }

    // Collect lesson Drive fileIds before deletion for cleanup
    const lessons = await Lesson.find({ course: req.params.id }).select('content.type content.data');

    await course.deleteOne();

    // Delete associated lessons
    await Lesson.deleteMany({ course: req.params.id });
    // Best-effort Drive cleanup
    for (const l of lessons) {
      try {
        if (l.content?.type === 'video' && l.content?.data?.storage === 'drive' && l.content?.data?.driveFileId) {
          await deleteDriveFile(l.content.data.driveFileId);
        }
      } catch (e) {
        console.warn('[CourseDelete] Drive cleanup failed (continuing):', e.message);
      }
    }
    
    // Delete enrollments
    await Enrollment.deleteMany({ course: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add lesson with optional video upload
// @route   POST /api/courses/:id/lessons
// @access  Private (Instructor/Admin)
export const addLesson = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Ownership check for course_admins
    if (req.user && req.user.role === 'course_admin') {
      if (!course.owner || String(course.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to add lessons to this course' });
      }
    }

    const { title, description, order, isPreview, moduleId } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    // Allow auto-fallback for missing description (front-end now sends one, but for resilience)
    let lessonDescription = description;
    if (!lessonDescription) {
      if (req.body.htmlContent && typeof req.body.htmlContent === 'string') {
        lessonDescription = req.body.htmlContent.replace(/[#>*`\-_|]/g,'').split(/\n/).map(l=>l.trim()).filter(Boolean)[0] || '';
      } else if (Array.isArray(req.body.questions) && req.body.questions.length > 0) {
        lessonDescription = req.body.questions[0].question?.slice(0,140) || '';
      }
      if (!lessonDescription) lessonDescription = `${title} lesson`;
    }

    let contentData = {};
    if (req.file) {
      // First, create local reference
      contentData = {
        videoUrl: `/uploads/lessons/${path.basename(req.file.path)}`,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        storage: 'local'
      };
      // Attempt Drive upload if configured
      const driveMeta = await uploadVideoToDrive(req.file.path, req.file.originalname);
      if (driveMeta) {
        contentData.driveFileId = driveMeta.driveFileId;
        contentData.webViewLink = driveMeta.webViewLink;
        contentData.webContentLink = driveMeta.webContentLink;
        contentData.storage = 'drive';
        // Add both streamUrl (legacy) and embedLink (preferred) forms
        contentData.streamUrl = `https://drive.google.com/file/d/${driveMeta.driveFileId}/preview`;
        contentData.embedLink = `https://drive.google.com/file/d/${driveMeta.driveFileId}/preview`;
      }
      else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID) {
        // Config appears present but upload failed (already logged by uploader) – surface a concise lesson-level warning
        console.warn('[LessonAdd] Drive upload not applied; using local file only. Check earlier [DriveUpload] logs for details.');
      }
    } else if (req.body.videoUrl) {
      // Allow providing a direct video URL without upload
      contentData = {
        videoUrl: req.body.videoUrl
      };
    } else if (req.body.youtubeUrl) {
      // Extract video ID from YouTube URL
      const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = req.body.youtubeUrl.match(youtubeRegex);
      const videoId = match ? match[1] : null;
      
      if (!videoId) {
        return res.status(400).json({ success: false, message: 'Invalid YouTube URL' });
      }
      
      contentData = {
        youtubeUrl: req.body.youtubeUrl,
        videoId: videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      };
    } else if (req.body.htmlContent) {
      contentData = { htmlContent: req.body.htmlContent };
    } else if (req.body.questions && Array.isArray(req.body.questions)) {
      // Quiz or Assessment questions
      contentData = { questions: req.body.questions };
    } else {
      return res.status(400).json({ success: false, message: 'Provide a video file, YouTube URL, questions, or htmlContent' });
    }

    // Determine next course-wide order to avoid unique index collisions
    let nextOrder = order;
    if (!nextOrder) {
      const agg = await Lesson.aggregate([
        { $match: { course: course._id } },
        { $group: { _id: null, maxOrder: { $max: "$order" } } }
      ]);
      const maxOrder = (agg && agg[0]?.maxOrder) || 0;
      nextOrder = maxOrder + 1;
    }

    // Create with retry on duplicate (race protection)
    let lesson;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        lesson = await Lesson.create({
          title,
          description: lessonDescription,
          content: {
            type: req.file || req.body.videoUrl ? 'video' : 
                  req.body.youtubeUrl ? 'youtube' : 
                  req.body.questions ? (req.body.type === 'assessment' ? 'assessment' : 'quiz') : 
                  'text',
            data: contentData
          },
          course: course._id,
          order: nextOrder,
          duration: req.body.duration || 0,
          isPreview: isPreview || false
        });
        break; // success
      } catch (err) {
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern.course && err.keyPattern.order) {
          nextOrder += 1; // bump and retry
          continue;
        }
        throw err;
      }
    }
    if (!lesson) {
      return res.status(500).json({ success: false, message: 'Failed to create lesson due to ordering conflict' });
    }

    course.lessons.push(lesson._id);
    course.totalLessons = course.lessons.length;
    await course.save();

    // Optionally attach to a module
    if (moduleId) {
      const moduleDoc = await Module.findById(moduleId);
      if (moduleDoc && String(moduleDoc.course) === String(course._id)) {
        if (!moduleDoc.lessons.includes(lesson._id)) moduleDoc.lessons.push(lesson._id);
        moduleDoc.totalLessons = moduleDoc.lessons.length;
        await moduleDoc.save();
      }
    }

  res.status(201).json({ success: true, data: lesson, moduleAttached: !!moduleId });
  } catch (error) {
    next(error);
  }
};

// @desc    Get full lesson content
// @route   GET /api/courses/:courseId/lessons/:lessonId
// @access  Private (must be enrolled or preview)
export const getLesson = async (req, res, next) => {
  try {
    const lesson = await Lesson.findOne({ _id: req.params.lessonId, course: req.params.courseId });
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }
    res.status(200).json({ success: true, data: lesson });
  } catch (error) {
    next(error);
  }
};
