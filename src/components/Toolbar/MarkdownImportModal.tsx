import { useRef, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore.ts';

interface Props {
  onClose: () => void;
}

export default function MarkdownImportModal({ onClose }: Props) {
  const { parseFromMarkdown } = useEditorStore();
  const [md, setMd] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const mdFile = fileArray.find(f => f.name.match(/\.(md|markdown|txt)$/i));
    const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));

    if (mdFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setMd(e.target?.result as string);
        setFileName(mdFile.name);
      };
      reader.readAsText(mdFile);
    }
    
    if (imageFiles.length > 0) {
      const newImageMap = { ...imageMap };
      for (const file of imageFiles) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        newImageMap[file.name] = dataUrl;
      }
      setImageMap(newImageMap);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }

  function handleImport() {
    let finalMd = md;
    if (finalMd.trim()) {
      for (const [name, dataUrl] of Object.entries(imageMap)) {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const encodedName = encodeURIComponent(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\]\\((?:[^)]*\\/)?(?:${escapedName}|${encodedName})\\)`, 'g');
        finalMd = finalMd.replace(re, `](${dataUrl})`);
      }
      parseFromMarkdown(finalMd);
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1e2433] modal-animate border border-white/10 rounded-xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-gray-100">Import Markdown</h2>
          <button
            className="text-gray-400 hover:text-gray-100 transition-colors text-lg leading-none"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="p-5 flex-1 overflow-hidden flex flex-col gap-3">
          {/* File drop zone */}
          <div
            className={[
              'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 cursor-pointer transition-colors',
              dragOver
                ? 'border-indigo-500 bg-indigo-600/10'
                : 'border-white/15 hover:border-white/30 hover:bg-white/5',
            ].join(' ')}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <span className="text-2xl">📄</span>
            <p className="text-xs text-gray-300 font-medium">
              {fileName ? fileName : 'Click to browse or drag & drop a .md file'}
            </p>
            <div className="flex gap-2 w-full mt-2">
              <button
                className="flex-1 bg-white/5 hover:bg-white/10 text-xs font-medium py-2 rounded border border-white/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Select Files
              </button>
              <button
                className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-medium py-2 rounded border border-indigo-500/30 transition-colors"
                onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
              >
                📁 Select Entire Folder
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt,image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is standard but often missing from types
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">or paste</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Paste area */}
          <div className="flex justify-between items-end -mb-1">
            <p className="text-xs text-gray-400">
              H1/H2 headings become new slides. Use{' '}
              <code className="bg-white/10 px-1 rounded text-indigo-300">
                &lt;!-- layout: two-column --&gt;
              </code>{' '}
              to control layout.
            </p>
            {Object.keys(imageMap).length > 0 && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-medium">
                {Object.keys(imageMap).length} image(s) loaded
              </span>
            )}
          </div>
          <textarea
            className="field-textarea flex-1 min-h-[200px] font-mono text-xs"
            placeholder="# My Slide&#10;Content here..."
            value={md}
            onChange={(e) => { setMd(e.target.value); if (e.target.value !== md) setFileName(''); }}
            spellCheck={false}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-4">
          <span className="text-[10px] text-gray-500">
            {md.trim() ? `${md.split('\n').length} lines` : 'No content'}
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" onClick={onClose}>Cancel</button>
            <button className="btn-primary text-sm" onClick={handleImport} disabled={!md.trim()}>
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
