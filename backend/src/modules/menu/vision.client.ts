import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import type { BulkImportPayload } from './validation.js';

const EXTRACTION_PROMPT = `You are a menu extraction assistant. Extract all menu items and categories from the provided content and return a JSON object.
Rules:
1. basePrice must be a non-negative number.
2. Group items into sensible categories (e.g. Starters, Main Courses, Desserts, Beverages).
3. If an item has customization options/variants, extract them with name and priceDelta.
4. Extract descriptions and image URLs if present.`;

/**
 * Google Gemini vision/multimodal client for structured menu extraction from images, PDFs, and text.
 */
export class GeminiVisionClient {
  private aiInstance: any = null;
  private typeHelper: any = null;

  private async getClient(): Promise<{ ai: any; Type: any }> {
    if (!this.aiInstance) {
      this.requireApiKey();
      const { GoogleGenAI, Type } = await import('@google/genai');
      this.aiInstance = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      this.typeHelper = Type;
    }
    return { ai: this.aiInstance, Type: this.typeHelper };
  }

  private getMenuResponseSchema(Type: any) {
    return {
      type: Type.OBJECT,
      properties: {
        categories: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              displayOrder: { type: Type.NUMBER },
              products: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    basePrice: { type: Type.NUMBER },
                    imageUrl: { type: Type.STRING },
                    variants: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          minSelect: { type: Type.NUMBER },
                          maxSelect: { type: Type.NUMBER },
                          options: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                name: { type: Type.STRING },
                                priceDelta: { type: Type.NUMBER },
                                isDefault: { type: Type.BOOLEAN },
                              },
                              required: ['name'],
                            },
                          },
                        },
                        required: ['name', 'options'],
                      },
                    },
                  },
                  required: ['name', 'basePrice'],
                },
              },
            },
            required: ['name', 'products'],
          },
        },
      },
      required: ['categories'],
    };
  }

  /**
   * Extracts structured menu data from an image buffer (PNG, JPEG, WEBP) or PDF buffer.
   */
  public async extractMenuFromImageBuffer(
    buffer: Buffer,
    mimetype: string
  ): Promise<BulkImportPayload> {
    this.requireApiKey();

    const { ai, Type } = await this.getClient();
    const base64Data = buffer.toString('base64');

    return this.generateStructuredMenu(ai, Type, [
      {
        text: EXTRACTION_PROMPT,
      },
      {
        inlineData: {
          mimeType: mimetype,
          data: base64Data,
        },
      },
    ]);
  }

  /**
   * Extracts structured menu data from plain text (e.g. text-based PDF or DOCX content).
   */
  public async extractMenuFromText(text: string): Promise<BulkImportPayload> {
    this.requireApiKey();

    const { ai, Type } = await this.getClient();

    return this.generateStructuredMenu(ai, Type, [
      {
        text: `${EXTRACTION_PROMPT}\n\nMenu text to extract from:\n\n${text.slice(0, 30_000)}`,
      },
    ]);
  }

  private requireApiKey(): void {
    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        'Menu file extraction is not configured: GEMINI_API_KEY is not set. ' +
          'Configure Google Gemini API key to enable PDF/image parsing.',
        501
      );
    }
  }

  private async generateStructuredMenu(
    ai: any,
    Type: any,
    parts: any[]
  ): Promise<BulkImportPayload> {
    try {
      const response = await ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: this.getMenuResponseSchema(Type),
          temperature: 0.1,
        },
      });

      const content = response.text?.trim() ?? '';
      if (!content) {
        throw new Error('Gemini returned an empty response');
      }

      const parsed = JSON.parse(content) as BulkImportPayload;
      if (!Array.isArray(parsed.categories)) {
        throw new Error('Gemini response missing categories array');
      }

      return parsed;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err?.message ?? err }, 'Gemini vision/chat extraction failed');
      throw new AppError('Failed to extract menu content via Gemini API', 502);
    }
  }
}

export const geminiVisionClient = new GeminiVisionClient();
export const nimVisionClient = geminiVisionClient;
