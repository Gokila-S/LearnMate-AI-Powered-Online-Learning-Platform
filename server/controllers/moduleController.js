import Course from '../models/Course.js';
import Module from '../models/Module.js';
import Lesson from '../models/Lesson.js';
import path from 'path';

// Create module
export const createModule = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, description, order } = req.body;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    if (req.user && req.user.role === 'course_admin') {
      if (!course.owner || String(course.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to modify modules for this course' });
      }
    }

    const moduleDoc = await Module.create({
      title,
      description,
      course: course._id,
      order: order || course.modules.length + 1
    });

    course.modules.push(moduleDoc._id);
    course.totalModules = course.modules.length;
    await course.save();

    res.status(201).json({ success: true, data: moduleDoc });
  } catch (err) {
    next(err);
  }
};

// Update module
export const updateModule = async (req, res, next) => {
  try {
    const moduleDoc = await Module.findById(req.params.moduleId);
    if (!moduleDoc) return res.status(404).json({ success: false, message: 'Module not found' });

    if (req.user && req.user.role === 'course_admin') {
      const course = await Course.findById(moduleDoc.course).select('owner');
      if (!course || !course.owner || String(course.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this module' });
      }
    }

    Object.assign(moduleDoc, req.body);
    await moduleDoc.save();
    if (!moduleDoc) return res.status(404).json({ success: false, message: 'Module not found' });
    res.status(200).json({ success: true, data: moduleDoc });
  } catch (err) {
    next(err);
  }
};

// Delete module
export const deleteModule = async (req, res, next) => {
  try {
    const moduleDoc = await Module.findById(req.params.moduleId);
    if (!moduleDoc) return res.status(404).json({ success: false, message: 'Module not found' });

    if (req.user && req.user.role === 'course_admin') {
      const course = await Course.findById(moduleDoc.course).select('owner');
      if (!course || !course.owner || String(course.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this module' });
      }
    }

    // Remove lessons belonging to module (optional: could retain)
    await Lesson.deleteMany({ _id: { $in: moduleDoc.lessons } });

    // Remove from course
    await Course.findByIdAndUpdate(moduleDoc.course, { $pull: { modules: moduleDoc._id }, $inc: { totalModules: -1 } });

    await moduleDoc.deleteOne();
    res.status(200).json({ success: true, message: 'Module deleted' });
  } catch (err) {
    next(err);
  }
};

// Get modules for a course
export const getModules = async (req, res, next) => {
  try {
    const modules = await Module.find({ course: req.params.courseId })
      .populate({ path: 'lessons', select: 'title order content.type duration' })
      .sort({ order: 1 });
    res.status(200).json({ success: true, data: modules });
  } catch (err) {
    next(err);
  }
};

// Attach lesson to module
export const addLessonToModule = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { lessonId } = req.body;

    const moduleDoc = await Module.findById(moduleId);
    if (!moduleDoc) return res.status(404).json({ success: false, message: 'Module not found' });

    if (req.user && req.user.role === 'course_admin') {
      const course = await Course.findById(moduleDoc.course).select('owner');
      if (!course || !course.owner || String(course.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to modify this module' });
      }
    }

    if (!moduleDoc.lessons.includes(lessonId)) moduleDoc.lessons.push(lessonId);
    moduleDoc.totalLessons = moduleDoc.lessons.length;
    await moduleDoc.save();

    res.status(200).json({ success: true, data: moduleDoc });
  } catch (err) {
    next(err);
  }
};

// Reorder modules for a course
export const reorderModules = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { orderedIds } = req.body; // array of moduleIds in desired order

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: 'orderedIds array is required' });
    }

    const modules = await Module.find({ course: courseId }).select('_id');
    const validIds = new Set(modules.map(m => String(m._id)));
    // Validate all ids belong to this course
    for (const id of orderedIds) {
      if (!validIds.has(String(id))) {
        return res.status(400).json({ success: false, message: 'Invalid module id in ordering list' });
      }
    }

    // Two-phase approach to avoid transient duplicate key conflicts on (course, order)
    // Phase 1: bump all involved modules to a high temp range
    const bumpOps = orderedIds.map(id => ({
      updateOne: {
        filter: { _id: id },
        update: { $inc: { order: 1000 } }
      }
    }));
    await Module.bulkWrite(bumpOps);

    // Phase 2: assign final sequential order
    const finalOps = orderedIds.map((id, idx) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: idx + 1 } }
      }
    }));
    await Module.bulkWrite(finalOps);

    const updated = await Module.find({ course: courseId }).sort({ order: 1 });
    res.status(200).json({ success: true, data: updated, orderCount: updated.length });
  } catch (err) {
    next(err);
  }
};

// Reorder lessons within a module (changes only the module.lessons array order)
export const reorderModuleLessons = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { orderedIds } = req.body; // array of lessonIds in desired order
    console.log('[reorderModuleLessons] moduleId=', moduleId, 'orderedIds=', orderedIds);

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: 'orderedIds array is required' });
    }

    const moduleDoc = await Module.findById(moduleId).select('lessons course');
    if (!moduleDoc) return res.status(404).json({ success: false, message: 'Module not found' });

    if (req.user && req.user.role === 'course_admin') {
      const course = await Course.findById(moduleDoc.course).select('owner');
      if (!course || !course.owner || String(course.owner) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to modify this module' });
      }
    }

    const validLessonIds = new Set(moduleDoc.lessons.map(id => String(id)));
    for (const id of orderedIds) {
      if (!validLessonIds.has(String(id))) {
        return res.status(400).json({ success: false, message: 'Invalid lesson id in ordering list' });
      }
    }

    // Atomic update of lessons array without relying on doc.save order detection
    await Module.updateOne({ _id: moduleId }, { $set: { lessons: orderedIds } });
    console.log('[reorderModuleLessons] updateOne applied');

    // Fetch lessons explicitly and map to requested order
    const lessons = await Lesson.find({ _id: { $in: orderedIds } })
      .select('title order content.type duration');
    const lessonMap = new Map(lessons.map(l => [String(l._id), l]));
    const orderedLessons = orderedIds.map(id => lessonMap.get(String(id))).filter(Boolean);
    console.log('[reorderModuleLessons] orderedLessons=', orderedLessons.map(l=>String(l._id)));

    const freshModule = await Module.findById(moduleId).select('_id title description course order');
    const payload = { ...freshModule.toObject(), lessons: orderedLessons };
    const orderMatches = orderedLessons.length === orderedIds.length;
    res.status(200).json({ success: true, orderMatches, data: payload });
  } catch (err) {
    console.error('[reorderModuleLessons] error', err);
    next(err);
  }
};
