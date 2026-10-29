import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'server/**/*.test.ts', 'services/web/src/**/*.test.ts'],
    coverage: { reporter: ['text'] },
  },
  resolve: {
    alias: { '@lightfield/shared': new URL('./packages/shared/src/index.ts', import.meta.url).pathname },
  },
});
