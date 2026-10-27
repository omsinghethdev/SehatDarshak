import { useCallback, useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import { AuthProvider } from './features/auth/AuthProvider';
import { I18nProvider } from './i18n/I18nProvider';
import { router } from './routes/router';
import IntroAnimation from './components/IntroAnimation';

function App() {
  const [showIntro, setShowIntro] = useState(true);
  const finishIntro = useCallback(() => setShowIntro(false), []);

  return (
    <I18nProvider>
      <AuthProvider>
        {/* The website loads underneath; the intro is uncovered from it, not swapped for it. */}
        <RouterProvider router={router} />
        {showIntro && <IntroAnimation onComplete={finishIntro} />}
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
