import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
  // Les tests du handler utilisent une fausse API VS Code.
  resolve: { alias: { vscode: resolve(__dirname, 'tests/fake-vscode.ts') } },
});
