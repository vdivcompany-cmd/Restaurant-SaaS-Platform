import { CsvParser } from './csv.parser.js';
import { StubParser } from './stub.parser.js';
import type { FileParser } from './parser.interface.js';

export * from './parser.interface.js';

export function getParserForMime(mimetype: string, filename: string): FileParser {
  const lower = (mimetype || '').toLowerCase();
  const name = filename.toLowerCase();

  if (lower.includes('csv') || name.endsWith('.csv')) return new CsvParser();
  if (lower === 'application/pdf' || name.endsWith('.pdf')) return new StubParser('pdf');
  if (
    lower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) return new StubParser('docx');
  if (lower.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(name)) return new StubParser('image');

  throw new Error(`Unsupported file type: ${mimetype || filename}`);
}
