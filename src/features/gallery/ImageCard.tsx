import { useTranslation } from 'react-i18next';
import type { FrameImage, Orientation } from '@/types/image';

type Props = {
  image: FrameImage;
  orientation: Orientation;
  onPreview: (image: FrameImage) => void;
};

// Ported from random-tools' eink-frame ImageCard.tsx (#185), extended with a view
// orientation: the card shows that orientation's thumbnail (landscape or portrait) and
// flags when no crop is saved for it yet (the thumb then shows the auto-crop preview).
export function ImageCard({ image, orientation, onPreview }: Props) {
  const { t } = useTranslation();
  const crop = image.crops?.[orientation];
  const aspect = orientation === 'vertical' ? 'aspect-[3/5]' : 'aspect-[5/3]';
  // Cache-bust on the saved crop's geometry; the auto-crop fallback is deterministic so
  // needs no bust.
  const bust = crop
    ? `&v=${crop.x.toFixed(4)},${crop.y.toFixed(4)},${crop.w.toFixed(4)},${crop.h.toFixed(4)}`
    : '';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft transition-shadow hover:shadow-card">
      <button
        className={`block w-full ${aspect}`}
        onClick={() => onPreview(image)}
        aria-label={`Preview ${image.name}`}
      >
        <img
          src={`/api/images/${encodeURIComponent(image.name)}/thumb?orientation=${orientation}${bust}`}
          alt={image.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </button>
      {!crop && (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-foreground/70 px-2 py-0.5 text-xs font-semibold text-background backdrop-blur-sm">
          {t('gallery.notSet')}
        </span>
      )}
    </div>
  );
}
