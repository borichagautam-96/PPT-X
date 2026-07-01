/**
 * image-export.ts
 *
 * Exports each slide as a PNG image, either as a single file (one slide) or
 * a ZIP archive (all slides), using the same off-screen render pipeline as
 * video export.
 */

import JSZip from 'jszip';
import type { Presentation } from '@/core/schema';
import { captureSlideToCanvas } from './slide-capture.ts';
import { downloadBlob, slugify } from './download.ts';

export interface ImageExportProgress {
  slideIndex: number;
  total:      number;
  label:      string;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

/** Export a single slide as a standalone PNG download. */
export async function exportSlideAsPng(
  presentation: Presentation,
  slideIndex: number,
  width = 1920,
  height = 1080,
): Promise<void> {
  const canvas = await captureSlideToCanvas(presentation, slideIndex, width, height);
  const blob = await canvasToPngBlob(canvas);
  const filename = `${slugify(presentation.meta.title)}-slide-${slideIndex + 1}.png`;
  downloadBlob(new Uint8Array(await blob.arrayBuffer()), filename, 'image/png');
}

/** Export every slide as PNGs bundled into a single ZIP download. */
export async function exportAllSlidesAsPngZip(
  presentation: Presentation,
  onProgress?: (p: ImageExportProgress) => void,
  width = 1920,
  height = 1080,
  signal?: AbortSignal,
): Promise<void> {
  const zip = new JSZip();
  const total = presentation.slides.length;

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) return;
    onProgress?.({ slideIndex: i, total, label: `Rendering slide ${i + 1} of ${total}…` });
    const canvas = await captureSlideToCanvas(presentation, i, width, height);
    const blob = await canvasToPngBlob(canvas);
    const num = String(i + 1).padStart(2, '0');
    zip.file(`slide-${num}.png`, blob);
  }

  if (signal?.aborted) return;
  onProgress?.({ slideIndex: total, total, label: 'Packaging ZIP…' });
  const data = await zip.generateAsync({ type: 'uint8array' });
  downloadBlob(data, `${slugify(presentation.meta.title)}-images.zip`, 'application/zip');
}
