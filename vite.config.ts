import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// UI-ul rulează sub calea de ingress: doar URL-uri relative (base './').
const backend = 'http://127.0.0.1:8099';
export default defineConfig({
  root: 'ui',
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': {
        target: backend.replace('http', 'ws'),
        ws: true,
        changeOrigin: true,
        // Serverul Vena verifică Origin (anti CSWSH). Aici verificăm originea paginii Vite
        // și abia apoi o rescriem către backend; altfel orice site ar trece prin acest proxy.
        configure(proxy) {
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            const ok = /^http:\/\/(127\.0\.0\.1|localhost):5173$/.test(req.headers.origin ?? '');
            if (!ok) return socket.destroy();
            proxyReq.setHeader('origin', backend);
          });
        },
      },
      '/config': { target: backend, changeOrigin: true },
      '/camera': { target: backend, changeOrigin: true },
      '/tts': { target: backend, changeOrigin: true },
    },
  },
});
