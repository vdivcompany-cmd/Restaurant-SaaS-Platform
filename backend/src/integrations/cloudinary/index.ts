import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import multer from 'multer';
import logger from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env['CLOUDINARY_CLOUD_NAME'] || 'default_cloud',
  api_key: process.env['CLOUDINARY_API_KEY'] || 'default_key',
  api_secret: process.env['CLOUDINARY_API_SECRET'] || 'default_secret',
});

// Configure Multer to store incoming file upload buffers cleanly in memory
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum file limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file format. Only JPEG, PNG, WEBP, and PDF files are allowed.', 400));
    }
  },
});

export type EntityFolderType = 'menus' | 'products' | 'employees' | 'menu-docs';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
}

/**
 * Uploads a file buffer directly to a dedicated Cloudinary tenant folder.
 * Directory hierarchy pattern: SaaS_Restaurants/{tenantId}/{entityType}
 */
export async function uploadTenantMedia(
  fileBuffer: Buffer,
  tenantId: string,
  entityType: EntityFolderType,
  originalName?: string
): Promise<CloudinaryUploadResult> {
  const folderPath = `SaaS_Restaurants/${tenantId}/${entityType}`;

  if (process.env['NODE_ENV'] === 'test' || process.env['CLOUDINARY_CLOUD_NAME'] === 'CHANGE_ME' || !process.env['CLOUDINARY_CLOUD_NAME']) {
    logger.info({ tenantId, entityType }, '[SIMULATED CLOUDINARY UPLOAD] File uploaded successfully (Mock)');
    return {
      url: `https://res.cloudinary.com/demo/image/upload/v1234567/SaaS_Restaurants/${tenantId}/${entityType}/${originalName || 'sample_file'}`,
      publicId: `${folderPath}/${originalName || 'sample_file'}`,
      format: 'pdf',
      bytes: fileBuffer.length,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        resource_type: 'auto',
        ...(originalName ? { public_id: originalName.split('.')[0] } : {}),
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          logger.error({ tenantId, entityType, error }, 'Failed to upload media asset to Cloudinary');
          return reject(new AppError('Cloudinary file upload failed', 500));
        }

        logger.info(
          { tenantId, folderPath, publicId: result.public_id, url: result.secure_url },
          'Successfully uploaded media asset to tenant directory in Cloudinary'
        );

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Deletes a media asset from Cloudinary by its public_id.
 * Silently succeeds if the asset is already gone (idempotent).
 */
export async function deleteTenantMedia(publicId: string): Promise<void> {
  if (process.env['NODE_ENV'] === 'test' || process.env['CLOUDINARY_CLOUD_NAME'] === 'CHANGE_ME' || !process.env['CLOUDINARY_CLOUD_NAME']) {
    logger.info({ publicId }, '[SIMULATED CLOUDINARY DELETE] Asset deleted (Mock)');
    return;
  }

  try {
    // Try image first, then raw (for PDFs)
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    if (result.result === 'not found') {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    }
    logger.info({ publicId }, 'Successfully deleted media asset from Cloudinary');
  } catch (error) {
    logger.error({ publicId, error }, 'Failed to delete media asset from Cloudinary');
    // Don't throw — deletion failures shouldn't block DB cleanup
  }
}

