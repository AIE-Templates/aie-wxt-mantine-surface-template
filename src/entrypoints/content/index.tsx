import { defineContentScript } from '#imports';
import contentCss from 'virtual:surface-css';
import { createShadowSurfaceUi } from '@/surface/shadow';
import ContentApp from '@/react-app/apps/content/App';
import { renderSurfaceApp } from '@/react-app/bootstrap';
import { SHADOW_SURFACE_TAG } from '@/constants';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  cssInjectionMode: 'manual',
  async main(ctx) {
    const ui = await createShadowSurfaceUi(ctx, {
      name: SHADOW_SURFACE_TAG,
      css: contentCss,
      onMount: (container, env) => {
        const controller = new AbortController();
        const app = renderSurfaceApp(container, env, <ContentApp />, { signal: controller.signal });
        app.catch((error) => console.warn('[content] failed to render the surface', error));
        return { app, controller };
      },
      onRemove: (mounted) => {
        // Cancel an in-flight hydration before it creates a React root, and
        // unmount once any already-created root settles (failed renders logged above).
        mounted?.controller.abort();
        void mounted?.app.then(
          (root) => root?.unmount(),
          () => {}
        );
      },
    });
    if (ctx.isInvalid) return;
    ui.mount();
  },
});
