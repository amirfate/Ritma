import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Base ESLint flat config for every TypeScript package in the Ritma workspace.
 *
 * Type-aware rules only apply to `*.ts` / `*.tsx` files so that plain
 * JavaScript config files (eslint.config.mjs, prettier.config.mjs, ...)
 * can be linted without a TypeScript project.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.turbo/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommendedTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  prettier,
);
