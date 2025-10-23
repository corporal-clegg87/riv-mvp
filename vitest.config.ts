import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react() as any],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup/test-setup.ts'],
    globals: true,
    watch: false,
    reporters: ['verbose'],
    // Environment-based test filtering
    include: process.env.NODE_ENV === 'production' 
      ? ['tests/**/*.test.ts', '!tests/lib/email-dev.test.ts']
      : process.env.NODE_ENV === 'development'
      ? ['tests/**/*.test.ts', '!tests/lib/email-integration.test.ts']
      : ['tests/**/*.test.ts'], // Default: run all tests
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
})

