import { Types } from 'mongoose';
import { MenuDraftModel, type IMenuDraft, type MenuDraftMode } from './draft.model.js';
import { getParserForMime } from './parsers/index.js';
import { menuExtractorService } from './extractor.service.js';
import { MenuRepository } from '../menu/repository.js';
import { queueService } from '../../services/queue/index.js';
import { PLATFORM_QUEUES } from '../../services/queue/queue-definitions.js';
import { enqueueVectorSync } from '../vector/enqueue.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import { MenuModel } from '../menu/model.js';
import logger from '../../utils/logger.js';

export interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export class MenuIngestionService {
  private menuRepo = new MenuRepository();

  /**
   * Kick off an upload — creates a `parsing` draft, enqueues background processing,
   * returns the draft id so the client can poll for status.
   */
  public async startUpload(tenantId: string, file: UploadFile): Promise<IMenuDraft> {
    // Validate parser exists up front so bad file types fail fast
    const parser = getParserForMime(file.mimetype, file.originalname);

    const draft = await MenuDraftModel.create({
      tenantId: new Types.ObjectId(tenantId),
      sourceType: parser.name,
      sourceFilename: file.originalname,
      status: 'parsing',
      categories: [],
    });

    // Ship the file bytes to the worker via base64 in the QStash payload.
    // For large files (>1MB) prefer object storage + signed URL; MVP keeps it simple.
    await queueService.enqueue(
      PLATFORM_QUEUES.MENU_INGESTION.name,
      {
        draftId: draft._id.toString(),
        tenantId,
        filename: file.originalname,
        mimetype: file.mimetype,
        base64: file.buffer.toString('base64'),
      },
      { tenantId }
    );

    return draft;
  }

  /**
   * Called by the menu-ingestion worker.
   * Parses the file, extracts structured categories (via LLM if unstructured),
   * and marks the draft `ready` for owner review.
   */
  public async processDraft(
    draftId: string,
    file: UploadFile
  ): Promise<void> {
    const draft = await MenuDraftModel.findById(draftId);
    if (!draft) throw new AppError('Draft not found', 404);

    try {
      const parser = getParserForMime(file.mimetype, file.originalname);
      const parsed = await parser.parse(file);

      const categories =
        parsed.categories && parsed.categories.length > 0
          ? parsed.categories
          : await menuExtractorService.extractFromText(parsed.text);

      draft.categories = categories as any;
      draft.rawText = parsed.text.slice(0, 20_000); // keep a preview only
      draft.status = 'ready';
      await draft.save();

      logger.info({ draftId, categories: categories.length }, 'Menu draft ready for review');
    } catch (err: any) {
      draft.status = 'failed';
      draft.errorMessage = err?.message ?? 'Unknown parsing error';
      await draft.save();
      throw err;
    }
  }

  public async getDraft(tenantId: string, draftId: string): Promise<IMenuDraft> {
    const draft = await MenuDraftModel.findOne({ _id: draftId, tenantId });
    if (!draft) throw new AppError('Draft not found', 404);
    return draft;
  }

  public async listDrafts(tenantId: string): Promise<IMenuDraft[]> {
    return await MenuDraftModel.find({ tenantId }).sort({ createdAt: -1 }).limit(20);
  }

  public async editDraft(
    tenantId: string,
    draftId: string,
    categories: IMenuDraft['categories']
  ): Promise<IMenuDraft> {
    const draft = await this.getDraft(tenantId, draftId);
    if (draft.status === 'approved') {
      throw new AppError('Approved drafts cannot be edited', 400);
    }
    draft.categories = categories as any;
    if (draft.status === 'failed') draft.status = 'ready';
    await draft.save();
    return draft;
  }

  /**
   * Apply the reviewed draft to the live menu.
   *  - `merge`   → upsert into existing menu (bulk import dedupes by name)
   *  - `replace` → wipe live menu products first, then insert
   * Vector sync happens automatically via MenuRepository.bulkImport.
   */
  public async approveDraft(
    tenantId: string,
    draftId: string,
    mode: MenuDraftMode
  ): Promise<{ categoriesCount: number; productsCount: number }> {
    const draft = await this.getDraft(tenantId, draftId);
    if (draft.status !== 'ready') {
      throw new AppError(`Draft must be in "ready" state (currently ${draft.status})`, 400);
    }

    if (mode === 'replace') {
      // Wipe live menu products; bulkImport will refill from the draft.
      const menu = await MenuModel.findOne({ tenantId }).exec();
      if (menu) {
        menu.products.splice(0, menu.products.length);
        await menu.save();
      }
      // Rebuild will happen anyway via bulkImport, but explicit reset is safer.
      await enqueueVectorSync({ op: 'rebuild-tenant', tenantId });
    }

    const payload = {
      categories: draft.categories.map((c) => ({
        name: c.name,
        displayOrder: c.displayOrder ?? 0,
        products: c.products.map((p) => ({
          name: p.name,
          description: p.description,
          basePrice: p.basePrice,
          imageUrl: p.imageUrl,
          variants: [],
        })),
      })),
    } as any;

    const result = await this.menuRepo.bulkImport(tenantId, payload);

    draft.status = 'approved';
    draft.mode = mode;
    await draft.save();

    return { categoriesCount: result.categoriesCount, productsCount: result.productsCount };
  }
}

export const menuIngestionService = new MenuIngestionService();
