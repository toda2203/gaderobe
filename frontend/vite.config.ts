import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')
  
  // Get host configuration from environment variables
  const appHost = env.VITE_APP_HOST || 'localhost'
  const frontendPort = parseInt(env.VITE_FRONTEND_PORT || '3078')
  const backendPort = env.VITE_BACKEND_PORT || '3077'

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
      https: hasSSL ? {
        // Use Buffer for pfx and avoid boolean union typing issues
        pfx: fs.readFileSync(certPath),
        passphrase: 'password123',
      } : undefined,
      host: '0.0.0.0',
      port: frontendPort,
      allowedHosts: ['localhost', appHost, '127.0.0.1'],
      proxy: {
        '/api': {
          target: `https://${appHost}:${backendPort}`,
          changeOrigin: true,
          rewrite: (path) => path,
          secure: false,  // Accept self-signed certificates
        },
        '/uploads': {
          target: `https://${appHost}:${backendPort}`,
          changeOrigin: true,
          rewrite: (path) => path,
          secure: false,  // Accept self-signed certificates
        },
      },
    },
  };
});
