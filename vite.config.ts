import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// When launched by the Tauri CLI, TAURI_ENV_PLATFORM is set. In that case we
// pin the dev server to a fixed port so the Rust shell can load it, and stop
// Vite from clearing the screen so Cargo output stays visible. Outside Tauri
// (e.g. the web preview) Vite keeps its default auto-selected port.
const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  plugins: [react()],
  clearScreen: !isTauri,
  server: isTauri
    ? { port: 1420, strictPort: true, host: process.env.TAURI_DEV_HOST || false }
    : undefined,
  // Tauri reads these env vars; exposing the prefix keeps builds warning-free.
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', include: ['src/**/*.test.ts?(x)'] },
});
