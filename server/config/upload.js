import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads/lessons directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'lessons');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

function fileFilter (req, file, cb) {
  const allowed = ['.mp4', '.webm', '.ogg', '.mov'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Unsupported video format'));
  }
  cb(null, true);
}

export const lessonUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter
});

export default lessonUpload;
