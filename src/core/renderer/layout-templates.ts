/**
 * layout-templates.ts
 *
 * Wraps rendered element HTML into the correct column structure
 * based on the slide's layout type.
 *
 * Single responsibility: given a layout name + array of element HTML strings,
 * return the final inner HTML of the <section>.
 */

import type { Element, SlideLayout } from '../schema.ts';
import type { RenderContext } from './element-renderers.ts';
import { renderElement } from './element-renderers.ts';

// ─── PUBLIC ──────────────────────────────────────────────────

/**
 * Render a slide's elements using the correct layout wrapper.
 * Returns the inner HTML to place inside the <section>.
 */
export function applyLayout(
  layout: SlideLayout,
  elements: Element[],
  title: string | undefined,
  ctx: RenderContext,
  slideIndex: number = 0,
): string {
  switch (layout) {
    case 'cover':
      return coverLayout(elements, title, ctx, slideIndex);
    case 'section':
      return sectionLayout(title);
    case 'two-column':
      return twoColumnLayout(elements, ctx, slideIndex);
    case 'three-column':
      return threeColumnLayout(elements, ctx, slideIndex);
    case 'image-left':
      return imageColumnLayout(elements, ctx, 'left', slideIndex);
    case 'image-right':
      return imageColumnLayout(elements, ctx, 'right', slideIndex);
    case 'full-image':
      return fullImageLayout(elements, ctx, slideIndex);
    case 'full-video':
      return fullVideoLayout(elements, ctx, slideIndex);
    case 'quote':
      return quoteLayout(elements, ctx, slideIndex);
    case 'content':
    case 'blank':
    case 'comparison':
    case 'timeline':
    case 'custom':
    default:
      return renderAll(elements, ctx, slideIndex);
  }
}

// ─── LAYOUT IMPLEMENTATIONS ──────────────────────────────────

function coverLayout(elements: Element[], title: string | undefined, ctx: RenderContext, slideIndex: number = 0): string {
  const heading = title
    ? `<h1>${title}</h1>`
    : '';
  const body = renderAll(elements, ctx);
  return `<div class="ppt-layout-cover">\n  ${heading}\n  ${body}\n</div>`;
}

function sectionLayout(title: string | undefined): string {
  const heading = title ? `<h2>${title}</h2>` : '';
  return `<div class="ppt-layout-section">\n  ${heading}\n</div>`;
}

function contentLayout(elements: Element[], title: string | undefined, ctx: RenderContext): string {
  const heading = title ? `<h2>${title}</h2>` : '';
  const body = renderAll(elements, ctx);
  return `${heading}\n${body}`;
}

function twoColumnLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0): string {
  const mid = Math.ceil(elements.length / 2);
  const left  = elements.slice(0, mid);
  const right = elements.slice(mid);
  return columnGrid('ppt-columns--2', [left, right], ctx, slideIndex);
}

function threeColumnLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0): string {
  const third = Math.ceil(elements.length / 3);
  const cols = [
    elements.slice(0, third),
    elements.slice(third, third * 2),
    elements.slice(third * 2),
  ];
  return columnGrid('ppt-columns--3', cols, ctx, slideIndex);
}

function imageColumnLayout(
  elements: Element[],
  ctx: RenderContext,
  imagePosition: 'left' | 'right',
  slideIndex: number = 0,
): string {
  const imageEls  = elements.filter((e) => e.type === 'image');
  const otherEls  = elements.filter((e) => e.type !== 'image');

  const cols =
    imagePosition === 'left'
      ? [imageEls, otherEls]
      : [otherEls, imageEls];

  const gridClass =
    imagePosition === 'left' ? 'ppt-columns--image-left' : 'ppt-columns--image-right';

  return columnGrid(gridClass, cols, ctx, slideIndex);
}

function fullImageLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0): string {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:0;">${renderAll(elements, ctx, slideIndex)}</div>`;
}

function fullVideoLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0): string {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:0;">${renderAll(elements, ctx, slideIndex)}</div>`;
}

function quoteLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0): string {
  return `<div class="ppt-layout-cover" style="text-align:center;align-items:center;">${renderAll(elements, ctx, slideIndex)}</div>`;
}

// ─── HELPERS ─────────────────────────────────────────────────

function renderAll(elements: Element[], ctx: RenderContext, slideIndex: number = 0): string {
  const flowEls = elements.filter((el) => el.position.mode !== 'absolute');
  const allAbsEls = elements.filter((el) => el.position.mode === 'absolute');

  // Template graphic elements (from slide master/layout) — rendered in a full-canvas
  // overlay at their exact absolute coordinates so all footer elements show correctly.
  const templateEls = allAbsEls.filter((el) => el.isTemplateGraphic === true);
  const templateIds  = new Set(templateEls.map((el) => el.id));
  const absEls       = allAbsEls.filter((el) => !templateIds.has(el.id));

  const slideNum = String(slideIndex + 1);

  // Preprocess template elements: inject per-slide slide number
  const processedTemplateEls = templateEls
    .filter(el => !(el.position.y !== undefined && el.position.y > 88))
    .map((el) => {
    if ((el.type === 'text' || el.type === 'heading') && typeof (el as { content?: unknown }).content === 'string') {
      const raw = (el as { content: string }).content;
      if (raw.includes('{{SLIDE_NUM}}')) {
        return { ...el, content: raw.replace(/\{\{SLIDE_NUM\}\}/g, slideNum) };
      }
    }
    return el;
  });

  const flowHtml = flowEls.map((el) => renderElement(el, ctx)).join('\n');

  // Regular absolute elements layer
  const absLayer = absEls.length
    ? `<div class="ppt-abs-layer" style="position:absolute;inset:0;pointer-events:none;">${
        absEls.map((el) => renderElement(el, ctx)).join('\n')
      }</div>`
    : '';

  // Template graphics layer — full-canvas overlay, elements at their natural coordinates
  const templateLayer = processedTemplateEls.length
    ? `<div class="ppt-template-layer" style="position:absolute;inset:0;pointer-events:none;z-index:50;overflow:visible;font-size:12px;line-height:1.3;">${
        processedTemplateEls.map((el) => renderElement(el, ctx)).join('\n')
      }</div>`
    : '';

  const pesFooterHtml = (() => {
    const baseHeight = 1080;
    const blueBarH = baseHeight * 0.07876;
    const grayBarH = baseHeight * 0.03097;

    return `
    <div style="position:absolute;bottom:0;left:0;width:100%;height:${blueBarH + grayBarH}px;pointer-events:none;z-index:50;overflow:hidden;font-family:'Trebuchet MS', Arial, sans-serif;">
      <!-- Blue Footer Bar -->
      <div style="position:absolute;left:0;bottom:0;width:100%;height:${blueBarH}px;background-color:#003F72;"></div>
      <!-- Gray Footer Bar -->
      <div style="position:absolute;left:0;bottom:${blueBarH}px;width:100%;height:${grayBarH}px;background-color:#BFBFBF;"></div>
      <!-- Left Footer Text -->
      <div style="position:absolute;left:2.160%;bottom:${blueBarH + (grayBarH - baseHeight * 0.02855) / 2}px;width:37.651%;height:${baseHeight * 0.02855}px;display:flex;align-items:center;font-size:12.72px;color:#000000;font-family:Arial, sans-serif;line-height:1;margin:0;padding:0;">
        <span>&lt;Deliverable_No_RevNo&gt; | All rights reserved with Larsen &amp; Toubro Limited. | ${
          (() => {
            const sysName = ctx.presentation?.meta?.title || 'Name of System';
            return (sysName === 'Name of System' || sysName === 'Untitled Presentation')
              ? '<span style="color:#FF0000;">&lt;</span>' + sysName + '<span style="color:#FF0000;">&gt;</span>'
              : sysName;
          })()
        }</span>
      </div>
      <!-- Page Number -->
      <div style="position:absolute;left:87.839%;bottom:${blueBarH + (grayBarH - baseHeight * 0.03097) / 2}px;width:10.000%;height:${baseHeight * 0.03097}px;display:flex;align-items:center;justify-content:flex-end;font-size:12.72px;color:#000000;font-family:Arial, sans-serif;line-height:1;margin:0;padding:0;">
        ${slideIndex + 1} of ${ctx.presentation?.slides?.length ?? 1}
      </div>
      <!-- L&T Logo -->
      <div style="position:absolute;left:69.691%;bottom:${(blueBarH - baseHeight * 0.07876) / 2}px;width:28.149%;height:${baseHeight * 0.07876}px;background-image:url(/lt_logo.jpeg);background-size:100% 100%;background-repeat:no-repeat;background-color:transparent;box-shadow:none;border:none;margin:0;padding:0;"></div>
      <!-- Aerospace Text -->
      <div style="position:absolute;left:2.637%;bottom:${(blueBarH - baseHeight * 0.03814) / 2}px;width:34.369%;height:${baseHeight * 0.03814}px;display:flex;align-items:center;font-size:17.52px;color:#D9D9D9;line-height:1;margin:0;padding:0;">
        Aerospace | Electronics | Land &amp; Marine – Platforms &amp; Systems
      </div>
      <!-- Copyright Text -->
      <div style="position:absolute;left:33.810%;bottom:${(blueBarH - baseHeight * 0.03814) / 2}px;width:31.893%;height:${baseHeight * 0.03814}px;display:flex;align-items:center;justify-content:center;font-size:17.52px;color:#D9D9D9;line-height:1;margin:0;padding:0;">
        &copy; Larsen &amp; Toubro Limited: Restricted
      </div>
    </div>`;
  })();

  return flowHtml + '\n' + absLayer + '\n' + templateLayer + '\n' + pesFooterHtml;
}

function columnGrid(
  gridClass: string,
  columns: Element[][],
  ctx: RenderContext,
  slideIndex: number = 0,
): string {
  const cols = columns
    .map(
      (colEls) =>
        `<div class="ppt-col">\n${renderAll(colEls, ctx, slideIndex)}\n</div>`,
    )
    .join('\n');
  return `<div class="ppt-columns ${gridClass}">\n${cols}\n</div>`;
}
