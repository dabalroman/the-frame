import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../locales/en.json';
import pl from '../locales/pl.json';

export const SUPPORTED_LANGUAGES = ['en', 'pl'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pl: { translation: pl },
    },
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    // Polish-first: this frame lives in a Polish home. We deliberately ignore the
    // browser/navigator language so first load is always PL; the manual toggle
    // (persisted to localStorage) is the only way to switch, and it sticks.
    fallbackLng: 'pl',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'the-frame-lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
