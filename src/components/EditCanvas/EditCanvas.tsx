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
 * show the same content (exact cover/section flex-centering is not
 * replicated here — only the heading itself).
 */
function SlideTitleBlock({ slide, theme, onCommit }: { slide: Slide; theme: Theme; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const b = theme.typography.baseSizePx;
  const r = theme.typography.scaleRatio;
  const isCover = slide.layout === 'cover';
  const fontSize = isCover ? b * r ** 4 : b * r ** 3; // h1 (cover) vs h2 (section)
  const Tag = (isCover ? 'h1' : 'h2') as 'div';

  const style: React.CSSProperties = {
    margin: `0 0 ${theme.spacing.elementGap}px 0`,
    fontSize,
    color: theme.colors.foreground,
    fontFamily: `'${theme.typography.headingFont}', system-ui, sans-serif`,
    lineHeight: 1.2,
    fontWeight: 700,
    outline: 'none',
    textAlign: slide.layout === 'section' ? 'center' : 'left',
  };

  if (!editing) {
    return (
      <Tag style={{ ...style, cursor: 'text', opacity: slide.title ? 1 : 0.4 }} onDoubleClick={() => setEditing(true)}>
        {slide.title || 'Click to add a title'}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      contentEditable
      suppressContentEditableWarning
      style={style}
      onBlur={(e) => { setEditing(false); onCommit(e.currentTarget.textContent ?? ''); }}
      onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      dangerouslySetInnerHTML={{ __html: slide.title || '' }}
    />
  );
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
    selectElement, setSelectedElements, deleteSelectedElements, updateSlideTitle,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

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
          {/* Flow elements — stacked in their natural order.
              cover/section layouts vertically-center this block to match the
              `.ppt-layout-cover`/`.ppt-layout-section` CSS rules in theme-css.ts. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              gap: theme.spacing.elementGap,
              padding: `${theme.spacing.slidePaddingY}px ${theme.spacing.slidePaddingX}px`,
              pointerEvents: 'none',
              justifyContent: (slide.layout === 'cover' || slide.layout === 'section') ? 'center' : 'flex-start',
              alignItems: slide.layout === 'section' ? 'center' : 'flex-start',
              textAlign: slide.layout === 'section' ? 'center' : 'left',
            }}
          >
            {(slide.layout === 'cover' || slide.layout === 'section') && (
              <div style={{ pointerEvents: 'auto' }}>
                <SlideTitleBlock
                  slide={slide}
                  theme={theme}
                  onCommit={(v) => updateSlideTitle(selectedSlideIndex, v)}
                />
              </div>
            )}
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
