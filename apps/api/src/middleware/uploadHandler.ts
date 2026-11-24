import multer from 'multer';
import { ApiError } from './errorHandler';

const ALLOWED_MIME_TYPES = ['text/csv', 'text/plain', 'application/csv'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    // Also allow files where the MIME type wasn't set by the client but the
    // extension is .csv or .txt (some browsers send application/octet-stream).
    const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const isAllowedExt = /\.(csv|txt)$/i.test(file.originalname);

    if (isAllowedMime || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only CSV and TXT files are accepted', 'INVALID_FILE_TYPE'));
    }
  },
});

export const uploadRecipients = upload.single('file');
