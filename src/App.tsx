import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from './components/ui/sonner';
import Home from './features/home/Home';
import Gallery from './features/gallery/Gallery';
import Calendar from './features/calendar/Calendar';

export default function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('app.name');
  }, [t, i18n.resolvedLanguage]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/photos" element={<Gallery />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" />
    </>
  );
}
