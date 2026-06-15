import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Fab } from '@/components/Fab';
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

  // Mobile upload accept (#190): plain `accept="image/*" multiple` makes Android Chrome
  // 14/15 open the Files UI *directly* — no Camera, no gallery grid. Appending the
  // non-standard `android/allowCamera` token makes Chrome show an intent chooser with
  // BOTH Camera and Files (multi-select preserved), which is what we want. The system
  // Photo Picker / gallery grid is NOT reachable while `multiple` is set (Chrome
  // limitation) — accepted. Mobile FAB only, so the desktop dialog keeps its clean
  // image-only filter. Non-image picks are rejected server-side by the magic-byte check.
  const accept = floating ? 'image/*,android/allowCamera' : 'image/*';

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleChange}
      />
      {floating ? (
        <Fab
          onClick={open}
          disabled={disabled}
          label={t('gallery.upload')}
          icon={<Upload className="h-5 w-5 shrink-0" strokeWidth={1.5} />}
          className={className}
        />
      ) : (
        <Button size="sm" onClick={open} disabled={disabled} className={className}>
          <Upload className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {t('gallery.upload')}
        </Button>
      )}
    </>
  );
}
