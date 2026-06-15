import { useTranslation } from 'react-i18next';
import type { FrameImage, Orientation } from '@/types/image';
import { ImageCard } from './ImageCard';

type Props = {
  images: FrameImage[];
  orientation: Orientation;
  onPreview: (image: FrameImage) => void;
};

// Ported from random-tools' eink-frame ImageGrid.tsx (#185). Portrait cards pack tighter,
// so the vertical view gets an extra column at each breakpoint.
export function ImageGrid({ images, orientation, onPreview }: Props) {
  const { t } = useTranslation();

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center text-base text-muted-foreground">
        {t('gallery.empty')}
      </div>
    );
  }

  const cols = orientation === 'vertical'
    ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

  return (
    <div className={`grid ${cols} gap-3`}>
      {images.map(img => (
        <ImageCard
          key={img.name}
          image={img}
          orientation={orientation}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}
