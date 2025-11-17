import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';
import Module from '../models/Module.js';
import { deleteDriveFile, getDriveAuthMode } from '../utils/driveUploader.js';
import { default as driveUtil } from '../utils/driveUploader.js';
import path from 'path';
import fs from 'fs';
import { uploadVideoToDrive } from '../utils/driveUploader.js';

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

    const updates = {};
  let oldDriveFileIdToDelete = null;
  let oldLocalPathToDelete = null;
  let uploadedWith = null; // drive auth mode if new upload occurs
  let oldDriveDeleted = null;
  let oldLocalDeleted = null;

    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.duration !== undefined) updates.duration = req.body.duration;
    if (req.body.isPreview !== undefined) updates.isPreview = req.body.isPreview;

    // Video replacement: if a new file uploaded (req.file) we'll build a fresh video content object
    if (req.file) {
      // Record old file references for post-update deletion
      if (lesson.content?.type === 'video' && lesson.content?.data) {
        if (lesson.content.data.storage === 'drive' && lesson.content.data.driveFileId) {
          oldDriveFileIdToDelete = lesson.content.data.driveFileId;
        } else if (lesson.content.data.storage === 'local' && lesson.content.data.videoUrl) {
          // local path is served from /uploads/lessons/<filename>
            const base = path.basename(lesson.content.data.videoUrl);
            oldLocalPathToDelete = path.join(process.cwd(), 'uploads', 'lessons', base);
        }
      }
      // Build new content data similarly to addLesson logic
      let contentData = {
        videoUrl: `/uploads/lessons/${path.basename(req.file.path)}`,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        storage: 'local'
      };
      const driveMeta = await uploadVideoToDrive(req.file.path, req.file.originalname);
      if (driveMeta) {
        contentData.driveFileId = driveMeta.driveFileId;
        contentData.webViewLink = driveMeta.webViewLink;
        contentData.webContentLink = driveMeta.webContentLink;
        contentData.storage = 'drive';
        contentData.streamUrl = `https://drive.google.com/file/d/${driveMeta.driveFileId}/preview`;
        contentData.embedLink = `https://drive.google.com/file/d/${driveMeta.driveFileId}/preview`;
        uploadedWith = getDriveAuthMode() || null;
      }
      updates.content = { type: 'video', data: contentData };
    } else {
      // Non-file content update path (quiz/text/etc or metadata changes)
      const newContent = buildContentFromPayload(req.body, lesson.content);
      if (newContent) updates.content = newContent;
    }

    updates.updatedAt = new Date();

    const updated = await Lesson.findByIdAndUpdate(lessonId, updates, { new: true });

    // Post-update cleanup (best effort) - delete old Drive/local video if replaced
    if (req.file) {
      if (oldDriveFileIdToDelete) {
        try { oldDriveDeleted = await deleteDriveFile(oldDriveFileIdToDelete); } catch(e){ oldDriveDeleted = false; console.warn('[LessonUpdate] Old Drive file delete failed:', e.message); }
      }
      if (oldLocalPathToDelete) {
        try { fs.unlink(oldLocalPathToDelete, ()=>{}); oldLocalDeleted = true; } catch(e){ oldLocalDeleted = false; console.warn('[LessonUpdate] Old local file delete failed:', e.message); }
      }
    }

    return res.status(200).json({ success: true, data: updated, replacedVideo: !!req.file, uploadedWith, oldDriveDeleted, oldLocalDeleted });
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

  let driveDeletion = null;
    try {
      if (lesson.content?.type === 'video' && lesson.content?.data?.storage === 'drive' && lesson.content?.data?.driveFileId) {
        console.log('[LessonDelete] Attempting Drive file removal', {
          driveFileId: lesson.content.data.driveFileId
        });
        const targetId = lesson.content.data.driveFileId;
        driveDeletion = await deleteDriveFile(targetId);
        console.log('[LessonDelete] Drive deletion result =', driveDeletion);
        // Optional verification: attempt metadata fetch if reported success to confirm 404
        if (driveDeletion) {
          try {
            const drive = await (await import('googleapis')).google.drive({ version: 'v3', auth: (await (async () => { /* reuse internal client via util */ return (await driveUtil)?.getDriveAuthMode ? undefined : undefined; })()) });
            // NOTE: Above direct verification is intentionally skipped to avoid re-auth complexity.
          } catch(verifyErr) {
            // Silently ignore; verification is optional
          }
        }
      }
    } catch (cleanupErr) {
      driveDeletion = false;
      console.warn('[LessonDelete] Drive cleanup failed (continuing):', cleanupErr.message);
    }

    await lesson.deleteOne();

    return res.status(200).json({ success: true, message: 'Lesson deleted', driveDeletion });
  } catch (error) {
    next(error);
  }
};

export default { updateLesson, deleteLesson };
