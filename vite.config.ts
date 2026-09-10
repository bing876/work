import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 浏览器只访问同源 /api,/health,由 Vite 转发给本机后端。
  // 这样预览环境下也不会出现"浏览器直连 localhost"的问题。
  server: { allowedHosts: true, proxy: { '/api': 'http://127.0.0.1:3001', '/health': 'http://127.0.0.1:3001' } },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', include: ['src/**/*.test.ts?(x)'] },
});
