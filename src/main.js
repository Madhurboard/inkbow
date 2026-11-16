// Entry point: fonts, styles, the game, then the app shell (loader, error bar, offline cache).
import '@fontsource/kaushan-script/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/700.css';
import './styles.css';

const fail = () => { const e = document.getElementById('err'); if (e) e.style.display = 'block'; };
window.addEventListener('error', fail);
window.addEventListener('unhandledrejection', fail);

const hideLoader = () => document.getElementById('loader').classList.add('done');
import('./game.js').then(() => {
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(r => setTimeout(r, 2500))]).then(() => requestAnimationFrame(hideLoader));
}, e => { console.error(e); hideLoader(); fail(); });

// Offline support: once the page has loaded, hand the service worker the files it used.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;
      const urls = ['/', ...performance.getEntriesByType('resource').map(r => r.name).filter(u => u.startsWith(location.origin))];
      reg.active && reg.active.postMessage({ cache: urls });
    } catch (e) { /* offline play is optional */ }
  });
}
