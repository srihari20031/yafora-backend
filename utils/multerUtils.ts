import multer from 'multer';
import { Multer } from 'multer';

interface MulterConfigOptions {
  maxFileSize?: number; // In bytes
  allowedMimeTypes?: string[]; // e.g., ['image/jpeg', 'application/pdf']
  maxFiles?: number; // Maximum number of files for array uploads
  fieldName?: string; // Field name for file uploads
}

export function createMulterInstance(options: MulterConfigOptions = {}): Multer {
  const {
    maxFileSize = 5 * 1024 * 1024, // Default: 5MB
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxFiles = 10,
    fieldName = 'files',
  } = options;

  const storage = multer.memoryStorage();

  return multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
    },
    fileFilter: (req, file, cb) => {
      console.log('[MulterUtils] File filter called:', {
        filename: file.originalname,
        mimetype: file.mimetype,
      });
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        console.error('[MulterUtils] File filter rejected:', file.originalname);
        cb(new Error(`Only ${allowedMimeTypes.join(', ')} files are allowed!`));
      }
    },
  });
}