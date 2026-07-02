import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    watch: {
      ignored: [
        '**/backend/venv/**',
        '**/backend/__pycache__/**',
        '**/.venv/**'
      ]
    }
  }
});
