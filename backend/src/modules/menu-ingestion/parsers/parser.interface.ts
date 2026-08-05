export interface ParsedSource {
  /** Raw extracted text (used by the LLM extractor for unstructured sources). */
  text: string;
  /** Pre-structured categories, if the parser produced them directly (CSV). */
  categories?: import('../draft.model.js').IExtractedCategory[];
}

export interface FileParser {
  readonly name: 'csv' | 'pdf' | 'docx' | 'image';
  parse(file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<ParsedSource>;
}
