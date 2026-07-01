/**
 * FooterSettingsModal.tsx
 *
 * Edits the branding footer shown on every slide (deliverable/system text,
 * org line, copyright text, logo). Backed by `presentation.footer` — see
 * core/footer-defaults.ts for the built-in fallback values used when a field
 * is left blank.
 */

import { useCallback, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore.ts';
import { DEFAULT_FOOTER } from '@/core/footer-defaults';
import type { FooterConfig } from '@/core/schema';

interface Props {
  onClose: () => void;
}

function FieldRow({
  label, placeholder, value, onChange,
}: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field-input text-sm"
      />
    </label>
  );
}

export default function FooterSettingsModal({ onClose }: Props) {
  const { presentation, updateFooterConfig } = useEditorStore();
  const [footer, setFooter] = useState<FooterConfig>(() => ({ ...presentation.footer }));

  const update = useCallback((partial: Partial<FooterConfig>) => {
    const next = { ...footer, ...partial };
    setFooter(next);
    updateFooterConfig(next);
  }, [footer, updateFooterConfig]);

  function resetToDefaults() {
    setFooter({});
    updateFooterConfig({});
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#161b27] modal-animate border border-white/10 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-none">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏷️</span>
            <div>
              <h2 className="text-sm font-semibold text-white">Footer / Branding</h2>
              <p className="text-xs text-gray-400 mt-0.5">Shown on every slide — changes reflect instantly</p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <FieldRow
            label="Deliverable / gray-bar text"
            placeholder={DEFAULT_FOOTER.deliverableText}
            value={footer.deliverableText ?? ''}
            onChange={(v) => update({ deliverableText: v || undefined })}
          />
          <FieldRow
            label="Organization line (blue bar, left)"
            placeholder={DEFAULT_FOOTER.orgLine}
            value={footer.orgLine ?? ''}
            onChange={(v) => update({ orgLine: v || undefined })}
          />
          <FieldRow
            label="Copyright text (blue bar, center)"
            placeholder={DEFAULT_FOOTER.copyrightText}
            value={footer.copyrightText ?? ''}
            onChange={(v) => update({ copyrightText: v || undefined })}
          />
          <FieldRow
            label="Logo URL (blue bar, right)"
            placeholder={DEFAULT_FOOTER.logoUrl}
            value={footer.logoUrl ?? ''}
            onChange={(v) => update({ logoUrl: v || undefined })}
          />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Leave a field blank to use the default shown as its placeholder. The system/deck name
            shown after the deliverable text comes from the presentation title (Toolbar → deck name).
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 flex-none">
          <button
            onClick={resetToDefaults}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Reset to defaults
          </button>
          <button onClick={onClose} className="btn-primary text-sm px-4 py-1.5">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
