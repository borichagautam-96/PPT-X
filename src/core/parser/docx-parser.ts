/**
 * docx-parser.ts
 *
 * Public entry point for importing a .docx file: converts it to Markdown
 * (docx-to-md.ts) and feeds that through the existing markdownToPresentation()
 * pipeline — the same "convert to Markdown, reuse the pipeline" approach
 * adoc-to-md.ts uses for AsciiDoc.
 */

import type { Presentation } from '../schema.ts';
import type { ParseOptions } from './types.ts';
import { docxToMarkdown } from './docx-to-md.ts';
import { markdownToPresentation } from './index.ts';

export interface DocxParseProgress {
  current: number;
  total: number;
  label: string;
}

/** Derive a human-readable title from a filename: "meeting_notes-v2.docx" → "Meeting Notes V2". */
function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.docx$/i, '');
  const words = base.replace(/[_-]+/g, ' ').trim();
  return words.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1)) || 'Imported Document';
}

export async function docxToPresentation(
  file: File,
  onProgress?: (p: DocxParseProgress) => void,
  options: ParseOptions = {},
  signal?: AbortSignal,
): Promise<Presentation> {
  onProgress?.({ current: 0, total: 2, label: 'Reading file…' });
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.({ current: 1, total: 2, label: 'Converting document…' });
  const markdown = await docxToMarkdown(arrayBuffer, signal);

  // markdownToPresentation's slide-splitter silently discards any content
  // that appears before the first H1/H2 — by design for typed Markdown
  // (which always opens with "# Title"), but plenty of real Word documents
  // don't use Word's "Heading" styles at all. Without a leading heading,
  // the whole document would otherwise vanish into an empty presentation.
  const startsWithHeading = /^\s*#{1,2}\s/.test(markdown);
  const safeMarkdown = startsWithHeading
    ? markdown
    : `# ${titleFromFilename(file.name)}\n\n${markdown}`;

  onProgress?.({ current: 2, total: 2, label: 'Building slides…' });
  return markdownToPresentation(safeMarkdown, options);
}
