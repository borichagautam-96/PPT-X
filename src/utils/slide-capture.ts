/**
 * slide-capture.ts
 *
 * Shared helpers for rasterizing a single slide to a canvas/image.
 * Used by both video-export.ts and image-export.ts.
 *
 * Strategy: render the full presentation HTML into an invisible iframe,
 * jump Reveal.js to the target slide, then snapshot it with html2canvas.
 */

import html2canvas from 'html2canvas';
import type { Presentation } from '@/core/schema';
import { renderPresentation } from '@/core/renderer';

/**
 * Render a full HTML string into a temporarily-mounted, off-screen iframe,
 * wait for it to fully paint, then return the iframe element.
 */
export async function mountHtmlInIframe(html: string, w: number, h: number): Promise<HTMLIFrameElement> {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    position: fixed;
    left: -${w + 20}px;
    top: 0;
    width: ${w}px;
    height: ${h}px;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
    border: none;
  `;
  document.body.appendChild(iframe);
  iframe.srcdoc = html;
  // Wait for the iframe content to load and settle
  await new Promise<void>((resolve) => {
    iframe.onload = () => setTimeout(resolve, 800); // 800 ms for JS/CSS/fonts
  });
  return iframe;
}

/**
 * Generate the HTML for a single slide by rendering the whole presentation
 * and jumping Reveal.js to that slide index. We use a custom script appended
 * to the HTML to auto-navigate on init.
 */
export function renderSlideHtml(presentation: Presentation, slideIndex: number, w: number, h: number): string {
  const baseHtml = renderPresentation(presentation, {
    useCdn: true,
    overrideRevealConfig: {
      controls:    false,
      progress:    false,
      slideNumber: false,
      history:     false,
      autoSlide:   0,
    },
  });
  // Append a script to jump to the target slide once Reveal initialises
  const jumpScript = `
  <script>
    (function() {
      var maxTries = 20;
      function trySlide(tries) {
        if (window.Reveal && window.Reveal.isReady && window.Reveal.isReady()) {
          window.Reveal.slide(${slideIndex}, 0, 0);
        } else if (tries > 0) {
          setTimeout(function() { trySlide(tries - 1); }, 150);
        }
      }
      trySlide(maxTries);
    })();
  </script>
  `;
  return baseHtml.replace('</body>', `${jumpScript}\n</body>`);
}

/**
 * Render one slide into an off-screen iframe and capture it as a canvas.
 * Caller is responsible for nothing further — the iframe is cleaned up internally.
 */
export async function captureSlideToCanvas(
  presentation: Presentation,
  slideIndex: number,
  w: number,
  h: number,
): Promise<HTMLCanvasElement> {
  const html = renderSlideHtml(presentation, slideIndex, w, h);
  const iframe = await mountHtmlInIframe(html, w, h);
  try {
    const captureTarget = iframe.contentDocument?.documentElement ?? iframe.contentDocument?.body;
    if (!captureTarget) throw new Error('iframe content not available for capture');
    return await html2canvas(captureTarget as HTMLElement, {
      width: w,
      height: h,
      scale: 1,
      useCORS: true,
      allowTaint: false,
      backgroundColor: presentation.theme.colors.background,
      logging: false,
      ignoreElements: (el) => el.id === 'ppt-pdf-banner',
    });
  } finally {
    iframe.remove();
  }
}
