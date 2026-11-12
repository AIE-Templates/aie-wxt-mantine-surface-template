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
      onMount: (container, env) => renderSurfaceApp(container, env, <ContentApp />),
      onRemove: (mounted) => {
        void mounted?.then((root) => root.unmount());
      },
    });
    if (ctx.isInvalid) return;
    ui.mount();
  },
});
