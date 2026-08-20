import type { FileParser, ParsedMenuData } from './parser.interface.js';
import { geminiVisionClient } from '../vision.client.js';

/**
 * DOCX parser: extracts text with mammoth, then uses Gemini for structured extraction.
 */
export class DocxParser implements FileParser {
  public readonly name = 'docx' as const;

  public async parse(file: { buffer: Buffer }): Promise<ParsedMenuData> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    const text = (result.value ?? '').trim();

    if (!text || text.length < 20) {
      throw new Error('DOCX file appears to be empty or contains no extractable text');
    }

    const payload = await geminiVisionClient.extractMenuFromText(text);
    return { categories: payload.categories };
  }
}
