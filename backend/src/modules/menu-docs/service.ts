import { MenuDocRepository } from './repository.js';
import { uploadTenantMedia, deleteTenantMedia } from '../../integrations/cloudinary/index.js';
import type { IMenuDocument, MenuDocFileType } from './model.js';
import type { UploadMenuDocDto, UpdateMenuDocDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import logger from '../../utils/logger.js';

export interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export class MenuDocService {
  private repo = new MenuDocRepository();

  /**
   * Upload a menu document (PDF or image) to Cloudinary and persist metadata.
   */
  public async uploadDocument(
    tenantId: string,
    dto: UploadMenuDocDto,
    file: UploadFile,
    uploadedBy?: string
  ): Promise<IMenuDocument> {
    const fileType = this.resolveFileType(file.mimetype);

    const cloudResult = await uploadTenantMedia(
      file.buffer,
      tenantId,
      'menu-docs',
      file.originalname
    );

    const doc = await this.repo.create(tenantId, {
      title: dto.title,
      fileUrl: cloudResult.url,
      publicId: cloudResult.publicId,
      fileType,
      mimeType: file.mimetype,
      fileSize: cloudResult.bytes,
      isActive: true,
      ...(uploadedBy ? { uploadedBy: uploadedBy as any } : {}),
    });

    logger.info(
      { tenantId, docId: doc._id, title: dto.title, fileType },
      'Menu document uploaded successfully'
    );

    return doc;
  }

  /**
   * List menu documents for a tenant.
   * Public callers see only active documents; authenticated staff see all.
   */
  public async listDocuments(tenantId: string, activeOnly = false): Promise<IMenuDocument[]> {
    return await this.repo.findAll(tenantId, activeOnly);
  }

  public async getDocument(tenantId: string, id: string): Promise<IMenuDocument> {
    const doc = await this.repo.findById(tenantId, id);
    if (!doc) throw new AppError('Menu document not found or out of scope', 404);
    return doc;
  }

  public async updateDocument(tenantId: string, id: string, dto: UpdateMenuDocDto): Promise<IMenuDocument> {
    const doc = await this.repo.update(tenantId, id, dto);
    if (!doc) throw new AppError('Menu document not found or out of scope', 404);
    return doc;
  }

  /**
   * Deletes both the Cloudinary asset and the DB record.
   * Cloudinary deletion is fire-and-forget (won't block DB cleanup).
   */
  public async deleteDocument(tenantId: string, id: string): Promise<void> {
    const doc = await this.repo.findById(tenantId, id);
    if (!doc) throw new AppError('Menu document not found or out of scope', 404);

    // Fire-and-forget Cloudinary cleanup
    void deleteTenantMedia(doc.publicId);

    const success = await this.repo.delete(tenantId, id);
    if (!success) throw new AppError('Menu document deletion failed', 500);

    logger.info({ tenantId, docId: id, publicId: doc.publicId }, 'Menu document deleted');
  }

  private resolveFileType(mimetype: string): MenuDocFileType {
    if (mimetype === 'application/pdf') return 'pdf';
    return 'image';
  }
}

export const menuDocService = new MenuDocService();
