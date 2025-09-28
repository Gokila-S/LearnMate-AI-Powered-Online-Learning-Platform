import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';
import Module from '../models/Module.js';

// Extract YouTube video ID from a variety of URL formats
const extractYouTubeVideoId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// Helper: map incoming payload to content structure
const buildContentFromPayload = (body, fallback) => {
  // Accept either explicit fields (videoUrl/youtubeUrl/htmlContent/questions) or generic { type, content }
  const { type, content, videoUrl, youtubeUrl, htmlContent, questions } = body || {};

  // If explicit fields provided, infer type
  if (videoUrl) {
    return { type: 'video', data: { videoUrl } };
  }
  if (youtubeUrl) {
    const videoId = extractYouTubeVideoId(youtubeUrl);
    const payload = { youtubeUrl };
    if (videoId) {
      payload.videoId = videoId;
      payload.thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
    return { type: 'youtube', data: payload };
  }
  if (questions && Array.isArray(questions)) {
    const lessonType = body.type === 'assessment' ? 'assessment' : 'quiz';
    return { type: lessonType, data: { questions } };
  }
  if (htmlContent !== undefined) {
    return { type: 'text', data: { htmlContent } };
  }

  // If generic type/content provided
  if (type && content !== undefined) {
    if (type === 'video') return { type: 'video', data: { videoUrl: content } };
    if (type === 'youtube') {
      const videoId = extractYouTubeVideoId(content);
      const payload = { youtubeUrl: content };
      if (videoId) {
        payload.videoId = videoId;
        payload.thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
      return { type: 'youtube', data: payload };
    }
    if (type === 'text') return { type: 'text', data: { htmlContent: content } };
    if (type === 'quiz' || type === 'assessment') return { type, data: { questions: content } };
  }

  // Nothing supplied -> return fallback (existing content)
  return fallback;
};

// @desc    Update a lesson
// @route   PUT /api/lessons/:lessonId
// @access  Private (Instructor/Admin)
export const updateLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // AuthZ: course_admin must own the course
    if (req.user && req.user.role === 'course_admin') {
      const course = await Course.findById(lesson.course).select('owner');
      if (!course || !course.owner || String(course.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this lesson' });
      }
    }

    // Apply updates
    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.duration !== undefined) updates.duration = req.body.duration;
    if (req.body.isPreview !== undefined) updates.isPreview = req.body.isPreview;

    // Content updates (optional)
    const newContent = buildContentFromPayload(req.body, lesson.content);
    if (newContent) updates.content = newContent;

    updates.updatedAt = new Date();

    const updated = await Lesson.findByIdAndUpdate(lessonId, updates, { new: true });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a lesson
// @route   DELETE /api/lessons/:lessonId
// @access  Private (Instructor/Admin)
export const deleteLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    // AuthZ check
    const course = await Course.findById(lesson.course).select('owner lessons totalLessons');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Parent course not found' });
    }
    if (req.user && req.user.role === 'course_admin') {
      if (!course.owner || String(course.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this lesson' });
      }
    }

    // Remove lesson from course and modules
    await Course.findByIdAndUpdate(course._id, {
      $pull: { lessons: lesson._id },
      $inc: { totalLessons: -1 }
    });

    await Module.updateMany(
      { course: course._id, lessons: lesson._id },
      { $pull: { lessons: lesson._id }, $inc: { totalLessons: -1 } }
    );

    await lesson.deleteOne();

    return res.status(200).json({ success: true, message: 'Lesson deleted' });
  } catch (error) {
    next(error);
  }
};

export default { updateLesson, deleteLesson };
