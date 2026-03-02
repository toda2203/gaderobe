import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')
  
  // Get host configuration from environment variables
  // Feste Ports für Entwicklung (Frontend: 3078, Backend: 3077)
  // Für andere Umgebungen ggf. Umgebungsvariablen anpassen
  const appHost = env.VITE_APP_HOST || 'localhost'
  const frontendPort = 3078;
  const backendPort = 3077;

  // Check if SSL certificates exist
  const certPath = path.resolve(__dirname, 'cert.pfx');
  const hasSSL = fs.existsSync(certPath);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@services': path.resolve(__dirname, './src/services'),
        '@store': path.resolve(__dirname, './src/store'),
        '@types': path.resolve(__dirname, './src/types'),
        '@utils': path.resolve(__dirname, './src/utils'),
      },
    },
    server: {
      // Für Entwicklung: HTTP verwenden, kein SSL, kein Nginx nötig
      // Für Produktion: Unten stehende Zeilen wieder auf HTTPS ändern!
      // ---
      // https: hasSSL ? {
      //   pfx: fs.readFileSync(certPath),
      //   passphrase: 'password123',
      // } : undefined,
      host: '0.0.0.0',
      port: frontendPort,
      allowedHosts: ['localhost', appHost, '127.0.0.1'],
      proxy: {
        // Proxy für API- und Upload-Requests im Dev-Modus
        '/api': {
          target: `http://localhost:3077`,
          changeOrigin: true,
          rewrite: (path) => path,
        },
        '/uploads': {
          target: `http://localhost:3077`,
          changeOrigin: true,
          rewrite: (path) => path,
        },
      },
    },
  };
});
