import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore.ts';
import ElementWidget, { CANVAS_W, CANVAS_H } from './ElementWidget.tsx';
import ContextMenu from '../ContextMenu/ContextMenu.tsx';
import PESFooter from './PESFooter.tsx';
import type { Slide, Theme, Element as PresentationElement } from '@/core/schema';

/**
 * Some layouts (cover, section) synthesize their big title heading from
 * `slide.title` rather than from an element in `slide.elements` — see
 * coverLayout()/sectionLayout() in core/renderer/layout-templates.ts.
 * Without this, those titles are invisible in the editor even though they
 * render in Preview/export. This mirrors that behavior so Edit and Preview
 * show the same content, and additionally supports click-to-select and
 * drag-to-reposition (persisted as `slide.titlePosition`, applied by the
 * renderer as an absolute-position override on the same heading).
 */
function SlideTitleBlock({
  slide, theme, selected, onSelect,
  canvasRef, scale,
  onCommitText, onCommitPosition,
}: {
  slide: Slide;
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
  canvasRef: React.RefObject<HTMLDivElement>;
  scale: number;
  onCommitText: (v: string) => void;
  onCommitPosition: (pos: { x: number; y: number; width: number; height: number } | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [livePos, setLivePos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const b = theme.typography.baseSizePx;
  const r = theme.typography.scaleRatio;
  const isCover = slide.layout === 'cover';
  const fontSize = isCover ? b * r ** 4 : b * r ** 3; // h1 (cover) vs h2 (section)
  const Tag = (isCover ? 'h1' : 'h2') as 'div';

  const pos = slide.titlePosition;
  const displayPos = livePos ?? (pos ? { x: pos.x, y: pos.y, w: pos.width ?? 30, h: pos.height ?? 15 } : null);

  function toCanvasPct(dx: number, dy: number) {
    return { dx: dx / scale / CANVAS_W * 100, dy: dy / scale / CANVAS_H * 100 };
  }

  function getRect() {
    const el = ref.current;
    const cv = canvasRef.current;
    if (!el || !cv) return null;
    const er = el.getBoundingClientRect();
    const cr = cv.getBoundingClientRect();
    return {
      x: (er.left - cr.left) / scale / CANVAS_W * 100,
      y: (er.top  - cr.top)  / scale / CANVAS_H * 100,
      w: er.width  / scale / CANVAS_W * 100,
      h: er.height / scale / CANVAS_H * 100,
    };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();

    const startRect = getRect();
    if (!startRect) return;
    const startMouse = { x: e.clientX, y: e.clientY };

    const onMove = (me: MouseEvent) => {
      const { dx, dy } = toCanvasPct(me.clientX - startMouse.x, me.clientY - startMouse.y);
      setLivePos({
        x: Math.max(0, Math.min(100 - startRect.w, startRect.x + dx)),
        y: Math.max(0, Math.min(100 - startRect.h, startRect.y + dy)),
        w: startRect.w,
        h: startRect.h,
      });
    };
    const onUp = (me: MouseEvent) => {
      const { dx, dy } = toCanvasPct(me.clientX - startMouse.x, me.clientY - startMouse.y);
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        onCommitPosition({
          x: Math.max(0, Math.min(100 - startRect.w, startRect.x + dx)),
          y: Math.max(0, Math.min(100 - startRect.h, startRect.y + dy)),
          width: startRect.w,
          height: startRect.h,
        });
      }
      setLivePos(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const style: React.CSSProperties = {
    margin: displayPos ? 0 : `0 0 ${theme.spacing.elementGap}px 0`,
    fontSize,
    color: theme.colors.foreground,
    fontFamily: `'${theme.typography.headingFont}', system-ui, sans-serif`,
    lineHeight: 1.2,
    fontWeight: 700,
    outline: selected ? '1.5px solid #6366f1' : '1px solid transparent',
    outlineOffset: 2,
    textAlign: slide.layout === 'section' ? 'center' : 'left',
    pointerEvents: 'auto',
    boxSizing: 'border-box',
    ...(displayPos
      ? { position: 'absolute', left: `${displayPos.x}%`, top: `${displayPos.y}%`, width: `${displayPos.w}%`, zIndex: 10 }
      : {}),
  };

  return (
    <>
      {selected && !editing && (
        <div
          style={{
            position: displayPos ? 'absolute' : 'static',
            ...(displayPos ? { left: `${displayPos.x}%`, top: `${displayPos.y}%`, transform: 'translateY(-100%)' } : {}),
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#6366f1', color: '#fff',
            fontSize: 10, padding: '2px 8px', borderRadius: '4px 4px 0 0',
            pointerEvents: 'auto', zIndex: 30, whiteSpace: 'nowrap', width: 'max-content',
          }}
        >
          <span style={{ fontWeight: 600 }}>title</span>
          {!displayPos && <span style={{ opacity: 0.75 }}>· drag to reposition</span>}
          {displayPos && (
            <button
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, opacity: 0.8, padding: '0 0 0 4px', textDecoration: 'underline' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onCommitPosition(undefined); }}
            >
              reset position
            </button>
          )}
        </div>
      )}
      {editing ? (
        <Tag
          ref={ref as React.RefObject<HTMLDivElement>}
          contentEditable
          suppressContentEditableWarning
          style={style}
          onBlur={(e) => { setEditing(false); onCommitText(e.currentTarget.textContent ?? ''); }}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
          dangerouslySetInnerHTML={{ __html: slide.title || '' }}
        />
      ) : (
        <Tag
          ref={ref as React.RefObject<HTMLDivElement>}
          style={{ ...style, cursor: 'move', opacity: slide.title ? 1 : 0.4 }}
          onMouseDown={onMouseDown}
          onDoubleClick={(e) => { e.stopPropagation(); onSelect(); setEditing(true); }}
        >
          {slide.title || 'Click to add a title'}
        </Tag>
      )}
    </>
  );
}

const COLUMN_LAYOUTS = new Set(['two-column', 'three-column', 'image-left', 'image-right']);

/** Mirrors layout-templates.ts's twoColumnLayout/threeColumnLayout/imageColumnLayout column splits. */
function splitFlowColumns(layout: Slide['layout'], flowEls: PresentationElement[]): PresentationElement[][] {
  if (layout === 'two-column') {
    const mid = Math.ceil(flowEls.length / 2);
    return [flowEls.slice(0, mid), flowEls.slice(mid)];
  }
  if (layout === 'three-column') {
    const third = Math.ceil(flowEls.length / 3);
    return [flowEls.slice(0, third), flowEls.slice(third, third * 2), flowEls.slice(third * 2)];
  }
  if (layout === 'image-left' || layout === 'image-right') {
    const imageEls = flowEls.filter((el) => el.type === 'image');
    const otherEls = flowEls.filter((el) => el.type !== 'image');
    return layout === 'image-left' ? [imageEls, otherEls] : [otherEls, imageEls];
  }
  return [flowEls];
}

/** Mirrors theme-css.ts's .ppt-columns--* grid-template-columns rules. */
function gridTemplateColumnsFor(layout: Slide['layout']): string | undefined {
  switch (layout) {
    case 'two-column':   return '1fr 1fr';
    case 'three-column': return '1fr 1fr 1fr';
    case 'image-left':   return '1fr 1.2fr';
    case 'image-right':  return '1.2fr 1fr';
    default: return undefined;
  }
}

function slideBackground(slide: Slide, theme: Theme): React.CSSProperties {
  const bg = slide.background;
  if (bg?.type === 'color' && bg.color) return { background: bg.color };
  if (bg?.type === 'gradient' && bg.gradient) {
    const stops = bg.gradient.stops.map((s) => `${s.color} ${s.position}%`).join(', ');
    const angle = bg.gradient.angle ?? 135;
    return { background: `linear-gradient(${angle}deg, ${stops})` };
  }
  return { background: theme.colors.background };
}

export default function EditCanvas() {
  const {
    presentation, selectedSlideIndex, selectedElementIndex, selectedElementIndices,
    selectElement, setSelectedElements, deleteSelectedElements, updateSlideTitle, updateSlideTitlePosition,
    updateSlideContentScale, splitSlideAt,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const flowWrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [titleSelected, setTitleSelected] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Selecting a real element (from ElementWidget, marquee, or Ctrl+A — all outside
  // this component) deselects the title, keeping selection exclusive.
  useEffect(() => {
    if (selectedElementIndices.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing selection exclusivity with state owned by sibling components, not derivable from render
      setTitleSelected(false);
    }
  }, [selectedElementIndices]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min((width - 48) / CANVAS_W, (height - 48) / CANVAS_H));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Overflow detection: compares the (already-scaled, if slide.contentScale is set)
  // rendered content height against the available slide content area. Measuring via
  // getBoundingClientRect (not scrollHeight) means this correctly reflects any
  // `transform: scale()` shrink already applied, so it clears once content actually fits.
  useEffect(() => {
    const wrapper = flowWrapperRef.current;
    if (!wrapper || scale <= 0) return;
    const check = () => {
      const footerH = CANVAS_H * (0.07876 + 0.03097);
      const padY = presentation.theme.spacing.slidePaddingY;
      const availableH = CANVAS_H - footerH - padY * 2;
      const contentH = wrapper.getBoundingClientRect().height / scale;
      setIsOverflowing(contentH > availableH + 2);
    };
    check();
    const obs = new ResizeObserver(check);
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, [selectedSlideIndex, scale, presentation]);

  // Delete/Backspace removes the current multi-selection (ignored while typing in an input/contentEditable).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (selectedElementIndices.length === 0) return;
      e.preventDefault();
      deleteSelectedElements(selectedSlideIndex);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedElementIndices, selectedSlideIndex, deleteSelectedElements]);

  // Ctrl/Cmd+A selects every (non-template-graphic) element on the current slide.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const currentSlide = presentation.slides[selectedSlideIndex];
      if (!currentSlide) return;
      e.preventDefault();
      const allIndices = currentSlide.elements
        .map((el, i) => ({ el, i }))
        .filter(({ el }) => !el.isTemplateGraphic)
        .map(({ i }) => i);
      setSelectedElements(allIndices);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presentation, selectedSlideIndex, setSelectedElements]);

  const slide = presentation.slides[selectedSlideIndex];
  if (!slide) return null;

  const theme   = presentation.theme;
  const bgStyle = slideBackground(slide, theme);

  const flowEls   = slide.elements.filter((el) => el.position.mode !== 'absolute');
  const allAbsEls = slide.elements.filter((el) => el.position.mode === 'absolute');
  
  // Template graphic elements (from slide master/layout) are kept in a separate
  // full-canvas overlay so they are always rendered on top of content at their
  // correct absolute coordinates — not pushed around by flow content.
  const templateEls = allAbsEls.filter((el) => el.isTemplateGraphic === true);
  const templateElIds = new Set(templateEls.map((el) => el.id));
  const absEls = allAbsEls.filter((el) => !templateElIds.has(el.id));

  const selectedSet = new Set(selectedElementIndices);

  const sharedProps = {
    slideIndex: selectedSlideIndex,
    canvasRef:  canvasRef as React.RefObject<HTMLDivElement>,
    scale,
    theme,
    assets: presentation.assets,
    selectedIndices: selectedElementIndices,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedElementIndex === null) return;
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // ── Marquee (rubber-band) selection — drag on empty canvas background ──
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const cr = cv.getBoundingClientRect();
    const toPct = (clientX: number, clientY: number) => ({
      x: (clientX - cr.left) / scale / CANVAS_W * 100,
      y: (clientY - cr.top)  / scale / CANVAS_H * 100,
    });
    const start = toPct(e.clientX, e.clientY);
    let moved = false;

    const onMove = (me: MouseEvent) => {
      const cur = toPct(me.clientX, me.clientY);
      if (Math.abs(me.clientX - e.clientX) > 3 || Math.abs(me.clientY - e.clientY) > 3) moved = true;
      setMarquee({
        x0: Math.min(start.x, cur.x), y0: Math.min(start.y, cur.y),
        x1: Math.max(start.x, cur.x), y1: Math.max(start.y, cur.y),
      });
    };
    const onUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (moved) {
        const cur = toPct(me.clientX, me.clientY);
        const rect = {
          x0: Math.min(start.x, cur.x), y0: Math.min(start.y, cur.y),
          x1: Math.max(start.x, cur.x), y1: Math.max(start.y, cur.y),
        };
        const hitIndices = absEls
          .filter((el) => el.position.mode === 'absolute')
          .filter((el) => {
            const ex0 = el.position.x ?? 0, ey0 = el.position.y ?? 0;
            const ex1 = ex0 + (el.position.width ?? 0), ey1 = ey0 + (el.position.height ?? 0);
            return ex0 < rect.x1 && ex1 > rect.x0 && ey0 < rect.y1 && ey1 > rect.y0;
          })
          .map((el) => slide.elements.indexOf(el));
        setSelectedElements(hitIndices);
      } else {
        selectElement(null);
        setTitleSelected(false);
      }
      setMarquee(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const selectedElement = selectedElementIndex !== null ? slide.elements[selectedElementIndex] : null;

  const handleDuplicate = () => {
    if (!selectedElement) return;
    const { addElement } = useEditorStore.getState();
    const newEl = {
      ...selectedElement,
      id: crypto.randomUUID(),
    };
    if (newEl.position.mode === 'absolute') {
      newEl.position = {
        ...newEl.position,
        x: (newEl.position.x || 0) + 2,
        y: (newEl.position.y || 0) + 2,
      };
    }
    addElement(selectedSlideIndex, newEl);
  };

  const handleBringForward = () => {
    if (!selectedElement || selectedElement.position.mode !== 'absolute') return;
    const { updateElement } = useEditorStore.getState();
    updateElement(selectedSlideIndex, selectedElementIndex!, {
      position: { ...selectedElement.position, zIndex: (selectedElement.position.zIndex || 1) + 1 }
    } as Partial<PresentationElement>);
  };

  const handleSendBackward = () => {
    if (!selectedElement || selectedElement.position.mode !== 'absolute') return;
    const { updateElement } = useEditorStore.getState();
    updateElement(selectedSlideIndex, selectedElementIndex!, {
      position: { ...selectedElement.position, zIndex: Math.max(1, (selectedElement.position.zIndex || 1) - 1) }
    } as Partial<PresentationElement>);
  };

  function handleShrinkToFit() {
    const wrapper = flowWrapperRef.current;
    if (!wrapper || scale <= 0) return;
    const footerH = CANVAS_H * (0.07876 + 0.03097);
    const padY = theme.spacing.slidePaddingY;
    const availableH = CANVAS_H - footerH - padY * 2;
    const currentContentH = wrapper.getBoundingClientRect().height / scale;
    if (currentContentH <= 0) return;
    const currentScale = slide.contentScale ?? 1;
    // currentContentH already reflects currentScale (measured post-transform), so scale
    // relative to it to get the new ABSOLUTE factor applied to the original content.
    const neededScale = Math.max(0.4, Math.min(1, currentScale * (availableH / currentContentH)));
    updateSlideContentScale(selectedSlideIndex, neededScale >= 0.999 ? undefined : neededScale);
  }

  function handleSplitSlide() {
    const cv = canvasRef.current;
    if (!cv || scale <= 0) return;
    const cr = cv.getBoundingClientRect();
    const footerH = CANVAS_H * (0.07876 + 0.03097);
    const padY = theme.spacing.slidePaddingY;
    const boundaryY = CANVAS_H - footerH - padY;

    // Find the first element whose BOTTOM edge crosses the boundary — that's the
    // first element actually causing the overflow, so it (and everything after) moves.
    let splitIdx: number | null = null;
    for (const el of flowEls) {
      const idx = slide.elements.indexOf(el);
      const node = cv.querySelector(`[data-el-idx="${idx}"]`) as HTMLElement | null;
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      const bottomY = (rect.bottom - cr.top) / scale;
      if (bottomY > boundaryY) { splitIdx = idx; break; }
    }
    if (splitIdx === null) return;
    splitSlideAt(selectedSlideIndex, splitIdx);
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-1 bg-surface-900 overflow-auto relative"
      style={{ 
        minHeight: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        backgroundPosition: 'center center'
      }}
    >
      {/* Subtle hint */}
      <div
        style={{
          position: 'absolute', top: 44, left: 200, right: 280, zIndex: 40,
          padding: '2px 12px', fontSize: 10, color: 'rgba(148,163,184,0.4)',
          display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none',
          letterSpacing: '0.03em',
        }}
      >
        Click to select · Double-click to edit text · Drag to move
      </div>

      {/* Overflow warning — content taller than the slide's usable area */}
      {isOverflowing && (
        <div
          style={{
            position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)', zIndex: 45,
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(120,53,15,0.95)', border: '1px solid rgba(251,146,60,0.5)',
            borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#fed7aa',
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          }}
        >
          <span>⚠️ Content overflows the slide</span>
          <button
            onClick={handleShrinkToFit}
            style={{ background: 'rgba(251,146,60,0.2)', border: '1px solid rgba(251,146,60,0.4)', color: '#fed7aa', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
          >
            Shrink to fit
          </button>
          <button
            onClick={handleSplitSlide}
            style={{ background: 'rgba(251,146,60,0.2)', border: '1px solid rgba(251,146,60,0.4)', color: '#fed7aa', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
          >
            Split into new slide
          </button>
        </div>
      )}

      {/* Canvas wrapper - occupies exactly scaled size so it stays centred, but can grow if content overflows */}
      <div style={{ margin: 'auto', width: CANVAS_W * scale, minHeight: CANVAS_H * scale, height: 'max-content', position: 'relative', flexShrink: 0 }}>
        <div
          ref={canvasRef}
          style={{
            position: 'absolute',
            width:  CANVAS_W,
            minHeight: CANVAS_H,
            height: 'max-content',
            display: 'flex',
            flexDirection: 'column',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',

            fontFamily: `'${theme.typography.bodyFont}', system-ui, sans-serif`,
            color: theme.colors.foreground,
            ...bgStyle,
          }}
          onMouseDown={handleCanvasMouseDown}
          onContextMenu={handleContextMenu}
        >
          {/* Flow elements. cover/section vertically-center to match theme-css.ts;
              two-column/three-column/image-left/image-right split into a CSS grid to
              match layout-templates.ts's twoColumnLayout/threeColumnLayout/imageColumnLayout. */}
          {(() => {
            const isColumnLayout = COLUMN_LAYOUTS.has(slide.layout);
            const isCentered = ['cover', 'section', 'full-image', 'full-video', 'quote'].includes(slide.layout);
            const isCenteredBoth = ['section', 'full-image', 'full-video', 'quote'].includes(slide.layout);
            const isTextCentered = ['section', 'quote'].includes(slide.layout);

            // Uniform shrink-to-fit — pure visual scale (no reflow), mirrors layout-templates.ts.
            const contentScale = slide.contentScale;
            const scaleStyle: React.CSSProperties | undefined = (contentScale && contentScale < 1)
              ? { transform: `scale(${contentScale})`, transformOrigin: 'top left', width: `${(100 / contentScale).toFixed(4)}%` }
              : undefined;

            return (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  padding: `${theme.spacing.slidePaddingY}px ${theme.spacing.slidePaddingX}px`,
                  pointerEvents: 'none',
                  justifyContent: !isColumnLayout && isCentered ? 'center' : 'flex-start',
                  alignItems: !isColumnLayout && isCenteredBoth ? 'center' : 'flex-start',
                }}
              >
              {/* Naturally-sized (not flex:1-stretched) — this is what overflow
                  detection measures, so it reflects real content height, not the
                  parent's stretched-to-fill-canvas height. */}
              <div
                ref={flowWrapperRef}
                style={{
                  display: isColumnLayout ? 'grid' : 'flex',
                  flexDirection: isColumnLayout ? undefined : 'column',
                  gridTemplateColumns: isColumnLayout ? gridTemplateColumnsFor(slide.layout) : undefined,
                  gap: isColumnLayout ? theme.spacing.elementGap * 2 : theme.spacing.elementGap,
                  width: '100%',
                  pointerEvents: 'none',
                  alignItems: !isColumnLayout && isCenteredBoth ? 'center' : 'flex-start',
                  textAlign: !isColumnLayout && isTextCentered ? 'center' : 'left',
                }}
              >
                {(slide.layout === 'cover' || slide.layout === 'section') && (
                  <SlideTitleBlock
                    slide={slide}
                    theme={theme}
                    selected={titleSelected}
                    onSelect={() => { setTitleSelected(true); selectElement(null); }}
                    canvasRef={canvasRef as React.RefObject<HTMLDivElement>}
                    scale={scale}
                    onCommitText={(v) => updateSlideTitle(selectedSlideIndex, v)}
                    onCommitPosition={(p) => updateSlideTitlePosition(selectedSlideIndex, p)}
                  />
                )}

                {isColumnLayout ? (
                  splitFlowColumns(slide.layout, flowEls).map((colEls, colIdx) => (
                    <div
                      key={colIdx}
                      style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.elementGap, overflow: 'hidden', pointerEvents: 'none', ...scaleStyle }}
                    >
                      {colEls.map((el) => {
                        const idx = slide.elements.indexOf(el);
                        return (
                          <div key={el.id} style={{ pointerEvents: 'auto' }}>
                            <ElementWidget
                              element={el}
                              elementIndex={idx}
                              isSelected={selectedSet.has(idx)}
                              {...sharedProps}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.elementGap, pointerEvents: 'none', ...scaleStyle }}>
                    {flowEls.map((el) => {
                      const idx = slide.elements.indexOf(el);
                      return (
                        <div key={el.id} style={{ pointerEvents: 'auto' }}>
                          <ElementWidget
                            element={el}
                            elementIndex={idx}
                            isSelected={selectedSet.has(idx)}
                            {...sharedProps}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </div>
            );
          })()}

          {/* Absolute elements — freely positioned */}
          {absEls.map((el) => {
            const idx = slide.elements.indexOf(el);
            return (
              <ElementWidget
                key={el.id}
                element={el}
                elementIndex={idx}
                isSelected={selectedSet.has(idx)}
                {...sharedProps}
              />
            );
          })}

          {/* Template graphic elements (master/layout) — rendered in a full-canvas overlay
               so they always appear at their correct absolute positions on top of content */}
          {templateEls.length > 0 && (() => {
            const totalSlides  = presentation.slides.length;
            const slideNum     = selectedSlideIndex + 1;
            const slideNumStr  = String(slideNum);

            // Preprocess template elements: inject slide number, unify footer bar colors
            const processedTemplateEls = templateEls
              // EXCLUDE any template elements in the footer region (y > 88) because we are
              // replacing the entire footer with a pixel-perfect hardcoded PESFooter component
              .filter(el => !(el.position.y !== undefined && el.position.y > 88))
              .map((el) => {
              let updated = el;

              // Replace {{SLIDE_NUM}} placeholder in text/heading content
              if ((el.type === 'text' || el.type === 'heading') && typeof (el as {content?: unknown}).content === 'string') {
                const raw = (el as {content: string}).content;
                if (raw.includes('{{SLIDE_NUM}}')) {
                  updated = { ...updated, content: raw.replace(/\{\{SLIDE_NUM\}\}/g, slideNumStr) } as typeof el;
                }
              }

              return updated;
            });

            return (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 50,
                  pointerEvents: 'none',
                  overflow: 'visible',
                  fontSize: 12,
                  lineHeight: 1.3,
                }}
              >
                {processedTemplateEls.map((el) => {
                  const idx = slide.elements.indexOf(
                    templateEls.find((t) => t.id === el.id) ?? el
                  );
                  return (
                    <div key={el.id} style={{ pointerEvents: 'auto' }}>
                      <ElementWidget
                        element={el}
                        elementIndex={idx}
                        isSelected={selectedSet.has(idx)}
                        {...sharedProps}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Hardcoded pixel-perfect PES Footer */}
          <PESFooter
            slideIndex={selectedSlideIndex}
            totalSlides={presentation.slides.length}
            systemName={presentation.meta?.title || 'Name of System'}
            baseHeight={CANVAS_H}
            footer={presentation.footer}
          />

          {/* Marquee (rubber-band) selection rectangle */}
          {marquee && (
            <div
              style={{
                position: 'absolute',
                left: `${marquee.x0}%`, top: `${marquee.y0}%`,
                width: `${marquee.x1 - marquee.x0}%`, height: `${marquee.y1 - marquee.y0}%`,
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.7)',
                zIndex: 100,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Empty State Overlay */}
          {slide.elements.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none select-none">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2 shadow-xl shadow-black/20">
                <span className="text-4xl opacity-50 drop-shadow-lg">✨</span>
              </div>
              <h3 className="text-3xl font-bold tracking-tight text-gray-300 drop-shadow-md">Beautifully Empty</h3>
              <p className="text-base text-gray-500 max-w-md text-center leading-relaxed">
                This slide is waiting for your ideas. Insert text, media, or shapes from the right panel to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {contextMenu && selectedElementIndex !== null && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: 'Duplicate', icon: '📋', onClick: handleDuplicate },
            { divider: true, label: '', onClick: () => {} },
            { label: 'Bring Forward', icon: '⬆️', onClick: handleBringForward },
            { label: 'Send Backward', icon: '⬇️', onClick: handleSendBackward },
            { divider: true, label: '', onClick: () => {} },
            {
              label: selectedElementIndices.length > 1 ? `Delete ${selectedElementIndices.length} elements` : 'Delete',
              icon: '🗑️',
              danger: true,
              onClick: () => {
                if (selectedElementIndices.length > 1) {
                  deleteSelectedElements(selectedSlideIndex);
                } else {
                  const { deleteElement } = useEditorStore.getState();
                  deleteElement(selectedSlideIndex, selectedElementIndex);
                }
              }
            },
          ]}
        />
      )}
    </div>
  );
}
