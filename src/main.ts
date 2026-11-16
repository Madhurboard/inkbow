/** Entry point: fonts and styles, then the game, then the app shell (loader, error bar, offline cache). */
import '@fontsource/kaushan-script/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/700.css';
import './styles.css';

const showError = () => {
  const bar = document.getElementById('err');
  if (bar) bar.style.display = 'block';
};
window.addEventListener('error', showError);
window.addEventListener('unhandledrejection', showError);

const hideLoader = () => document.getElementById('loader')?.classList.add('done');

import('./app')
  .then(({ startApp }) => {
    startApp();
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    void Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 2500))]).then(() =>
      requestAnimationFrame(hideLoader),
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    hideLoader();
    showError();
  });

// Offline support: once loaded, hand the service worker the files this page used.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      const urls = [
        '/',
        ...performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) => url.startsWith(location.origin)),
      ];
      registration.active?.postMessage({ cache: urls });
    } catch {
      // Offline play is optional.
    }
  });
}
