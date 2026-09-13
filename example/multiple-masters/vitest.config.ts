import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['violation/test/**/*.test.ts', 'fixed/test/**/*.test.ts'],
  },
});
