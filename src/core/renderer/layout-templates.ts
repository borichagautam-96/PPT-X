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
import { escapeHtml } from './utils.ts';
import { resolveFooter } from '../footer-defaults.ts';

export type TitlePosition = { x: number; y: number; width?: number; height?: number };

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
  titlePosition?: TitlePosition,
  contentScale?: number,
): string {
  switch (layout) {
    case 'cover':
      return coverLayout(elements, title, ctx, slideIndex, titlePosition, contentScale);
    case 'section':
      return sectionLayout(title, titlePosition);
    case 'two-column':
      return twoColumnLayout(elements, ctx, slideIndex, contentScale);
    case 'three-column':
      return threeColumnLayout(elements, ctx, slideIndex, contentScale);
    case 'image-left':
      return imageColumnLayout(elements, ctx, 'left', slideIndex, contentScale);
    case 'image-right':
      return imageColumnLayout(elements, ctx, 'right', slideIndex, contentScale);
    case 'full-image':
      return fullImageLayout(elements, ctx, slideIndex);
    case 'full-video':
      return fullVideoLayout(elements, ctx, slideIndex);
    case 'quote':
      return quoteLayout(elements, ctx, slideIndex, contentScale);
    case 'content':
    case 'blank':
    case 'comparison':
    case 'timeline':
    case 'custom':
    default:
      return renderAll(elements, ctx, slideIndex, contentScale);
  }
}

// ─── LAYOUT IMPLEMENTATIONS ──────────────────────────────────

/** Inline style attribute that absolutely positions the title heading when a manual override is set. */
function titleStyleAttr(pos?: TitlePosition): string {
  if (!pos) return '';
  const w = pos.width  != null ? `width:${pos.width}%;`   : '';
  const h = pos.height != null ? `height:${pos.height}%;` : '';
  return ` style="position:absolute; left:${pos.x}%; top:${pos.y}%; ${w}${h}margin:0;"`;
}

function coverLayout(elements: Element[], title: string | undefined, ctx: RenderContext, slideIndex: number = 0, titlePosition?: TitlePosition, contentScale?: number): string {
  const heading = title
    ? `<h1${titleStyleAttr(titlePosition)}>${escapeHtml(title)}</h1>`
    : '';
  const body = renderAll(elements, ctx, slideIndex, contentScale);
  const wrapperStyle = titlePosition ? ' style="position:relative;"' : '';
  return `<div class="ppt-layout-cover"${wrapperStyle}>\n  ${heading}\n  ${body}\n</div>`;
}

function sectionLayout(title: string | undefined, titlePosition?: TitlePosition): string {
  const heading = title ? `<h2${titleStyleAttr(titlePosition)}>${escapeHtml(title)}</h2>` : '';
  const wrapperStyle = titlePosition ? ' style="position:relative;"' : '';
  return `<div class="ppt-layout-section"${wrapperStyle}>\n  ${heading}\n</div>`;
}

function contentLayout(elements: Element[], title: string | undefined, ctx: RenderContext): string {
  const heading = title ? `<h2>${title}</h2>` : '';
  const body = renderAll(elements, ctx);
  return `${heading}\n${body}`;
}

function twoColumnLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0, contentScale?: number): string {
  const mid = Math.ceil(elements.length / 2);
  const left  = elements.slice(0, mid);
  const right = elements.slice(mid);
  return columnGrid('ppt-columns--2', [left, right], ctx, slideIndex, contentScale);
}

function threeColumnLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0, contentScale?: number): string {
  const third = Math.ceil(elements.length / 3);
  const cols = [
    elements.slice(0, third),
    elements.slice(third, third * 2),
    elements.slice(third * 2),
  ];
  return columnGrid('ppt-columns--3', cols, ctx, slideIndex, contentScale);
}

function imageColumnLayout(
  elements: Element[],
  ctx: RenderContext,
  imagePosition: 'left' | 'right',
  slideIndex: number = 0,
  contentScale?: number,
): string {
  const imageEls  = elements.filter((e) => e.type === 'image');
  const otherEls  = elements.filter((e) => e.type !== 'image');

  const cols =
    imagePosition === 'left'
      ? [imageEls, otherEls]
      : [otherEls, imageEls];

  const gridClass =
    imagePosition === 'left' ? 'ppt-columns--image-left' : 'ppt-columns--image-right';

  return columnGrid(gridClass, cols, ctx, slideIndex, contentScale);
}

function fullImageLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0): string {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:0;">${renderAll(elements, ctx, slideIndex)}</div>`;
}

function fullVideoLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0): string {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:0;">${renderAll(elements, ctx, slideIndex)}</div>`;
}

function quoteLayout(elements: Element[], ctx: RenderContext, slideIndex: number = 0, contentScale?: number): string {
  return `<div class="ppt-layout-cover" style="text-align:center;align-items:center;">${renderAll(elements, ctx, slideIndex, contentScale)}</div>`;
}

// ─── HELPERS ─────────────────────────────────────────────────

function renderAll(elements: Element[], ctx: RenderContext, slideIndex: number = 0, contentScale?: number): string {
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

  const rawFlowHtml = flowEls.map((el) => renderElement(el, ctx)).join('\n');
  // Uniform shrink to fit overflowing content — pure visual scale, no reflow, so
  // height reduces exactly proportionally (see EditCanvas's overflow-shrink calc).
  const flowHtml = (contentScale && contentScale < 1)
    ? `<div style="transform:scale(${contentScale});transform-origin:top left;width:${(100 / contentScale).toFixed(4)}%;">${rawFlowHtml}</div>`
    : rawFlowHtml;

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
    const footer = resolveFooter(ctx.presentation?.footer);

    return `
    <div style="position:absolute;bottom:0;left:0;width:100%;height:${blueBarH + grayBarH}px;pointer-events:none;z-index:50;overflow:hidden;font-family:'Trebuchet MS', Arial, sans-serif;">
      <!-- Blue Footer Bar -->
      <div style="position:absolute;left:0;bottom:0;width:100%;height:${blueBarH}px;background-color:#003F72;"></div>
      <!-- Gray Footer Bar -->
      <div style="position:absolute;left:0;bottom:${blueBarH}px;width:100%;height:${grayBarH}px;background-color:#BFBFBF;"></div>
      <!-- Left Footer Text -->
      <div style="position:absolute;left:2.160%;bottom:${blueBarH + (grayBarH - baseHeight * 0.02855) / 2}px;width:37.651%;height:${baseHeight * 0.02855}px;display:flex;align-items:center;font-size:12.72px;color:#000000;font-family:Arial, sans-serif;line-height:1;margin:0;padding:0;">
        <span>${escapeHtml(footer.deliverableText)} | ${
          (() => {
            const sysName = ctx.presentation?.meta?.title || 'Name of System';
            return (sysName === 'Name of System' || sysName === 'Untitled Presentation')
              ? '<span style="color:#FF0000;">&lt;</span>' + escapeHtml(sysName) + '<span style="color:#FF0000;">&gt;</span>'
              : escapeHtml(sysName);
          })()
        }</span>
      </div>
      <!-- Page Number -->
      <div style="position:absolute;left:87.839%;bottom:${blueBarH + (grayBarH - baseHeight * 0.03097) / 2}px;width:10.000%;height:${baseHeight * 0.03097}px;display:flex;align-items:center;justify-content:flex-end;font-size:12.72px;color:#000000;font-family:Arial, sans-serif;line-height:1;margin:0;padding:0;">
        ${slideIndex + 1} of ${ctx.presentation?.slides?.length ?? 1}
      </div>
      <!-- Logo -->
      <div style="position:absolute;left:69.691%;bottom:${(blueBarH - baseHeight * 0.07876) / 2}px;width:28.149%;height:${baseHeight * 0.07876}px;background-image:url(${escapeHtml(footer.logoUrl)});background-size:100% 100%;background-repeat:no-repeat;background-color:transparent;box-shadow:none;border:none;margin:0;padding:0;"></div>
      <!-- Org Line -->
      <div style="position:absolute;left:2.637%;bottom:${(blueBarH - baseHeight * 0.03814) / 2}px;width:34.369%;height:${baseHeight * 0.03814}px;display:flex;align-items:center;font-size:17.52px;color:#D9D9D9;line-height:1;margin:0;padding:0;">
        ${escapeHtml(footer.orgLine)}
      </div>
      <!-- Copyright Text -->
      <div style="position:absolute;left:33.810%;bottom:${(blueBarH - baseHeight * 0.03814) / 2}px;width:31.893%;height:${baseHeight * 0.03814}px;display:flex;align-items:center;justify-content:center;font-size:17.52px;color:#D9D9D9;line-height:1;margin:0;padding:0;">
        ${escapeHtml(footer.copyrightText)}
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
  contentScale?: number,
): string {
  const cols = columns
    .map(
      (colEls) =>
        `<div class="ppt-col">\n${renderAll(colEls, ctx, slideIndex, contentScale)}\n</div>`,
    )
    .join('\n');
  return `<div class="ppt-columns ${gridClass}">\n${cols}\n</div>`;
}
