import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from './components/ui/sonner';
import Gallery from './features/gallery/Gallery';

/**
 * Gallery lives at `/` for now (#185). The real Picture ↔ Calendar shell that
 * wraps it is #187.
 */
export default function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('app.name');
  }, [t, i18n.resolvedLanguage]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" />
    </>
  );
}
