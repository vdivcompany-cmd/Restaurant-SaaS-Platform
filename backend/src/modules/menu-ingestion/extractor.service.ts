import type { IExtractedCategory } from './draft.model.js';

/**
 * LLM-driven extraction from raw text → structured categories/products.
 *
 * TODO — wire a real LLM here. Recommended call shape (OpenAI-compatible /chat/completions
 * with response_format=json_object, or NVIDIA NIM chat endpoint):
 *
 *   system: "Extract restaurant menu items from the text. Return strict JSON:
 *            { categories: [{ name, displayOrder, products: [{ name, description?, basePrice }] }] }"
 *   user:   the raw parsed text
 *
 * For CSV inputs the parser already returns structured categories, so this
 * extractor is only invoked when a parser gives `text` without `categories`.
 */
export class MenuExtractorService {
  public async extractFromText(_rawText: string): Promise<IExtractedCategory[]> {
    throw new Error(
      'LLM extraction not enabled yet. Wire an LLM client (OpenAI, NVIDIA NIM chat, etc.) ' +
      'in MenuExtractorService.extractFromText to convert raw menu text into structured categories.'
    );
  }
}

export const menuExtractorService = new MenuExtractorService();
