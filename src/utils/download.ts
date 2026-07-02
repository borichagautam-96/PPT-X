import JSZip from 'jszip';
import type { Presentation } from '@/core/schema';
import { renderPresentation } from '@/core/renderer';
import { buildInlineVendorUrls, inlineFooterLogo } from './vendor-inline.ts';

export function downloadBlob(data: Uint8Array | string, filename: string, mimeType: string): void {
  const blob =
    typeof data === 'string'
      ? new Blob([data], { type: mimeType })
      : new Blob([data as unknown as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'presentation'
  );
}

/**
 * Exports a single fully self-contained HTML file — reveal.js/mermaid/highlight.js
 * are inlined as data: URIs (not CDN links), so the file works offline, via
 * file://, or shared to anyone with no access to the app's own server.
 */
export async function exportHtmlSingleFile(presentation: Presentation): Promise<void> {
  const [vendorUrls, inlinedPresentation] = await Promise.all([
    buildInlineVendorUrls(),
    inlineFooterLogo(presentation),
  ]);
  const html = renderPresentation(inlinedPresentation, { useCdn: false, vendorUrls });
  const filename = `${slugify(presentation.meta.title)}.html`;
  downloadBlob(html, filename, 'text/html');
}

export async function exportHtmlZip(presentation: Presentation): Promise<void> {
  const [vendorUrls, inlinedPresentation] = await Promise.all([
    buildInlineVendorUrls(),
    inlineFooterLogo(presentation),
  ]);
  const html = renderPresentation(inlinedPresentation, { useCdn: false, vendorUrls });
  const zip = new JSZip();
  zip.file('index.html', html);
  const data = await zip.generateAsync({ type: 'uint8array' });
  const filename = `${slugify(presentation.meta.title)}.zip`;
  downloadBlob(data, filename, 'application/zip');
}
