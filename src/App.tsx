import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Image as ImageIcon, CalendarDays } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import LanguageToggle from './components/LanguageToggle';
import { VERSION } from './version';

/**
 * Placeholder landing. Exists only to exercise the design-system foundation,
 * i18n, and the base components. The real Picture ↔ Calendar shell is #187.
 */
function Landing() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('app.name');
  }, [t, i18n.resolvedLanguage]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-4 px-5 pt-6">
        <span className="font-display text-xl font-medium tracking-tight">{t('app.name')}</span>
        <LanguageToggle />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-5 py-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-muted-foreground shadow-soft">
          <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
          {t('nav.picture')}
          <span className="opacity-40">·</span>
          <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
          {t('nav.calendar')}
        </span>

        <h1 className="font-display text-4xl">{t('landing.welcome')}</h1>
        <p className="max-w-md text-lg text-muted-foreground">{t('app.tagline')}</p>

        <Card className="w-full max-w-md text-left">
          <CardContent className="flex flex-col gap-4">
            <p className="text-base text-muted-foreground">{t('landing.scaffoldNote')}</p>
            <Button onClick={() => toast.success(t('toast.hello'))}>{t('landing.tryButton')}</Button>
          </CardContent>
        </Card>
      </main>

      <footer className="px-5 py-4 text-center text-sm text-muted-foreground">v{VERSION}</footer>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" />
    </>
  );
}
