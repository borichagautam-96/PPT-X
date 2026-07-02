// Static paths to vendor files copied to public/vendor/ by scripts/copy-vendor.mjs.
// These resolve against the page origin, so they work in srcdoc iframes
// (which inherit the parent page's base URL) without any CDN dependency.
import type { VendorUrls } from './core/renderer/html-template.ts';

export const LOCAL_VENDOR_URLS: VendorUrls = {
  revealResetCss:        '/vendor/reveal/reset.css',
  revealCss:             '/vendor/reveal/reveal.css',
  revealJs:              '/vendor/reveal/reveal.js',
  revealHighlightPlugin: '/vendor/reveal/plugin/highlight.js',
  revealNotesPlugin:     '/vendor/reveal/plugin/notes.js',
  revealZoomPlugin:      '/vendor/reveal/plugin/zoom.js',
  revealSearchPlugin:    '/vendor/reveal/plugin/search.js',
  revealMathPlugin:      '/vendor/reveal/plugin/math.js',
  highlightCss:          '/vendor/highlight/github-dark.min.css',
  mermaidJs:             '/vendor/mermaid/mermaid.min.js',
};

/** Local copy of Reveal.js's PDF print stylesheet (compiled from .scss — see scripts/copy-vendor.mjs). */
export const LOCAL_REVEAL_PRINT_CSS = '/vendor/reveal/print/pdf.css';

/** Local base path for Reveal's math (KaTeX) plugin — pass as `katexLocalBase` alongside LOCAL_VENDOR_URLS. */
export const LOCAL_KATEX_BASE = '/vendor/katex';
