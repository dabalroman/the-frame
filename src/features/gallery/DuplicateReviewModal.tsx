import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// Ported from random-tools' eink-frame DuplicateReviewModal.tsx (#185). Queue-owned
// object URL lifecycle and logic are identical; restyled + i18n. The matched
// thumbnail path changed (`/api/eink/images/...` → `/api/images/...`).

// The object URL is owned by the queue (created at enqueue, revoked at dequeue),
// not by this component — guarantees a stable lifetime across React StrictMode
// double-invokes of mount effects.
export type ReviewItem = { file: File; incomingUrl: string; matchedName: string };

type Props = {
  item: ReviewItem;
  remaining: number;
  onSkip: () => void;
  onUploadAnyway: () => void;
};

export function DuplicateReviewModal({ item, remaining, onSkip, onUploadAnyway }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open onOpenChange={open => { if (!open) onSkip(); }}>
      <DialogContent className="max-w-2xl" hideCloseButton>
        <DialogTitle>{t('gallery.dup.title')}</DialogTitle>
        <DialogDescription>
          <span className="font-medium text-foreground break-all">{item.file.name}</span>{' '}
          {t('gallery.dup.body')}
          {remaining > 1 ? ` ${t('gallery.dup.bodyMore', { count: remaining - 1 })}` : ''}
        </DialogDescription>

        <div className="grid grid-cols-2 gap-3">
          <figure className="flex flex-col gap-1.5">
            <figcaption className="text-xs font-semibold text-muted-foreground">
              {t('gallery.dup.incoming')}
            </figcaption>
            <div className="overflow-hidden rounded-xl border border-border bg-card aspect-[5/3]">
              <img src={item.incomingUrl} alt={t('gallery.dup.incoming')} className="w-full h-full object-cover" />
            </div>
            <p className="text-xs text-muted-foreground truncate">{item.file.name}</p>
          </figure>

          <figure className="flex flex-col gap-1.5">
            <figcaption className="text-xs font-semibold text-muted-foreground">
              {t('gallery.dup.matched')}
            </figcaption>
            <div className="overflow-hidden rounded-xl border border-border bg-card aspect-[5/3]">
              <img
                src={`/api/images/${encodeURIComponent(item.matchedName)}/thumb`}
                alt={item.matchedName}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-muted-foreground truncate">{item.matchedName}</p>
          </figure>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onUploadAnyway}>{t('gallery.dup.uploadAnyway')}</Button>
          <Button size="sm" onClick={onSkip}>{t('gallery.dup.skip')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
