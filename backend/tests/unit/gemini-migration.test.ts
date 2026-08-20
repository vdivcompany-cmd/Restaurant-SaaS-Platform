import { describe, it, expect } from 'vitest';
import { geminiVisionClient, nimVisionClient } from '../../src/modules/menu/vision.client.js';
import { geminiEmbeddingClient, nemotronClient } from '../../src/modules/vector/index.js';
import { getParserForMime } from '../../src/modules/menu/parsers/index.js';
import { ImageParser } from '../../src/modules/menu/parsers/image.parser.js';
import { PdfParser } from '../../src/modules/menu/parsers/pdf.parser.js';
import { DocxParser } from '../../src/modules/menu/parsers/docx.parser.js';
import { CsvParser } from '../../src/modules/menu/parsers/csv.parser.js';

describe('Gemini Migration Unit Tests', () => {
  it('should export geminiVisionClient and nimVisionClient alias', () => {
    expect(geminiVisionClient).toBeDefined();
    expect(nimVisionClient).toBe(geminiVisionClient);
    expect(typeof geminiVisionClient.extractMenuFromImageBuffer).toBe('function');
    expect(typeof geminiVisionClient.extractMenuFromText).toBe('function');
  });

  it('should export geminiEmbeddingClient and nemotronClient alias', () => {
    expect(geminiEmbeddingClient).toBeDefined();
    expect(nemotronClient).toBe(geminiEmbeddingClient);
    expect(typeof geminiEmbeddingClient.embed).toBe('function');
    expect(typeof geminiEmbeddingClient.embedOne).toBe('function');
  });

  it('should route mimetypes to the correct parser', () => {
    expect(getParserForMime('image/png', 'test.png')).toBeInstanceOf(ImageParser);
    expect(getParserForMime('image/jpeg', 'test.jpg')).toBeInstanceOf(ImageParser);
    expect(getParserForMime('image/webp', 'test.webp')).toBeInstanceOf(ImageParser);
    expect(getParserForMime('application/pdf', 'menu.pdf')).toBeInstanceOf(PdfParser);
    expect(
      getParserForMime(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'menu.docx'
      )
    ).toBeInstanceOf(DocxParser);
    expect(getParserForMime('text/csv', 'menu.csv')).toBeInstanceOf(CsvParser);
  });

  it('geminiVisionClient throws 501 AppError when GEMINI_API_KEY is not configured', async () => {
    const dummyBuffer = Buffer.from('test');
    await expect(
      geminiVisionClient.extractMenuFromImageBuffer(dummyBuffer, 'image/jpeg')
    ).rejects.toMatchObject({
      statusCode: 501,
      message: expect.stringContaining('GEMINI_API_KEY'),
    });
  });

  it('geminiEmbeddingClient throws when GEMINI_API_KEY is not configured', async () => {
    await expect(
      geminiEmbeddingClient.embed(['test string'])
    ).rejects.toThrow(/GEMINI_API_KEY is not configured/);
  });
});
