import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Container } from '../common/Container';
import { LanguageSelector } from '../common/LanguageSelector';
import { useTranslation } from '../../hooks/useTranslation';
import { stopSpeech } from '../../lib/speech';
import { Footer } from './Footer';
import { DemoModeBanner } from './DemoModeBanner';
import { EmergencyButton } from '../../features/emergency/EmergencyButton';
import { Header } from './Header';
import { RouteFocusManager } from './RouteFocusManager';

export function AppLayout() {
  const mainRef = useRef(null);
  const { pathname } = useLocation();
  const { t } = useTranslation();

  // Read-aloud belongs to the page it was started on.
  useEffect(() => stopSpeech, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-brand-700 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('layout.skipToContent')}
      </a>
      <DemoModeBanner />
      {/* Language choice is available on every page, before and after sign-in. */}
      <div className="border-b border-line bg-white">
        <Container className="flex justify-end py-1.5">
          <LanguageSelector />
        </Container>
      </div>
      <Header />
      <EmergencyButton />
      <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <RouteFocusManager mainRef={mainRef} />
    </div>
  );
}
