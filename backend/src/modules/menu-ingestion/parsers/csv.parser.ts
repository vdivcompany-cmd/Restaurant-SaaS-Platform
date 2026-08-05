import type { FileParser, ParsedSource } from './parser.interface.js';
import type { IExtractedCategory, IExtractedProduct } from '../draft.model.js';

/**
 * Minimal CSV parser — no external dep.
 * Expected headers (case-insensitive): category, name, price, description?, imageUrl?
 * Handles quoted fields with commas and escaped quotes ("").
 */
export class CsvParser implements FileParser {
  public readonly name = 'csv' as const;

  public async parse(file: { buffer: Buffer }): Promise<ParsedSource> {
    const text = file.buffer.toString('utf8').replace(/^﻿/, ''); // strip BOM
    const rows = this.splitRows(text);
    if (rows.length < 2) {
      throw new Error('CSV must contain a header row and at least one data row');
    }

    const headerRow = rows[0]!;
    const headers = headerRow.map((h) => h.trim().toLowerCase());
    const idx = {
      category: headers.indexOf('category'),
      name: headers.indexOf('name'),
      price: headers.indexOf('price'),
      description: headers.indexOf('description'),
      imageUrl: headers.indexOf('imageurl'),
    };

    if (idx.category < 0 || idx.name < 0 || idx.price < 0) {
      throw new Error('CSV must have columns: category, name, price (description, imageUrl optional)');
    }

    const catMap = new Map<string, IExtractedCategory>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const categoryName = (row[idx.category] ?? '').trim();
      const productName = (row[idx.name] ?? '').trim();
      const priceStr = (row[idx.price] ?? '').trim();
      if (!categoryName || !productName || !priceStr) continue;

      const price = Number(priceStr);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Row ${i + 1}: invalid price "${priceStr}"`);
      }

      const product: IExtractedProduct = {
        name: productName,
        basePrice: price,
      };
      if (idx.description >= 0 && row[idx.description]) product.description = row[idx.description]!.trim();
      if (idx.imageUrl >= 0 && row[idx.imageUrl]) product.imageUrl = row[idx.imageUrl]!.trim();

      let cat = catMap.get(categoryName.toLowerCase());
      if (!cat) {
        cat = { name: categoryName, displayOrder: catMap.size, products: [] };
        catMap.set(categoryName.toLowerCase(), cat);
      }
      cat.products.push(product);
    }

    return { text, categories: Array.from(catMap.values()) };
  }

  private splitRows(text: string): string[][] {
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i]!;
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          field += c;
        }
        continue;
      }
      if (c === '"') { inQuotes = true; continue; }
      if (c === ',') { row.push(field); field = ''; continue; }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        if (row.some((v) => v.length > 0)) rows.push(row);
        row = [];
        field = '';
        continue;
      }
      field += c;
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      if (row.some((v) => v.length > 0)) rows.push(row);
    }
    return rows;
  }
}
