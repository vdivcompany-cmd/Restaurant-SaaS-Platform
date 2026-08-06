import axios, { AxiosInstance } from 'axios';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import type { BulkImportPayload } from './validation.js';

const EXTRACTION_PROMPT = `You are a menu extraction assistant. Extract all menu items from the provided content and return a JSON object with this exact structure:
{
  "categories": [
    {
      "name": "Category Name",
      "displayOrder": 0,
      "products": [
        {
          "name": "Product Name",
          "description": "Product description",
          "basePrice": 0.00,
          "imageUrl": ""
        }
      ]
    }
  ]
}
Rules: basePrice must be a non-negative number. Return only valid JSON, no markdown fences, no extra text.`;

/**
 * NVIDIA NIM vision/chat client for structured menu extraction from images and text.
 * Reuses the same NEMOTRON_API_KEY and NEMOTRON_BASE_URL as the embedding client.
 */
export class NimVisionClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.NEMOTRON_BASE_URL,
      timeout: 90_000,
      headers: {
        Authorization: `Bearer ${env.NEMOTRON_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Extracts structured menu data from an image buffer (PNG, JPEG, WEBP) or
   * a scanned PDF rendered as an image.
   */
  public async extractMenuFromImageBuffer(
    buffer: Buffer,
    mimetype: string
  ): Promise<BulkImportPayload> {
    this.requireApiKey();

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimetype};base64,${base64}`;

    return this.callChatCompletions([
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ]);
  }

  /**
   * Extracts structured menu data from plain text (e.g. text-based PDF content).
   */
  public async extractMenuFromText(text: string): Promise<BulkImportPayload> {
    this.requireApiKey();

    return this.callChatCompletions([
      {
        role: 'user',
        content: `${EXTRACTION_PROMPT}\n\nMenu text to extract from:\n\n${text.slice(0, 12_000)}`,
      },
    ]);
  }

  private requireApiKey(): void {
    if (!env.NEMOTRON_API_KEY) {
      throw new AppError(
        'Menu file extraction is not configured: NEMOTRON_API_KEY is not set. ' +
          'Configure NVIDIA NIM credentials to enable PDF/image parsing.',
        501
      );
    }
  }

  private async callChatCompletions(messages: unknown[]): Promise<BulkImportPayload> {
    try {
      const { data } = await this.http.post('/chat/completions', {
        model: env.NEMOTRON_VISION_MODEL,
        messages,
        max_tokens: 4096,
        temperature: 0.1,
      });

      const content: string = data?.choices?.[0]?.message?.content ?? '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON object found in NIM response. Content: ${content.slice(0, 200)}`);
      }

      const parsed = JSON.parse(jsonMatch[0]) as BulkImportPayload;
      if (!Array.isArray(parsed.categories)) {
        throw new Error('NIM response missing categories array');
      }

      return parsed;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err?.response?.data ?? err?.message }, 'NIM vision/chat extraction failed');
      throw new AppError('Failed to extract menu content via NIM vision API', 502);
    }
  }
}

export const nimVisionClient = new NimVisionClient();
