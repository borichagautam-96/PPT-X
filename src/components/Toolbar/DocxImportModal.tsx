/**
 * DocxImportModal.tsx
 *
 * A drag-and-drop modal for importing a .docx file into the editor.
 * Shows a progress bar while converting, then a summary before confirming.
 */

import { useRef, useState, useCallback } from 'react';
import { docxToPresentation, type DocxParseProgress } from '../../core/parser/docx-parser.ts';
import { useEditorStore } from '../../store/useEditorStore.ts';
import type { Presentation } from '@/core/schema';

interface Props {
  onClose: () => void;
}

type Stage = 'idle' | 'parsing' | 'preview' | 'error';

// Large/image-heavy documents can legitimately take a while — surface a clear
// timeout error rather than leaving the user staring at a stalled progress bar.
const IMPORT_TIMEOUT_MS = 120_000;

export default function DocxImportModal({ onClose }: Props) {
  const { loadPresentation } = useEditorStore();

  const [stage, setStage]               = useState<Stage>('idle');
  const [progress, setProgress]         = useState<DocxParseProgress | null>(null);
  const [parsed, setParsed]             = useState<Presentation | null>(null);
  const [errorMsg, setErrorMsg]         = useState<string>('');
  const [isDragOver, setIsDragOver]     = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const abortRef                        = useRef<AbortController | null>(null);
  const manualCancelRef                 = useRef(false);

  // ── File processing ──────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setErrorMsg('Please select a valid .docx file.');
      setStage('error');
      return;
    }
    setStage('parsing');
    setProgress({ current: 0, total: 2, label: 'Starting…' });
    manualCancelRef.current = false;

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

    try {
      const presentation = await docxToPresentation(file, (p) => setProgress(p), {}, controller.signal);
      setParsed(presentation);
      setStage('preview');
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      // Word documents with many/large embedded images get inlined as base64
      // data URIs; past a few hundred MB of combined image data this can
      // exceed the JS engine's maximum string length ("Invalid string length").
      const isStringLengthLimit = e instanceof RangeError && /string length/i.test(e.message);
      setErrorMsg(
        manualCancelRef.current
          ? 'Import cancelled.'
          : isAbort
          ? 'This document is taking too long to convert (over 2 minutes) and was cancelled. Try a smaller document, or one with fewer/smaller embedded images.'
          : isStringLengthLimit
          ? 'This document has too many or too large embedded images to convert. Try compressing the images in Word first, or splitting the document into smaller files.'
          : e instanceof Error ? e.message : 'Unknown error while parsing the file.',
      );
      setStage('error');
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    manualCancelRef.current = true;
    abortRef.current?.abort();
  }, []);

  // ── Drag-and-drop ────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ── Import confirm ───────────────────────────────────────────────────────

  const handleImport = () => {
    if (!parsed) return;
    loadPresentation(parsed);
    onClose();
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  function countElements(p: Presentation): number {
    return p.slides.reduce((acc, s) => acc + s.elements.length, 0);
  }

  function countImages(p: Presentation): number {
    return p.assets.length;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#161b27] modal-animate border border-white/10 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div>
              <h2 className="text-sm font-semibold text-white">Import Word Document</h2>
              <p className="text-xs text-gray-400 mt-0.5">Import a .docx file into the editor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* ── IDLE: drop zone ── */}
          {stage === 'idle' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={[
                'rounded-lg border-2 border-dashed transition-all duration-150 flex flex-col items-center justify-center py-12 px-6 text-center cursor-pointer',
                isDragOver
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-white/20 hover:border-white/40 hover:bg-white/5',
              ].join(' ')}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-4xl mb-3 select-none">📂</div>
              <p className="text-sm font-medium text-white mb-1">
                Drop your .docx file here
              </p>
              <p className="text-xs text-gray-400">or click to browse</p>
              <p className="text-xs text-gray-600 mt-4">
                Supports headings, paragraphs, lists, tables, and images
              </p>
              <p className="text-xs text-gray-600">
                Word's "Heading 1"/"Heading 2" styles become new slides — just like Markdown import
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}

          {/* ── PARSING: progress bar ── */}
          {stage === 'parsing' && progress && (
            <div className="py-8 flex flex-col items-center gap-6">
              <div className="text-3xl animate-bounce select-none">⚙️</div>
              <div className="w-full">
                <p className="text-xs text-gray-400 mb-3 text-center">{progress.label}</p>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{
                      width: progress.total > 0
                        ? `${Math.round((progress.current / progress.total) * 100)}%`
                        : '10%',
                    }}
                  />
                </div>
                {progress.total > 1 && (
                  <p className="text-[11px] text-gray-600 mt-2 text-center">
                    {progress.current} / {progress.total}
                  </p>
                )}
                <p className="text-[11px] text-gray-600 mt-3 text-center">
                  Large or image-heavy documents can take a minute or two.
                </p>
              </div>
              <button onClick={handleCancel} className="btn-ghost text-xs px-4 py-1.5">
                Cancel
              </button>
            </div>
          )}

          {/* ── PREVIEW: parsed summary ── */}
          {stage === 'preview' && parsed && (
            <div className="flex flex-col gap-5">
              {/* Summary card */}
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
                <p className="text-sm font-semibold text-white mb-3">
                  ✅ Parsed successfully
                </p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-2xl font-bold text-indigo-400">{parsed.slides.length}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Slides</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-2xl font-bold text-indigo-400">{countElements(parsed)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Elements</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-2xl font-bold text-indigo-400">{countImages(parsed)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Images</p>
                  </div>
                </div>
              </div>

              {/* Slide list preview */}
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1 pr-1">
                {parsed.slides.slice(0, 20).map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 rounded bg-white/5 text-xs text-gray-300"
                  >
                    <span className="text-gray-500 w-5 text-right flex-none">{i + 1}</span>
                    <span className="flex-1 truncate">{s.title || 'Untitled slide'}</span>
                    <span className="text-gray-500 flex-none">{s.elements.length} el.</span>
                  </div>
                ))}
                {parsed.slides.length > 20 && (
                  <p className="text-xs text-gray-500 text-center py-1">
                    … and {parsed.slides.length - 20} more slides
                  </p>
                )}
              </div>

              <p className="text-[11px] text-amber-400/80">
                ⚠ Headers/footers, footnotes, comments, and tracked changes are not imported.
                Only "Heading 1"/"Heading 2" styles start new slides — other content stays on the current slide.
              </p>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setStage('idle'); setParsed(null); }}
                  className="btn-ghost flex-1"
                >
                  ← Try another file
                </button>
                <button
                  onClick={handleImport}
                  className="btn-primary flex-1"
                >
                  Import →
                </button>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {stage === 'error' && (
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="text-4xl select-none">❌</div>
              <div className="text-center">
                <p className="text-sm font-semibold text-red-400 mb-2">Import failed</p>
                <p className="text-xs text-gray-400 max-w-xs">{errorMsg}</p>
              </div>
              <button
                onClick={() => { setStage('idle'); setErrorMsg(''); }}
                className="btn-ghost"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
