/**
 * docx-to-md.ts
 *
 * .docx → Markdown converter for the PPTAutomation parser pipeline.
 * Converts enough of a Word document so markdownToPresentation() can handle it,
 * mirroring how adoc-to-md.ts lets AsciiDoc reuse the same downstream pipeline.
 *
 * Strategy: mammoth converts the docx to HTML (handling Word "Heading 1/2/…"
 * styles, lists, tables, and inline images as base64 data URIs), then Turndown
 * (+ GFM plugin) converts that HTML to GitHub-flavoured Markdown.
 *
 * Why not mammoth's own convertToMarkdown()? Its built-in Markdown writer has
 * no table support at all — tables would collapse into unstructured text.
 * Going through HTML preserves them as proper GFM tables.
 */

import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/**
 * Yield one tick to the browser's event loop. mammoth/Turndown/DOMParser all
 * require DOM APIs (unavailable in a Web Worker in this Chromium build), so
 * the conversion has to run on the main thread — but a large/image-heavy
 * document can block it long enough to trigger the "Page Unresponsive"
 * watchdog. Yielding between phases lets the browser process paint/input in
 * between, even though total wall-clock time is unchanged.
 */
function yieldToEventLoop(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    setTimeout(() => {
      if (signal?.aborted) reject(new DOMException('Aborted', 'AbortError'));
      else resolve();
    }, 0);
  });
}

/**
 * Normalize mammoth's table markup so Turndown+GFM can convert it to a proper
 * Markdown table:
 *
 *  1. turndown-plugin-gfm only treats a <table> as having a header if every
 *     cell in the first row is a literal <th> — but mammoth always emits
 *     plain <td> for every row, regardless of Word's actual header-row
 *     styling. Since GFM Markdown syntactically requires *some* header row,
 *     promoting the first row to <th> is the standard convention here.
 *  2. mammoth wraps each cell's content in <p>. Turndown's default paragraph
 *     rule inserts blank lines around <p>, which breaks the one-line-per-row
 *     table syntax if left as-is — so those inner <p> tags are unwrapped
 *     (multiple paragraphs in one cell are joined with <br> instead).
 */
async function normalizeTablesForMarkdown(html: string, signal?: AbortSignal): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const cells = Array.from(doc.querySelectorAll('table td, table th'));
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const paragraphs = Array.from(cell.querySelectorAll('p'));
    if (paragraphs.length > 0) {
      cell.innerHTML = paragraphs.map((p) => p.innerHTML).join('<br>');
    }
    if (i % 200 === 199) await yieldToEventLoop(signal);
  }

  const tables = Array.from(doc.querySelectorAll('table'));
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const firstRow = table.rows[0];
    if (firstRow) {
      const firstRowCells = Array.from(firstRow.cells);
      if (firstRowCells.length > 0 && !firstRowCells.every((c) => c.tagName === 'TH')) {
        for (const td of firstRowCells) {
          const th = doc.createElement('th');
          th.innerHTML = td.innerHTML;
          for (const attr of Array.from(td.attributes)) th.setAttribute(attr.name, attr.value);
          td.replaceWith(th);
        }
      }
    }
    if (i % 50 === 49) await yieldToEventLoop(signal);
  }

  return doc.body.innerHTML;
}

/**
 * Convert a .docx file (as an ArrayBuffer) to a Markdown string.
 * Word's built-in "Heading 1"/"Heading 2" styles map to H1/H2, which the
 * existing Markdown parser splits into new slides.
 */
export async function docxToMarkdown(arrayBuffer: ArrayBuffer, signal?: AbortSignal): Promise<string> {
  const { value: html } = await mammoth.convertToHtml(
    { arrayBuffer },
    // Default image handling already inlines images as base64 data URIs.
    { includeDefaultStyleMap: true },
  );
  await yieldToEventLoop(signal);

  const normalizedHtml = await normalizeTablesForMarkdown(html, signal);
  await yieldToEventLoop(signal);

  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });
  turndown.use(gfm);

  return turndown.turndown(normalizedHtml);
}
