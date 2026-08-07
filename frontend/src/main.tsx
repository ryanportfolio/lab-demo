import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './workspace.css';

declare global {
  interface Window {
    __capture: { freeze(): void; thaw(): void };
  }
}
window.__capture = {
  freeze() {
    document.documentElement.classList.add('no-anim');
  },
  thaw() {
    document.documentElement.classList.remove('no-anim');
  },
};

const q = new URLSearchParams(location.search);
if (
  q.get('noanim') === '1' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches
) {
  document.documentElement.classList.add('no-anim');
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
