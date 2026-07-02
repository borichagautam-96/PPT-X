import { useEffect, useRef, useMemo, useState } from 'react';
import { renderPresentation } from '@/core/renderer';
import { useEditorStore } from '../../store/useEditorStore.ts';
import { LOCAL_VENDOR_URLS, LOCAL_KATEX_BASE } from '../../vendor-urls.ts';

export default function PresentationMode() {
  const { presentation, selectedSlideIndex, exitPresentationMode } = useEditorStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentIndex, setCurrentIndex] = useState(selectedSlideIndex);
  const [showNotes, setShowNotes] = useState(false);

  const html = useMemo(
    () => renderPresentation(presentation, { editorMode: true, vendorUrls: LOCAL_VENDOR_URLS, katexLocalBase: LOCAL_KATEX_BASE }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // intentionally render once on mount; navigated via onLoad
  );

  function handleLoad() {
    try {
      const win = iframeRef.current?.contentWindow as Window & {
        Reveal?: { slide: (h: number, v?: number) => void };
      };
      win?.Reveal?.slide(selectedSlideIndex, 0);

      // Iframe traps focus, so we must bind the escape key to the inner window
      win?.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') exitPresentationMode();
        if (e.key.toLowerCase() === 'n') setShowNotes((v) => !v);
      });
    } catch {
      // cross-origin guard
    }
  }

  // Track slide navigation inside the iframe so the notes panel stays in sync
  // (Reveal.js posts 'ppt-slidechanged' — same mechanism PreviewFrame uses).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'ppt-slidechanged') setCurrentIndex(e.data.indexh ?? 0);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // ESC exits presentation mode, N toggles the speaker-notes panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') exitPresentationMode();
      if (e.key.toLowerCase() === 'n') setShowNotes((v) => !v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exitPresentationMode]);

  // Lock body scroll while in presentation mode
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const currentSlide = presentation.slides[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Minimal HUD — fades out on hover off */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
        <span className="text-xs text-white/60 font-medium select-none">
          {presentation.meta.title}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40 select-none">
            Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">N</kbd> for notes ·{' '}
            <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">ESC</kbd> to exit
          </span>
          <button
            onClick={() => setShowNotes((v) => !v)}
            className={`text-xs px-3 py-1 rounded transition-colors ${showNotes ? 'text-white bg-indigo-500/40' : 'text-white/60 bg-white/10 hover:bg-white/20 hover:text-white'}`}
          >
            📝 Notes
          </button>
          <button
            onClick={exitPresentationMode}
            className="text-xs text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Full-screen Reveal.js iframe */}
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Presentation"
        onLoad={handleLoad}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin"
        allowFullScreen
      />

      {/* Speaker-notes / teleprompter panel */}
      {showNotes && (
        <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[35%] overflow-y-auto bg-black/90 border-t border-white/10 backdrop-blur-sm">
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-[11px] uppercase tracking-wide text-white/40 font-semibold">
              Slide {currentIndex + 1} of {presentation.slides.length}
              {currentSlide?.title ? ` — ${currentSlide.title}` : ''}
            </span>
            <button
              onClick={() => setShowNotes(false)}
              className="text-white/40 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
          <p className="px-5 pb-4 text-lg leading-relaxed text-white/90 whitespace-pre-wrap select-text">
            {currentSlide?.notes || <span className="text-white/30 italic">No speaker notes for this slide.</span>}
          </p>
        </div>
      )}
    </div>
  );
}
