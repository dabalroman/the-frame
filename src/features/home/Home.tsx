import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Images, CalendarDays } from 'lucide-react';
import LanguageToggle from '@/components/LanguageToggle';

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-8 px-5 py-10 sm:py-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl sm:text-4xl">{t('app.name')}</h1>
          <p className="text-base text-muted-foreground">{t('app.tagline')}</p>
        </div>
        <LanguageToggle />
      </header>

      <nav className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-6">
        <Link
          to="/photos"
          className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-6 shadow-card transition-[transform,box-shadow] hover:shadow-lifted active:scale-[0.99] sm:p-8"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Images className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <h2 className="font-display text-2xl">{t('home.photos.title')}</h2>
          <p className="text-base text-muted-foreground">{t('home.photos.description')}</p>
        </Link>

        <Link
          to="/calendar"
          className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-6 shadow-card transition-[transform,box-shadow] hover:shadow-lifted active:scale-[0.99] sm:p-8"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <h2 className="font-display text-2xl">{t('home.calendar.title')}</h2>
          <p className="text-base text-muted-foreground">{t('home.calendar.description')}</p>
        </Link>
      </nav>
    </div>
  );
}
