/**
 * vendor-inline.ts
 *
 * Fetches the app's own locally-bundled vendor files (reveal.js, mermaid,
 * highlight.js — see public/vendor/, copied by scripts/copy-vendor.mjs) and
 * inlines them as data: URIs.
 *
 * Used only by HTML export (single-file and ZIP): those files are meant to be
 * fully portable — opened via file://, shared to someone with no access to
 * the app's server, or offline — so they can't reference external URLs
 * (CDN) or even same-origin absolute paths (/vendor/...), which only resolve
 * while the app itself is serving them.
 */

import type { Presentation } from '@/core/schema';
import type { VendorUrls } from '@/core/renderer/html-template';
import { LOCAL_VENDOR_URLS } from '../vendor-urls.ts';
import { resolveFooter } from '@/core/footer-defaults';

export function toDataUri(path: string): Promise<string> {
  return fetch(path)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
    );
}

/** Resolves to a VendorUrls object where every value is a self-contained data: URI. */
export async function buildInlineVendorUrls(): Promise<VendorUrls> {
  const keys = Object.keys(LOCAL_VENDOR_URLS) as (keyof VendorUrls)[];
  const dataUris = await Promise.all(keys.map((key) => toDataUri(LOCAL_VENDOR_URLS[key])));
  const result = {} as VendorUrls;
  keys.forEach((key, i) => { result[key] = dataUris[i]; });
  return result;
}

/**
 * Returns a copy of the presentation with its footer logo inlined as a data:
 * URI, if it's a same-origin path (e.g. the default `/lt_logo.jpeg`). Absolute
 * paths like that only resolve while the app itself is serving them — opened
 * via file:// they'd resolve against the filesystem root instead. External
 * https:// logo URLs the user configured are left as-is (already portable).
 */
export async function inlineFooterLogo(presentation: Presentation): Promise<Presentation> {
  const footer = resolveFooter(presentation.footer);
  if (!footer.logoUrl.startsWith('/')) return presentation;
  try {
    const dataUri = await toDataUri(footer.logoUrl);
    return { ...presentation, footer: { ...presentation.footer, logoUrl: dataUri } };
  } catch {
    return presentation;
  }
}
