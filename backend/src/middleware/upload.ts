import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { nanoid } from 'nanoid';

// Upload directory
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'clothing-images');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueId = nanoid(10);
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${uniqueId}${ext}`;
    cb(null, filename);
  },
});

// File filter - only images
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Nur Bilder sind erlaubt (JPEG, PNG, WEBP)'));
  }
};

// File filter for Excel files (for import)
const excelFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/octet-stream', // Sometimes browsers send this
  ];
  
  const isAllowedMime = allowedMimeTypes.includes(file.mimetype);
  const isAllowedExt = file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
  
  if (isAllowedMime || isAllowedExt) {
    cb(null, true);
  } else {
    cb(new Error(`Excel-Datei erforderlich. Erhalten: ${file.mimetype}, Dateiname: ${file.originalname}`));
  }
};

// File filter for ZIP files (for CSV backup import)
const zipFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'application/octet-stream', // Sometimes browsers send this
  ];
  
  const isAllowedMime = allowedMimeTypes.includes(file.mimetype);
  const isAllowedExt = file.originalname.endsWith('.zip');
  
  if (isAllowedMime || isAllowedExt) {
    cb(null, true);
  } else {
    cb(new Error(`ZIP-Datei erforderlich. Erhalten: ${file.mimetype}, Dateiname: ${file.originalname}`));
  }
};

// Upload configuration for images (disk storage)
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Upload configuration for Excel files (memory storage for processing)
export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Upload configuration for ZIP files (memory storage for processing)
export const uploadZip = multer({
  storage: multer.memoryStorage(),
  fileFilter: zipFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Helper function to delete old image
export const deleteImage = (imageUrl: string): void => {
  if (!imageUrl) return;
  
  try {
    // Extract filename from URL
    const filename = imageUrl.split('/').pop();
    if (!filename) return;
    
    const filePath = path.join(UPLOAD_DIR, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};
