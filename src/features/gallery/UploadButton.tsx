import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { uploadFiles, type UploadResult } from './uploadFiles';

export type { UploadResult };

// Ported from random-tools' eink-frame UploadButton.tsx (#185). Same hidden-input +
// uploadFiles logic; gains a `floating` presentation for the mobile thumb-reach FAB.

type Props = {
  onFileDone: (result: UploadResult, file: File, done: number, total: number) => void;
  onUploadComplete: (results: UploadResult[]) => void;
  disabled?: boolean;
  floating?: boolean;
  className?: string;
};

export function UploadButton({ onFileDone, onUploadComplete, disabled, floating, className }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (inputRef.current) inputRef.current.value = '';
    await uploadFiles(files, { onFileDone, onUploadComplete });
  }

  const open = () => inputRef.current?.click();

  // NOTE (#190): on Android Chrome 14/15, `accept="image/*" multiple` skips the system
  // Photo Picker and opens the Files UI directly (no gallery grid) — `multiple` is the
  // cause, and there is no web-side way to get the gallery without dropping it. We keep
  // `multiple` (multi-select) by decision; the gallery limitation is OS/Chrome-side.
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      {floating ? (
        <button
          type="button"
          onClick={open}
          disabled={disabled}
          aria-label={t('gallery.upload')}
          className={cn(
            'fixed bottom-6 right-5 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-primary pl-5 pr-6 text-base font-semibold text-primary-foreground shadow-lifted transition-transform active:scale-95 disabled:opacity-60',
            className
          )}
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <Upload className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          {t('gallery.upload')}
        </button>
      ) : (
        <Button size="sm" onClick={open} disabled={disabled} className={className}>
          <Upload className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {t('gallery.upload')}
        </Button>
      )}
    </>
  );
}
