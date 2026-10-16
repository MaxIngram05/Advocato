import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { composeUi } from './compose';

const { gateway, clock } = composeUi();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App gateway={gateway} clock={clock} />
  </StrictMode>,
);
