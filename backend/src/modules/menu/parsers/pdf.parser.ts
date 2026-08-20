import type { FileParser, ParsedMenuData } from './parser.interface.js';
import { geminiVisionClient } from '../vision.client.js';

/**
 * PDF parser: extracts text with pdf-parse.
 * If meaningful text is found (>100 chars), sends it to Gemini for structured extraction.
 * If text is empty/sparse (scanned PDF), sends the PDF buffer directly to Gemini vision.
 */
export class PdfParser implements FileParser {
  public readonly name = 'pdf' as const;

  public async parse(file: { buffer: Buffer; mimetype: string }): Promise<ParsedMenuData> {
    // Dynamic import to avoid startup cost when PDF parsing isn't needed.
    // CJS interop: pdf-parse may be the default export or the module itself.
    const pdfMod = await import('pdf-parse') as any;
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
      typeof pdfMod.default === 'function' ? pdfMod.default : pdfMod;

    let extractedText = '';
    try {
      const result = await pdfParse(file.buffer);
      extractedText = (result.text ?? '').trim();
    } catch (err: any) {
      // pdf-parse can throw on encrypted/corrupted PDFs — fall through to vision
    }

    if (extractedText.length > 100) {
      const payload = await geminiVisionClient.extractMenuFromText(extractedText);
      return { categories: payload.categories };
    }

    // Scanned PDF — no readable text; send the raw buffer as application/pdf to Gemini
    const payload = await geminiVisionClient.extractMenuFromImageBuffer(file.buffer, 'application/pdf');
    return { categories: payload.categories };
  }
}
