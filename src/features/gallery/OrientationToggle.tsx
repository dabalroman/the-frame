import { useTranslation } from 'react-i18next';
import { RectangleHorizontal, RectangleVertical } from 'lucide-react';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import type { Orientation } from '@/types/image';

/** Gallery view-orientation control — a thin wrapper over the shared SegmentedToggle. */
export function OrientationToggle({
  value,
  onChange,
  className,
}: {
  value: Orientation;
  onChange: (o: Orientation) => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <SegmentedToggle<Orientation>
      value={value}
      onChange={onChange}
      ariaLabel={t('gallery.viewOrientation')}
      className={className}
      options={[
        { value: 'horizontal', label: t('gallery.orientation.horizontal'), Icon: RectangleHorizontal },
        { value: 'vertical', label: t('gallery.orientation.vertical'), Icon: RectangleVertical },
      ]}
    />
  );
}
