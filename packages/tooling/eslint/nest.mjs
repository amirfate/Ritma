import globals from 'globals';
import tseslint from 'typescript-eslint';

import base from './base.mjs';

/**
 * ESLint flat config for NestJS applications.
 *
 * Extends the workspace base config with decorator-friendly rules and
 * Jest globals for spec files.
 */
export default tseslint.config(
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
      // Nest resolves dependencies from parameter decorators at runtime;
      // classes and empty modules are part of its programming model.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      // Supertest assertions return floating promise-like values by design.
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
