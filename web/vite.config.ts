import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 5174 para no chocar con la PWA (5173) si se levantan las dos a la vez.
  server: { port: 5174 },
});
