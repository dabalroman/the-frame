import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';

export default function HomeButton() {
  const { t } = useTranslation();

  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      {t('home.back')}
    </Link>
  );
}
