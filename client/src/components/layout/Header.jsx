import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AuthActions } from './AuthActions';
import { BrandLink } from './BrandLink';
import { MainNav } from './MainNav';
import { Container } from '../common/Container';
import { OPENED_ON_LANDING } from '../../hooks/useLandingReveal';
import { useTranslation } from '../../hooks/useTranslation';

const MOBILE_MENU_ID = 'mobile-menu';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();
  const toggleRef = useRef(null);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      // Focus inside the menu would be left on a hidden element; return it to the toggle.
      if (document.getElementById(MOBILE_MENU_ID)?.contains(document.activeElement)) {
        toggleRef.current?.focus();
      }
      setMenuOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas">
      {/* Brand, links, and Sign out keep their natural width; only the signed-in name may
          shrink (it truncates), so labels never wrap or squeeze into each other. */}
      <Container className="flex h-16 items-center justify-between gap-4">
        <BrandLink onClick={closeMenu} className="shrink-0" animateMark={OPENED_ON_LANDING} />

        <div className="hidden shrink-0 lg:block">
          <MainNav />
        </div>

        <div className="hidden min-w-0 lg:flex lg:justify-end">
          <AuthActions />
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg text-slate-800 hover:bg-canvas-muted lg:hidden"
          aria-expanded={menuOpen}
          aria-controls={MOBILE_MENU_ID}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
          <span className="sr-only">{menuOpen ? t('layout.closeMenu') : t('layout.openMenu')}</span>
        </button>
      </Container>

      <div id={MOBILE_MENU_ID} hidden={!menuOpen} className="border-t border-line bg-canvas lg:hidden">
        <Container className="space-y-4 py-4">
          <MainNav orientation="vertical" onNavigate={closeMenu} />
          <div className="border-t border-line pt-4">
            <AuthActions stacked onNavigate={closeMenu} />
          </div>
        </Container>
      </div>
    </header>
  );
}
