import { createRoot } from 'react-dom/client';
import App from './app';
import { StrictMode } from 'react';

// biome-ignore lint/style/noNonNullAssertion: just because
const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
