import { useRef } from 'react';
import { Outlet } from 'react-router';
import { Footer } from './Footer';
import { DemoModeBanner } from './DemoModeBanner';
import { Header } from './Header';
import { RouteFocusManager } from './RouteFocusManager';

export function AppLayout() {
  const mainRef = useRef(null);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-brand-700 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <DemoModeBanner />
      <Header />
      <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <RouteFocusManager mainRef={mainRef} />
    </div>
  );
}
