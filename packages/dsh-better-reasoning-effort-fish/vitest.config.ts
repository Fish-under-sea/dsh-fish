import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // One React instance for JSX and react-dom/client in every test file.
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.spec.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
