import multer from 'multer';
import { warningResponse } from '../utils/response.js';

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
    fields: 0,
  },
  fileFilter(_request, file, callback) {
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error('El formato de imagen debe ser JPEG, PNG o WEBP.'));
    }
    return callback(null, true);
  },
});

export function parseImageUpload(request, response, next) {
  uploadImage.single('image')(request, response, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return warningResponse(response, 'La imagen no puede superar los 8 MB.', {}, 413);
    }

    return warningResponse(response, error.message, {}, 400);
  });
}
