import type { FileParser, ParsedSource } from './parser.interface.js';

/**
 * Placeholder for PDF / DOCX / image sources.
 *
 * TODO — wire real implementations:
 *   pdf   → `pdf-parse` or `pdfjs-dist` for text; `pdf2pic` + OCR for scanned PDFs
 *   docx  → `mammoth` (produces plain text or HTML)
 *   image → `tesseract.js` for OCR, or a hosted vision model
 *
 * Each real parser should return `{ text }`, and the LLM extractor turns that
 * text into structured categories/products.
 */
export class StubParser implements FileParser {
  constructor(public readonly name: 'pdf' | 'docx' | 'image') {}

  public async parse(_file: { buffer: Buffer; originalname: string }): Promise<ParsedSource> {
    throw new Error(
      `${this.name} parsing is not enabled yet. Install the appropriate lib (pdf-parse / mammoth / tesseract.js) and swap StubParser for the real implementation.`
    );
  }
}
