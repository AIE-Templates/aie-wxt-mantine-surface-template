import path from 'node:path';
import { defineConfig, type WxtViteConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import toUtf8 from './vite-plugins/to-utf8';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () =>
    ({
      // to-utf8 keeps emitted chunks pure-ASCII so Chrome never rejects a
      // script as non-UTF-8 once the bundle contains CJK/emoji (wxt#353).
      plugins: [tailwindcss(), toUtf8()],
      css: {
        preprocessorOptions: {
          scss: {
            api: 'modern-compiler',
            // Expose Mantine breakpoint/scheme mixins to every .scss module as `mantine.*`
            additionalData: `@use "${path
              .join(process.cwd(), 'src/react-app/styles/_mantine')
              .replace(/\\/g, '/')}" as mantine;`,
          },
        },
      },
    }) as WxtViteConfig,
  imports: {
    // Generate the auto-import globals file in ESLint 9 (flat-config) format —
    // consumed by eslint.config.mjs so lint knows WXT's auto-imported names.
    eslintrc: {
      enabled: 9,
    },
  },
  dev: {
    server: {
      port: 3012,
    },
  },
  webExt: {
    // NOTE: do NOT add --remote-debugging-port here — web-ext-run drives Chrome
    // over its own CDP pipe and an explicit port breaks Extensions.loadUnpacked.
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
  // Function-form manifest so it can read env vars: `.env` is not loaded yet
  // when this config module is first evaluated (https://wxt.dev/guide/essentials/config/environment-variables).
  manifest: () => ({
    name: 'AIE Surface Template',
    permissions: ['storage'],
    // Stable extension ID via the `key` field. Set WXT_EXTENSION_KEY in `.env`
    // (see .env.example) — never hardcode it. Omitted from the manifest when unset.
    ...(import.meta.env.WXT_EXTENSION_KEY ? { key: import.meta.env.WXT_EXTENSION_KEY } : {}),
  }),
});
