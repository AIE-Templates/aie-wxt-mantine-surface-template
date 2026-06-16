import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';
import autoImports from './.wxt/eslint-auto-imports.mjs';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '.output/**',
      '.wxt/**',
      'public/**',
      // vendored third-party test fixtures (tw3-play.js)
      'test-pages/**',
    ],
  },
  autoImports,
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    // Register the plugin object explicitly and take only its rules —
    // robust against the plugin's prepackaged-config format (flat vs
    // legacy) shifting between versions.
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Downgrade from the recommended 'error' to 'warn': the template itself is
      // any-free, but downstream code should be able to prototype with `any`
      // without breaking the build.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Off for downstream comfort: the common `interface Props extends Base {}`
      // (extend with nothing added) pattern trips this rule. The template never
      // triggers it.
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Surface isomorphism guard: UI code must not assume its mount point.
    // document.body / document.documentElement differ per surface (popup vs
    // shadow DOM) — always go through useSurface(). The surface/ kernel and
    // entrypoints are exempt (they BUILD the env).
    files: ['src/react-app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='document'][property.name='body']",
          message: 'Surface UI must not assume its mount point — use useSurface().portalTarget instead.',
        },
        {
          selector: "MemberExpression[object.name='document'][property.name='documentElement']",
          message: 'Surface UI must not assume its mount point — use useSurface().rootElement instead.',
        },
      ],
    },
  },
  eslintConfigPrettier
);
