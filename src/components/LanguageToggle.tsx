import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

/**
 * Manual PL/EN override. i18next-browser-languagedetector persists the choice to
 * localStorage (key `the-frame-lang`), so it survives reloads and beats navigator
 * detection on the next visit.
 */
export default function LanguageToggle({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.resolvedLanguage ?? '')
    ? (i18n.resolvedLanguage as SupportedLanguage)
    : 'en';

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className={cn('inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft', className)}
    >
      <Languages className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => void i18n.changeLanguage(lng)}
          aria-pressed={current === lng}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
            current === lng
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t(`language.${lng}`)}
        </button>
      ))}
    </div>
  );
}
