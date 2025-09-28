import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Payment from '../models/Payment.js';
import PDFDocument from 'pdfkit';

// @desc    Enroll in a course
// @route   POST /api/enrollments/:courseId
// @access  Private
export const enrollInCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user._id;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course || !course.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Prevent direct enrollment in paid course without successful payment
    if (course.price > 0) {
      const paidPayment = await Payment.findOne({ user: studentId, course: courseId, status: 'paid' });
      if (!paidPayment) {
        return res.status(402).json({ // 402 Payment Required semantic
          success: false,
          message: 'Payment required before enrollment'
        });
      }
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course'
      });
    }

    // Get first lesson for current lesson
    const firstLesson = await Lesson.findOne({ course: courseId }).sort({ order: 1 });

    // Create enrollment
    const enrollment = await Enrollment.create({
      student: studentId,
      course: courseId,
      progress: {
        currentLesson: firstLesson?._id || null,
        progressPercentage: 0,
        completedLessons: []
      }
    });

    // Update course enrollment count
    await Course.findByIdAndUpdate(courseId, {
      $inc: { totalEnrollments: 1 },
      $addToSet: { enrolledStudents: studentId }
    });

    res.status(201).json({
      success: true,
      message: 'Successfully enrolled in course',
      data: enrollment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user enrollments
// @route   GET /api/enrollments
// @access  Private
export const getUserEnrollments = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate({
        path: 'course',
        select: 'title description thumbnail category level duration totalLessons instructor price'
      })
      .populate({
        path: 'progress.currentLesson',
        select: 'title order'
      })
      .sort({ enrolledAt: -1 });

    res.status(200).json({
      success: true,
      count: enrollments.length,
      data: enrollments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get enrollment details for a specific course
// @route   GET /api/enrollments/:courseId
// @access  Private
export const getEnrollmentDetails = async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: req.params.courseId
    })
      .populate({
        path: 'course',
        populate: {
          path: 'lessons',
          select: 'title description duration order isPreview content.type',
          options: { sort: { order: 1 } }
        }
      })
      .populate({
        path: 'progress.completedLessons.lesson',
        select: 'title order'
      })
      .populate({
        path: 'progress.currentLesson',
        select: 'title order content'
      });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: enrollment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lesson progress
// @route   PUT /api/enrollments/:courseId/lessons/:lessonId/complete
// @access  Private
export const markLessonComplete = async (req, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    const studentId = req.user._id;

    // Find enrollment
    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Check if lesson is already completed
    const isAlreadyCompleted = enrollment.progress.completedLessons.some(
      cl => cl.lesson.toString() === lessonId
    );

    if (!isAlreadyCompleted) {
      // Add to completed lessons
      enrollment.progress.completedLessons.push({
        lesson: lessonId,
        completedAt: new Date()
      });

  // Recalculate both count-based and duration-weighted progress
  const allLessons = await Lesson.find({ course: courseId }).select('duration');
  const totalLessons = allLessons.length;
  const completedSet = new Set(enrollment.progress.completedLessons.map(cl => cl.lesson.toString()));
  const completedCount = completedSet.size;
  const progressPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  // Duration weighted
  const totalDuration = allLessons.reduce((sum, l) => sum + (l.duration || 0), 0) || 0;
  const completedDuration = allLessons.reduce((sum, l) => completedSet.has(l._id.toString()) ? sum + (l.duration || 0) : sum, 0);
  const durationWeighted = totalDuration > 0 ? Math.round((completedDuration / totalDuration) * 100) : progressPercentage;
  enrollment.progress.progressPercentage = durationWeighted; // store weighted value to drive UI

      // Check if course is completed
      if (enrollment.progress.progressPercentage === 100) {
        enrollment.isCompleted = true;
        enrollment.completedAt = new Date();
      }

      // Update current lesson to next lesson
      const currentLessonOrder = await Lesson.findById(lessonId).select('order');
      const nextLesson = await Lesson.findOne({
        course: courseId,
        order: { $gt: currentLessonOrder.order }
      }).sort({ order: 1 });

      if (nextLesson) {
        enrollment.progress.currentLesson = nextLesson._id;
      }

      enrollment.lastAccessedAt = new Date();
      await enrollment.save();
    }

    res.status(200).json({
      success: true,
      message: 'Lesson marked as complete',
      data: {
        progressPercentage: enrollment.progress.progressPercentage,
        isCompleted: enrollment.isCompleted
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download certificate (simple PDF) when 100% complete
// @route   GET /api/enrollments/:courseId/certificate
// @access  Private
export const downloadCertificate = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user._id;
    const enrollment = await Enrollment.findOne({ student: studentId, course: courseId }).populate('course').populate('student');
    if (!enrollment) {
      return res.status(404).json({ success:false, message:'Enrollment not found' });
    }
    if (enrollment.progress.progressPercentage < 100) {
      return res.status(400).json({ success:false, message:'Course not yet completed' });
    }
    const doc = new PDFDocument({ size: 'A4', margin:40 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="certificate-${courseId}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).end(pdfBuffer);
    });
    const studentName = enrollment.student?.name || 'Student';
    const courseTitle = enrollment.course?.title || 'Course Title';
    const issuedDate = new Date(enrollment.completedAt || Date.now());
    const certId = (enrollment._id.toString()).slice(-10).toUpperCase();
    
    // Colors matching the template - Blue and Yellow theme
    const darkBlue = '#1e3a8a';  // Dark blue for main text
    const brightBlue = '#3b82f6'; // Bright blue for elements
    const yellow = '#fbbf24';     // Yellow/gold for accents
    const darkGray = '#374151';   // Dark gray for body text
    const lightGray = '#f3f4f6';  // Light background
    
    // Light background
    doc.fillColor(lightGray).rect(0, 0, 595, 842).fill();
    
    // Helper function to draw circles
    const drawCircle = (x, y, radius, color, opacity = 1) => {
      doc.save();
      doc.fillColor(color, opacity);
      doc.circle(x, y, radius).fill();
      doc.restore();
    };
    
    // Helper function to draw dot patterns
    const drawDotPattern = (startX, startY, rows, cols, spacing, color) => {
      doc.save();
      doc.fillColor(color);
      for(let row = 0; row < rows; row++) {
        for(let col = 0; col < cols; col++) {
          doc.circle(startX + col * spacing, startY + row * spacing, 2).fill();
        }
      }
      doc.restore();
    };
    
    // Background geometric elements matching template
    
    // Top left dot pattern
    drawDotPattern(55, 40, 6, 5, 8, brightBlue);
    
    // Top right dot pattern  
    drawDotPattern(520, 40, 6, 5, 8, brightBlue);
    
    // Right side large circles - yellow and blue
    drawCircle(570, 100, 25, yellow);
    drawCircle(545, 140, 35, brightBlue);
    drawCircle(570, 180, 20, yellow);
    drawCircle(575, 220, 15, darkBlue);
    drawCircle(550, 250, 25, yellow);
    drawCircle(570, 290, 30, darkBlue);
    
    // Middle right dot patterns
    drawDotPattern(520, 300, 4, 3, 6, brightBlue);
    drawDotPattern(530, 340, 5, 4, 7, brightBlue);
    
    // Bottom geometric shapes
    drawCircle(100, 500, 20, brightBlue);
    drawCircle(130, 520, 25, brightBlue);
    drawCircle(450, 520, 30, yellow);
    drawCircle(480, 490, 35, brightBlue);
    drawCircle(510, 520, 20, darkBlue);
    drawCircle(540, 500, 25, yellow);
    
    // Bottom left dot pattern
    drawDotPattern(55, 480, 5, 4, 8, brightBlue);
    
    // More bottom geometric elements
    drawCircle(350, 650, 40, brightBlue);
    drawCircle(400, 680, 35, yellow);
    drawCircle(450, 650, 30, darkBlue);
    drawCircle(500, 680, 25, brightBlue);
    
    // Main title - "CERTIFICATE" in large caps
    doc.fontSize(48).fillColor(darkBlue).font('Helvetica-Bold');
    doc.text('CERTIFICATE', 55, 100, { 
      align: 'left',
      characterSpacing: 3
    });
    
    // Subtitle "APPRECIATION"
    doc.fontSize(16).fillColor(darkBlue).font('Helvetica');
    doc.text('OF COMPLETION', 55, 150, { 
      align: 'left',
      characterSpacing: 2
    });
    
    // "AWARDED TO" label
    doc.fontSize(12).fillColor(darkGray).font('Helvetica-Bold');
    doc.text('AWARDED TO', 55, 200);
    
    // Student name in elegant script-like style (using italic as closest approximation)
    doc.fontSize(36).fillColor(brightBlue).font('Times-Italic');
    doc.text(studentName, 55, 230, { 
      width: 400
    });
    
    // Achievement description
    doc.fontSize(11).fillColor(darkGray).font('Helvetica');
    doc.text('SUCCESSFULLY COMPLETED THE PROFESSIONAL', 55, 300, { width: 400 });
    doc.text(`${courseTitle.toUpperCase()} PROGRAM ORGANIZED BY`, 55, 315, { width: 400 });
    doc.text('LEARNMATE PLATFORM CO.', 55, 330, { width: 400 });
    
    // Date
    doc.fontSize(12).fillColor(darkBlue).font('Helvetica-Bold');
    const dateStr = `${issuedDate.getDate()}${getOrdinalSuffix(issuedDate.getDate())} ${issuedDate.toLocaleString('default', { month: 'long' }).toUpperCase()}, ${issuedDate.getFullYear()}`;
    doc.text(dateStr, 55, 370);
    
    // "AWARDED BY" text  
    doc.fontSize(10).fillColor(darkGray).font('Helvetica');
    doc.text('AWARDED BY LEARNMATE PLATFORM', 55, 390);
    
    // Signature section at bottom left
    doc.fontSize(10).fillColor(darkBlue).font('Helvetica-Bold');
    doc.text('CO-FOUNDER', 55, 750);
    
    // Helper function for ordinal suffix
    function getOrdinalSuffix(day) {
      if (day > 3 && day < 21) return 'TH';
      switch (day % 10) {
        case 1: return 'ST';
        case 2: return 'ND'; 
        case 3: return 'RD';
        default: return 'TH';
      }
    }
    doc.end();
  } catch (error) {
    next(error);
  }
};

// @desc    Update current lesson
// @route   PUT /api/enrollments/:courseId/current-lesson/:lessonId
// @access  Private
export const updateCurrentLesson = async (req, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    const studentId = req.user._id;

    const enrollment = await Enrollment.findOneAndUpdate(
      { student: studentId, course: courseId },
      { 
        'progress.currentLesson': lessonId,
        lastAccessedAt: new Date()
      },
      { new: true }
    );

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Current lesson updated',
      data: enrollment.progress
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lesson watch progress (video/youtube) with resume & thresholds
// @route   PUT /api/enrollments/:courseId/lessons/:lessonId/progress
// @access  Private
export const updateLessonWatchProgress = async (req, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    const { watchedSeconds = 0, durationSeconds = 0, markIfThreshold = false } = req.body || {};
    const studentId = req.user._id;

    const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
    if (!enrollment) {
      return res.status(404).json({ success:false, message:'Enrollment not found' });
    }

    // Upsert watch entry
    const existing = enrollment.progress.lessonWatch.find(l => l.lesson.toString() === lessonId);
    if (existing) {
      // Only allow monotonic increase
      if (watchedSeconds > existing.watchedSeconds) existing.watchedSeconds = watchedSeconds;
      if (durationSeconds && durationSeconds > existing.durationSeconds) existing.durationSeconds = durationSeconds;
      existing.updatedAt = new Date();
    } else {
      enrollment.progress.lessonWatch.push({ lesson: lessonId, watchedSeconds, durationSeconds, updatedAt: new Date() });
    }

    // Determine thresholds
    const dur = durationSeconds || existing?.durationSeconds || 0;
    let completionTriggered = false;
    if (dur > 0) {
      const ratio = watchedSeconds / dur;
      // Auto-complete at >=90%
      if (ratio >= 0.9) {
        // Reuse markLessonComplete logic style (but inline to avoid duplicate save cycles)
        const already = enrollment.progress.completedLessons.some(cl => cl.lesson.toString() === lessonId);
        if (!already) {
          enrollment.progress.completedLessons.push({ lesson: lessonId, completedAt: new Date() });
          completionTriggered = true;
        }
      } else if (markIfThreshold && ratio >= 0.6) {
        // Allow manual completion at 60%+ if client requested markIfThreshold
        const already = enrollment.progress.completedLessons.some(cl => cl.lesson.toString() === lessonId);
        if (!already) {
          enrollment.progress.completedLessons.push({ lesson: lessonId, completedAt: new Date() });
          completionTriggered = true;
        }
      }
    }

    // Only if completionTriggered recalc progress (mirror existing logic simplified)
    if (completionTriggered) {
      const allLessons = await Lesson.find({ course: courseId }).select('duration');
      const totalLessons = allLessons.length;
      const completedSet = new Set(enrollment.progress.completedLessons.map(cl => cl.lesson.toString()));
      const completedCount = completedSet.size;
      const progressPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
      const totalDuration = allLessons.reduce((sum, l) => sum + (l.duration || 0), 0) || 0;
      const completedDuration = allLessons.reduce((sum, l) => completedSet.has(l._id.toString()) ? sum + (l.duration || 0) : sum, 0);
      const durationWeighted = totalDuration > 0 ? Math.round((completedDuration / totalDuration) * 100) : progressPercentage;
      enrollment.progress.progressPercentage = durationWeighted;
      if (durationWeighted === 100) {
        enrollment.isCompleted = true;
        enrollment.completedAt = new Date();
      }
    }

    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    return res.status(200).json({
      success: true,
      data: {
        watchedSeconds: watchedSeconds,
        durationSeconds: dur,
        completionTriggered,
        progressPercentage: enrollment.progress.progressPercentage,
        isCompleted: enrollment.isCompleted
      }
    });
  } catch (error) { next(error); }
};

// @desc    Unenroll (drop) from a course
// @route   DELETE /api/enrollments/:courseId
// @access  Private
export const unenrollFromCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user._id;

    const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
    if (!enrollment) {
      return res.status(404).json({ success:false, message:'Enrollment not found' });
    }

    // Remove enrollment
    await Enrollment.deleteOne({ _id: enrollment._id });

    // Update course counts & enrolledStudents list
    await Course.findByIdAndUpdate(courseId, {
      $pull: { enrolledStudents: studentId },
      $inc: { totalEnrollments: -1 }
    });

    res.status(200).json({ success:true, message:'Successfully unenrolled from course' });
  } catch (error) { next(error); }
};
