import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [cloudflare(), react()]
});
