import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';
import { composeDev } from './compose';

const { gateway, clock, extractors } = composeDev(new URLSearchParams(window.location.search));

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App gateway={gateway} clock={clock} extractors={extractors} />
  </StrictMode>,
);
