import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import LanguageToggle from '@/components/LanguageToggle';
import HomeButton from '@/components/HomeButton';
import { useImages } from './useImages';
import { useFrameConfig } from './useFrameConfig';
import { useGalleryOrientation } from './useGalleryOrientation';
import { UploadButton, type UploadResult } from './UploadButton';
import { uploadFiles } from './uploadFiles';
import { ImageGrid } from './ImageGrid';
import { OrientationToggle } from './OrientationToggle';
import { CropEditor } from './CropEditor';
import { DuplicateReviewModal, type ReviewItem } from './DuplicateReviewModal';
import type { FrameImage } from '@/types/image';

// Ported from random-tools' eink-frame EinkFrame.tsx (#185). Upload / delete-undo /
// duplicate-review-queue / drag-drop logic is identical; the random-tools ToolHeader +
// footer-status context are replaced by The Frame's own warm header + i18n. The real
// Picture↔Calendar shell wraps this in #187.

const UNDO_TTL = 5000;

type UploadProgress = { done: number; total: number };

export default function Gallery() {
  const { t } = useTranslation();
  const { images, loading, error, reload } = useImages();
  const frameConfig = useFrameConfig();
  const [orientation, setOrientation] = useGalleryOrientation();
  const [preview, setPreview] = useState<FrameImage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (error) toast.error(error, { duration: Infinity, id: 'images-fetch-error' });
  }, [error]);

  function clearToastTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  async function handleDelete(image: FrameImage) {
    const res = await fetch(`/api/images/${encodeURIComponent(image.name)}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(t('gallery.deleteFailed', { status: res.status }));
      return;
    }
    void reload();

    clearToastTimer();
    if (toastIdRef.current !== null) toast.dismiss(toastIdRef.current);

    toastIdRef.current = toast(t('gallery.deleted', { name: image.name }), {
      duration: UNDO_TTL,
      action: {
        label: t('gallery.undo'),
        onClick: () => {
          clearToastTimer();
          void fetch(`/api/images/${encodeURIComponent(image.name)}/restore`, { method: 'POST' }).then(() => reload());
        },
      },
      onDismiss: () => {
        // Dismissed by user before TTL — still purge from trash
        clearToastTimer();
        void fetch(`/api/trash/${encodeURIComponent(image.name)}`, { method: 'DELETE' });
      },
    });

    timerRef.current = setTimeout(() => {
      void fetch(`/api/trash/${encodeURIComponent(image.name)}`, { method: 'DELETE' });
      timerRef.current = null;
    }, UNDO_TTL);
  }

  function handleFileDone(result: UploadResult, file: File, done: number, total: number) {
    setUploadProgress({ done, total });
    if (result.duplicate && result.matchedName) {
      const incomingUrl = URL.createObjectURL(file);
      setReviewQueue(q => [...q, { file, incomingUrl, matchedName: result.matchedName! }]);
    } else if (result.error) {
      const msg = file.name ? `${file.name}: ${result.error}` : result.error;
      toast.error(msg);
    }
    void reload();
  }

  function handleUploadComplete(_results: UploadResult[]) {
    setUploadProgress(null);
    void reload();
  }

  function dequeueHead() {
    setReviewQueue(q => {
      const [head, ...rest] = q;
      if (head) URL.revokeObjectURL(head.incomingUrl);
      return rest;
    });
  }

  async function handleReviewUploadAnyway() {
    const head = reviewQueue[0];
    if (!head) return;
    dequeueHead();
    await uploadFiles(
      [head.file],
      {
        onFileDone: (res, file) => {
          if (res.error) {
            toast.error(`${file.name}: ${res.error}`);
          }
        },
        onUploadComplete: () => { void reload(); },
      },
      { force: true },
    );
  }

  function handleReviewSkip() {
    dequeueHead();
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    if (!(e.currentTarget as Element).contains(e.relatedTarget as Node)) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!(e.currentTarget as Element).contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    await uploadFiles(files, { onFileDone: handleFileDone, onUploadComplete: handleUploadComplete });
  }

  const uploading = uploadProgress !== null;

  const status = uploading
    ? t('gallery.status.uploading', { done: uploadProgress.done, total: uploadProgress.total })
    : loading ? t('gallery.status.loading')
    : error ? t('gallery.status.error')
    : t('gallery.status.images', { count: images.length });

  const reviewHead = reviewQueue[0];

  return (
    <div
      className="relative flex flex-col gap-6 p-4 sm:p-6 max-w-screen-xl mx-auto min-h-screen"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <HomeButton />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-2xl sm:text-3xl">{t('gallery.title')}</h1>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
          {/* On mobile the language toggle rides next to the title; on desktop it joins the control group. */}
          <LanguageToggle className="sm:hidden" />
        </div>

        <div className="flex items-center gap-2">
          <OrientationToggle value={orientation} onChange={setOrientation} />
          <LanguageToggle className="hidden sm:inline-flex" />
          <UploadButton
            className="hidden sm:inline-flex"
            disabled={uploading}
            onFileDone={handleFileDone}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      </header>

      <ImageGrid images={images} orientation={orientation} onPreview={setPreview} />

      {/* Spacer so the floating upload button never hides the last row on mobile. */}
      <div className="h-20 sm:hidden" aria-hidden />

      {/* Mobile: thumb-reachable floating upload button (desktop uses the header button). */}
      <UploadButton
        floating
        className="sm:hidden"
        disabled={uploading}
        onFileDone={handleFileDone}
        onUploadComplete={handleUploadComplete}
      />

      {/* Crop editor / preview modal — derive from images so crop prop stays fresh after reload */}
      {preview && (
        <CropEditor
          key={preview.name}
          image={images.find(img => img.name === preview.name) ?? preview}
          frameWidth={frameConfig.width}
          frameHeight={frameConfig.height}
          initialOrientation={orientation}
          onClose={() => setPreview(null)}
          onDelete={handleDelete}
          onCropSaved={() => { void reload(); }}
        />
      )}

      {reviewHead && (
        <DuplicateReviewModal
          item={reviewHead}
          remaining={reviewQueue.length}
          onSkip={handleReviewSkip}
          onUploadAnyway={handleReviewUploadAnyway}
        />
      )}

      {/* Drop zone overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/90 pointer-events-none">
          <p className="text-lg font-semibold text-primary">{t('gallery.dropHere')}</p>
        </div>
      )}
    </div>
  );
}
