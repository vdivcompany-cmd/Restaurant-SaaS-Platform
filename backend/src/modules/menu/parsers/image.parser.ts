import type { FileParser, ParsedMenuData } from './parser.interface.js';
import { geminiVisionClient } from '../vision.client.js';

/**
 * Image parser (PNG, JPEG, WEBP): sends the buffer directly to Gemini vision for OCR + extraction.
 */
export class ImageParser implements FileParser {
  public readonly name = 'image' as const;

  public async parse(file: { buffer: Buffer; mimetype: string }): Promise<ParsedMenuData> {
    const payload = await geminiVisionClient.extractMenuFromImageBuffer(file.buffer, file.mimetype);
    return { categories: payload.categories };
  }
}
