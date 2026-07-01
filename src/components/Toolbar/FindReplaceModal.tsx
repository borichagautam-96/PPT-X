/**
 * FindReplaceModal.tsx
 *
 * Searches text across all slides (headings, text, bullet items, callouts)
 * and replaces matches one-by-one or all at once.
 *
 * Keyboard: Ctrl+H to open, Enter = find next, Escape = close.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../../store/useEditorStore.ts';
import type {
  TextElement, HeadingElement, BulletListElement,
  CalloutElement, PresentationElement,
} from '@/core/schema';

interface Props {
  onClose: () => void;
}

interface Match {
  slideIndex: number;
  slideTitle: string;
  elementIndex: number;
  elementType: string;
  preview: string;       // snippet of text around the match
  field: 'content' | 'items'; // where on the element the text lives
  itemIndex?: number;    // for bullet-list items
}

// ─── text extraction ──────────────────────────────────────────────────────────

function getElementText(el: PresentationElement, field: 'content' | 'items', itemIndex?: number): string {
  if (field === 'content') {
    const content = (el as { content?: unknown }).content;
    if (typeof content === 'string') return content.replace(/<[^>]+>/g, '');
  }
  if (field === 'items' && itemIndex !== undefined) {
    const items = (el as BulletListElement).items;
    const c = items?.[itemIndex]?.content;
    return typeof c === 'string' ? c.replace(/<[^>]+>/g, '') : '';
  }
  return '';
}

function collectMatches(
  presentation: ReturnType<typeof useEditorStore.getState>['presentation'],
  needle: string,
  caseSensitive: boolean,
  wholeWord: boolean,
): Match[] {
  if (!needle.trim()) return [];
  const matches: Match[] = [];
  const flags = caseSensitive ? 'g' : 'gi';
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
  let re: RegExp;
  try { re = new RegExp(pattern, flags); } catch { return []; }

  presentation.slides.forEach((slide, si) => {
    slide.elements.forEach((el, ei) => {
      const elType = el.type;

      if (elType === 'text' || elType === 'heading' || elType === 'callout') {
        const raw = (el as TextElement | HeadingElement | CalloutElement);
        const text = typeof raw.content === 'string'
          ? raw.content.replace(/<[^>]+>/g, '') : '';
        re.lastIndex = 0;
        if (re.test(text)) {
          matches.push({
            slideIndex: si,
            slideTitle: slide.title ?? `Slide ${si + 1}`,
            elementIndex: ei,
            elementType: elType,
            field: 'content',
            preview: text.slice(0, 80),
          });
        }
      }

      if (elType === 'bullet-list') {
        const bl = el as BulletListElement;
        bl.items.forEach((item, ii) => {
          const text = typeof item.content === 'string'
            ? item.content.replace(/<[^>]+>/g, '') : '';
          re.lastIndex = 0;
          if (re.test(text)) {
            matches.push({
              slideIndex: si,
              slideTitle: slide.title ?? `Slide ${si + 1}`,
              elementIndex: ei,
              elementType: 'bullet-list',
              field: 'items',
              itemIndex: ii,
              preview: text.slice(0, 80),
            });
          }
        });
      }
    });
  });
  return matches;
}

// ─── replace logic ────────────────────────────────────────────────────────────

function applyReplace(
  original: string,
  needle: string,
  replacement: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  replaceAll: boolean,
): string {
  const flags = caseSensitive ? (replaceAll ? 'g' : '') : (replaceAll ? 'gi' : 'i');
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
  try {
    const re = new RegExp(pattern, flags);
    return original.replace(re, replacement);
  } catch {
    return original;
  }
}

// ─── FindReplaceModal ─────────────────────────────────────────────────────────

export default function FindReplaceModal({ onClose }: Props) {
  const { presentation, updateElement, selectSlide } = useEditorStore();

  const [find,          setFind]          = useState('');
  const [replace,       setReplace]       = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord,     setWholeWord]     = useState(false);
  const [matchIndex,    setMatchIndex]    = useState(0);
  const [flashId,       setFlashId]       = useState<string | null>(null);
  const [replaceCount,  setReplaceCount]  = useState<number | null>(null);

  const findRef = useRef<HTMLInputElement>(null);
  useEffect(() => { findRef.current?.focus(); }, []);

  const matches = collectMatches(presentation, find, caseSensitive, wholeWord);
  const current = matches[matchIndex] ?? null;

  // Reset match index when search params change
  useEffect(() => { setMatchIndex(0); setReplaceCount(null); }, [find, caseSensitive, wholeWord]);

  // Jump to current match slide
  useEffect(() => {
    if (current) selectSlide(current.slideIndex);
  }, [current, selectSlide]);

  const flash = useCallback((id: string) => {
    setFlashId(id);
    setTimeout(() => setFlashId(null), 800);
  }, []);

  function navigate(dir: 1 | -1) {
    if (!matches.length) return;
    setMatchIndex((prev) => (prev + dir + matches.length) % matches.length);
    setReplaceCount(null);
  }

  function doReplace(all: boolean) {
    if (!find.trim() || !current) return;
    const targets = all ? matches : [current];
    let count = 0;

    // Process in reverse order so indices stay valid when replacing
    const sorted = [...targets].sort((a, b) =>
      b.slideIndex - a.slideIndex || b.elementIndex - a.elementIndex || (b.itemIndex ?? 0) - (a.itemIndex ?? 0),
    );

    sorted.forEach((m) => {
      const slide = presentation.slides[m.slideIndex];
      if (!slide) return;
      const el = slide.elements[m.elementIndex];
      if (!el) return;

      if (m.field === 'content') {
        const original = typeof (el as { content?: unknown }).content === 'string'
          ? (el as TextElement).content : '';
        const updated = applyReplace(original, find, replace, caseSensitive, wholeWord, all);
        if (updated !== original) {
          updateElement(m.slideIndex, m.elementIndex, { content: updated } as never);
          count++;
        }
      } else if (m.field === 'items' && m.itemIndex !== undefined) {
        const bl = el as BulletListElement;
        const items = bl.items.map((item, ii) => {
          if (ii !== m.itemIndex) return item;
          const original = typeof item.content === 'string' ? item.content : '';
          const updated = applyReplace(original, find, replace, caseSensitive, wholeWord, all);
          return updated !== original ? { ...item, content: updated } : item;
        });
        updateElement(m.slideIndex, m.elementIndex, { items } as never);
        count++;
      }
    });

    setReplaceCount(count);
    flash('replaced');
    if (!all) {
      // Move to next match after replacing
      setMatchIndex((prev) => Math.min(prev, matches.length - 2));
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); navigate(1); }
      if (e.key === 'Enter' && e.shiftKey)  { e.preventDefault(); navigate(-1); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length]);

  const typeIcon: Record<string, string> = {
    heading: 'H', text: 'T', 'bullet-list': '•', callout: '!',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#161b27] border border-white/10 rounded-xl shadow-2xl w-[620px] max-h-[80vh] flex flex-col overflow-hidden modal-animate">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-none">
          <div className="flex items-center gap-2">
            <span className="text-base">🔍</span>
            <h2 className="text-sm font-semibold text-white">Find & Replace</h2>
            {matches.length > 0 && (
              <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                {matchIndex + 1} / {matches.length}
              </span>
            )}
            {find && matches.length === 0 && (
              <span className="text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                No matches
              </span>
            )}
          </div>
          <button
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            onClick={onClose}
          >×</button>
        </div>

        {/* Search & Replace inputs */}
        <div className="px-5 py-4 border-b border-white/5 flex-none">
          {/* Find row */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="relative flex-1">
              <input
                ref={findRef}
                type="text"
                placeholder="Find text…"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
              {find && (
                <button
                  onClick={() => { setFind(''); setMatchIndex(0); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                >✕</button>
              )}
            </div>
            <button
              onClick={() => navigate(-1)}
              disabled={matches.length === 0}
              title="Previous match (Shift+Enter)"
              className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-30 transition-all"
            >↑</button>
            <button
              onClick={() => navigate(1)}
              disabled={matches.length === 0}
              title="Next match (Enter)"
              className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-30 transition-all"
            >↓</button>
          </div>

          {/* Replace row */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Replace with…"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              className="flex-1 bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
            <button
              onClick={() => doReplace(false)}
              disabled={!current}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-30 transition-all whitespace-nowrap"
            >Replace</button>
            <button
              onClick={() => doReplace(true)}
              disabled={matches.length === 0}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30 transition-all whitespace-nowrap"
            >Replace All</button>
          </div>

          {/* Options row */}
          <div className="flex items-center gap-4 mt-2.5">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-200">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="accent-indigo-500 w-3 h-3"
              />
              Case sensitive
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-200">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
                className="accent-indigo-500 w-3 h-3"
              />
              Whole word
            </label>
            {replaceCount !== null && (
              <span className={`text-xs font-medium ml-auto transition-all ${flashId === 'replaced' ? 'text-emerald-400' : 'text-gray-500'}`}>
                ✓ Replaced {replaceCount} occurrence{replaceCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Match list */}
        <div className="flex-1 overflow-y-auto">
          {find && matches.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
              <span className="text-3xl opacity-40">🔍</span>
              <p className="text-sm">No matches found for <strong className="text-gray-300">"{find}"</strong></p>
            </div>
          )}
          {!find && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
              <span className="text-3xl opacity-30">🔤</span>
              <p className="text-sm">Type above to search across all {presentation.slides.length} slides</p>
            </div>
          )}
          {matches.map((m, idx) => {
            const isCurrent = idx === matchIndex;
            const highlighted = m.preview.replace(
              new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi'),
              (match) => `<mark style="background:#6366f1;color:#fff;border-radius:2px;padding:0 2px;">${match}</mark>`,
            );
            return (
              <button
                key={`${m.slideIndex}-${m.elementIndex}-${m.itemIndex ?? 0}`}
                onClick={() => { setMatchIndex(idx); selectSlide(m.slideIndex); }}
                className={`w-full text-left px-5 py-3 border-b border-white/5 transition-all flex items-start gap-3 ${
                  isCurrent ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'hover:bg-white/5 border-l-2 border-l-transparent'
                }`}
              >
                {/* Slide number */}
                <div className={`flex-none w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold mt-0.5 ${
                  isCurrent ? 'bg-indigo-500 text-white' : 'bg-surface-800 text-gray-400'
                }`}>
                  {m.slideIndex + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{m.slideTitle}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      isCurrent ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-500'
                    }`}>
                      {typeIcon[m.elementType] ?? m.elementType}
                    </span>
                    {m.itemIndex !== undefined && (
                      <span className="text-[9px] text-gray-600">item {m.itemIndex + 1}</span>
                    )}
                  </div>
                  <p
                    className="text-[12px] text-gray-300 truncate leading-snug"
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-white/5 flex items-center justify-between flex-none">
          <span className="text-[10px] text-gray-600">Enter = next · Shift+Enter = prev · Esc = close</span>
          <button className="btn-ghost text-xs" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
