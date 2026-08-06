import type { BulkImportPayload } from '../validation.js';

export interface ParsedMenuData {
  categories: BulkImportPayload['categories'];
}

export interface FileParser {
  readonly name: 'csv' | 'pdf' | 'docx' | 'image';
  parse(file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<ParsedMenuData>;
}
