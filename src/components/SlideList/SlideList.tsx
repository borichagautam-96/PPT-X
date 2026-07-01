import { useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore.ts';
import SlideThumb from './SlideThumb.tsx';

function slideMatchesQuery(slide: ReturnType<typeof useEditorStore.getState>['presentation']['slides'][number], q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (slide.title?.toLowerCase().includes(needle)) return true;
  if (slide.notes?.toLowerCase().includes(needle)) return true;
  return slide.elements.some((el) => {
    const content = (el as { content?: unknown }).content;
    if (typeof content === 'string' && content.toLowerCase().includes(needle)) return true;
    if ('items' in el && Array.isArray((el as { items?: { content?: string }[] }).items)) {
      return (el as { items: { content?: string }[] }).items.some(
        (item) => item.content?.toLowerCase().includes(needle),
      );
    }
    return false;
  });
}

export default function SlideList() {
  const { presentation, selectedSlideIndex, selectSlide, reorderSlide } = useEditorStore();
  const { slides } = presentation;

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const visibleIndices = slides
    .map((_, i) => i)
    .filter((i) => slideMatchesQuery(slides[i], query));
  const isFiltering = query.trim().length > 0;

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData('slideIndex', String(index));
    setDraggedIndex(index);
    // Slight delay so the drag image is still rendered
    setTimeout(() => setDraggedIndex(index), 0);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('slideIndex'));
    if (from !== toIndex && !isNaN(from)) reorderSlide(from, toIndex);
    setDragOverIndex(null);
    setDraggedIndex(null);
  }

  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 mb-2 mt-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Slides
        </p>
        <span className="text-[10px] font-medium text-gray-500 bg-surface-900 px-1.5 py-0.5 rounded-sm shadow-inner">
          {isFiltering ? `${visibleIndices.length}/${slides.length}` : slides.length}
        </span>
      </div>

      <div className="relative mb-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search slides…"
          className="w-full text-[11px] bg-surface-900 border border-white/5 rounded-md pl-6 pr-6 py-1.5 text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-[11px] pointer-events-none">🔍</span>
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-[11px] px-1"
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {isFiltering && visibleIndices.length === 0 && (
        <p className="text-[11px] text-gray-500 text-center py-6 px-2">No slides match “{query}”.</p>
      )}

      {visibleIndices.map((index) => {
        const slide = slides[index];
        return (
        <div
          key={slide.id}
          className="relative transition-all duration-200"
          style={{ opacity: draggedIndex === index ? 0.4 : 1 }}
        >
          {dragOverIndex === index && draggedIndex !== null && draggedIndex > index && (
            <div className="absolute -top-1.5 left-0 right-0 h-1 bg-accent rounded-full z-10 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-[fadeIn_0.1s_ease-out]" />
          )}
          
          <div
            draggable={!isFiltering}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => handleDrop(e, index)}
          >
            <SlideThumb
              slide={slide}
              index={index}
              displayNumber={index + 1}
              isSelected={index === selectedSlideIndex}
              onClick={() => selectSlide(index)}
            />
          </div>

          {dragOverIndex === index && draggedIndex !== null && draggedIndex < index && (
            <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-accent rounded-full z-10 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-[fadeIn_0.1s_ease-out]" />
          )}
        </div>
        );
      })}
    </div>
  );
}
